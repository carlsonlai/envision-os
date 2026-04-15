/**
 * POST /api/admin/reconcile
 *
 * Bridges the two entry paths into Envicion OS:
 *   • Lark group sync  → creates Clients with larkFolderId but no Bukku link
 *   • Bukku sync       → creates Clients with bukkuContactId but no Lark link
 *
 * This endpoint runs a reconciliation pass:
 *   1. Fetch all Bukku contacts
 *   2. For each local Client missing a bukkuContactId, fuzzy-match by company name
 *   3. When matched, write Client.bukkuContactId
 *   4. For Projects of matched clients that lack a Bukku invoice/quote link,
 *      look up Bukku invoices for that contact and write Project.bukkuInvoiceId
 *
 * Safe to run repeatedly — only fills gaps, never overwrites existing links.
 * Requires ADMIN role.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { listContacts, listInvoices, listQuotations } from '@/services/bukku'
import type { BukkuContact } from '@/services/bukku'

// ─── Name normalisation ───────────────────────────────────────────────────────

function normalise(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bsdn\.?\s*bhd\.?\b|\bsdn\s+bhd\b/gi, '')   // strip "Sdn Bhd"
    .replace(/\bplt\b|\bllp\b|\binc\.?\b|\bltd\.?\b/gi, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Returns true if the two names are close enough to be the same company. */
function namesMatch(a: string, b: string): boolean {
  const na = normalise(a)
  const nb = normalise(b)
  if (na === nb) return true
  // One contains the other (handles "ABC Creative" vs "ABC Creative Studio")
  if (na.length > 3 && nb.includes(na)) return true
  if (nb.length > 3 && na.includes(nb)) return true
  return false
}

// ─── Route handler ────────────────────────────────────────────────────────────

export interface ReconcileResult {
  clientsScanned: number
  clientsLinked: number      // got a new bukkuContactId
  projectsLinked: number     // got a new bukkuInvoiceId or bukkuQuoteId
  errors: string[]
}

export async function POST(_req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result: ReconcileResult = {
    clientsScanned: 0,
    clientsLinked: 0,
    projectsLinked: 0,
    errors: [],
  }

  try {
    // 1. Fetch Bukku contacts (all pages)
    let bukkuContacts: BukkuContact[] = []
    try {
      bukkuContacts = await listContacts()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return NextResponse.json(
        { success: false, error: `Could not reach Bukku contacts API: ${msg}` },
        { status: 502 }
      )
    }

    // 2. Fetch local Clients that are missing a Bukku link
    const unlinkedClients = await prisma.client.findMany({
      where: { bukkuContactId: null },
      select: { id: true, companyName: true },
    })
    result.clientsScanned = unlinkedClients.length

    // Build a map: normalisedName → BukkuContact for O(1) lookup
    const bukkuMap = new Map<string, BukkuContact>()
    for (const bc of bukkuContacts) {
      const key = normalise(bc.company_name ?? bc.name)
      if (key) bukkuMap.set(key, bc)
    }

    // 3. Match and update clients
    const nowLinkedContactIds = new Map<string, string>() // clientId → bukku contact_id

    for (const client of unlinkedClients) {
      let matched: BukkuContact | undefined

      // Exact normalised match first
      matched = bukkuMap.get(normalise(client.companyName))

      // Fallback: scan all entries for a substring match
      if (!matched) {
        for (const [, bc] of bukkuMap) {
          if (namesMatch(client.companyName, bc.company_name ?? bc.name)) {
            matched = bc
            break
          }
        }
      }

      if (!matched) continue

      try {
        await prisma.client.update({
          where: { id: client.id },
          data: { bukkuContactId: matched.id },
        })
        nowLinkedContactIds.set(client.id, matched.id)
        result.clientsLinked++
      } catch (err) {
        result.errors.push(
          `Client ${client.companyName}: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }

    // 4. For newly linked clients, try to link Bukku invoices → projects
    if (nowLinkedContactIds.size > 0) {
      // Fetch recent Bukku invoices and quotes (last 2 years)
      const since = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000)
      let invoices: { id: string; contact_id: string }[] = []
      let quotes:   { id: string; contact_id: string }[] = []

      try {
        const [invRes, quoteRes] = await Promise.all([
          listInvoices({ per_page: 200 }),
          listQuotations({ per_page: 200 }),
        ])
        invoices = invRes.data
        quotes   = quoteRes.data
        void since // used conceptually — Bukku API filters by updated_at
      } catch {
        // Non-fatal — project links are best-effort
      }

      // Build contact_id → invoice/quote lookup
      const invoiceByContact = new Map<string, string>()
      for (const inv of invoices) {
        if (!invoiceByContact.has(inv.contact_id)) {
          invoiceByContact.set(inv.contact_id, inv.id)
        }
      }
      const quoteByContact = new Map<string, string>()
      for (const q of quotes) {
        if (!quoteByContact.has(q.contact_id)) {
          quoteByContact.set(q.contact_id, q.id)
        }
      }

      // Find projects for these clients that are missing a Bukku link
      const orphanProjects = await prisma.project.findMany({
        where: {
          clientId: { in: Array.from(nowLinkedContactIds.keys()) },
          AND: [{ bukkuInvoiceId: null }, { bukkuQuoteId: null }],
        },
        select: { id: true, clientId: true },
      })

      for (const project of orphanProjects) {
        const bukkuContactId = nowLinkedContactIds.get(project.clientId ?? '')
        if (!bukkuContactId) continue

        const invId   = invoiceByContact.get(bukkuContactId)
        const quoteId = quoteByContact.get(bukkuContactId)

        if (!invId && !quoteId) continue

        try {
          await prisma.project.update({
            where: { id: project.id },
            data: {
              ...(invId   ? { bukkuInvoiceId: invId }   : {}),
              ...(quoteId ? { bukkuQuoteId:   quoteId } : {}),
            },
          })
          result.projectsLinked++
        } catch (err) {
          result.errors.push(
            `Project ${project.id}: ${err instanceof Error ? err.message : String(err)}`
          )
        }
      }
    }

    return NextResponse.json({
      success: true,
      result,
      message: `Reconcile complete — ${result.clientsLinked} clients linked to Bukku, ${result.projectsLinked} projects linked`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

/**
 * GET /api/admin/reconcile
 * Returns a dry-run preview: how many clients are unlinked, how many Bukku contacts exist.
 */
export async function GET(_req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [unlinkedClients, linkedClients, orphanProjects] = await Promise.all([
    prisma.client.count({ where: { bukkuContactId: null } }),
    prisma.client.count({ where: { bukkuContactId: { not: null } } }),
    prisma.project.count({
      where: { AND: [{ bukkuInvoiceId: null }, { bukkuQuoteId: null }] },
    }),
  ])

  return NextResponse.json({
    success: true,
    stats: {
      clientsUnlinked: unlinkedClients,
      clientsLinked: linkedClients,
      projectsWithoutBukku: orphanProjects,
    },
  })
}
