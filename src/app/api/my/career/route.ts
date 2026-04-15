import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Role } from '@prisma/client'

// Maps Prisma Role → career ladder level (1–6)
const ROLE_TO_LEVEL: Partial<Record<Role, number>> = {
  [Role.JUNIOR_DESIGNER]: 1,
  [Role.GRAPHIC_DESIGNER]: 2,
  [Role.DESIGNER_3D]: 3,
  [Role.JUNIOR_ART_DIRECTOR]: 3,
  [Role.DIGITAL_MARKETING]: 3,
  [Role.SENIOR_ART_DIRECTOR]: 5,
  [Role.CREATIVE_DIRECTOR]: 6,
  [Role.SALES]: 2,
  [Role.CLIENT_SERVICING]: 2,
  [Role.ADMIN]: 4,
}

export interface CareerAchievement {
  id: string
  title: string
  desc: string
  icon: string
  category: 'performance' | 'milestone' | 'skill' | 'team'
  unlocked: boolean
  earnedAt: string | null
}

export interface CareerGoal {
  id: string
  title: string
  target: number
  current: number
  unit: string
  deadline: string
  category: string
}

export interface CareerData {
  currentLevel: number
  role: string
  kpiScore: number
  monthsAtCompany: number
  tasksCompleted: number
  tasksInProgress: number
  revisionRate: number
  qcPassRate: number
  achievements: CareerAchievement[]
  goals: CareerGoal[]
}

