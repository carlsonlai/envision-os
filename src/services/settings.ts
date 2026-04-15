import { prisma } from '@/lib/db'

export interface SystemSettings {
  id: string
  autopilotMode: boolean
  autoAssignEnabled: boolean
  larkGanttEnabled: boolean
  larkBriefEnabled: boolean
  autoImportQuotes: boolean
  autoImportInvoices: boolean
  overloadThreshold: number
  weeklyDigestDay: number
  salesAutopilotEnabled: boolean
  updatedAt: Date
  updatedById: string | null
}

export type SettingsUpdate = Partial<Omit<SystemSettings, 'id' | 'updatedAt'>>

const DEFAULTS: Omit<SystemSettings, 'id' | 'updatedAt' | 'updatedById'> = {
  autopilotMode: false,
  autoAssignEnabled: true,
  larkGanttEnabled: true,
  larkBriefEnabled: true,
  autoImportQuotes: false,
  autoImportInvoices: false,
  overloadThreshold: 90,
  weeklyDigestDay: 1,
  salesAutopilotEnabled: false,
}

// ─── Raw SQL helpers (SystemSettings model added after Prisma client generation) ──

async function rawGet(): Promise<SystemSettings | null> {
  const rows = await prisma.$queryRawUnsafe<SystemSettings[]>(
    `SELECT id, "autopilotMode", "autoAssignEnabled", "larkGanttEnabled", "larkBriefEnabled",
            "autoImportQuotes", "autoImportInvoices", "overloadThreshold", "weeklyDigestDay",
            COALESCE("salesAutopilotEnabled", false) AS "salesAutopilotEnabled",
            "updatedAt", "updatedById"
     FROM "system_settings"
     WHERE id = 'singleton'
     LIMIT 1`
  )
  return rows[0] ?? null
}

async function rawCreate(): Promise<SystemSettings> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "system_settings"
       (id, "autopilotMode", "autoAssignEnabled", "larkGanttEnabled", "larkBriefEnabled",
        "autoImportQuotes", "autoImportInvoices", "overloadThreshold", "weeklyDigestDay", "updatedAt", "updatedById")
     VALUES
       ('singleton', $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NULL)
     ON CONFLICT (id) DO NOTHING`,
    DEFAULTS.autopilotMode,
    DEFAULTS.autoAssignEnabled,
    DEFAULTS.larkGanttEnabled,
    DEFAULTS.larkBriefEnabled,
    DEFAULTS.autoImportQuotes,
    DEFAULTS.autoImportInvoices,
    DEFAULTS.overloadThreshold,
    DEFAULTS.weeklyDigestDay
  )
  const row = await rawGet()
  if (!row) throw new Error('Failed to create system_settings singleton')
  return row
}

async function rawUpdate(data: SettingsUpdate, updatedById?: string): Promise<SystemSettings> {
  const sets: string[] = []
  const values: unknown[] = []
  let idx = 1

  const fieldMap: Record<string, string> = {
    autopilotMode: '"autopilotMode"',
    autoAssignEnabled: '"autoAssignEnabled"',
    larkGanttEnabled: '"larkGanttEnabled"',
    larkBriefEnabled: '"larkBriefEnabled"',
    autoImportQuotes: '"autoImportQuotes"',
    autoImportInvoices: '"autoImportInvoices"',
    overloadThreshold: '"overloadThreshold"',
    weeklyDigestDay: '"weeklyDigestDay"',
    salesAutopilotEnabled: '"salesAutopilotEnabled"',
    updatedById: '"updatedById"',
  }

  for (const [key, val] of Object.entries(data)) {
    if (val === undefined) continue
    sets.push(`${fieldMap[key]} = $${idx}`)
    values.push(val)
    idx++
  }

  // Always update updatedAt and updatedById
  sets.push(`"updatedAt" = NOW()`)
  sets.push(`"updatedById" = $${idx}`)
  values.push(updatedById ?? null)

  await prisma.$executeRawUnsafe(
    `UPDATE "system_settings" SET ${sets.join(', ')} WHERE id = 'singleton'`,
    ...values
  )

  const row = await rawGet()
  if (!row) throw new Error('Failed to update system_settings singleton')
  return row
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get the system settings singleton.
 * Always returns a value — creates the row with defaults if it doesn't exist.
 */
export async function getSettings(): Promise<SystemSettings> {
  const existing = await rawGet()
  if (existing) return existing
  return rawCreate()
}

/**
 * Update specific settings fields.
 */
export async function updateSettings(
  data: SettingsUpdate,
  updatedById?: string
): Promise<SystemSettings> {
  const existing = await rawGet()
  if (!existing) await rawCreate()
  return rawUpdate(data, updatedById)
}

/**
 * Convenience: get the current autopilot mode.
 */
export async function isAutopilot(): Promise<boolean> {
  const settings = await getSettings()
  return settings.autopilotMode
}
