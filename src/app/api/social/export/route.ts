/**
 * POST /api/social/export
 * Writes generated posts, calendars, hashtag sets, and reports
 * to the social-content/ folder inside the project.
 *
 * The folder lives at: <project-root>/social-content/
 * and mirrors to ~/Desktop/Envision Social Media/ if the user runs the sync script.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import path from 'path'
import fs from 'fs/promises'

const SOCIAL_ROOT = path.join(process.cwd(), 'social-content')

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

// ─── Export scheduled posts as calendar JSON + CSV ───────────────────────────

async function exportCalendar(year: number, month: number) {
  const from = new Date(year, month - 1, 1)
  const to   = new Date(year, month, 1)

  const posts = await prisma.$queryRawUnsafe<Array<{
    id: string; platform: string; caption: string; hashtags: string[];
    imagePrompt: string | null; bestTime: string | null; status: string;
    scheduledAt: string | null; postedAt: string | null
  }>>(
    `SELECT id, platform, caption, hashtags, "imagePrompt", "bestTime", status,
            "scheduledAt", "postedAt"
     FROM "ScheduledPost"
     WHERE "scheduledAt" >= $1 AND "scheduledAt" < $2
     ORDER BY "scheduledAt" ASC`,
    from.toISOString(), to.toISOString()
  )

  const monthName = from.toLocaleString('default', { month: 'long' })
  const dir = path.join(SOCIAL_ROOT, 'Calendar', String(year), monthName)
  await ensureDir(dir)

  // JSON export
  const jsonPath = path.join(dir, `calendar-${year}-${String(month).padStart(2, '0')}.json`)
  await fs.writeFile(jsonPath, JSON.stringify({ exported: new Date().toISOString(), posts }, null, 2))

  // CSV export
  const csv = [
    'Date,Day,Platform,Status,Caption Preview,Hashtags,Best Time',
    ...posts.map(p => {
      const d = p.scheduledAt ? new Date(p.scheduledAt) : null
      const dateStr = d ? d.toISOString().slice(0, 10) : ''
      const dayStr  = d ? d.toLocaleDateString('en-MY', { weekday: 'long' }) : ''
      const preview = p.caption.slice(0, 80).replace(/"/g, "'").replace(/\n/g, ' ')
      const tags    = (p.hashtags ?? []).join(' ')
      return `"${dateStr}","${dayStr}","${p.platform}","${p.status}","${preview}...","${tags}","${p.bestTime ?? ''}"`
    }),
  ].join('\n')

  const csvPath = path.join(dir, `calendar-${year}-${String(month).padStart(2, '0')}.csv`)
  await fs.writeFile(csvPath, csv)

  return { jsonPath, csvPath, count: posts.length }
}

// ─── Export content per platform ─────────────────────────────────────────────

async function exportContent(platform: string) {
  const posts = await prisma.$queryRawUnsafe<Array<{
    id: string; caption: string; hashtags: string[];
    imagePrompt: string | null; status: string; scheduledAt: string | null
  }>>(
    `SELECT id, caption, hashtags, "imagePrompt", status, "scheduledAt"
     FROM "ScheduledPost" WHERE platform = $1 ORDER BY "scheduledAt" DESC LIMIT 100`,
    platform
  )

  const dir = path.join(SOCIAL_ROOT, 'Content', platform.charAt(0).toUpperCase() + platform.slice(1))
  await ensureDir(dir)

  const dateStr = new Date().toISOString().slice(0, 10)
  const filePath = path.join(dir, `posts-${dateStr}.json`)
  await fs.writeFile(filePath, JSON.stringify({ platform, exportedAt: new Date().toISOString(), posts }, null, 2))

  // Also write image prompts separately for easy use with Midjourney/DALL-E
  const prompts = posts.filter(p => p.imagePrompt).map((p, i) => `# Post ${i + 1}\n${p.imagePrompt}`).join('\n\n---\n\n')
  if (prompts) {
    await fs.writeFile(path.join(dir, `image-prompts-${dateStr}.txt`), prompts)
  }

  return { filePath, count: posts.length }
}

// ─── Export hashtag sets ──────────────────────────────────────────────────────

async function exportHashtags() {
  const rows = await prisma.$queryRawUnsafe<Array<{ value: string }>>(
    `SELECT value FROM "SocialConfig" WHERE key = 'hashtag_sets'`
  ).catch(() => [] as Array<{ value: string }>)

  const dir = path.join(SOCIAL_ROOT, 'Hashtags')
  await ensureDir(dir)

  const dateStr = new Date().toISOString().slice(0, 10)

  if (rows.length > 0) {
    const sets = rows[0].value
    await fs.writeFile(path.join(dir, `hashtag-sets-${dateStr}.json`), JSON.stringify(sets, null, 2))

    // Human-readable text version
    type HashtagSet = { tier1?: string[]; tier2?: string[]; tier3?: string[] }
    type HashtagSets = Record<string, HashtagSet>
    const parsed = (typeof sets === 'string' ? JSON.parse(sets) : sets) as HashtagSets
    const txt = Object.entries(parsed).map(([platform, tiers]) => {
      return `## ${platform.toUpperCase()}\nBroad reach: ${(tiers.tier1 ?? []).map((t: string) => `#${t}`).join(' ')}\nNiche: ${(tiers.tier2 ?? []).map((t: string) => `#${t}`).join(' ')}\nBranded: ${(tiers.tier3 ?? []).map((t: string) => `#${t}`).join(' ')}`
    }).join('\n\n')
    await fs.writeFile(path.join(dir, `hashtag-sets-${dateStr}.txt`), txt)
  }

  return dir
}

// ─── Export weekly report ─────────────────────────────────────────────────────

async function exportReport() {
  const [total, posted, scheduled, optimisation] = await Promise.all([
    prisma.$queryRawUnsafe<[{ count: string }]>(`SELECT COUNT(*)::text FROM "ScheduledPost"`).catch(() => [{ count: '0' }]),
    prisma.$queryRawUnsafe<[{ count: string }]>(`SELECT COUNT(*)::text FROM "ScheduledPost" WHERE status = 'posted'`).catch(() => [{ count: '0' }]),
    prisma.$queryRawUnsafe<[{ count: string }]>(`SELECT COUNT(*)::text FROM "ScheduledPost" WHERE status = 'scheduled'`).catch(() => [{ count: '0' }]),
    prisma.$queryRawUnsafe<Array<{ value: string }>>(`SELECT value FROM "SocialConfig" WHERE key = 'optimisation_report'`).catch(() => [] as Array<{ value: string }>),
  ])

  const stats = await prisma.$queryRawUnsafe<Array<{ platform_id: string; followers: number; engagement: number; reach: number }>>(
    `SELECT platform_id, followers, engagement, reach FROM social_platform_stats ORDER BY engagement DESC`
  ).catch(() => [] as Array<{ platform_id: string; followers: number; engagement: number; reach: number }>)

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalPostsCreated: parseInt(total[0]?.count ?? '0'),
      postsPublished: parseInt(posted[0]?.count ?? '0'),
      postsScheduled: parseInt(scheduled[0]?.count ?? '0'),
    },
    platformStats: stats,
    optimisationReport: optimisation.length > 0 ? optimisation[0].value : null,
  }

  const dir = path.join(SOCIAL_ROOT, 'Reports', 'Weekly')
  await ensureDir(dir)

  const dateStr = new Date().toISOString().slice(0, 10)
  const filePath = path.join(dir, `weekly-report-${dateStr}.json`)
  await fs.writeFile(filePath, JSON.stringify(report, null, 2))

  return filePath
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, platform, year, month } = (await req.json()) as {
    type: 'calendar' | 'content' | 'hashtags' | 'report' | 'all'
    platform?: string
    year?: number
    month?: number
  }

  const results: Record<string, unknown> = {}

  try {
    if (type === 'calendar' || type === 'all') {
      const y = year ?? new Date().getFullYear()
      const m = month ?? new Date().getMonth() + 1
      results.calendar = await exportCalendar(y, m)
    }

    if (type === 'content' || type === 'all') {
      const platforms = platform
        ? [platform]
        : ['instagram', 'facebook', 'linkedin', 'tiktok', 'youtube']
      for (const p of platforms) {
        results[`content_${p}`] = await exportContent(p)
      }
    }

    if (type === 'hashtags' || type === 'all') {
      results.hashtags = await exportHashtags()
    }

    if (type === 'report' || type === 'all') {
      results.report = await exportReport()
    }

    return NextResponse.json({
      ok: true,
      exportedTo: SOCIAL_ROOT,
      results,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
