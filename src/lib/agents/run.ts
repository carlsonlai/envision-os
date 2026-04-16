import { prisma } from '@/lib/db'
import type { AgentKind } from '@prisma/client'
import { logger } from '@/lib/logger'
import { runFailsafeChecks } from './failsafe'

export interface StartRunInput {
  agent: AgentKind
  triggerKind: 'cron' | 'event' | 'manual' | 'backfill'
  triggerRef?: string
  skipFailsafe?: boolean  // manual runs may bypass failsafe checks
}

export interface RunHandle {
  id: string
  skipped: boolean        // true if failsafe blocked this run
  finish(summary: string, opts?: { tokensUsed?: number; costCents?: number }): Promise<void>
  fail(error: unknown): Promise<void>
}

/**
 * Open an AgentRun row. Runs failsafe checks first — if they fail, the run
 * is created but immediately marked COMPLETED with a skip summary, and the
 * returned handle has `skipped: true` so the caller can bail early.
 */
export async function startRun(input: StartRunInput): Promise<RunHandle> {
  const run = await prisma.agentRun.create({
    data: {
      agent: input.agent,
      triggerKind: input.triggerKind,
      triggerRef: input.triggerRef,
      status: 'STARTED',
    },
  })
  const startedMs = Date.now()

  // Run failsafe checks (unless explicitly skipped for manual triggers)
  if (!input.skipFailsafe) {
    const check = await runFailsafeChecks(input.agent, run.id)
    if (!check.passed) {
      const skipMsg = `Skipped: failsafe tripped (incidents: ${check.incidents.join(', ')})`
      await prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          finishedAt: new Date(),
          durationMs: Date.now() - startedMs,
          summary: skipMsg,
        },
      })
      logger.warn('agent.run.skipped_failsafe', { agent: input.agent, runId: run.id, incidents: check.incidents })
      return {
        id: run.id,
        skipped: true,
        async finish() { /* no-op — already closed */ },
        async fail() { /* no-op — already closed */ },
      }
    }
  }

  return {
    id: run.id,
    skipped: false,
    async finish(summary, opts) {
      await prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          finishedAt: new Date(),
          durationMs: Date.now() - startedMs,
          tokensUsed: opts?.tokensUsed,
          costCents: opts?.costCents,
          summary,
        },
      })
      logger.info('agent.run.finished', { agent: input.agent, runId: run.id, summary })
    },
    async fail(error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      await prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          durationMs: Date.now() - startedMs,
          error: message,
        },
      })
      logger.error('agent.run.failed', { agent: input.agent, runId: run.id, error: message })
    },
  }
}
