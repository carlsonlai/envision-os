import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest'
import { demandIntelFn } from '@/lib/agents/demand-intel'

// Register all agent functions here. Each new agent adds one import + one entry.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [demandIntelFn],
})
