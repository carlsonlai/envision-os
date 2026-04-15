import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

function getClient(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY is not configured. Add it to .env.local and restart.')
  return new Anthropic({ apiKey: key })
}

interface GenerateRequest {
  platforms: string[]
  contentType: string
  goal: string
  topic: string
  brandNotes?: string
}

interface GeneratedContent {
  platform: string
  hook: string[]
  caption: string
  hashtags: string[]
  imagePrompt: string
  videoScript?: string
  cta: string
  bestTime: string
  estimatedReach: string
  leadPotential: string
}

const PLATFORM_GUIDANCE: Record<string, string> = {
  instagram: 'Instagram: conversational, emoji-friendly, 2200 char max, 5-30 hashtags, strong visual hook. Stories get swipe-up leads.',
  linkedin: 'LinkedIn: professional, thought-leadership tone, 1300 char optimal, 3-5 hashtags, hook in first 2 lines before "see more".',
  facebook: 'Facebook: community-focused, conversational, link previews work well, 80 chars for highest engagement.',
  twitter: 'X/Twitter: punchy, 280 char max, 1-2 hashtags, strong opinion or hook. Threads for longer form.',
}

const GOAL_GUIDANCE: Record<string, string> = {
  brand_awareness: 'Build brand recognition. Focus on personality, behind-the-scenes, and distinctive brand perspective.',
  lead_gen: 'Drive leads and enquiries. Include clear CTA, pain point, and direct offer. Avoid fluffy content.',
  engagement: 'Maximise comments and shares. Ask questions, take a stand, share surprising stats.',
  sales: 'Drive direct sales. Urgency, social proof, clear offer, price anchor, remove objections.',
  thought_leadership: 'Position as industry expert. Share original insight, contrarian take, or detailed process.',
}

function buildPrompt(req: GenerateRequest): string {
  const platformGuides = req.platforms
    .map(p => PLATFORM_GUIDANCE[p] ?? p)
    .join('\n')

  const goalGuide = GOAL_GUIDANCE[req.goal] ?? req.goal

  return `You are a senior social media strategist for Envision Studios, a premium branding and creative agency based in Malaysia. Generate high-converting social media content.

AGENCY CONTEXT:
- Envision Studios specialises in brand identity, visual design, and creative campaigns
- Clients: SMEs, startups, and corporate brands across Malaysia & Southeast Asia
- Brand voice: Confident, expert, direct, premium but not arrogant. No corporate fluff.

CONTENT REQUEST:
Topic: ${req.topic}
Content Type: ${req.contentType}
Goal: ${req.goal} — ${goalGuide}
${req.brandNotes ? `Brand Notes: ${req.brandNotes}` : ''}

PLATFORM REQUIREMENTS:
${platformGuides}

For EACH platform requested (${req.platforms.join(', ')}), generate:
1. hook: 3 alternative opening lines (choose strongest)
2. caption: Full optimised caption for that platform
3. hashtags: Platform-appropriate hashtag list
4. imagePrompt: Detailed AI image generation prompt (for Midjourney/DALL-E)
5. videoScript: (only for reels/stories/video content) 30-60 second script with timing markers
6. cta: Strong call-to-action line
7. bestTime: Optimal posting time
8. estimatedReach: Realistic reach estimate based on ~4,800 Instagram / ~1,900 LinkedIn / ~3,200 Facebook followers
9. leadPotential: Expected lead count

Respond in valid JSON only, no markdown, using this exact structure:
{
  "results": [
    {
      "platform": "instagram",
      "hook": ["hook 1", "hook 2", "hook 3"],
      "caption": "full caption here",
      "hashtags": ["tag1", "tag2"],
      "imagePrompt": "detailed prompt here",
      "videoScript": "script here or null",
      "cta": "CTA line here",
      "bestTime": "Tue 8-9 AM",
      "estimatedReach": "3,200–5,100",
      "leadPotential": "4–8"
    }
  ]
}`
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const body: GenerateRequest = await req.json()

    if (!body.platforms?.length || !body.contentType || !body.goal || !body.topic) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const message = await getClient().messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: buildPrompt(body),
        },
      ],
    })

    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''

    let parsed: { results: GeneratedContent[] }
    try {
      parsed = JSON.parse(rawText)
    } catch {
      // Try to extract JSON from response if wrapped in any text
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
      }
      parsed = JSON.parse(jsonMatch[0])
    }

    return NextResponse.json({ success: true, results: parsed.results })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
