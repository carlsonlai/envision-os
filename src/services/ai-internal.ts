/**
 * ai-internal.ts
 *
 * Internal AI helpers used by services (not directly by API routes).
 * Avoids circular imports between ai.ts and feedback-processor.ts.
 */

import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (!_client) {
    const key = process.env.ANTHROPIC_API_KEY
    if (!key) throw new Error('ANTHROPIC_API_KEY is not set')
    _client = new Anthropic({ apiKey: key })
  }
  return _client
}

export async function callClaudeForQC(prompt: string): Promise<{
  results: Array<{ id: string; passed: boolean; note: string }>
  overallScore: number
}> {
  const message = await getClient().messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return { results: [], overallScore: 80 }

  try {
    return JSON.parse(match[0]) as {
      results: Array<{ id: string; passed: boolean; note: string }>
      overallScore: number
    }
  } catch {
    return { results: [], overallScore: 80 }
  }
}

export async function callClaudeForWorkloadPriority(prompt: string): Promise<{
  assignments: Array<{ itemId: string; designerId: string; reason: string; priority: number }>
}> {
  const message = await getClient().messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return { assignments: [] }

  try {
    return JSON.parse(match[0]) as {
      assignments: Array<{ itemId: string; designerId: string; reason: string; priority: number }>
    }
  } catch {
    return { assignments: [] }
  }
}
