import { Inngest } from 'inngest'

/**
 * Event names used by the autonomous agent layer. Inngest v4 doesn't require a
 * compile-time event schema — we keep typed payload helpers here for callers.
 */
export const AGENT_EVENTS = {
  demandIntelScanRequested: 'demand-intel/scan.requested',
  leadCreated:              'lead-engine/lead.created',
  leadUpdated:              'lead-engine/lead.updated',
} as const

export const inngest = new Inngest({ id: 'envision-os' })
