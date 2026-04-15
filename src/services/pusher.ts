import Pusher from 'pusher'
import { logger, getErrorMessage } from '@/lib/logger'

// Server-side Pusher instance
export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER ?? 'ap1',
  useTLS: true,
})

// Channel names
export const CHANNELS = {
  project: (id: string) => `project-${id}`,
  cs: 'cs-alerts',
  designer: (id: string) => `designer-${id}`,
  management: 'management',
  sales: 'sales',
} as const

// Event names
export const EVENTS = {
  NEW_FILE: 'new-file',
  REVISION_SUBMITTED: 'revision-submitted',
  REVISION_LIMIT_HIT: 'revision-limit-hit',
  ITEM_APPROVED: 'item-approved',
  QC_PASSED: 'qc-passed',
  FA_READY: 'fa-ready',
  FA_SIGNED: 'fa-signed',
  UNBILLED_ALERT: 'unbilled-alert',
  STATUS_CHANGED: 'status-changed',
} as const

export async function triggerEvent(
  channel: string,
  event: string,
  data: object
): Promise<void> {
  try {
    await pusherServer.trigger(channel, event, data)
  } catch (error) {
    logger.error(`Pusher triggerEvent error (${channel}/${event})`, { error: getErrorMessage(error) })
    // Non-fatal: log but don't throw
  }
}
