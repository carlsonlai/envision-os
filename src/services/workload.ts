import { prisma } from '@/lib/db'
import { DeliverableItem, ItemType, Role, User } from '@prisma/client'
import { notify } from '@/services/lark'
import { logger, getErrorMessage } from '@/lib/logger'

// ─── Extended types for AI context ───────────────────────────────────────────

export interface DeliverableWithProject {
  id: string
  description: string | null
  itemType: ItemType
  status: string
  deadline: Date | null
  estimatedMinutes: number | null
  projectCode: string
  clientName: string
  assignedDesignerName: string | null
}

export interface DesignerWorkloadDetail {
  userId: string
  name: string
  email: string
  role: Role
  totalPendingTasks: number
  totalEstimatedMinutes: number
  utilizationToday: number
  nearestDeadline: Date | null
  isOverloaded: boolean
  tasks: DeliverableWithProject[]
}

export interface ProjectTimeline {
  projectId: string
  projectCode: string
  clientName: string
  status: string
  deadline: Date | null
  deliverables: DeliverableWithProject[]
  completionPercent: number
  daysRemaining: number | null
}

export interface CompanyTimeline {
  generatedAt: Date
  activeProjects: ProjectTimeline[]
  designerWorkload: DesignerWorkloadDetail[]
  overloadedDesigners: string[]
  criticalDeadlines: DeliverableWithProject[]   // due within 3 days
  unassignedTasks: DeliverableWithProject[]
  totalPendingTasks: number
  totalEstimatedHours: number
}

const DEFAULT_CAPACITY_MINUTES = 480

const ITEM_ESTIMATE_MINUTES: Record<ItemType, number> = {
  [ItemType.BANNER]: 90,
  [ItemType.BROCHURE]: 180,
  [ItemType.LOGO]: 240,
  [ItemType.SOCIAL]: 60,
  [ItemType.PRINT]: 120,
  [ItemType.THREE_D]: 300,
  [ItemType.VIDEO]: 240,
  [ItemType.OTHER]: 120,
}

export interface CapacityInfo {
  userId: string
  date: Date
  committedMinutes: number
  capacityMinutes: number
  availableMinutes: number
  utilizationPercent: number
}

export interface TeamCapacity {
  user: Pick<User, 'id' | 'name' | 'email' | 'role'>
  slots: CapacityInfo[]
  averageUtilization: number
}

export interface Alert {
  userId: string
  userName: string
  date: Date
  utilizationPercent: number
  message: string
}

export async function getDesignerCapacity(userId: string, date: Date): Promise<CapacityInfo> {
  const dateOnly = new Date(date.toISOString().split('T')[0])

  const slot = await prisma.workloadSlot.findUnique({
    where: {
      userId_date: {
        userId,
        date: dateOnly,
      },
    },
  })

  const committedMinutes = slot?.committedMinutes ?? 0
  const capacityMinutes = slot?.capacityMinutes ?? DEFAULT_CAPACITY_MINUTES
  const availableMinutes = Math.max(0, capacityMinutes - committedMinutes)
  const utilizationPercent = Math.round((committedMinutes / capacityMinutes) * 100)

  return {
    userId,
    date: dateOnly,
    committedMinutes,
    capacityMinutes,
    availableMinutes,
    utilizationPercent,
  }
}

