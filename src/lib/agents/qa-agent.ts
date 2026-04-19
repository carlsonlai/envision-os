import { inngest } from '@/lib/inngest'
import { prisma } from '@/lib/db'
import { notify } from '@/services/lark'
import { startRun } from './run'
import { recordDecision, markDecisionResult, markDecisionFailed } from './decision-log'
import { summariseQaChecks } from './qa-validators'

/**
 * QA AGENT — Agent #10 (upgraded)
 *
 * Triggers:  cron every 2 hours  +  'qa/deliverable.uploaded' event
 * Reads:     DeliverableItems (QC_REVIEW), QCChecks, FileVersions
 * Writes:    QCCheck records, DeliverableItem.status
 *
 * Actions:
 *  1. Items in QC_REVIEW with a new file version → run auto-grading:
 *       - validate file-type against itemType (extension whitelist)
 *       - heuristic brand-check (size bounds + filename convention)
 *       - record QCCheck with passed=true when both checks pass,
 *         else passed=false with explanatory notes
 *  2. When auto-graded passed → record promote_item_approved decision and
 *     (if auto-executed) push DeliverableItem.status → APPROVED plus a
 *     CREATIVE Lark notify.
 *  3. Items with revisionCount ≥ revisionLimit → flag as over-revised
 *  4. Items in QC_REVIEW > 48h with no QC → escalate
 */

interface QaAgentResult {
  runId: string
  checksCreated: number
  autoPassed: number
  flagged: number
}