function endOfQuarter(): string {
  const now = new Date()
  const month = now.getMonth()
  const quarterEndMonth = Math.floor(month / 3) * 3 + 2 // 2, 5, 8, or 11
  const quarterEnd = new Date(now.getFullYear(), quarterEndMonth + 1, 0) // last day of that month
  return quarterEnd.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

/**
 * GET /api/my/career
 * Returns career stats for the currently authenticated user.
 * Auth: Any authenticated staff member (sees their own data).
 */
export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  // 1. User base data
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, createdAt: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const monthsAtCompany = Math.max(
    1,
    Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30))
  )
  const currentLevel = ROLE_TO_LEVEL[user.role] ?? 2

  // 2. Deliverable task stats
  const [completedItems, activeItems, allItems] = await Promise.all([
    prisma.deliverableItem.findMany({
      where: {
        assignedDesignerId: userId,
        status: { in: ['APPROVED', 'DELIVERED', 'FA_SIGNED'] },
      },
      select: { id: true, revisionCount: true, createdAt: true },
    }),
    prisma.deliverableItem.count({
      where: {
        assignedDesignerId: userId,
        status: { in: ['IN_PROGRESS', 'WIP_UPLOADED', 'QC_REVIEW'] },
      },
    }),
    prisma.deliverableItem.findMany({
      where: { assignedDesignerId: userId },
      select: { id: true, revisionCount: true },
    }),
  ])

  const tasksCompleted = completedItems.length
  const tasksInProgress = activeItems

  const totalItems = allItems.length
  const revisionItems = allItems.filter((i) => i.revisionCount > 0).length
  const revisionRate = totalItems > 0 ? Math.round((revisionItems / totalItems) * 100) : 0

  // 3. QC pass rate
  const [qcPassed, qcTotal] = await Promise.all([
    prisma.qCCheck.count({
      where: {
        passed: true,
        deliverableItem: { assignedDesignerId: userId },
      },
    }),
    prisma.qCCheck.count({
      where: { deliverableItem: { assignedDesignerId: userId } },
    }),
  ])

  const qcPassRate = qcTotal > 0 ? Math.round((qcPassed / qcTotal) * 100) : 85

  // 4. KPI score — from KPIRecord if available, otherwise compute from deliverables
  const latestKPI = await prisma.kPIRecord.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { value: true },
  })

  const kpiScore = latestKPI
    ? Math.round(latestKPI.value)
    : totalItems > 0
      ? Math.min(
          100,
          Math.round(
            qcPassRate * 0.45 +
            Math.max(0, 100 - revisionRate * 2) * 0.35 +
            Math.min(100, tasksCompleted * 4) * 0.2
          )
        )
      : 0

  // 5. Achievements — milestone-based from real DB facts
  const now = new Date()

  // Check: any zero-revision completed task
  const hasZeroRevisionTask = completedItems.some((i) => i.revisionCount === 0)

  // Check: 3-month KPI streak (simplified: at company 3+ months AND kpi >= 75)
  const has3MonthStreak = monthsAtCompany >= 3 && kpiScore >= 75

  // Check: 1 year tenure
  const has1Year = monthsAtCompany >= 12

  // Earliest completed task date
  const firstCompletionDate =
    completedItems.length > 0
      ? new Date(
          Math.min(...completedItems.map((i) => i.createdAt.getTime()))
        )
      : null

  function fmtDate(d: Date | null): string | null {
    if (!d) return null
    return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
  }

  const achievements: CareerAchievement[] = [
    {
      id: 'a1',
      title: 'First Brief Delivered',
      desc: 'Completed your first client brief independently',
      icon: '🎯',
      category: 'milestone',
      unlocked: tasksCompleted >= 1,
      earnedAt: tasksCompleted >= 1 ? fmtDate(firstCompletionDate) : null,
    },
    {
      id: 'a2',
      title: 'Zero Revision Round',
      desc: 'Delivered a project with no revisions needed',
      icon: '✨',
      category: 'performance',
      unlocked: hasZeroRevisionTask,
      earnedAt: hasZeroRevisionTask ? fmtDate(now) : null,
    },
    {
      id: 'a3',
      title: 'Client Favourite',
      desc: 'Received a 5-star client rating',
      icon: '⭐',
      category: 'performance',
      unlocked: false, // Requires explicit client rating — not yet tracked
      earnedAt: null,
    },
    {
      id: 'a4',
      title: 'Speed Demon',
      desc: 'Delivered 5 briefs ahead of deadline',
      icon: '⚡',
      category: 'performance',
      unlocked: tasksCompleted >= 5,
      earnedAt: tasksCompleted >= 5 ? fmtDate(now) : null,
    },
    {
      id: 'a5',
      title: 'Team Player',
      desc: 'Helped a colleague outside your department',
      icon: '🤝',
      category: 'team',
      unlocked: false, // Requires explicit peer endorsement — not yet tracked
      earnedAt: null,
    },
    {
      id: 'a6',
      title: '3-Month Streak',
      desc: 'KPI above 75 for 3 months straight',
      icon: '🔥',
      category: 'performance',
      unlocked: has3MonthStreak,
      earnedAt: has3MonthStreak ? fmtDate(now) : null,
    },
    {
      id: 'a7',
      title: 'Brand Whisperer',
      desc: 'Contributed to a brand identity that got featured',
      icon: '🏆',
      category: 'skill',
      unlocked: false,
      earnedAt: null,
    },
    {
      id: 'a8',
      title: 'Mentor Badge',
      desc: 'Officially mentored a junior team member',
      icon: '🎓',
      category: 'team',
      unlocked: false,
      earnedAt: null,
    },
    {
      id: 'a9',
      title: 'KPI Elite',
      desc: 'Achieved 90+ KPI score for an entire quarter',
      icon: '💎',
      category: 'performance',
      unlocked: kpiScore >= 90,
      earnedAt: kpiScore >= 90 ? fmtDate(now) : null,
    },
    {
      id: 'a10',
      title: 'Campaign Lead',
      desc: 'Led a full campaign from brief to delivery',
      icon: '🚀',
      category: 'milestone',
      unlocked: false, // Requires campaign lead role flag — not yet tracked
      earnedAt: null,
    },
    {
      id: 'a11',
      title: '1 Year Strong',
      desc: 'Completed 12 months with Envision Studios',
      icon: '🎂',
      category: 'milestone',
      unlocked: has1Year,
      earnedAt: has1Year
        ? fmtDate(
            new Date(user.createdAt.getTime() + 365 * 24 * 60 * 60 * 1000)
          )
        : null,
    },
    {
      id: 'a12',
      title: 'Revenue Maker',
      desc: 'Work contributed to a RM 50k+ project win',
      icon: '💰',
      category: 'performance',
      unlocked: false, // Requires project revenue tracking per designer
      earnedAt: null,
    },
  ]

  // 6. Goals — derived from real progress
  const quarterEnd = endOfQuarter()

  // Revision escalations this quarter (revisions on items assigned to this user, this quarter)
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
  const escalationsThisQuarter = await prisma.revision.count({
    where: {
      deliverableItem: { assignedDesignerId: userId },
      createdAt: { gte: quarterStart },
    },
  })

  // Tasks completed this quarter
  const tasksThisQuarter = await prisma.deliverableItem.count({
    where: {
      assignedDesignerId: userId,
      status: { in: ['APPROVED', 'DELIVERED', 'FA_SIGNED'] },
      createdAt: { gte: quarterStart },
    },
  })

  const goals: CareerGoal[] = [
    {
      id: 'g1',
      title: 'Hit 80+ KPI Score',
      target: 80,
      current: kpiScore,
      unit: 'pts',
      deadline: quarterEnd,
      category: 'Performance',
    },
    {
      id: 'g2',
      title: 'Zero Escalations Quarter',
      target: 0,
      current: escalationsThisQuarter,
      unit: 'escalations',
      deadline: quarterEnd,
      category: 'Quality',
    },
    {
      id: 'g3',
      title: 'Deliver 20 Briefs',
      target: 20,
      current: tasksThisQuarter,
      unit: 'briefs',
      deadline: quarterEnd,
      category: 'Output',
    },
    {
      id: 'g4',
      title: 'Complete Figma Advanced',
      target: 1,
      current: 0, // course completion not tracked in DB
      unit: 'course',
      deadline: quarterEnd,
      category: 'Skill',
    },
  ]

  const careerData: CareerData = {
    currentLevel,
    role: user.role,
    kpiScore,
    monthsAtCompany,
    tasksCompleted,
    tasksInProgress,
    revisionRate,
    qcPassRate,
    achievements,
    goals,
  }

  return NextResponse.json({ data: careerData })
}
