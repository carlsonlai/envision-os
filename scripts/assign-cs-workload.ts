/**
 * One-time script: Create Khayrin & Alia as CS users,
 * then assign 50% of active projects to each.
 *
 * Usage:  DATABASE_URL="..." npx tsx scripts/assign-cs-workload.ts
 * Or hit: GET /api/admin/assign-cs-workload (see route below)
 */

import { PrismaClient, Role } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const connectionString =
  process.env.POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL required')

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

function hash(pw: string) {
  return bcrypt.hashSync(pw, 12)
}

async function main() {
  // 1. Upsert Khayrin
  const khayrin = await prisma.user.upsert({
    where: { email: 'khayrin@envicionstudio.com.my' },
    update: { role: Role.CLIENT_SERVICING, active: true },
    create: {
      name: 'Khayrin',
      email: 'khayrin@envicionstudio.com.my',
      password: hash('Envicion@2026!'),
      role: Role.CLIENT_SERVICING,
      active: true,
    },
  })
  console.log(`Khayrin: ${khayrin.id} (${khayrin.role})`)

  // 2. Upsert Alia
  const alia = await prisma.user.upsert({
    where: { email: 'alia@envicionstudio.com.my' },
    update: { role: Role.CLIENT_SERVICING, active: true },
    create: {
      name: 'Alia',
      email: 'alia@envicionstudio.com.my',
      password: hash('Envicion@2026!'),
      role: Role.CLIENT_SERVICING,
      active: true,
    },
  })
  console.log(`Alia: ${alia.id} (${alia.role})`)

  // 3. Fetch all active projects (PROJECTED + ONGOING) ordered by code
  const projects = await prisma.project.findMany({
    where: { status: { in: ['PROJECTED', 'ONGOING'] } },
    select: { id: true, code: true, status: true },
    orderBy: { code: 'asc' },
  })
  console.log(`\nFound ${projects.length} active projects to assign`)

  // 4. Split 50/50 — alternating assignment
  const khayrinIds: string[] = []
  const aliaIds: string[] = []
  for (let i = 0; i < projects.length; i++) {
    if (i % 2 === 0) {
      khayrinIds.push(projects[i].id)
    } else {
      aliaIds.push(projects[i].id)
    }
  }

  // 5. Batch update — Khayrin
  const kResult = await prisma.project.updateMany({
    where: { id: { in: khayrinIds } },
    data: { assignedCSId: khayrin.id },
  })
  console.log(`Assigned ${kResult.count} projects to Khayrin`)

  // 6. Batch update — Alia
  const aResult = await prisma.project.updateMany({
    where: { id: { in: aliaIds } },
    data: { assignedCSId: alia.id },
  })
  console.log(`Assigned ${aResult.count} projects to Alia`)

  // 7. Summary
  console.log('\n--- Assignment Summary ---')
  console.log(`Khayrin (${khayrin.id}): ${khayrinIds.length} projects`)
  for (const id of khayrinIds) {
    const p = projects.find((pr) => pr.id === id)
    console.log(`  ${p?.code} (${p?.status})`)
  }
  console.log(`Alia (${alia.id}): ${aliaIds.length} projects`)
  for (const id of aliaIds) {
    const p = projects.find((pr) => pr.id === id)
    console.log(`  ${p?.code} (${p?.status})`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
