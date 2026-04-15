import { prisma } from '@/lib/db'
import { getUpcomingSeasonalEvents } from '@/lib/holidays'

export interface DesignerKPIs {
  onTimeRate: number
  avgRevisionCount: number
  outputCount: number
  avgCompletionMinutes: number
  qualityScore: number
}

export interface CSKPIs {
  avgResponseTimeHours: number
  clientSatisfactionScore: number
  revisionEscalationRate: number
  projectsOnTime: number
  unbilledCount: number
}

export interface SalesKPIs {
  leadsGenerated: number
  closeRate: number
  revenue: number
  targetGap: number
  upsellRevenue: number
  avgDealSize: number
}

export interface DesignerUtilisation {
  userId: string
  name: string
  utilisation: number
  status: 'healthy' | 'warning' | 'critical'
}

export interface TeamUtilisation {
  overall: number
  byDesigner: DesignerUtilisation[]
}

export interface ProjectProfitability {
  revenue: number
  cost: number
  profit: number
  margin: number
}

export interface RevenueOverview {
  projected: number
  ongoing: number
  unbilled: number
  billed: number
  paid: number
  target: number
  gap: number
}

export interface SeasonalAlert {
  event: string
  date: Date
  daysAway: number
  expectedDemandMultiplier: number
  capacityGap: number
  recommendation: string
}

