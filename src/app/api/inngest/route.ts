import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest'

// ─── Agent imports (12-agent autonomous spec) ────────────────────────────────
import { demandIntelFn }          from '@/lib/agents/demand-intel'
import { leadEngineFn }           from '@/lib/agents/lead-engine'
import { contentGeneratorFn }     from '@/lib/agents/content-generator'
import { distributionEngineFn }   from '@/lib/agents/distribution-engine'
import { performanceOptimizerFn } from '@/lib/agents/performance-optimizer'
import { salesAgentFn }           from '@/lib/agents/sales-agent'
import { paymentAgentFn }         from '@/lib/agents/payment-agent'
import { onboardingAgentFn }      from '@/lib/agents/onboarding-agent'
import { pmAiFn }                 from '@/lib/agents/pm-ai'
import { qaAgentFn }              from '@/lib/agents/qa-agent'
import { deliveryAgentFn }        from '@/lib/agents/delivery-agent'
import { revenueExpansionFn }     from '@/lib/agents/revenue-expansion'

// Register all agent functions. Each new agent adds one import above + one entry below.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    demandIntelFn,
    leadEngineFn,
    contentGeneratorFn,
    distributionEngineFn,
    performanceOptimizerFn,
    salesAgentFn,
    paymentAgentFn,
    onboardingAgentFn,
    pmAiFn,
    qaAgentFn,
    deliveryAgentFn,
    revenueExpansionFn,
  ],
})
