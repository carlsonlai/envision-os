import { inngest } from '@/lib/inngest'
import { prisma } from '@/lib/db'
import { startRun } from './run'
import { recordDecision, markDecisionResult, markDecisionFailed } from './decision-log'
import { getErrorMessage } from '@/lib/logger'

/**
 * QA AGENT — Agent #10
 *
 * Triggers:  cron every 2 hours  +  'qa/deliverable.uploaded' event
 * Reads:     DeliverableItems (IN_REVIEW), QCChecks, FileVersions
 * Writes:    QCCheck records, DeliverableItem.status
 *
 * Actions:
 *  1. Items in IN_REVIEW with a file version but no QC check → auto-create QC
 *  2. Items with revisionCount ≥ revisionLimit → flag as over-revised
 *  3. Items in IN_REVIEW for > 48h → escalate to CD
 */

export async function runQaAgent(
  opts: { triggerKind: 'cron' | 'event' | 'manual'; triggerRef?: string } = { triggerKind: 'manual' },
): Promise<{ runId: string; checksCreated: number; flagged: number }> {
  const run = await startRun({ agent: 'QA_AGENT', triggerKind: opts.triggerKind, triggerRef: opts.triggerRef })

  try {
    // ── Step 1: Items needing QC check ────────────────────────────────────
    // Fetch review items, then batch-load file versions and QC checks
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

    let checksCreated = 0
    let flagged = 0
    const now = new Date()

    for (const item of reviewItems) {
      const latestFile = (filesByItem.get(item.id) ?? [])[0]
      const latestQC = (qcByItem.get(item.id) ?? [])[0]

      // If there's a file version newer than the latest QC → create a new QC entry
      if (latestFile && (!latestQC || latestFile.createdAt > latestQC.createdAt)) {
        const decision = await recordDecision({
          runId: run.id,
          agent: 'QA_AGENT',
          action: 'create_qc_check',
          rationale: `"${item.description ?? item.id.slice(0, 8)}" v${latestFile.version} uploaded — QC needed`,
          confidence: 0.88,
          entityType: 'DeliverableItem',
          entityId: item.id,
          proposedChange: { fileVersionId: latestFile.id, autoQC: true },
        })

        if (decision.status === 'AUTO_EXECUTED') {
          try {
            await prisma.qCCheck.create({
              data: {
                deliverableItemId: item.id,
                fileVersionId: latestFile.id,
                checkedById: latestFile.uploadedById, // self-check placeholder
                passed: false,
                notes: 'Auto-created by QA Agent — awaiting manual review',
              },
            })
            await markDecisionResult(decision.id, { created: true })
            checksCreated++
          } catch (error: unknown) {
            await markDecisionFailed(decision.id, error)
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

      // Stuck in review > 48h
      const itemAge = now.getTime() - item.createdAt.getTime()
      if (itemAge > 48 * 60 * 60 * 1000 && !latestQC) {
        const decision = await recordDecision({
          runId: run.id,
          agent: 'QA_AGENT',
          action: 'escalate_stale_review',
          rationale: `"${item.description ?? item.id.slice(0, 8)}" in IN_REVIEW > 48h with no QC — escalating`,
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

    await run.finish(`Created ${checksCreated} QC checks, flagged ${flagged} items`)
    return { runId: run.id, checksCreated, flagged }
  } catch (error: unknown) {
    await run.fail(error)
    throw error
  }
}

export const qaAgentFn = inngest.createFunction(
  {
    id: 'qa-agent',
    name: 'QA Agent — review deliverables',
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