export async function runQaAgent(
  opts: { triggerKind: 'cron' | 'event' | 'manual'; triggerRef?: string } = { triggerKind: 'manual' },
): Promise<QaAgentResult> {
  const run = await startRun({ agent: 'QA_AGENT', triggerKind: opts.triggerKind, triggerRef: opts.triggerRef })
  if (run.skipped) return { runId: run.id, checksCreated: 0, autoPassed: 0, flagged: 0 }

  try {
    // ── Step 1: Items needing QC check ────────────────────────────────────
    const reviewItems = await prisma.deliverableItem.findMany({
      where: { status: 'QC_REVIEW' },
      take: 50,
    })

    const reviewIds = reviewItems.map((i) => i.id)
    const fileVersions = reviewIds.length > 0
      ? await prisma.fileVersion.findMany({
          where: { deliverableItemId: { in: reviewIds } },
          orderBy: { version: 'desc' },
        })
      : []
    const qcChecks = reviewIds.length > 0
      ? await prisma.qCCheck.findMany({
          where: { deliverableItemId: { in: reviewIds } },
          orderBy: { createdAt: 'desc' },
        })
      : []

    const filesByItem = new Map<string, typeof fileVersions>()
    for (const fv of fileVersions) {
      if (!filesByItem.has(fv.deliverableItemId)) filesByItem.set(fv.deliverableItemId, [])
      filesByItem.get(fv.deliverableItemId)!.push(fv)
    }
    const qcByItem = new Map<string, typeof qcChecks>()
    for (const qc of qcChecks) {
      if (!qcByItem.has(qc.deliverableItemId)) qcByItem.set(qc.deliverableItemId, [])
      qcByItem.get(qc.deliverableItemId)!.push(qc)
    }

    // Batch-load project codes once for Lark messaging
    const projectIds = [...new Set(reviewItems.map((i) => i.projectId))]
    const projects = projectIds.length > 0
      ? await prisma.project.findMany({
          where: { id: { in: projectIds } },
          select: { id: true, code: true },
        })
      : []
    const codeByProject = new Map(projects.map((p) => [p.id, p.code]))

    let checksCreated = 0
    let autoPassed = 0
    let flagged = 0
    const now = new Date()

    for (const item of reviewItems) {
      const latestFile = (filesByItem.get(item.id) ?? [])[0]
      const latestQC = (qcByItem.get(item.id) ?? [])[0]

      // If there's a file version newer than the latest QC → auto-grade
      if (latestFile && (!latestQC || latestFile.createdAt > latestQC.createdAt)) {
        const summary = summariseQaChecks({
          filename: latestFile.filename,
          fileSize: latestFile.fileSize,
          itemType: item.itemType,
        })

        const decision = await recordDecision({
          runId: run.id,
          agent: 'QA_AGENT',
          action: 'create_qc_check',
          rationale: summary.autoPass
            ? `"${item.description ?? item.id.slice(0, 8)}" v${latestFile.version} — auto-pass (file-type OK, brand-check PASS_HEURISTIC)`
            : `"${item.description ?? item.id.slice(0, 8)}" v${latestFile.version} — needs human review: ${summary.brand.verdict}, file-type ${summary.fileType.valid ? 'OK' : 'mismatch'}`,
          confidence: summary.autoPass ? 0.92 : 0.86,
          entityType: 'DeliverableItem',
          entityId: item.id,
          proposedChange: {
            fileVersionId: latestFile.id,
            passed: summary.autoPass,
            fileTypeValid: summary.fileType.valid,
            brandVerdict: summary.brand.verdict,
          },
        })

        if (decision.status === 'AUTO_EXECUTED') {
          try {
            await prisma.qCCheck.create({
              data: {
                deliverableItemId: item.id,
                fileVersionId: latestFile.id,
                checkedById: latestFile.uploadedById, // self-check placeholder
                passed: summary.autoPass,
                notes: summary.notes,
              },
            })
            await markDecisionResult(decision.id, {
              created: true,
              autoPass: summary.autoPass,
            })
            checksCreated++
          } catch (error: unknown) {
            await markDecisionFailed(decision.id, error)
            continue
          }

          // If auto-pass eligible, emit a separate promotion decision
          if (summary.autoPass) {
            const promoteDecision = await recordDecision({
              runId: run.id,
              agent: 'QA_AGENT',
              action: 'promote_item_approved',
              rationale: `"${item.description ?? item.id.slice(0, 8)}" v${latestFile.version} cleared auto-QC — promoting to APPROVED`,
              confidence: 0.88,
              entityType: 'DeliverableItem',
              entityId: item.id,
              proposedChange: { status: 'APPROVED', previousStatus: item.status },
            })

            if (promoteDecision.status === 'AUTO_EXECUTED') {
              try {
                await prisma.deliverableItem.update({
                  where: { id: item.id },
                  data: { status: 'APPROVED' },
                })
                await notify('CREATIVE', {
                  title: `Auto-QC passed — ${codeByProject.get(item.projectId) ?? 'item'}`,
                  body: `"${item.description ?? item.id.slice(0, 8)}" v${latestFile.version} passed automated QC and is marked APPROVED. Please confirm with the client.`,
                  projectCode: codeByProject.get(item.projectId),
                  actionLabel: 'Open project',
                  actionUrl: `/admin/projects/${item.projectId}`,
                })
                await markDecisionResult(promoteDecision.id, { promoted: true })
                autoPassed++
              } catch (error: unknown) {
                await markDecisionFailed(promoteDecision.id, error)
              }
            }
          }
        }
      }

      // Over-revised items
      if (item.revisionCount >= item.revisionLimit) {
        const decision = await recordDecision({
          runId: run.id,
          agent: 'QA_AGENT',
          action: 'flag_over_revised',
          rationale: `"${item.description ?? item.id.slice(0, 8)}" — ${item.revisionCount}/${item.revisionLimit} revisions used`,
          confidence: 0.92,
          entityType: 'DeliverableItem',
          entityId: item.id,
          proposedChange: { overRevised: true },
        })
        if (decision.status === 'AUTO_EXECUTED') {
          await markDecisionResult(decision.id, { flagged: true })
          flagged++
        }
      }

      // Stuck in review > 48h with no QC
      const itemAge = now.getTime() - item.createdAt.getTime()
      if (itemAge > 48 * 60 * 60 * 1000 && !latestQC) {
        const decision = await recordDecision({
          runId: run.id,
          agent: 'QA_AGENT',
          action: 'escalate_stale_review',
          rationale: `"${item.description ?? item.id.slice(0, 8)}" in QC_REVIEW > 48h with no QC — escalating`,
          confidence: 0.85,
          entityType: 'DeliverableItem',
          entityId: item.id,
          proposedChange: { escalate: true, hoursInReview: Math.round(itemAge / 3600000) },
        })
        if (decision.status === 'AUTO_EXECUTED') {
          await markDecisionResult(decision.id, { escalated: true })
          flagged++
        }
      }
    }

    await run.finish(
      `Created ${checksCreated} QC checks (${autoPassed} auto-passed), flagged ${flagged} items`,
    )
    return { runId: run.id, checksCreated, autoPassed, flagged }
  } catch (error: unknown) {
    await run.fail(error)
    throw error
  }
}

export const qaAgentFn = inngest.createFunction(
  {
    id: 'qa-agent',
    name: 'QA Agent — auto-grade deliverables',
    triggers: [
      { cron: '0 */2 * * *' },
      { event: 'qa/deliverable.uploaded' },
    ],
  },
  async ({ event, step }) => {
    const triggerKind: 'cron' | 'event' = event.name === 'qa/deliverable.uploaded' ? 'event' : 'cron'
    return step.run('run-qa-agent', () =>
      runQaAgent({ triggerKind, triggerRef: event.id ?? event.name }),
    )
  },
)
