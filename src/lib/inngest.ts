import { Inngest } from 'inngest'

/**
 * Event names used by the autonomous agent layer. Inngest v4 doesn't require a
 * compile-time event schema — we keep typed payload helpers here for callers.
 */
export const AGENT_EVENTS = {
  // Demand Intel
  demandIntelScanRequested: 'demand-intel/scan.requested',
  demandIntelLeadScored:    'demand-intel/lead.scored',

  // Lead Engine
  leadCreated:              'lead-engine/lead.created',
  leadUpdated:              'lead-engine/lead.updated',
  leadRouted:               'lead-engine/lead.routed',

  // Content Generator
  contentBriefReady:        'content-generator/brief.ready',

  // Distribution Engine
  distributionCampaignReady:'distribution/campaign.ready',

  // Performance Optimizer
  perfReviewRequested:      'perf-optimizer/review.requested',

  // Sales Agent
  salesProposalNeeded:      'sales-agent/proposal.needed',

  // Payment Agent
  paymentInvoiceOverdue:    'payment/invoice.overdue',

  // Onboarding Agent
  onboardingLeadWon:        'onboarding/lead.won',

  // PM AI
  pmRebalanceRequested:     'pm-ai/rebalance.requested',

  // QA Agent
  qaDeliverableUploaded:    'qa/deliverable.uploaded',

  // Delivery Agent
  deliveryItemApproved:     'delivery/item.approved',

  // Revenue Expansion
  revenueExpansionCheck:    'revenue/expansion.check',
} as const

export const inngest = new Inngest({ id: 'envision-os' })
