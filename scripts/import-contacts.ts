/**
 * Import contacts into Envicion OS as Leads.
 *
 * Input:  scripts/_import_data/contacts.csv
 * Output: upsert into Lead table by email (idempotent — safe to re-run).
 *
 * Usage:
 *   cd ~/Desktop/Jobs/envision-os
 *   npx tsx scripts/import-contacts.ts           # dry-run (default)
 *   npx tsx scripts/import-contacts.ts --apply   # actually write to DB
 *
 * Notes:
 *   - Skips rows without email (Lead.email is required).
 *   - Competitors already excluded upstream (see competitors_excluded.csv).
 *   - Phone-only contacts stored in phone_only_audience.csv for WhatsApp use.
 *   - If a Lead with the same email already exists, we update only empty fields
 *     and preserve the user's existing status/score.
 */

import { PrismaClient, LeadStatus, LeadScore } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import fs from 'node:fs'
import path from 'node:path'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL required')
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const APPLY = process.argv.includes('--apply')
const CSV = path.join(__dirname, '_import_data', 'contacts.csv')

type Row = {
  name: string
  company: string
  email: string
  phone: string
  source: string
  score: string
  status: string
  notes: string
}

// Minimal CSV parser (handles quoted fields + embedded commas + embedded quotes).
function parseCSV(text: string): Row[] {
  const rows: string[][] = []
  let cur: string[] = []
  let field = ''
  let inQ = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') inQ = false
      else field += ch
    } else {
      if (ch === '"') inQ = true
      else if (ch === ',') { cur.push(field); field = '' }
      else if (ch === '\n') { cur.push(field); rows.push(cur); cur = []; field = '' }
      else if (ch === '\r') { /* skip */ }
      else field += ch
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur) }
  const [header, ...data] = rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''))
  return data.map(r => {
    const o: Record<string, string> = {}
    header.forEach((h, i) => { o[h] = (r[i] ?? '').trim() })
    return o as Row
  })
}

function toScore(s: string): LeadScore {
  if (s === 'HOT' || s === 'WARM' || s === 'COLD') return s as LeadScore
  return 'COLD'
}
function toStatus(s: string): LeadStatus {
  const allowed = ['NEW','QUALIFIED','PROPOSAL_SENT','NEGOTIATING','WON','LOST','NURTURE']
  return (allowed.includes(s) ? s : 'NEW') as LeadStatus
}

async function main() {
  if (!fs.existsSync(CSV)) throw new Error(`Missing CSV at ${CSV}`)
  const text = fs.readFileSync(CSV, 'utf8')
  const rows = parseCSV(text)

  console.log(`\nLoaded ${rows.length} rows from ${path.basename(CSV)}`)
  console.log(`Mode: ${APPLY ? '\x1b[31mAPPLY (writing to DB)\x1b[0m' : '\x1b[33mDRY RUN (no writes)\x1b[0m'}`)

  const byScore: Record<string, number> = {}
  const byStatus: Record<string, number> = {}
  let created = 0, updated = 0, invalid = 0

  for (const r of rows) {
    if (!r.email || !r.name) { invalid++; continue }
    byScore[r.score] = (byScore[r.score] || 0) + 1
    byStatus[r.status] = (byStatus[r.status] || 0) + 1

    if (!APPLY) continue

    const existing = await prisma.lead.findFirst({ where: { email: r.email } })
    if (existing) {
      await prisma.lead.update({
        where: { id: existing.id },
        data: {
          // Preserve user-managed state; only backfill empty fields.
          name:    existing.name    || r.name,
          company: existing.company || r.company,
          phone:   existing.phone   || r.phone || null,
          source:  existing.source  || r.source,
          notes: existing.notes
            ? existing.notes
            : r.notes,
        },
      })
      updated++
    } else {
      await prisma.lead.create({
        data: {
          name: r.name,
          company: r.company,
          email: r.email,
          phone: r.phone || null,
          source: r.source,
          score: toScore(r.score),
          status: toStatus(r.status),
          notes: r.notes,
        },
      })
      created++
    }
  }

  console.log('\n--- Summary ---')
  console.log('by score :', byScore)
  console.log('by status:', byStatus)
  console.log('invalid  :', invalid)
  if (APPLY) {
    console.log(`created  : ${created}`)
    console.log(`updated  : ${updated}`)
  } else {
    console.log('Run again with --apply to write to the database.')
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
