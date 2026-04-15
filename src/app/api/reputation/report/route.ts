import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'

function getClient(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY is not configured. Add it to .env.local and restart.')
  return new Anthropic({ apiKey: key })
}

interface ReviewRow {
  platform: string
  author: string
  rating: number
  text: string
  replied: boolean
  reviewed_at: string
}

interface MentionRow {
  platform: string
  author: string
  text: string
  sentiment: string
  mentioned_at: string
}

export async function POST(_req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch last 30 days of reviews and mentions
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  let reviews: ReviewRow[] = []
  let mentions: MentionRow[] = []

  try {
    reviews = await prisma.$queryRawUnsafe<ReviewRow[]>(
      `SELECT platform, author, rating, text, replied, reviewed_at
       FROM reputation_reviews
       WHERE reviewed_at >= $1
       ORDER BY reviewed_at DESC LIMIT 50`,
      new Date(since)
    )
  } catch {
    // Table may not exist yet — that's fine
  }

  try {
    mentions = await prisma.$queryRawUnsafe<MentionRow[]>(
      `SELECT platform, author, text, sentiment, mentioned_at
       FROM reputation_mentions
       WHERE mentioned_at >= $1
       ORDER BY mentioned_at DESC LIMIT 50`,
      new Date(since)
    )
  } catch {
    // Table may not exist yet — that's fine
  }

  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : 'N/A'

  const sentimentCounts = mentions.reduce(
    (acc, m) => {
      acc[m.sentiment as keyof typeof acc]++
      return acc
    },
    { positive: 0, neutral: 0, negative: 0 }
  )

  const reviewSummary = reviews
    .slice(0, 10)
    .map(r => `[${r.platform}] ★${r.rating} by ${r.author}: "${r.text.slice(0, 120)}"`)
    .join('\n')

  const mentionSummary = mentions
    .slice(0, 10)
    .map(m => `[${m.platform}/${m.sentiment}] ${m.author}: "${m.text.slice(0, 100)}"`)
    .join('\n')

  const prompt = `You are a reputation analyst for Envision Studios, a creative agency.
Generate a concise weekly reputation report based on the data below.

PERIOD: Last 30 days
REVIEWS: ${reviews.length} total | Average rating: ${avgRating}/5
MENTIONS: ${mentions.length} total | Positive: ${sentimentCounts.positive} | Neutral: ${sentimentCounts.neutral} | Negative: ${sentimentCounts.negative}

Recent reviews:
${reviewSummary || 'No reviews this period.'}

Recent mentions:
${mentionSummary || 'No mentions this period.'}

Write the report in this format (use plain text, no markdown headers):

REPUTATION SUMMARY
[2-3 sentence overall health assessment]

KEY WINS
[2-3 bullet points of positive highlights]

AREAS TO WATCH
[1-2 bullet points of concerns or unanswered reviews]

RECOMMENDED ACTIONS
[2-3 specific, actionable next steps]

Keep the total report under 300 words. Be specific and actionable.`

  const message = await getClient().messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  })

  const reportText =
    message.content[0].type === 'text' ? message.content[0].text.trim() : 'Report generation failed.'

  return NextResponse.json({
    success: true,
    data: {
      report: reportText,
      meta: {
        reviewCount: reviews.length,
        mentionCount: mentions.length,
        avgRating,
        sentimentCounts,
        generatedAt: new Date().toISOString(),
      },
    },
  })
}
