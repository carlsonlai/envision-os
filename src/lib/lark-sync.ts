/**
 * lark-sync.ts
 *
 * Utilities for syncing staff members from Lark into the local User table.
 *
 * Flow:
 *   1. Fetch all active staff from Lark (getStaff)
 *   2. Map each Lark job title → local Role enum
 *   3. Upsert into users table: create if new, update name/role/avatar/larkOpenId if existing
 *   4. Deactivate local users not found in Lark (optional, controlled by `deactivateMissing`)
 */

import bcrypt from 'bcryptjs'
import { Role } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getStaff, type LarkStaffMember } from '@/services/lark'

// ─── Role mapping ─────────────────────────────────────────────────────────────

/**
 * Map a Lark job title and/or department name to a local Role.
 * Matching is case-insensitive substring / keyword based.
 * Extend the mapping table as new roles are added to Lark.
 */
export function larkTitleToRole(
  jobTitle?: string,
  departmentName?: string,
): Role {
  const t = (jobTitle ?? '').toLowerCase()
  const d = (departmentName ?? '').toLowerCase()

  // ADMIN
  if (t.includes('admin') || t.includes('managing director') || t.includes('ceo') || t.includes('founder')) {
    return Role.ADMIN
  }
  // CREATIVE_DIRECTOR
  if (t.includes('creative director')) return Role.CREATIVE_DIRECTOR

  // SENIOR_ART_DIRECTOR
  if (t.includes('senior art director') || t.includes('senior designer')) return Role.SENIOR_ART_DIRECTOR

  // JUNIOR_ART_DIRECTOR
  if (t.includes('art director')) return Role.JUNIOR_ART_DIRECTOR

  // DESIGNER_3D
  if (t.includes('3d') || t.includes('motion') || t.includes('animator')) return Role.DESIGNER_3D

  // MULTIMEDIA_DESIGNER
  if (t.includes('multimedia') || t.includes('video editor') || t.includes('videographer')) return Role.MULTIMEDIA_DESIGNER

  // JUNIOR_DESIGNER
  if (t.includes('junior designer') || t.includes('junior graphic')) return Role.JUNIOR_DESIGNER

  // GRAPHIC_DESIGNER
  if (t.includes('graphic designer') || t.includes('graphic design') || t.includes('designer')) {
    return Role.GRAPHIC_DESIGNER
  }

  // DIGITAL_MARKETING
  if (
    t.includes('digital marketing') ||
    t.includes('marketing') ||
    t.includes('social media') ||
    d.includes('digital marketing') ||
    d.includes('marketing')
  ) {
    return Role.DIGITAL_MARKETING
  }

  // SALES
  if (t.includes('sales') || d.includes('sales')) return Role.SALES

  // CLIENT_SERVICING
  if (
    t.includes('client service') ||
    t.includes('account manager') ||
    t.includes('account exec') ||
    t.includes('project manager') ||
    d.includes('client service')
  ) {
    return Role.CLIENT_SERVICING
  }

  // Fallback — treat unrecognised titles as staff (DIGITAL_MARKETING is a safe default)
  return Role.DIGITAL_MARKETING
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SyncResult {
  created: number
  updated: number
  deactivated: number
  skipped: number      // Lark members with neither email nor openId
  errors: string[]
}

// ─── Core sync function ───────────────────────────────────────────────────────

/**
 * Fetch all active staff from Lark and upsert them into the local User table.
 *
 * @param deactivateMissing  If true, set active=false on local users whose email
 *                           is no longer present in Lark. Defaults to false (safe).
 * @param defaultPassword    Plain-text password assigned to newly provisioned users.
 *                           They should change it on first login. Defaults to a
 *                           random-ish string; pass your own if preferred.
 */
export async function syncLarkStaffToUsers(
  deactivateMissing = false,
  defaultPassword = 'Envicion@2025',
): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, deactivated: 0, skipped: 0, errors: [] }

  // 1. Fetch from Lark
  let larkStaff: LarkStaffMember[]
  try {
    larkStaff = await getStaff()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    result.errors.push(`Failed to fetch Lark staff: ${msg}`)
    return result
  }

  // 2. Collect all emails seen in Lark (for deactivation step)
  const larkEmails = new Set<string>()

  // Hash the default password once outside the loop — bcrypt is expensive (~100ms each)
  const hashedDefault = bcrypt.hashSync(defaultPassword, 12)

  // 3. Upsert each staff member
  //    - Members WITH email   → upsert on email (authoritative key)
  //    - Members WITHOUT email → upsert on larkOpenId (fallback when contact
  //      scope is missing; email gets a @lark.local placeholder so the row
  //      still satisfies the NOT NULL constraint; re-running sync after fixing
  //      Lark permissions will fill in the real email via the email-conflict path)
  for (const member of larkStaff) {
    if (!member.email && !member.openId) {
      result.skipped++
      continue
    }

    const role = larkTitleToRole(member.jobTitle, member.departmentName)
    const newId = `clk${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

    if (member.email) {
      // ── Upsert by email ──────────────────────────────────────────────────────
      larkEmails.add(member.email.toLowerCase())
      try {
        /**
         * ON CONFLICT (email) → update name / role / avatar / larkOpenId
         * Do NOT update password — users may have changed it
         * COALESCE keeps larkOpenId if already set
         * xmax = 0 → fresh INSERT; xmax > 0 → UPDATE
         */
        const rows = await prisma.$queryRawUnsafe<[{ xmax: string }]>(
          `INSERT INTO "users" (id, name, email, password, role, active, avatar, "larkOpenId", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5::"Role", true, $6, $7, NOW(), NOW())
           ON CONFLICT (email) DO UPDATE
             SET name         = EXCLUDED.name,
                 role         = EXCLUDED.role,
                 active       = true,
                 avatar       = COALESCE(EXCLUDED.avatar, "users".avatar),
                 "larkOpenId" = COALESCE(EXCLUDED."larkOpenId", "users"."larkOpenId"),
                 "updatedAt"  = NOW()
           RETURNING xmax::text`,
          newId,
          member.name,
          member.email,
          hashedDefault,
          role,
          member.avatar ?? null,
          member.openId ?? null,
        )
        const wasInsert = rows[0]?.xmax === '0'
        if (wasInsert) result.created++
        else result.updated++
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        result.errors.push(`Error syncing ${member.email}: ${msg}`)
      }
    } else {
      // ── Upsert by larkOpenId (no email visible — contact scope not granted) ──
      const placeholderEmail = `${member.openId}@lark.local`
      try {
        const rows = await prisma.$queryRawUnsafe<[{ xmax: string }]>(
          `INSERT INTO "users" (id, name, email, password, role, active, avatar, "larkOpenId", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5::"Role", true, $6, $7, NOW(), NOW())
           ON CONFLICT ("larkOpenId") DO UPDATE
             SET name        = EXCLUDED.name,
                 active      = true,
                 avatar      = COALESCE(EXCLUDED.avatar, "users".avatar),
                 "updatedAt" = NOW()
           RETURNING xmax::text`,
          newId,
          member.name,
          placeholderEmail,
          hashedDefault,
          role,
          member.avatar ?? null,
          member.openId,
        )
        const wasInsert = rows[0]?.xmax === '0'
        if (wasInsert) result.created++
        else result.updated++
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        result.errors.push(`Error syncing ${member.openId} (${member.name}): ${msg}`)
      }
    }
  }

  // 4. Optionally deactivate users not found in Lark
  if (deactivateMissing && larkEmails.size > 0) {
    try {
      const deactivated = await prisma.user.updateMany({
        where: {
          active: true,
          role: { notIn: [Role.CLIENT] },   // Never deactivate client-role accounts
          email: { notIn: Array.from(larkEmails) },
        },
        data: { active: false },
      })
      result.deactivated = deactivated.count
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`Error deactivating missing users: ${msg}`)
    }
  }

  return result
}

/**
 * Look up a single Lark staff member by email and return their mapped role.
 * Used in auth.ts for just-in-time role refresh on login.
 * Returns null if the user is not found in Lark or Lark is unreachable.
 */
export async function getLarkRoleForEmail(email: string): Promise<{
  role: Role
  name: string
  avatar?: string
  larkOpenId?: string
} | null> {
  try {
    const staff = await getStaff()
    const match = staff.find(m => m.email?.toLowerCase() === email.toLowerCase())
    if (!match) return null
    return {
      role:        larkTitleToRole(match.jobTitle, match.departmentName),
      name:        match.name,
      avatar:      match.avatar,
      larkOpenId:  match.openId,
    }
  } catch {
    return null   // Lark unreachable — fall back to local DB role
  }
}
