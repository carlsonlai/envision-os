import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Package templates are stored as structured JSON
// In a future version this could be a DB model
// For now we return static configurable templates

export interface PackageTemplate {
  id: string
  name: string
  description: string
  items: Array<{
    itemType: string
    quantity: number
    defaultRevisionLimit: number
    estimatedMinutes: number
  }>
  defaultDeadlineDays: number
  basePrice: number
}

const PACKAGE_TEMPLATES: PackageTemplate[] = [
  {
    id: 'branding-starter',
    name: 'Branding Starter',
    description: 'Logo + business card + letterhead',
    items: [
      { itemType: 'LOGO', quantity: 1, defaultRevisionLimit: 3, estimatedMinutes: 480 },
      { itemType: 'PRINT', quantity: 2, defaultRevisionLimit: 2, estimatedMinutes: 180 },
    ],
    defaultDeadlineDays: 14,
    basePrice: 2500,
  },
  {
    id: 'social-monthly',
    name: 'Social Media Monthly',
    description: '20 posts + 4 stories + copy',
    items: [
      { itemType: 'SOCIAL', quantity: 20, defaultRevisionLimit: 2, estimatedMinutes: 60 },
      { itemType: 'SOCIAL', quantity: 4, defaultRevisionLimit: 1, estimatedMinutes: 30 },
    ],
    defaultDeadlineDays: 7,
    basePrice: 1800,
  },
  {
    id: 'campaign-full',
    name: 'Campaign Full Package',
    description: 'Banner + social + flyer + EDM',
    items: [
      { itemType: 'BANNER', quantity: 3, defaultRevisionLimit: 2, estimatedMinutes: 240 },
      { itemType: 'SOCIAL', quantity: 10, defaultRevisionLimit: 2, estimatedMinutes: 60 },
      { itemType: 'PRINT', quantity: 2, defaultRevisionLimit: 2, estimatedMinutes: 180 },
    ],
    defaultDeadlineDays: 10,
    basePrice: 4500,
  },
]

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({ data: PACKAGE_TEMPLATES })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  // Template creation would persist to DB in production
  // For now return success with the received template
  const body = (await req.json()) as PackageTemplate
  return NextResponse.json({ data: { ...body, id: crypto.randomUUID() } }, { status: 201 })
}
