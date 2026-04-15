import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateRoleReplacementReport } from '@/services/ai'
import { prisma } from '@/lib/prisma-extended'
import { z } from 'zod'
import { logger, getErrorMessage } from '@/lib/logger'

const ReportSchema = z.object({
  role: z.string().min(1),
  responsibilities: z.array(z.string()),
  teamSize: z.number().int().min(1),
  avgSalary: z.string(),
  currentAIUsage: z.string(),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — Admin only' }, { status: 403 })
  }

  try {
    const body: unknown = await req.json()
    const data = ReportSchema.parse(body)

    const report = await generateRoleReplacementReport(data)

    // Persist the report (create new record each time for history)
    const period = new Date().toISOString().slice(0, 7) // "2026-04"
    try {
      await prisma.aIRoleReport.create({
        data: {
          role: data.role,
          period,
          efficiencyScore: report.currentEfficiency,
          automationScore: report.automationPotential,
          tasksAnalyzed: data.responsibilities.length,
          tasksAutomated: Math.round(data.responsibilities.length * report.automationPotential / 100),
          humanHoursSaved: data.teamSize * 8 * 22 * (report.automationPotential / 100),
          reportData: report as unknown as Record<string, unknown>,
        },
      })
    } catch {
      // Non-critical if DB save fails — still return the report
    }

    return NextResponse.json({ data: report })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    logger.error('POST /api/ai/replacement-report error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — Admin only' }, { status: 403 })
  }

  try {
    const reports = await prisma.aIRoleReport.findMany({
      orderBy: [{ period: 'desc' }, { automationScore: 'desc' }],
    })
    return NextResponse.json({ data: reports })
  } catch (error) {
    logger.error('GET /api/ai/replacement-report error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
  }
}
