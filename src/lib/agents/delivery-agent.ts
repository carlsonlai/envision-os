import { inngest } from '@/lib/inngest'
import { prisma } from '@/lib/db'
import { notify } from '@/services/lark'
import { startRun } from './run'
import { recordDecision, markDecisionResult, markDecisionFailed } from './decision-log'

/**
 * DELIVERY AGENT — Agent #11 (blueprint §4.5)
 *
 * Triggers:  cron every 4 hours  +  'delivery/item.approved' event
 * Reads:     DeliverableItem, FileVersion, WorkloadSlot, Project, User (designers)
 * Writes:    DeliverableItem.assignedDesignerId, DeliverableItem.deadline, Project.status
 *
 * Responsibilities (per blueprint §4.5):
 *  1. Auto-assign PENDING items to designers with available capacity
 *  2. Recompute deadlines for items at revision-limit (buy one more day)
 *  3. Enforce scope caps (alert CS when revisionCount > revisionLimit)
 *  4. Idle-task escalation (IN_PROGRESS > 72h with no file activity)
 *  5. Daily standup brief to Creative channel (once per day at 08:00)
 *  6. Project promotion (all items DELIVERED/FA_SIGNED → Project COMPLETED)
 *
 * Lark policy: notifications never contain invoice/quotation/pricing/payment/billing
 * keywords — the notify() filter enforces this and titles/bodies are worded to comply.
 */

type DeliveryTrigger = 'cron' | 'event' | 'manual'

interface DeliveryAgentResult {
  runId: string
  assigned: number
  deadlinesAdjusted: number
  scopeCapAlerts: number
  idleEscalations: number
  projectsPromoted: number
  standupSent: boolean
}

// Production-capable designer roles (CDs + SADs are reviewers, excluded from auto-assign)
const ASSIGNABLE_ROLES = [
  'GRAPHIC_DESIGNER',
  'JUNIOR_DESIGNER',
  'JUNIOR_ART_DIRECTOR',
  'DESIGNER_3D',
  'MULTIMEDIA_DESIGNER',
] as const

interface DesignerCapacity {
  userId: string
  name: string
  committedMinutes: number
  capacityMinutes: number
  activeCount: number
}