function periodFilter(period: 'WEEK' | 'MONTH'): Date {
  const now = new Date()
  if (period === 'WEEK') {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  }
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

export async function getDesignerKPIs(
  userId: string,
  period: 'WEEK' | 'MONTH'
): Promise<DesignerKPIs> {
  const since = periodFilter(period)

  const items = await prisma.deliverableItem.findMany({
    where: {
      assignedDesignerId: userId,
      createdAt: { gte: since },
    },
    include: {
      qcChecks: { select: { passed: true } },
    },
  })

  const completed = items.filter((i) => ['APPROVED', 'DELIVERED', 'FA_SIGNED'].includes(i.status))
  const total = items.length

  const onTimeCount = completed.filter((i) => {
    if (!i.deadline) return true
    return i.deadline >= (i.createdAt ?? new Date())
  }).length

  const onTimeRate = completed.length > 0 ? Math.round((onTimeCount / completed.length) * 100) : 100

  const avgRevisionCount =
    total > 0
      ? Math.round((items.reduce((s, i) => s + i.revisionCount, 0) / total) * 10) / 10
      : 0

  const itemsWithTime = items.filter((i) => i.actualMinutes !== null)
  const avgCompletionMinutes =
    itemsWithTime.length > 0
      ? Math.round(
          itemsWithTime.reduce((s, i) => s + (i.actualMinutes ?? 0), 0) / itemsWithTime.length
        )
      : 0

  const allQC = items.flatMap((i) => i.qcChecks)
  const passedQC = allQC.filter((q) => q.passed).length
  const qualityScore = allQC.length > 0 ? Math.round((passedQC / allQC.length) * 100) : 100

  return {
    onTimeRate,
    avgRevisionCount,
    outputCount: completed.length,
    avgCompletionMinutes,
    qualityScore,
  }
}

export async function getCSKPIs(
  userId: string,
  period: 'WEEK' | 'MONTH'
): Promise<CSKPIs> {
  const since = periodFilter(period)

  const projects = await prisma.project.findMany({
    where: {
      assignedCSId: userId,
      createdAt: { gte: since },
    },
    include: {
      chatMessages: { orderBy: { createdAt: 'asc' } },
      deliverableItems: { select: { revisionCount: true, revisionLimit: true } },
    },
  })

  // Calculate avg response time from chat messages
  let totalResponseMs = 0
  let responseCount = 0

  for (const project of projects) {
    const messages = project.chatMessages
    for (let i = 0; i < messages.length - 1; i++) {
      const current = messages[i]
      const next = messages[i + 1]
      if (current.senderType === 'CLIENT' && next.senderType === 'CS') {
        totalResponseMs += new Date(next.createdAt).getTime() - new Date(current.createdAt).getTime()
        responseCount++
      }
    }
  }

  const avgResponseTimeHours =
    responseCount > 0
      ? Math.round((totalResponseMs / responseCount / (1000 * 60 * 60)) * 10) / 10
      : 0

  // Revision escalation rate
  const allItems = projects.flatMap((p) => p.deliverableItems)
  const escalatedCount = allItems.filter((i) => i.revisionCount > i.revisionLimit).length
  const revisionEscalationRate =
    allItems.length > 0 ? Math.round((escalatedCount / allItems.length) * 100) : 0

  // Projects on time
  const completedProjects = projects.filter((p) =>
    ['COMPLETED', 'BILLED', 'PAID'].includes(p.status)
  )
  const onTimeProjects = completedProjects.filter(
    (p) => !p.deadline || new Date(p.deadline) >= new Date(p.updatedAt)
  ).length
  const projectsOnTime =
    completedProjects.length > 0
      ? Math.round((onTimeProjects / completedProjects.length) * 100)
      : 100

  // Unbilled count
  const unbilledCount = projects.filter((p) => p.status === 'COMPLETED').length

  return {
    avgResponseTimeHours,
    clientSatisfactionScore: Math.max(0, 100 - revisionEscalationRate * 2),
    revisionEscalationRate,
    projectsOnTime,
    unbilledCount,
  }
}

export async function getSalesKPIs(
  userId: string,
  period: 'WEEK' | 'MONTH'
): Promise<SalesKPIs> {
  const since = periodFilter(period)

  const leads = await prisma.lead.findMany({
    where: {
      assignedSalesId: userId,
      createdAt: { gte: since },
    },
  })

  const wonLeads = leads.filter((l) => l.status === 'WON')
  const closeRate =
    leads.length > 0 ? Math.round((wonLeads.length / leads.length) * 100) : 0

  // Get revenue from converted clients' projects
  const wonClients = await prisma.client.findMany({
    where: { assignedSalesId: userId },
    include: {
      projects: {
        where: { createdAt: { gte: since } },
        select: { paidAmount: true, billedAmount: true },
      },
    },
  })

  const revenue = wonClients.flatMap((c) => c.projects).reduce((s, p) => s + p.paidAmount, 0)
  const billedTotal = wonClients.flatMap((c) => c.projects).reduce((s, p) => s + p.billedAmount, 0)

  // Get target
  const target = await prisma.target.findFirst({
    where: {
      setById: userId,
      metric: 'revenue',
      period: period === 'MONTH' ? new Date().toISOString().slice(0, 7) : 'week',
    },
    orderBy: { createdAt: 'desc' },
  })

  const targetValue = target?.targetValue ?? 50000
  const targetGap = Math.max(0, targetValue - revenue)

  const avgDealSize = wonClients.length > 0 ? Math.round(billedTotal / wonClients.length) : 0

  return {
    leadsGenerated: leads.length,
    closeRate,
    revenue,
    targetGap,
    upsellRevenue: 0, // tracked separately via package type
    avgDealSize,
  }
}

export async function getTeamUtilisation(date: Date): Promise<TeamUtilisation> {
  const dateStr = date.toISOString().slice(0, 10)

  const slots = await prisma.workloadSlot.findMany({
    where: {
      date: {
        gte: new Date(dateStr),
        lt: new Date(new Date(dateStr).getTime() + 24 * 60 * 60 * 1000),
      },
    },
    include: { user: { select: { id: true, name: true } } },
  })

  const byDesigner: DesignerUtilisation[] = slots.map((slot) => {
    const utilisation =
      slot.capacityMinutes > 0
        ? Math.round((slot.committedMinutes / slot.capacityMinutes) * 100)
        : 0
    const status: 'healthy' | 'warning' | 'critical' =
      utilisation >= 90 ? 'critical' : utilisation >= 70 ? 'warning' : 'healthy'

    return {
      userId: slot.userId,
      name: slot.user.name,
      utilisation,
      status,
    }
  })

  const overall =
    byDesigner.length > 0
      ? Math.round(byDesigner.reduce((s, d) => s + d.utilisation, 0) / byDesigner.length)
      : 0

  return { overall, byDesigner }
}

export async function getProjectProfitability(projectId: string): Promise<ProjectProfitability> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      deliverableItems: {
        select: { actualMinutes: true, assignedDesignerId: true },
      },
      invoices: { select: { amount: true, status: true } },
    },
  })

  const revenue = project.paidAmount
  const hourlyRate = 80 // RM 80/hr default — configurable via env later

  const designerCost = project.deliverableItems.reduce((sum, item) => {
    if (!item.actualMinutes) return sum
    return sum + (item.actualMinutes / 60) * hourlyRate
  }, 0)

  const profit = revenue - designerCost
  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0

  return {
    revenue,
    cost: Math.round(designerCost),
    profit: Math.round(profit),
    margin,
  }
}

