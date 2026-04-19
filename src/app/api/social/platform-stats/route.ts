import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Auto-migrate: create table on first request if it doesn't exist.
// Uses platform_id as PRIMARY KEY — no pgcrypto / gen_random_uuid() needed.
async function ensureTable() {
  // Create table with platform_id as PK (no extension dependency)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS social_platform_stats (
      platform_id     TEXT PRIMARY KEY,
      platform_name   TEXT NOT NULL,
      followers       INT  DEFAULT 0,
      follower_growth FLOAT DEFAULT 0,
      reach           INT  DEFAULT 0,
      engagement      FLOAT DEFAULT 0,
      leads           INT  DEFAULT 0,
      posts           INT  DEFAULT 0,
      likes           INT  DEFAULT 0,
      comments        INT  DEFAULT 0,
      score           INT  DEFAULT 0,
      best_time       TEXT DEFAULT '',
      updated_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_by      TEXT DEFAULT 'manual'
    )
  `)

  // Migration guard: if table was created with the old schema (id column +
  // platform_id UNIQUE), silently drop the redundant id column.
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'social_platform_stats' AND column_name = 'id'
      ) THEN
        ALTER TABLE social_platform_stats DROP COLUMN IF EXISTS id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END $$;
  `)
}

const DEFAULT_PLATFORMS = [
  { platformId: 'instagram', platformName: 'Instagram',    score: 0, bestTime: 'Tue & Thu 8–9 AM' },
  { platformId: 'tiktok',    platformName: 'TikTok',        score: 0, bestTime: 'Fri & Sat 7–9 PM' },
  { platformId: 'linkedin',  platformName: 'LinkedIn',      score: 0, bestTime: 'Mon & Wed 9 AM'   },
  { platformId: 'facebook',  platformName: 'Facebook',      score: 0, bestTime: 'Wed 12 PM'        },
  { platformId: 'youtube',   platformName: 'YouTube',       score: 0, bestTime: 'Sat & Sun 10 AM'  },
  { platformId: 'rednote',   platformName: '小红书 (RedNote)', score: 0, bestTime: 'Wed & Sun 8 PM' },
  { platformId: 'mailchimp', platformName: 'Mailchimp',     score: 0, bestTime: 'Tue 10 AM'        },
]

// ─── GET /api/social/platform-stats ──────────────────────────────────────────
// Returns all platform stats from DB. If no rows yet, returns defaults.
export async function GET(): Promise<NextResponse> {
  try {
    await ensureTable()

    const rows = await prisma.$queryRawUnsafe<Array<{
      platform_id: string
      platform_name: string
      followers: number
      follower_growth: number
      reach: number
      engagement: number
      leads: number
      posts: number
      likes: number
      comments: number
      score: number
      best_time: string
      updated_at: Date
      updated_by: string
    }>>(`
      SELECT platform_id, platform_name, followers, follower_growth,
             reach, engagement, leads, posts, likes, comments,
             score, best_time, updated_at, updated_by
      FROM social_platform_stats
      ORDER BY platform_id
    `)

    if (rows.length === 0) {
      return NextResponse.json({ platforms: [], hasData: false })
    }

    type RawRow = typeof rows[number]
    const platforms = (rows as RawRow[]).map((r: RawRow) => ({
      id:             r.platform_id,
      name:           r.platform_name,
      followers:      r.followers,
      followerGrowth: r.follower_growth,
      reach:          r.reach,
      engagement:     r.engagement,
      leads:          r.leads,
      posts:          r.posts,
      likes:          r.likes,
      comments:       r.comments,
      score:          r.score,
      bestTime:       r.best_time,
      updatedAt:      r.updated_at,
      updatedBy:      r.updated_by,
    }))

    return NextResponse.json({ platforms, hasData: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ─── PUT /api/social/platform-stats ──────────────────────────────────────────
// Upsert one or many platform rows.
// Body: { platforms: Array<{ id, followers, followerGrowth, reach, engagement, leads, posts, likes, comments, score, bestTime }> }
export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    await ensureTable()

    const body = await req.json() as {
      platforms: Array<{
        id: string
        name?: string
        followers?: number
        followerGrowth?: number
        reach?: number
        engagement?: number
        leads?: number
        posts?: number
        likes?: number
        comments?: number
        score?: number
        bestTime?: string
      }>
    }

    if (!Array.isArray(body.platforms)) {
      return NextResponse.json({ error: 'platforms array required' }, { status: 400 })
    }

    for (const p of body.platforms) {
      const def = DEFAULT_PLATFORMS.find(d => d.platformId === p.id)
      await prisma.$executeRawUnsafe(`
        INSERT INTO social_platform_stats
          (platform_id, platform_name, followers, follower_growth, reach, engagement, leads, posts, likes, comments, score, best_time, updated_at, updated_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),'manual')
        ON CONFLICT (platform_id) DO UPDATE SET
          platform_name   = EXCLUDED.platform_name,
          followers       = EXCLUDED.followers,
          follower_growth = EXCLUDED.follower_growth,
          reach           = EXCLUDED.reach,
          engagement      = EXCLUDED.engagement,
          leads           = EXCLUDED.leads,
          posts           = EXCLUDED.posts,
          likes           = EXCLUDED.likes,
          comments        = EXCLUDED.comments,
          score           = EXCLUDED.score,
          best_time       = EXCLUDED.best_time,
          updated_at      = NOW(),
          updated_by      = 'manual'
      `,
        p.id,
        p.name ?? def?.platformName ?? p.id,
        p.followers      ?? 0,
        p.followerGrowth ?? 0,
        p.reach          ?? 0,
        p.engagement     ?? 0,
        p.leads          ?? 0,
        p.posts          ?? 0,
        p.likes          ?? 0,
        p.comments       ?? 0,
        p.score          ?? 0,
        p.bestTime       ?? def?.bestTime ?? ''
      )
    }

    return NextResponse.json({ success: true, updated: body.platforms.length })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
