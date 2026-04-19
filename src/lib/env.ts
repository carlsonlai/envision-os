/**
 * env.ts — Validates required environment variables at startup.
 * Import this in src/lib/db.ts or src/app/layout.tsx so it runs early.
 *
 * In development, missing OPTIONAL vars log a warning.
 * In production, missing REQUIRED vars throw immediately.
 */

interface EnvVar {
  key: string
  required: boolean
  description: string
}

const ENV_VARS: EnvVar[] = [
  // Auth
  { key: 'NEXTAUTH_SECRET',         required: true,  description: 'NextAuth signing secret' },
  { key: 'NEXTAUTH_URL',            required: false, description: 'App base URL for NextAuth callbacks' },
  // Database
  { key: 'DATABASE_URL',            required: true,  description: 'PostgreSQL connection string' },
  // Pusher real-time
  { key: 'PUSHER_APP_ID',           required: false, description: 'Pusher app ID (real-time events)' },
  { key: 'PUSHER_KEY',              required: false, description: 'Pusher key' },
  { key: 'PUSHER_SECRET',           required: false, description: 'Pusher secret' },
  { key: 'NEXT_PUBLIC_PUSHER_KEY',  required: false, description: 'Pusher key (client-side)' },
  // AI
  { key: 'ANTHROPIC_API_KEY',       required: false, description: 'Anthropic API key for AI features' },
  // Notifications
  { key: 'LARK_APP_ID',             required: false, description: 'Lark bot app ID' },
  { key: 'LARK_APP_SECRET',         required: false, description: 'Lark bot app secret' },
  { key: 'RESEND_API_KEY',          required: false, description: 'Resend API key for transactional email' },
  // Finance
  { key: 'BUKKU_API_KEY',           required: false, description: 'Bukku accounting API key' },
  // WhatsApp
  { key: 'WHATSAPP_TOKEN',          required: false, description: 'WhatsApp Cloud API token' },
  { key: 'WHATSAPP_PHONE_ID',       required: false, description: 'WhatsApp sender phone ID' },
  // Inngest (autonomous agents)
  { key: 'INNGEST_SIGNING_KEY',     required: false, description: 'Inngest signing key (agents run on schedule)' },
  { key: 'INNGEST_EVENT_KEY',       required: false, description: 'Inngest event key (agents triggered by events)' },
  // Cron protection
  { key: 'CRON_SECRET',             required: false, description: 'Bearer token protecting /api/cron/* routes' },
]

export function validateEnv(): void {
  const isProd = process.env.NODE_ENV === 'production'
  const missing: string[] = []
  const warnings: string[] = []

  for (const { key, required, description } of ENV_VARS) {
    const value = process.env[key]
    if (!value || value.trim() === '') {
      if (required && isProd) {
        missing.push(`  ✗ ${key} — ${description}`)
      } else if (!required) {
        warnings.push(`  ⚠ ${key} — ${description} (feature may be disabled)`)
      }
    }
  }

  if (warnings.length > 0 && !isProd) {
    process.stdout.write(
      `\n[env] Optional environment variables not set:\n${warnings.join('\n')}\n\n`
    )
  }

  if (missing.length > 0) {
    throw new Error(
      `\n\n[env] Missing required environment variables:\n${missing.join('\n')}\n\n` +
      `Copy .env.example to .env and fill in the required values.\n`
    )
  }
}

// Run validation immediately when this module is imported
validateEnv()
