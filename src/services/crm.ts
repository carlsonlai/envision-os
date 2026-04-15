import { prisma } from '@/lib/db'
import { ClientTier, LeadStatus, LeadScore } from '@prisma/client'

export interface CreateLeadData {
  name: string
  company: string
  email: string
  phone?: string
  source?: string
  score?: LeadScore
  assignedSalesId?: string
  notes?: string
}

export interface Lead {
  id: string
  name: string
  company: string
  email: string
  phone: string | null
  source: string | null
  score: LeadScore
  status: LeadStatus
  assignedSalesId: string | null
  notes: string | null
  createdAt: Date
}

export interface Client {
  id: string
  companyName: string
  contactPerson: string
  email: string
  phone: string | null
  tier: ClientTier
  ltv: number
  assignedCSId: string | null
  assignedSalesId: string | null
  createdAt: Date
}

export interface PipelineData {
  NEW: Lead[]
  QUALIFIED: Lead[]
  PROPOSAL_SENT: Lead[]
  NEGOTIATING: Lead[]
  WON: Lead[]
  LOST: Lead[]
  NURTURE: Lead[]
}

export interface ChurnRisk {
  risk: 'HIGH' | 'MEDIUM' | 'LOW'
  signals: string[]
  daysSinceLastContact: number
}

export interface CompetitorReport {
  losses: Array<{
    id: string
    leadId: string
    competitor: string
    reason: string
    createdAt: Date
  }>
  topCompetitors: Array<{ competitor: string; count: number }>
}

export async function createLead(data: CreateLeadData): Promise<Lead> {
  const lead = await prisma.lead.create({
    data: {
      name: data.name,
      company: data.company,
      email: data.email,
      phone: data.phone,
      source: data.source,
      score: data.score ?? 'COLD',
      status: 'NEW',
      assignedSalesId: data.assignedSalesId,
      notes: data.notes,
    },
  })
  return lead
}

export async function updateLeadStatus(
  leadId: string,
  status: LeadStatus,
  reason?: string
): Promise<Lead> {
  const lead = await prisma.lead.update({
    where: { id: leadId },
    data: {
      status,
      notes: reason
        ? `[Status: ${status}] ${reason}`
        : undefined,
    },
  })
  return lead
}

export async function convertLeadToClient(
  leadId: string,
  csId: string,
  salesId: string
): Promise<Client> {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } })

  const client = await prisma.client.create({
    data: {
      companyName: lead.company,
      contactPerson: lead.name,
      email: lead.email,
      phone: lead.phone,
      assignedCSId: csId,
      assignedSalesId: salesId,
      tier: 'BRONZE',
      ltv: 0,
    },
  })

  await prisma.lead.update({
    where: { id: leadId },
    data: { status: 'WON' },
  })

  return client
}

export async function getLeadPipeline(salesId?: string): Promise<PipelineData> {
  const where = salesId ? { assignedSalesId: salesId } : {}
  const leads = await prisma.lead.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  const pipeline: PipelineData = {
    NEW: [],
    QUALIFIED: [],
    PROPOSAL_SENT: [],
    NEGOTIATING: [],
    WON: [],
    LOST: [],
    NURTURE: [],
  }

  for (const lead of leads) {
    pipeline[lead.status].push(lead)
  }

  return pipeline
}

export async function calculateClientLTV(clientId: string): Promise<number> {
  const projects = await prisma.project.findMany({
    where: { clientId },
    select: { paidAmount: true },
  })

  const ltv = projects.reduce((sum, p) => sum + (Number(p.paidAmount) || 0), 0)

  await prisma.client.update({
    where: { id: clientId },
    data: { ltv },
  })

  return ltv
}

export async function updateClientTier(clientId: string): Promise<ClientTier> {
  const ltv = await calculateClientLTV(clientId)

  const tier: ClientTier =
    ltv >= 50000
      ? 'PLATINUM'
      : ltv >= 20000
      ? 'GOLD'
      : ltv >= 5000
      ? 'SILVER'
      : 'BRONZE'

  await prisma.client.update({
    where: { id: clientId },
    data: { tier },
  })

  return tier
}

export async function detectChurnRisk(clientId: string): Promise<ChurnRisk> {
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: clientId },
    include: {
      projects: {
        orderBy: { updatedAt: 'desc' },
        take: 5,
        include: {
          deliverableItems: { select: { revisionCount: true, revisionLimit: true } },
          chatMessages: { orderBy: { createdAt: 'desc' }, take: 20, select: { content: true, createdAt: true } },
        },
      },
    },
  })

  const signals: string[] = []
  let daysSinceLastContact = 0

  // Check last chat message date
  const allMessages = client.projects.flatMap((p) => p.chatMessages)
  if (allMessages.length > 0) {
    const lastMsg = allMessages.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0]
    daysSinceLastContact = Math.floor(
      (Date.now() - new Date(lastMsg.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysSinceLastContact >= 7) {
      signals.push(`No contact for ${daysSinceLastContact} days`)
    }
  } else {
    daysSinceLastContact = 999
    signals.push('No communication history')
  }

  // Check revision spike
  for (const project of client.projects) {
    for (const item of project.deliverableItems) {
      if (item.revisionCount >= item.revisionLimit) {
        signals.push('Revision limit reached on active project')
        break
      }
    }
  }

  // Keyword scan in recent messages
  const negativeKeywords = ['disappointed', 'wrong', 'not what i wanted', 'not happy', 'unhappy', 'poor']
  const recentText = allMessages
    .slice(0, 10)
    .map((m) => m.content.toLowerCase())
    .join(' ')

  for (const kw of negativeKeywords) {
    if (recentText.includes(kw)) {
      signals.push(`Negative sentiment detected: "${kw}"`)
    }
  }

  const risk: 'HIGH' | 'MEDIUM' | 'LOW' =
    signals.length >= 3 || daysSinceLastContact >= 14
      ? 'HIGH'
      : signals.length >= 1
      ? 'MEDIUM'
      : 'LOW'

  return { risk, signals, daysSinceLastContact }
}

export async function logCompetitorLoss(
  leadId: string,
  competitor: string,
  reason: string
): Promise<void> {
  // Persist as a lead note since we don't have a separate competitors table
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } })
  const existingNotes = lead.notes ?? ''
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      notes: `${existingNotes}\n[COMPETITOR:${competitor}] ${reason}`.trim(),
      status: 'LOST',
    },
  })
}

export async function getCompetitorIntelligence(): Promise<CompetitorReport> {
  const lostLeads = await prisma.lead.findMany({
    where: { status: 'LOST', notes: { contains: '[COMPETITOR:' } },
    select: { id: true, notes: true, createdAt: true },
  })

  const losses: CompetitorReport['losses'] = []
  const competitorCount: Record<string, number> = {}

  for (const lead of lostLeads) {
    const matches = (lead.notes ?? '').matchAll(/\[COMPETITOR:([^\]]+)\]\s*(.+)/g)
    for (const match of matches) {
      const competitor = match[1].trim()
      const reason = match[2].trim()
      losses.push({ id: `${lead.id}-${competitor}`, leadId: lead.id, competitor, reason, createdAt: lead.createdAt })
      competitorCount[competitor] = (competitorCount[competitor] ?? 0) + 1
    }
  }

  const topCompetitors = Object.entries(competitorCount)
    .map(([competitor, count]) => ({ competitor, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return { losses, topCompetitors }
}