function startOfDay(d: Date): Date {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export async function runDeliveryAgent(
  opts: { triggerKind: DeliveryTrigger; triggerRef?: string } = { triggerKind: 'manual' },
): Promise<DeliveryAgentResult> {
  const run = await startRun({ agent: 'DELIVERY_AGENT', triggerKind: opts.triggerKind, triggerRef: opts.triggerRef })
  if (run.skipped) {
    return {
      runId: run.id,
      assigned: 0,
      deadlinesAdjusted: 0,
      scopeCapAlerts: 0,
      idleEscalations: 0,
      projectsPromoted: 0,
      standupSent: false,
    }
  }

  let assigned = 0
  let deadlinesAdjusted = 0
  let scopeCapAlerts = 0
  let idleEscalations = 0
  let projectsPromoted = 0
  let standupSent = false

  try {
    const now = new Date()
    const today = startOfDay(now)

    // ── 1. AUTO-ASSIGN PENDING ITEMS ──────────────────────────────────────
    const unassigned = await prisma.deliverableItem.findMany({
      where: { status: 'PENDING', assignedDesignerId: null },
      orderBy: [{ deadline: 'asc' }, { createdAt: 'asc' }],
      take: 30,
    })

    if (unassigned.length > 0) {
      const designers = await prisma.user.findMany({
        where: { role: { in: [...ASSIGNABLE_ROLES] } },
        select: { id: true, name: true },
      })

      const designerIds = designers.map((d) => d.id)
      const slots = designerIds.length > 0
        ? await prisma.workloadSlot.findMany({
            where: { userId: { in: designerIds }, date: today },
          })
        : []
      const slotMap = new Map(slots.map((s) => [s.userId, s]))

      const activeCounts = designerIds.length > 0
        ? await prisma.deliverableItem.groupBy({
            by: ['assignedDesignerId'],
            where: {
              assignedDesignerId: { in: designerIds },
              status: { in: ['IN_PROGRESS', 'WIP_UPLOADED', 'QC_REVIEW'] },
            },
            _count: { _all: true },
          })
        : []
      const activeMap = new Map<string, number>()
      for (const c of activeCounts) {
        if (c.assignedDesignerId) activeMap.set(c.assignedDesignerId, c._count._all)
      }

      const capacities: DesignerCapacity[] = designers.map((d) => {
        const slot = slotMap.get(d.id)
        return {
          userId: d.id,
          name: d.name ?? d.id.slice(0, 8),
          committedMinutes: slot?.committedMinutes ?? 0,
          capacityMinutes: slot?.capacityMinutes ?? 480,
          activeCount: activeMap.get(d.id) ?? 0,
        }
      })

      for (const item of unassigned) {
        const cost = item.estimatedMinutes ?? 120 // default 2h if unknown
        const candidates = capacities
          .filter((c) => c.committedMinutes + cost <= c.capacityMinutes)
          .sort((a, b) => {
            const availA = a.capacityMinutes - a.committedMinutes
            const availB = b.capacityMinutes - b.committedMinutes
            if (availB !== availA) return availB - availA
            return a.activeCount - b.activeCount
          })

        if (candidates.length === 0) continue
        const target = candidates[0]

        const decision = await recordDecision({
          runId: run.id,
          agent: 'DELIVERY_AGENT',
          action: 'auto_assign_item',
          rationale: `Assign "${item.description ?? item.id.slice(0, 8)}" (${cost}m) → ${target.name} (${target.capacityMinutes - target.committedMinutes}m free, ${target.activeCount} active)`,
          confidence: 0.78,
          entityType: 'DeliverableItem',
          entityId: item.id,
          proposedChange: { assignedDesignerId: target.userId, estimatedMinutes: cost },
        })

        if (decision.status === 'AUTO_EXECUTED') {
          try {
            await prisma.$transaction([
              prisma.deliverableItem.update({
                where: { id: item.id },
                data: { assignedDesignerId: target.userId, status: 'IN_PROGRESS' },
              }),
              prisma.workloadSlot.upsert({
                where: { userId_date: { userId: target.userId, date: today } },
                create: {
                  userId: target.userId,
                  date: today,
                  committedMinutes: cost,
                  capacityMinutes: target.capacityMinutes,
                },
                update: { committedMinutes: { increment: cost } },
              }),
            ])
            target.committedMinutes += cost
            target.activeCount += 1
            await markDecisionResult(decision.id, { assignedTo: target.userId })
            assigned++
          } catch (error: unknown) {
            await markDecisionFailed(decision.id, error)
          }
        }
      }
    }

    // ── 2. DEADLINE RECOMPUTE (items at revision cap) ─────────────────────
    const atCap = await prisma.deliverableItem.findMany({
      where: {
        status: { in: ['IN_PROGRESS', 'WIP_UPLOADED'] },
        deadline: { not: null },
      },
      select: {
        id: true,
        description: true,
        deadline: true,
        revisionCount: true,
        revisionLimit: true,
        projectId: true,
      },
      take: 100,
    })

    for (const item of atCap) {
      if (!item.deadline) continue
      if (item.revisionCount !== item.revisionLimit) continue
      // Only extend if deadline is within next 48h
      const msUntilDeadline = item.deadline.getTime() - now.getTime()
      if (msUntilDeadline < 0 || msUntilDeadline > 48 * 60 * 60 * 1000) continue

      const newDeadline = new Date(item.deadline.getTime() + 24 * 60 * 60 * 1000)
      const decision = await recordDecision({
        runId: run.id,
        agent: 'DELIVERY_AGENT',
        action: 'extend_deadline_at_cap',
        rationale: `"${item.description ?? item.id.slice(0, 8)}" at revision cap (${item.revisionCount}/${item.revisionLimit}) — extend deadline by 24h`,
        confidence: 0.72,
        entityType: 'DeliverableItem',
        entityId: item.id,
        proposedChange: { deadline: newDeadline.toISOString(), previousDeadline: item.deadline.toISOString() },
      })

      if (decision.status === 'AUTO_EXECUTED') {
        try {
          await prisma.deliverableItem.update({
            where: { id: item.id },
            data: { deadline: newDeadline },
          })
          await markDecisionResult(decision.id, { newDeadline: newDeadline.toISOString() })
          deadlinesAdjusted++
        } catch (error: unknown) {
          await markDecisionFailed(decision.id, error)
        }
      }
    }

    // ── 3. SCOPE-CAP ENFORCEMENT (revisionCount > revisionLimit) ──────────
    const overScope = await prisma.deliverableItem.findMany({
      where: {
        status: { in: ['IN_PROGRESS', 'WIP_UPLOADED', 'QC_REVIEW'] },
      },
      select: {
        id: true,
        description: true,
        revisionCount: true,
        revisionLimit: true,
        projectId: true,
      },
      take: 100,
    })

    const overScopeItems = overScope.filter((i) => i.revisionCount > i.revisionLimit)
    if (overScopeItems.length > 0) {
      const pids = [...new Set(overScopeItems.map((i) => i.projectId))]
      const projs = await prisma.project.findMany({
        where: { id: { in: pids } },
        select: { id: true, code: true },
      })
      const codeByProject = new Map(projs.map((p) => [p.id, p.code]))

      for (const item of overScopeItems) {
        const decision = await recordDecision({
          runId: run.id,
          agent: 'DELIVERY_AGENT',
          action: 'alert_scope_cap_exceeded',
          rationale: `"${item.description ?? item.id.slice(0, 8)}" (${codeByProject.get(item.projectId) ?? '?'}) revision count ${item.revisionCount} exceeds limit ${item.revisionLimit}`,
          confidence: 0.9,
          entityType: 'DeliverableItem',
          entityId: item.id,
          proposedChange: {
            alert: true,
            revisionCount: item.revisionCount,
            revisionLimit: item.revisionLimit,
          },
        })

        if (decision.status === 'AUTO_EXECUTED') {
          try {
            await notify('CS', {
              title: `Scope check — ${codeByProject.get(item.projectId) ?? 'item'} at revision cap`,
              body: `The deliverable "${item.description ?? item.id.slice(0, 8)}" has used ${item.revisionCount} of ${item.revisionLimit} revisions. Please review with the client before proceeding with further changes.`,
              projectCode: codeByProject.get(item.projectId),
              actionLabel: 'Open item',
              actionUrl: `/admin/projects/${item.projectId}`,
            })
            await markDecisionResult(decision.id, { alerted: true })
            scopeCapAlerts++
          } catch (error: unknown) {
            await markDecisionFailed(decision.id, error)
          }
        }
      }
    }

    // ── 4. IDLE-TASK ESCALATION (IN_PROGRESS > 72h, no recent file) ───────
    const activeItems = await prisma.deliverableItem.findMany({
      where: { status: 'IN_PROGRESS' },
      select: {
        id: true,
        description: true,
        projectId: true,
        createdAt: true,
        assignedDesignerId: true,
      },
      take: 100,
    })

    if (activeItems.length > 0) {
      const activeIds = activeItems.map((i) => i.id)
      const latestFiles = await prisma.fileVersion.findMany({
        where: { deliverableItemId: { in: activeIds } },
        orderBy: { createdAt: 'desc' },
      })
      const lastFileByItem = new Map<string, Date>()
      for (const fv of latestFiles) {
        if (!lastFileByItem.has(fv.deliverableItemId)) {
          lastFileByItem.set(fv.deliverableItemId, fv.createdAt)
        }
      }

      const idleCutoff = now.getTime() - 72 * 60 * 60 * 1000
      const projCodes = await prisma.project.findMany({
        where: { id: { in: [...new Set(activeItems.map((i) => i.projectId))] } },
        select: { id: true, code: true },
      })
      const codeMap = new Map(projCodes.map((p) => [p.id, p.code]))

      for (const item of activeItems) {
        const lastActivity = lastFileByItem.get(item.id)?.getTime() ?? item.createdAt.getTime()
        if (lastActivity >= idleCutoff) continue

        const hoursIdle = Math.round((now.getTime() - lastActivity) / 3600000)
        const decision = await recordDecision({
          runId: run.id,
          agent: 'DELIVERY_AGENT',
          action: 'escalate_idle_item',
          rationale: `"${item.description ?? item.id.slice(0, 8)}" (${codeMap.get(item.projectId) ?? '?'}) has been IN_PROGRESS with no file activity for ${hoursIdle}h`,
          confidence: 0.85,
          entityType: 'DeliverableItem',
          entityId: item.id,
          proposedChange: { escalate: true, hoursIdle },
        })

        if (decision.status === 'AUTO_EXECUTED') {
          try {
            await notify('CREATIVE', {
              title: `Idle deliverable — ${codeMap.get(item.projectId) ?? 'item'}`,
              body: `"${item.description ?? item.id.slice(0, 8)}" has had no file upload for ${hoursIdle}h. Please check in with the assigned designer.`,
              projectCode: codeMap.get(item.projectId),
              actionLabel: 'Open project',
              actionUrl: `/admin/projects/${item.projectId}`,
            })
            await markDecisionResult(decision.id, { escalated: true })
            idleEscalations++
          } catch (error: unknown) {
            await markDecisionFailed(decision.id, error)
          }
        }
      }
    }

    // ── 5. DAILY STANDUP BRIEF (08:00 cron only) ──────────────────────────
    if (opts.triggerKind === 'cron' && now.getHours() === 8) {
      const decision = await recordDecision({
        runId: run.id,
        agent: 'DELIVERY_AGENT',
        action: 'send_daily_standup',
        rationale: `Daily standup brief — ${now.toISOString().slice(0, 10)}`,
        confidence: 0.95,
        entityType: 'Org',
      })

      if (decision.status === 'AUTO_EXECUTED') {
        try {
          const activeByDesigner = await prisma.deliverableItem.groupBy({
            by: ['assignedDesignerId'],
            where: {
              status: { in: ['IN_PROGRESS', 'WIP_UPLOADED', 'QC_REVIEW'] },
              assignedDesignerId: { not: null },
            },
            _count: { _all: true },
          })

          const overdueCount = await prisma.deliverableItem.count({
            where: {
              status: { in: ['IN_PROGRESS', 'WIP_UPLOADED', 'QC_REVIEW'] },
              deadline: { lt: now },
            },
          })

          const dueTodayCount = await prisma.deliverableItem.count({
            where: {
              status: { in: ['IN_PROGRESS', 'WIP_UPLOADED'] },
              deadline: {
                gte: today,
                lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
              },
            },
          })

          const designerMap = activeByDesigner.filter((g) => g.assignedDesignerId)
          const designerIdList = designerMap.map((g) => g.assignedDesignerId as string)
          const designerNames = designerIdList.length > 0
            ? await prisma.user.findMany({
                where: { id: { in: designerIdList } },
                select: { id: true, name: true },
              })
            : []
          const nameById = new Map(designerNames.map((u) => [u.id, u.name ?? u.id.slice(0, 8)]))

          const perDesigner = designerMap
            .map((g) => `- ${nameById.get(g.assignedDesignerId as string) ?? '?'}: ${g._count._all} active`)
            .sort()
            .join('\n')

          const body = [
            `Active work across the studio today:`,
            perDesigner || '- (no active items)',
            ``,
            `Due today: ${dueTodayCount}`,
            `Overdue: ${overdueCount}`,
          ].join('\n')

          await notify('CREATIVE', {
            title: `Daily standup — ${now.toISOString().slice(0, 10)}`,
            body,
            actionLabel: 'Open dashboard',
            actionUrl: `/admin`,
          })
          await markDecisionResult(decision.id, { sent: true })
          standupSent = true
        } catch (error: unknown) {
          await markDecisionFailed(decision.id, error)
        }
      }
    }

    // ── 6. PROJECT PROMOTION (all items delivered → COMPLETED) ────────────
    const candidates = await prisma.project.findMany({
      where: { status: 'ONGOING' },
      select: {
        id: true,
        code: true,
        deliverableItems: { select: { status: true } },
      },
      take: 50,
    })

    for (const proj of candidates) {
      if (proj.deliverableItems.length === 0) continue
      const allDone = proj.deliverableItems.every(
        (d) => d.status === 'DELIVERED' || d.status === 'FA_SIGNED',
      )
      if (!allDone) continue

      const decision = await recordDecision({
        runId: run.id,
        agent: 'DELIVERY_AGENT',
        action: 'promote_project_completed',
        rationale: `Project ${proj.code} — all ${proj.deliverableItems.length} items delivered`,
        confidence: 0.95,
        entityType: 'Project',
        entityId: proj.id,
        proposedChange: { status: 'COMPLETED' },
      })

      if (decision.status === 'AUTO_EXECUTED') {
        try {
          await prisma.project.update({
            where: { id: proj.id },
            data: { status: 'COMPLETED' },
          })
          await markDecisionResult(decision.id, { promoted: true })
          projectsPromoted++
        } catch (error: unknown) {
          await markDecisionFailed(decision.id, error)
        }
      }
    }

    const summary = [
      `${assigned} assigned`,
      `${deadlinesAdjusted} deadlines extended`,
      `${scopeCapAlerts} scope alerts`,
      `${idleEscalations} idle escalations`,
      `${projectsPromoted} projects promoted`,
      standupSent ? 'standup sent' : 'no standup',
    ].join(', ')

    await run.finish(summary)

    return {
      runId: run.id,
      assigned,
      deadlinesAdjusted,
      scopeCapAlerts,
      idleEscalations,
      projectsPromoted,
      standupSent,
    }
  } catch (error: unknown) {
    await run.fail(error)
    throw error
  }
}

export const deliveryAgentFn = inngest.createFunction(
  {
    id: 'delivery-agent',
    name: 'Delivery Agent — orchestrate production',
    triggers: [
      { cron: '0 */4 * * *' },
      { event: 'delivery/item.approved' },
    ],
  },
  async ({ event, step }) => {
    const triggerKind: DeliveryTrigger =
      event.name === 'delivery/item.approved' ? 'event' : 'cron'
    return step.run('run-delivery-agent', () =>
      runDeliveryAgent({ triggerKind, triggerRef: event.id ?? event.name }),
    )
  },
)
