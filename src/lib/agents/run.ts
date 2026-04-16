import { prisma } from '@/lib/db'
import type { AgentKind } from '@prisma/client'
import { logger } from '@/lib/logger'

export interface StartRunInput {
  agent: AgentKind
  triggerKind: 'cron' | 'event' | 'manual' | 'backfill'
  triggerRef?: string
}

export interface RunHandle {
  id: string
  finish(summary: string, opts?: { tokensUsed?: number; costCents?: number }): Promise<void>
  fail(error: unknown): Promise<void>
}

/** Open an AgentRun row; returns a handle the agent uses to close it out. */
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

  return {
    id: run.id,
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
