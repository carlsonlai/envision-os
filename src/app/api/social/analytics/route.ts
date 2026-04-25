import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * Social Analytics API
 *
 * Fetches real-time stats from each connected platform using stored access tokens.
 * Token resolution order: environment variable → SocialConfig DB (saved by OAuth callback).
 * Falls back to placeholder data when credentials are not configured in either source.
 *
 * Supported platforms:
 *  - Instagram / Facebook (Graph API v25)
 *  - TikTok (Business API v2)
 *  - YouTube (Data API v3)
 *  - LinkedIn (Marketing API v2)
 *  - Mailchimp (Marketing API v3)
 *  - 小红书 / RedNote (no public API — manual data only)
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 15

// 6-second timeout per platform — prevents one slow API from blocking the response
function fetchWithTimeout(url: string, options: RequestInit = {}, ms = 6000): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id))
}

interface PlatformResult {
  id: string
  name: string
  connected: boolean
  followers: number | null
  followerGrowth: number | null
  reach: number | null
  engagement: number | null
  leads: number | null
  posts: number | null
  error?: string
}

// ─── DB token helpers ─────────────────────────────────────────────────────────

interface MetaPageToken {
  id: string
  name: string
  pageAccessToken: string
  instagramBusinessAccountId: string | null
}

interface MetaTokensDB {
  pages: MetaPageToken[]
}

/** Read Meta page tokens saved by the OAuth callback — returns null on any error */
async function getMetaTokensFromDB(): Promise<MetaTokensDB | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ value: MetaTokensDB }>>(
      `SELECT value FROM "SocialConfig" WHERE key = 'meta_tokens'`,
    )
    return rows[0]?.value ?? null
  } catch {
    return null
  }
}

// ─── Instagram / Facebook Graph API ──────────────────────────────────────────

/**
 * Accepts pre-fetched DB tokens so the route handler can resolve them once
 * and share the result between Instagram + Facebook fetchers.
 */