export async function getRevenueOverview(
  period: 'MONTH' | 'QUARTER' | 'YEAR'
): Promise<RevenueOverview> {
  const now = new Date()
  let since: Date

  if (period === 'MONTH') {
    since = new Date(now.getFullYear(), now.getMonth(), 1)
  } else if (period === 'QUARTER') {
    const quarter = Math.floor(now.getMonth() / 3)
    since = new Date(now.getFullYear(), quarter * 3, 1)
  } else {
    since = new Date(now.getFullYear(), 0, 1)
  }

  const projects = await prisma.project.findMany({
    where: { createdAt: { gte: since } },
    select: {
      status: true,
      quotedAmount: true,
      billedAmount: true,
      paidAmount: true,
    },
  })

  const projected = projects
    .filter((p) => p.status === 'PROJECTED')
    .reduce((s, p) => s + p.quotedAmount, 0)
  const ongoing = projects
    .filter((p) => p.status === 'ONGOING')
    .reduce((s, p) => s + p.quotedAmount, 0)
  const unbilled = projects
    .filter((p) => p.status === 'COMPLETED')
    .reduce((s, p) => s + p.billedAmount, 0)
  const billed = projects
    .filter((p) => p.status === 'BILLED')
    .reduce((s, p) => s + p.billedAmount, 0)
  const paid = projects
    .filter((p) => p.status === 'PAID')
    .reduce((s, p) => s + p.paidAmount, 0)

  const target = await prisma.target.findFirst({
    where: {
      metric: 'revenue',
      period: period.toLowerCase(),
    },
    orderBy: { createdAt: 'desc' },
  })

  const targetValue = target?.targetValue ?? 150000
  const gap = Math.max(0, targetValue - paid)

  return { projected, ongoing, unbilled, billed, paid, target: targetValue, gap }
}

export async function getSeasonalForecast(): Promise<SeasonalAlert[]> {
  const upcoming = getUpcomingSeasonalEvents(60)

  const utilisation = await getTeamUtilisation(new Date())
  const currentUtil = utilisation.overall

  return upcoming.map((event) => {
    const projectedDemand = event.typicalDemandMultiplier * 100
    const capacityGap = Math.max(0, projectedDemand - currentUtil)

    const recommendation =
      capacityGap > 50
        ? `Hire freelancers immediately — expected ${event.typicalDemandMultiplier}x demand`
        : capacityGap > 20
        ? `Prepare team roster — ${event.typicalDemandMultiplier}x demand expected`
        : `Monitor capacity — demand spike in ${event.daysAway} days`

    return {
      event: event.name,
      date: event.date,
      daysAway: event.daysAway,
      expectedDemandMultiplier: event.typicalDemandMultiplier,
      capacityGap,
      recommendation,
    }
  })
}