export async function getTeamCapacity(date: Date): Promise<TeamCapacity[]> {
  const designers = await prisma.user.findMany({
    where: {
      active: true,
      role: {
        in: [
          Role.JUNIOR_ART_DIRECTOR,
          Role.GRAPHIC_DESIGNER,
          Role.JUNIOR_DESIGNER,
          Role.DESIGNER_3D,
          Role.DIGITAL_MARKETING,
          Role.SENIOR_ART_DIRECTOR,
        ],
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  })

  const dateOnly = new Date(date.toISOString().split('T')[0])

  const teamCapacity = await Promise.all(
    designers.map(async (designer) => {
      const capacityInfo = await getDesignerCapacity(designer.id, dateOnly)

      return {
        user: designer,
        slots: [capacityInfo],
        averageUtilization: capacityInfo.utilizationPercent,
      }
    })
  )

  return teamCapacity
}

export async function autoAssign(deliverableItem: DeliverableItem): Promise<User> {
  if (!deliverableItem.deadline) {
    throw new Error('Deliverable item must have a deadline for auto-assignment')
  }

  const requiredSkillRole = getRequiredRoleForItemType(deliverableItem.itemType)
  const estimatedMinutes =
    deliverableItem.estimatedMinutes ?? ITEM_ESTIMATE_MINUTES[deliverableItem.itemType]
  const deadline = new Date(deliverableItem.deadline)
  const today = new Date()

  const defaultDesignerRoles: Role[] = [
    Role.JUNIOR_ART_DIRECTOR,
    Role.GRAPHIC_DESIGNER,
    Role.JUNIOR_DESIGNER,
    Role.DESIGNER_3D,
    Role.DIGITAL_MARKETING,
  ]

  // Find all designers with the required skill who are active
  const candidates = await prisma.user.findMany({
    where: {
      active: true,
      role: { in: requiredSkillRole ?? defaultDesignerRoles },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatar: true,
      active: true,
      createdAt: true,
      updatedAt: true,
      password: true,
      larkOpenId: true,
    },
  })

  if (candidates.length === 0) {
    throw new Error(`No available designers found for item type: ${deliverableItem.itemType}`)
  }

  // Score each candidate
  const scored = await Promise.all(
    candidates.map(async (candidate) => {
      // Check capacity between today and deadline
      let totalAvailableMinutes = 0
      const daysUntilDeadline = Math.ceil(
        (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      )

      for (let i = 0; i < daysUntilDeadline; i++) {
        const checkDate = new Date(today)
        checkDate.setDate(today.getDate() + i)
        const capacity = await getDesignerCapacity(candidate.id, checkDate)
        totalAvailableMinutes += capacity.availableMinutes
      }

      const todayCapacity = await getDesignerCapacity(candidate.id, today)
      const availabilityScore = todayCapacity.utilizationPercent < 90 ? 1 : 0
      const capacityScore = totalAvailableMinutes >= estimatedMinutes ? 1 : 0

      // Combined score: feasibility + utilization headroom
      const score = capacityScore * 10 + availabilityScore * 5 + (100 - todayCapacity.utilizationPercent)

      return { candidate, score, totalAvailableMinutes }
    })
  )

  // Filter candidates who can feasibly complete the work before deadline
  const feasible = scored.filter((s) => s.totalAvailableMinutes >= estimatedMinutes)
  const pool = feasible.length > 0 ? feasible : scored

  // Sort by score descending, pick highest scorer
  pool.sort((a, b) => b.score - a.score)
  const selected = pool[0].candidate

  // Update the deliverable item
  await prisma.deliverableItem.update({
    where: { id: deliverableItem.id },
    data: { assignedDesignerId: selected.id },
  })

  // Update workload slot for today
  const todayDate = new Date(today.toISOString().split('T')[0])
  const existingSlot = await prisma.workloadSlot.findUnique({
    where: {
      userId_date: {
        userId: selected.id,
        date: todayDate,
      },
    },
  })

  if (existingSlot) {
    await prisma.workloadSlot.update({
      where: { id: existingSlot.id },
      data: {
        committedMinutes: existingSlot.committedMinutes + estimatedMinutes,
      },
    })
  } else {
    await prisma.workloadSlot.create({
      data: {
        userId: selected.id,
        date: todayDate,
        committedMinutes: estimatedMinutes,
        capacityMinutes: DEFAULT_CAPACITY_MINUTES,
      },
    })
  }

  return selected
}

export async function checkCapacityAlerts(): Promise<Alert[]> {
  const today = new Date()
  const teamCapacity = await getTeamCapacity(today)
  const alerts: Alert[] = []

  for (const member of teamCapacity) {
    if (member.averageUtilization > 90) {
      const alert: Alert = {
        userId: member.user.id,
        userName: member.user.name,
        date: today,
        utilizationPercent: member.averageUtilization,
        message: `${member.user.name} is at ${member.averageUtilization}% capacity today — consider rebalancing workload.`,
      }
      alerts.push(alert)
    }
  }

  if (alerts.length > 0) {
    const alertBody = alerts
      .map((a) => `- ${a.userName}: **${a.utilizationPercent}%** utilisation`)
      .join('\n')

    await notify('MANAGEMENT', {
      title: 'Team Capacity Alert',
      body: `The following designers are over 90% capacity today:\n\n${alertBody}\n\nConsider redistributing tasks.`,
      actionLabel: 'View Workload',
      actionUrl: `${process.env.NEXTAUTH_URL}/cd`,
    })
  }

  return alerts
}

export async function rebalanceOnAbsence(absentUserId: string, date: Date): Promise<void> {
  const dateOnly = new Date(date.toISOString().split('T')[0])

  // Find all pending deliverable items assigned to absent designer due on or after this date
  const pendingItems = await prisma.deliverableItem.findMany({
    where: {
      assignedDesignerId: absentUserId,
      status: { in: ['PENDING', 'IN_PROGRESS'] },
      deadline: { gte: dateOnly },
    },
  })

  if (pendingItems.length === 0) {
    return
  }

  // Reassign each item
  const reassigned: string[] = []
  const failed: string[] = []

  for (const item of pendingItems) {
    try {
      const newAssignee = await autoAssign(item)
      reassigned.push(`${item.itemType} → ${newAssignee.name}`)
    } catch (error) {
      logger.error(`Failed to reassign item ${item.id}`, { error: getErrorMessage(error) })
      failed.push(item.id)
    }
  }

  // Clear absent designer's slot for that day
  await prisma.workloadSlot.upsert({
    where: {
      userId_date: {
        userId: absentUserId,
        date: dateOnly,
      },
    },
    update: { committedMinutes: 0 },
    create: {
      userId: absentUserId,
      date: dateOnly,
      committedMinutes: 0,
      capacityMinutes: 0,
    },
  })

  // Notify management
  const absentUser = await prisma.user.findUnique({
    where: { id: absentUserId },
    select: { name: true },
  })

  await notify('MANAGEMENT', {
    title: `Workload Rebalanced — ${absentUser?.name} Absent`,
    body: `${pendingItems.length} task(s) have been redistributed:\n\n${reassigned.map((r) => `- ${r}`).join('\n')}${failed.length > 0 ? `\n\n⚠ ${failed.length} item(s) could not be reassigned automatically.` : ''}`,
    actionLabel: 'Review Workload',
    actionUrl: `${process.env.NEXTAUTH_URL}/cd`,
  })
}

// ─── Full Company Timeline (for AI context) ───────────────────────────────────

/**
 * Returns a complete snapshot of the company's current workload:
 * - All active/projected projects with their deliverables and timelines
 * - Every designer's current task load and utilisation
 * - Critical deadlines (due within 3 days)
 * - Unassigned tasks that need immediate attention
 *
 * This is the primary function the AI uses to understand the company state
 * before making assignment or scheduling decisions.
 */
export async function getCompanyTimeline(): Promise<CompanyTimeline> {
  const now = new Date()
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

  // 1. Fetch all active/projected projects with deliverables
  const activeProjects = await prisma.project.findMany({
    where: {
      status: { in: ['PROJECTED', 'ONGOING'] },
    },
    include: {
      client: { select: { companyName: true } },
      deliverableItems: {
        include: {
          assignedDesigner: { select: { name: true } },
        },
      },
    },
    orderBy: { deadline: 'asc' },
  })

  const projectTimelines: ProjectTimeline[] = activeProjects.map((project) => {
    const deliverables: DeliverableWithProject[] = project.deliverableItems.map((item) => ({
      id: item.id,
      description: item.description,
      itemType: item.itemType,
      status: item.status,
      deadline: item.deadline,
      estimatedMinutes: item.estimatedMinutes,
      projectCode: project.code,
      clientName: project.client?.companyName ?? 'Unknown',
      assignedDesignerName: item.assignedDesigner?.name ?? null,
    }))

    const total = deliverables.length
    const done = deliverables.filter((d) =>
      ['APPROVED', 'DELIVERED', 'FA_SIGNED'].includes(d.status)
    ).length
    const completionPercent = total > 0 ? Math.round((done / total) * 100) : 0
    const daysRemaining = project.deadline
      ? Math.ceil((project.deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null

    return {
      projectId: project.id,
      projectCode: project.code,
      clientName: project.client?.companyName ?? 'Unknown',
      status: project.status,
      deadline: project.deadline,
      deliverables,
      completionPercent,
      daysRemaining,
    }
  })

  // 2. Fetch all designer workload details
  const designerRoles: Role[] = [
    Role.JUNIOR_ART_DIRECTOR,
    Role.GRAPHIC_DESIGNER,
    Role.JUNIOR_DESIGNER,
    Role.DESIGNER_3D,
    Role.DIGITAL_MARKETING,
    Role.SENIOR_ART_DIRECTOR,
    Role.CREATIVE_DIRECTOR,
  ]

  const designers = await prisma.user.findMany({
    where: { active: true, role: { in: designerRoles } },
    select: { id: true, name: true, email: true, role: true },
  })

  // Fetch all pending/in-progress tasks assigned to designers
  const allAssignedTasks = await prisma.deliverableItem.findMany({
    where: {
      assignedDesignerId: { not: null },
      status: { in: ['PENDING', 'IN_PROGRESS', 'WIP_UPLOADED', 'QC_REVIEW'] },
    },
    include: {
      project: {
        include: { client: { select: { companyName: true } } },
      },
      assignedDesigner: { select: { name: true } },
    },
  })

  const designerWorkload: DesignerWorkloadDetail[] = await Promise.all(
    designers.map(async (designer) => {
      const tasks = allAssignedTasks
        .filter((t) => t.assignedDesignerId === designer.id)
        .map((t): DeliverableWithProject => ({
          id: t.id,
          description: t.description,
          itemType: t.itemType,
          status: t.status,
          deadline: t.deadline,
          estimatedMinutes: t.estimatedMinutes,
          projectCode: t.project.code,
          clientName: t.project.client?.companyName ?? 'Unknown',
          assignedDesignerName: designer.name,
        }))

      const totalEstimatedMinutes = tasks.reduce(
        (sum, t) => sum + (t.estimatedMinutes ?? ITEM_ESTIMATE_MINUTES[t.itemType]),
        0
      )

      const todayCapacity = await getDesignerCapacity(designer.id, now)
      const deadlines = tasks.filter((t) => t.deadline).map((t) => t.deadline as Date)
      const nearestDeadline =
        deadlines.length > 0
          ? deadlines.sort((a, b) => a.getTime() - b.getTime())[0]
          : null

      return {
        userId: designer.id,
        name: designer.name,
        email: designer.email,
        role: designer.role,
        totalPendingTasks: tasks.length,
        totalEstimatedMinutes,
        utilizationToday: todayCapacity.utilizationPercent,
        nearestDeadline,
        isOverloaded: todayCapacity.utilizationPercent >= 90,
        tasks,
      }
    })
  )

  // 3. Critical deadlines — due within 3 days, not done
  const criticalDeadlines: DeliverableWithProject[] = projectTimelines
    .flatMap((p) => p.deliverables)
    .filter(
      (d) =>
        d.deadline &&
        d.deadline <= threeDaysFromNow &&
        !['APPROVED', 'DELIVERED', 'FA_SIGNED'].includes(d.status)
    )
    .sort((a, b) => (a.deadline?.getTime() ?? 0) - (b.deadline?.getTime() ?? 0))

  // 4. Unassigned tasks across all active projects
  const unassignedTasks: DeliverableWithProject[] = projectTimelines
    .flatMap((p) => p.deliverables)
    .filter(
      (d) => !d.assignedDesignerName && !['APPROVED', 'DELIVERED', 'FA_SIGNED'].includes(d.status)
    )

  const totalPendingTasks = projectTimelines
    .flatMap((p) => p.deliverables)
    .filter((d) => !['APPROVED', 'DELIVERED', 'FA_SIGNED'].includes(d.status)).length

  const totalEstimatedHours =
    projectTimelines
      .flatMap((p) => p.deliverables)
      .reduce(
        (sum, d) =>
          sum + (d.estimatedMinutes ?? ITEM_ESTIMATE_MINUTES[d.itemType] ?? 120),
        0
      ) / 60

  return {
    generatedAt: now,
    activeProjects: projectTimelines,
    designerWorkload,
    overloadedDesigners: designerWorkload.filter((d) => d.isOverloaded).map((d) => d.name),
    criticalDeadlines,
    unassignedTasks,
    totalPendingTasks,
    totalEstimatedHours: Math.round(totalEstimatedHours * 10) / 10,
  }
}

/**
 * Get workload for a single designer with full task detail.
 */
export async function getDesignerWorkload(userId: string): Promise<DesignerWorkloadDetail | null> {
  const designer = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, active: true },
  })

  if (!designer || !designer.active) return null

  const tasks = await prisma.deliverableItem.findMany({
    where: {
      assignedDesignerId: userId,
      status: { in: ['PENDING', 'IN_PROGRESS', 'WIP_UPLOADED', 'QC_REVIEW'] },
    },
    include: {
      project: { include: { client: { select: { companyName: true } } } },
      assignedDesigner: { select: { name: true } },
    },
    orderBy: { deadline: 'asc' },
  })

  const mappedTasks: DeliverableWithProject[] = tasks.map((t) => ({
    id: t.id,
    description: t.description,
    itemType: t.itemType,
    status: t.status,
    deadline: t.deadline,
    estimatedMinutes: t.estimatedMinutes,
    projectCode: t.project.code,
    clientName: t.project.client?.companyName ?? 'Unknown',
    assignedDesignerName: designer.name,
  }))

  const totalEstimatedMinutes = mappedTasks.reduce(
    (sum, t) => sum + (t.estimatedMinutes ?? ITEM_ESTIMATE_MINUTES[t.itemType] ?? 120),
    0
  )

  const now = new Date()
  const todayCapacity = await getDesignerCapacity(userId, now)
  const deadlines = mappedTasks.filter((t) => t.deadline).map((t) => t.deadline as Date)
  const nearestDeadline =
    deadlines.length > 0 ? deadlines.sort((a, b) => a.getTime() - b.getTime())[0] : null

  return {
    userId: designer.id,
    name: designer.name,
    email: designer.email,
    role: designer.role,
    totalPendingTasks: mappedTasks.length,
    totalEstimatedMinutes,
    utilizationToday: todayCapacity.utilizationPercent,
    nearestDeadline,
    isOverloaded: todayCapacity.utilizationPercent >= 90,
    tasks: mappedTasks,
  }
}

// ─── AI Priority Management ───────────────────────────────────────────────────

export interface PrioritisedTask {
  itemId: string
  projectCode: string
  itemType: string
  description: string | null
  assignedDesignerId: string | null
  assignedDesignerName: string | null
  deadline: Date | null
  estimatedMinutes: number
  priorityScore: number     // 0–100 (higher = more urgent)
  priorityReason: string
  suggestedAction: 'KEEP' | 'REASSIGN' | 'ESCALATE' | 'DEFER'
}

export interface AIWorkloadPlan {
  generatedAt: Date
  prioritisedTasks: PrioritisedTask[]
  reassignmentSuggestions: Array<{
    itemId: string
    fromDesignerId: string | null
    toDesignerId: string
    toDesignerName: string
    reason: string
  }>
  warnings: string[]
  summary: string
}

/**
 * AI analyses current workload, applies deadline urgency + designer availability
 * (including leave records) and returns a priority-ordered action plan.
 */
export async function generateAIWorkloadPlan(): Promise<AIWorkloadPlan> {
  const { callClaudeForWorkloadPriority } = await import('@/services/ai-internal')
  const now = new Date()

  // Fetch all active deliverables
  const items = await prisma.deliverableItem.findMany({
    where: {
      status: { in: ['PENDING', 'IN_PROGRESS', 'WIP_UPLOADED', 'QC_REVIEW'] },
      project: { status: { in: ['PROJECTED', 'ONGOING'] } },
    },
    include: {
      project: { select: { code: true, deadline: true, client: { select: { companyName: true, tier: true } } } },
      assignedDesigner: { select: { id: true, name: true } },
    },
    orderBy: { deadline: 'asc' },
  })

  // Fetch all designers and their workload
  const timeline = await getCompanyTimeline()

  // Fetch leave records to know who's absent in the next 14 days
  const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  const leaveRows = await prisma.$queryRawUnsafe<{
    userId: string; startDate: Date; endDate: Date; status: string;
  }[]>(
    `SELECT "userId", "startDate", "endDate", status
     FROM "leave_records"
     WHERE status IN ('APPROVED','PENDING')
       AND "endDate" >= NOW()::date
       AND "startDate" <= $1::date`,
    twoWeeks.toISOString().split('T')[0]
  ).catch(() => [] as { userId: string; startDate: Date; endDate: Date; status: string }[])

  const absentDesignerIds = new Set(leaveRows.map((r) => r.userId))

  // Priority scoring (rule-based, then AI-enhanced)
  const prioritised: PrioritisedTask[] = items.map((item) => {
    const deadlineDays = item.deadline
      ? Math.ceil((item.deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : 30

    // Urgency: 0–50 based on deadline proximity
    const deadlineScore = deadlineDays <= 0 ? 50
      : deadlineDays <= 1 ? 45
      : deadlineDays <= 3 ? 35
      : deadlineDays <= 7 ? 20
      : deadlineDays <= 14 ? 10
      : 0

    // Client tier: PLATINUM = +20, GOLD = +10, SILVER = +5
    const tierScore = item.project.client?.tier === 'PLATINUM' ? 20
      : item.project.client?.tier === 'GOLD' ? 10
      : item.project.client?.tier === 'SILVER' ? 5
      : 0

    // Status urgency
    const statusScore = item.status === 'WIP_UPLOADED' || item.status === 'QC_REVIEW' ? 15
      : item.status === 'IN_PROGRESS' ? 5
      : 0

    // Designer on leave penalty
    const designerOnLeave = item.assignedDesignerId ? absentDesignerIds.has(item.assignedDesignerId) : false
    const leaveScore = designerOnLeave ? 20 : 0

    const priorityScore = Math.min(100, deadlineScore + tierScore + statusScore + leaveScore)

    const suggestedAction: PrioritisedTask['suggestedAction'] =
      priorityScore >= 70 ? 'ESCALATE'
      : designerOnLeave ? 'REASSIGN'
      : item.assignedDesignerId === null ? 'REASSIGN'
      : priorityScore >= 40 ? 'KEEP'
      : 'KEEP'

    const priorityReason = [
      deadlineDays <= 3 ? `Due in ${deadlineDays} day(s)` : null,
      tierScore >= 20 ? `${item.project.client?.tier} client` : null,
      designerOnLeave ? 'Designer on leave' : null,
      item.assignedDesignerId === null ? 'Unassigned' : null,
    ].filter(Boolean).join('; ') || 'Normal priority'

    return {
      itemId: item.id,
      projectCode: item.project.code,
      itemType: item.itemType,
      description: item.description,
      assignedDesignerId: item.assignedDesignerId,
      assignedDesignerName: item.assignedDesigner?.name ?? null,
      deadline: item.deadline,
      estimatedMinutes: item.estimatedMinutes ?? ITEM_ESTIMATE_MINUTES[item.itemType] ?? 120,
      priorityScore,
      priorityReason,
      suggestedAction,
    }
  }).sort((a, b) => b.priorityScore - a.priorityScore)

  // Build reassignment suggestions for tasks that need it
  const toReassign = prioritised.filter((t) => t.suggestedAction === 'REASSIGN' || t.suggestedAction === 'ESCALATE')
  const availableDesigners = timeline.designerWorkload.filter((d) => !absentDesignerIds.has(d.userId) && !d.isOverloaded)

  const reassignmentSuggestions = toReassign.slice(0, 10).map((task) => {
    // Find best available designer (least loaded, matching skill)
    const best = availableDesigners
      .filter((d) => d.userId !== task.assignedDesignerId)
      .sort((a, b) => a.utilizationToday - b.utilizationToday)[0]

    if (!best) return null

    return {
      itemId: task.itemId,
      fromDesignerId: task.assignedDesignerId,
      toDesignerId: best.userId,
      toDesignerName: best.name,
      reason: task.suggestedAction === 'REASSIGN' && absentDesignerIds.has(task.assignedDesignerId ?? '')
        ? `Assigned designer is on approved leave`
        : task.assignedDesignerId === null
        ? 'Task was unassigned'
        : `High priority task — redistribute to available designer`,
    }
  }).filter(Boolean) as AIWorkloadPlan['reassignmentSuggestions']

  const warnings: string[] = []
  if (absentDesignerIds.size > 0) {
    const names = timeline.designerWorkload
      .filter((d) => absentDesignerIds.has(d.userId))
      .map((d) => d.name)
    warnings.push(`${names.join(', ')} on leave in the next 14 days — ${toReassign.length} task(s) may need reassignment.`)
  }
  const overdueCount = prioritised.filter((t) => t.deadline && t.deadline < now).length
  if (overdueCount > 0) warnings.push(`${overdueCount} task(s) are past their deadline!`)
  const overloadedDesigners = timeline.overloadedDesigners
  if (overloadedDesigners.length > 0) warnings.push(`Designers over 90% capacity: ${overloadedDesigners.join(', ')}.`)

  // AI summary
  let summary = ''
  try {
    const prompt = `Summarise this design team workload status in 2 sentences. Action-oriented.
Tasks: ${prioritised.length} active, ${overdueCount} overdue, ${toReassign.length} need reassignment.
Designers: ${timeline.designerWorkload.length} total, ${overloadedDesigners.length} overloaded, ${absentDesignerIds.size} on leave.
Critical (due <3 days): ${timeline.criticalDeadlines.length}`

    const result = await callClaudeForWorkloadPriority(prompt)
    summary = JSON.stringify(result).slice(0, 300)
  } catch {
    summary = `${prioritised.length} active tasks across ${timeline.designerWorkload.length} designers. ${overdueCount > 0 ? `${overdueCount} task(s) overdue.` : 'No overdue tasks.'} ${toReassign.length} task(s) need attention.`
  }

  return {
    generatedAt: now,
    prioritisedTasks: prioritised,
    reassignmentSuggestions,
    warnings,
    summary,
  }
}

/**
 * When leave is detected for a designer, automatically rebalance and notify.
 * Called by the Lark HR sync when a leave is approved.
 */
export async function handleLeaveApproval(userId: string, startDate: Date, endDate: Date): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
  if (!user) return

  // Rebalance each day they're absent
  const current = new Date(startDate)
  while (current <= endDate) {
    await rebalanceOnAbsence(userId, new Date(current))
    current.setDate(current.getDate() + 1)
  }

  await notify('MANAGEMENT', {
    title: `🏖️ Leave Approved — ${user.name}`,
    body: `${user.name} is on approved leave from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}. Workload has been automatically rebalanced.`,
    actionLabel: 'Review Workload',
    actionUrl: `${process.env.NEXTAUTH_URL ?? ''}/cd`,
  }).catch(() => {})
}

function getRequiredRoleForItemType(itemType: ItemType): Role[] | null {
  const roleMap: Partial<Record<ItemType, Role[]>> = {
    [ItemType.THREE_D]: [Role.DESIGNER_3D, Role.SENIOR_ART_DIRECTOR],
    [ItemType.VIDEO]: [Role.DIGITAL_MARKETING, Role.SENIOR_ART_DIRECTOR],
    [ItemType.SOCIAL]: [Role.DIGITAL_MARKETING, Role.GRAPHIC_DESIGNER, Role.JUNIOR_DESIGNER],
  }
  return roleMap[itemType] ?? null
}
