import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * Social Analytics API
 *
 * Fetches real-time stats from each connected platform using stored access tokens.
 * Falls back to placeholder data when credentials are not configured.
 *
 * Supported platforms:
 *  - Instagram / Facebook (Graph API v19)
 *  - TikTok (Business API v2)
 *  - YouTube (Data API v3)
 *  - LinkedIn (Marketing API v2)
 *  - Mailchimp (Marketing API v3)
 *  - 小红书 / RedNote (no public API — manual data only)
 */

export const dynamic = 'force-dynamic'

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

// ─── Instagram / Facebook Graph API ──────────────────────────────────────────

async function fetchInstagramStats(): Promise<PlatformResult> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN
  const accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID

  if (!token || !accountId) {
    return { id: 'instagram', name: 'Instagram', connected: false, followers: null, followerGrowth: null, reach: null, engagement: null, leads: null, posts: null }
  }

  try {
    const fields = 'followers_count,media_count,profile_views'
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${accountId}?fields=${fields}&access_token=${token}`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()

    // Fetch insights (reach, impressions) for the last 7 days
    const insightRes = await fetch(
      `https://graph.facebook.com/v19.0/${accountId}/insights?metric=reach,impressions,follower_count&period=week&access_token=${token}`,
      { next: { revalidate: 3600 } }
    )
    const insightData = insightRes.ok ? await insightRes.json() : { data: [] }
    const reachMetric = (insightData.data as Array<{ name: string; values: Array<{ value: number }> }>)
      .find((m) => m.name === 'reach')
    const weeklyReach = reachMetric?.values?.[0]?.value ?? null

    return {
      id: 'instagram',
      name: 'Instagram',
      connected: true,
      followers: data.followers_count ?? null,
      followerGrowth: null, // requires comparing historical data
      reach: weeklyReach,
      engagement: null, // requires per-post calculation
      leads: null,
      posts: data.media_count ?? null,
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return { id: 'instagram', name: 'Instagram', connected: true, followers: null, followerGrowth: null, reach: null, engagement: null, leads: null, posts: null, error: msg }
  }
}

// ─── Facebook Page ─────────────────────────────────────────────────────────

async function fetchFacebookStats(): Promise<PlatformResult> {
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN
  const pageId = process.env.FACEBOOK_PAGE_ID

  if (!token || !pageId) {
    return { id: 'facebook', name: 'Facebook', connected: false, followers: null, followerGrowth: null, reach: null, engagement: null, leads: null, posts: null }
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}?fields=fan_count,followers_count&access_token=${token}`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()

    const insightRes = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}/insights/page_impressions_unique/week?access_token=${token}`,
      { next: { revalidate: 3600 } }
    )
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
    const res = await fetch(
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
    const res = await fetch(
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
    const res = await fetch(
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

    // List stats
    const listRes = await fetch(`${base}/lists/${listId ?? ''}`, { headers, next: { revalidate: 3600 } })
    if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`)
    const listData = await listRes.json()
    const memberCount: number = listData.stats?.member_count ?? null

    // Recent campaign stats
    const campRes = await fetch(`${base}/campaigns?count=10&status=sent&sort_field=send_time&sort_dir=DESC`, { headers, next: { revalidate: 3600 } })
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

  // Run all platform fetches in parallel
  const results = await Promise.allSettled([
    fetchInstagramStats(),
    fetchFacebookStats(),
    fetchYouTubeStats(),
    fetchLinkedInStats(),
    fetchTikTokStats(),
    fetchMailchimpStats(),
  ])

  const platforms: PlatformResult[] = results.map((r) =>
    r.status === 'fulfilled' ? r.value : { id: 'unknown', name: 'Unknown', connected: false, followers: null, followerGrowth: null, reach: null, engagement: null, leads: null, posts: null, error: 'Promise rejected' }
  )

  const connectedCount = platforms.filter((p) => p.connected).length

  return NextResponse.json({
    success: true,
    connectedCount,
    totalPlatforms: 7, // includes RedNote (manual)
    platforms,
    lastUpdated: new Date().toISOString(),
  })
}