async function fetchInstagramStats(dbTokens: MetaTokensDB | null): Promise<PlatformResult> {
  // Prefer env vars; fall back to tokens saved by the OAuth callback in SocialConfig
  let token = process.env.INSTAGRAM_ACCESS_TOKEN
  let accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID

  if (!token || !accountId) {
    const page = dbTokens?.pages?.find((p) => p.instagramBusinessAccountId)
    if (page) {
      token = page.pageAccessToken
      accountId = page.instagramBusinessAccountId ?? undefined
    }
  }

  if (!token || !accountId) {
    return { id: 'instagram', name: 'Instagram', connected: false, followers: null, followerGrowth: null, reach: null, engagement: null, leads: null, posts: null }
  }

  try {
    const fields = 'followers_count,media_count,username,name'

    const res = await fetchWithTimeout(
      `https://graph.facebook.com/v25.0/${accountId}?fields=${fields}&access_token=${token}`,
      { next: { revalidate: 3600 } }
    )

    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()

    return {
      id: 'instagram',
      name: 'Instagram',
      connected: true,
      followers: data.followers_count ?? null,
      followerGrowth: null,
      reach: null,
      engagement: null,
      leads: null,
      posts: data.media_count ?? null,
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return { id: 'instagram', name: 'Instagram', connected: true, followers: null, followerGrowth: null, reach: null, engagement: null, leads: null, posts: null, error: msg }
  }
}

// ─── Facebook Page ─────────────────────────────────────────────────────────

async function fetchFacebookStats(dbTokens: MetaTokensDB | null): Promise<PlatformResult> {
  // Prefer env vars; fall back to tokens saved by the OAuth callback in SocialConfig
  let token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN
  let pageId = process.env.FACEBOOK_PAGE_ID

  if (!token || !pageId) {
    const page = dbTokens?.pages?.[0]
    if (page) {
      token = page.pageAccessToken
      pageId = page.id
    }
  }

  if (!token || !pageId) {
    return { id: 'facebook', name: 'Facebook', connected: false, followers: null, followerGrowth: null, reach: null, engagement: null, leads: null, posts: null }
  }

  try {
    // Parallelize page info + insights fetch
    const [res, insightRes] = await Promise.all([
      fetchWithTimeout(
        `https://graph.facebook.com/v25.0/${pageId}?fields=fan_count,followers_count&access_token=${token}`,
        { next: { revalidate: 3600 } }
      ),
      fetchWithTimeout(
        `https://graph.facebook.com/v25.0/${pageId}/insights/page_impressions_unique/week?access_token=${token}`,
        { next: { revalidate: 3600 } }
      ),
    ])

    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const insightData = insightRes.ok ? await insightRes.json() : { data: [] }
    const latestReach = (insightData.data as Array<{ value: number }>)?.[0]?.value ?? null

    return {
      id: 'facebook',
      name: 'Facebook',
      connected: true,
      followers: data.followers_count ?? data.fan_count ?? null,
      followerGrowth: null,
      reach: latestReach,
      engagement: null,
      leads: null,
      posts: null,
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return { id: 'facebook', name: 'Facebook', connected: true, followers: null, followerGrowth: null, reach: null, engagement: null, leads: null, posts: null, error: msg }
  }
}

// ─── YouTube Data API v3 ───────────────────────────────────────────────────

async function fetchYouTubeStats(): Promise<PlatformResult> {
  const apiKey = process.env.YOUTUBE_API_KEY
  const channelId = process.env.YOUTUBE_CHANNEL_ID

  if (!apiKey || !channelId) {
    return { id: 'youtube', name: 'YouTube', connected: false, followers: null, followerGrowth: null, reach: null, engagement: null, leads: null, posts: null }
  }

  try {
    const res = await fetchWithTimeout(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${apiKey}`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const stats = data.items?.[0]?.statistics

    return {
      id: 'youtube',
      name: 'YouTube',
      connected: true,
      followers: stats?.subscriberCount ? parseInt(stats.subscriberCount) : null,
      followerGrowth: null,
      reach: stats?.viewCount ? parseInt(stats.viewCount) : null,
      engagement: null,
      leads: null,
      posts: stats?.videoCount ? parseInt(stats.videoCount) : null,
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return { id: 'youtube', name: 'YouTube', connected: true, followers: null, followerGrowth: null, reach: null, engagement: null, leads: null, posts: null, error: msg }
  }
}

// ─── LinkedIn Marketing API ────────────────────────────────────────────────

async function fetchLinkedInStats(): Promise<PlatformResult> {
  const token = process.env.LINKEDIN_ACCESS_TOKEN
  const orgId = process.env.LINKEDIN_ORGANIZATION_ID

  if (!token || !orgId) {
    return { id: 'linkedin', name: 'LinkedIn', connected: false, followers: null, followerGrowth: null, reach: null, engagement: null, leads: null, posts: null }
  }

  try {
    const res = await fetchWithTimeout(
      `https://api.linkedin.com/v2/networkSizes/urn:li:organization:${orgId}?edgeType=CompanyFollowedByMember`,
      {
        headers: { Authorization: `Bearer ${token}`, 'X-Restli-Protocol-Version': '2.0.0' },
        next: { revalidate: 3600 },
      }
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()

    return {
      id: 'linkedin',
      name: 'LinkedIn',
      connected: true,
      followers: data.firstDegreeSize ?? null,
      followerGrowth: null,
      reach: null,
      engagement: null,
      leads: null,
      posts: null,
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return { id: 'linkedin', name: 'LinkedIn', connected: true, followers: null, followerGrowth: null, reach: null, engagement: null, leads: null, posts: null, error: msg }
  }
}

// ─── TikTok Business API ───────────────────────────────────────────────────

async function fetchTikTokStats(): Promise<PlatformResult> {
  const token = process.env.TIKTOK_ACCESS_TOKEN
  const advertiserId = process.env.TIKTOK_ADVERTISER_ID

  if (!token) {
    return { id: 'tiktok', name: 'TikTok', connected: false, followers: null, followerGrowth: null, reach: null, engagement: null, leads: null, posts: null }
  }

  try {
    // TikTok Business API — account info
    const params = new URLSearchParams({ advertiser_id: advertiserId ?? '', fields: JSON.stringify(['follower_count']) })
    const res = await fetchWithTimeout(
      `https://business-api.tiktok.com/open_api/v1.3/bc/auth/info/?${params}`,
      {
        headers: { 'Access-Token': token },
        next: { revalidate: 3600 },
      }
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()

    return {
      id: 'tiktok',
      name: 'TikTok',
      connected: true,
      followers: data.data?.follower_count ?? null,
      followerGrowth: null,
      reach: null,
      engagement: null,
      leads: null,
      posts: null,
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return { id: 'tiktok', name: 'TikTok', connected: true, followers: null, followerGrowth: null, reach: null, engagement: null, leads: null, posts: null, error: msg }
  }
}

// ─── Mailchimp Marketing API v3 ───────────────────────────────────────────

async function fetchMailchimpStats(): Promise<PlatformResult> {
  const apiKey = process.env.MAILCHIMP_API_KEY
  const server = process.env.MAILCHIMP_SERVER_PREFIX // e.g. "us21"
  const listId = process.env.MAILCHIMP_LIST_ID

  if (!apiKey || !server) {
    return { id: 'mailchimp', name: 'Mailchimp', connected: false, followers: null, followerGrowth: null, reach: null, engagement: null, leads: null, posts: null }
  }

  try {
    const base = `https://${server}.api.mailchimp.com/3.0`
    const headers = { Authorization: `apikey ${apiKey}` }

    // Parallelize list stats + campaign stats fetch
    const [listRes, campRes] = await Promise.all([
      fetch(`${base}/lists/${listId ?? ''}`, { headers, next: { revalidate: 3600 } }),
      fetch(`${base}/campaigns?count=10&status=sent&sort_field=send_time&sort_dir=DESC`, { headers, next: { revalidate: 3600 } }),
    ])

    if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`)
    const listData = await listRes.json()
    const memberCount: number = listData.stats?.member_count ?? null
    const campData = campRes.ok ? await campRes.json() : { campaigns: [] }
    const campaigns: Array<{ report_summary?: { open_rate?: number; click_rate?: number } }> = campData.campaigns ?? []
    const avgOpenRate = campaigns.length > 0
      ? Math.round((campaigns.reduce((sum, c) => sum + (c.report_summary?.open_rate ?? 0), 0) / campaigns.length) * 100)
      : null

    return {
      id: 'mailchimp',
      name: 'Mailchimp',
      connected: true,
      followers: memberCount,
      followerGrowth: null,
      reach: memberCount,
      engagement: avgOpenRate,
      leads: null,
      posts: campaigns.length,
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return { id: 'mailchimp', name: 'Mailchimp', connected: true, followers: null, followerGrowth: null, reach: null, engagement: null, leads: null, posts: null, error: msg }
  }
}

// ─── Route Handler ─────────────────────────────────────────────────────────

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch DB-stored Meta tokens once — shared by Instagram + Facebook fetchers
  // to avoid two identical DB round-trips in the parallel Promise.allSettled below.
  const metaDbTokens = await getMetaTokensFromDB()

  // Run all platform fetches in parallel
  const results = await Promise.allSettled([
    fetchInstagramStats(metaDbTokens),
    fetchFacebookStats(metaDbTokens),
    fetchYouTubeStats(),
    fetchLinkedInStats(),
    fetchTikTokStats(),
    fetchMailchimpStats(),
  ])

  const platforms: PlatformResult[] = results.map((r) =>
    r.status === 'fulfilled' ? r.value : { id: 'unknown', name: 'Unknown', connected: false, followers: null, followerGrowth: null, reach: null, engagement: null, leads: null, posts: null, error: 'Promise rejected' }
  )

  const connectedCount = platforms.filter((p) => p.connected).length

  const res = NextResponse.json({
    success: true,
    connectedCount,
    totalPlatforms: 7, // includes RedNote (manual)
    platforms,
    lastUpdated: new Date().toISOString(),
  })
  res.headers.set('Cache-Control', 'private, max-age=60')
  return res
}
