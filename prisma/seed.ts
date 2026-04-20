import { PrismaClient, Role, ClientTier, ProjectStatus } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required for seeding.')
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 12)
}

async function main() {
  console.log('Seeding database...')

  // Create Carlson (Admin)
  const carlson = await prisma.user.upsert({
    where: { email: 'carlson@envicionstudio.com.my' },
    update: {},
    create: {
      name: 'Carlson',
      email: 'carlson@envicionstudio.com.my',
      password: hashPassword('Envicion@2026!'),
      role: Role.ADMIN,
      active: true,
    },
  })
  console.log(`Created admin: ${carlson.email}`)

  // Create test CS user
  const csUser = await prisma.user.upsert({
    where: { email: 'cs@envicionstudio.com.my' },
    update: {},
    create: {
      name: 'Sarah Chen',
      email: 'cs@envicionstudio.com.my',
      password: hashPassword('Envicion@2026!'),
      role: Role.CLIENT_SERVICING,
      active: true,
    },
  })
  console.log(`Created CS user: ${csUser.email}`)

  // Create test designer
  const designer = await prisma.user.upsert({
    where: { email: 'designer@envicionstudio.com.my' },
    update: {},
    create: {
      name: 'Alex Wong',
      email: 'designer@envicionstudio.com.my',
      password: hashPassword('Envicion@2026!'),
      role: Role.GRAPHIC_DESIGNER,
      active: true,
    },
  })
  console.log(`Created designer: ${designer.email}`)

  // Create test sales user
  const salesUser = await prisma.user.upsert({
    where: { email: 'sales@envicionstudio.com.my' },
    update: {},
    create: {
      name: 'Ryan Lim',
      email: 'sales@envicionstudio.com.my',
      password: hashPassword('Envicion@2026!'),
      role: Role.SALES,
      active: true,
    },
  })
  console.log(`Created sales user: ${salesUser.email}`)

  // Create test client user (portal login)
  await prisma.user.upsert({
    where: { email: 'client@acmecorp.com' },
    update: {},
    create: {
      name: 'John Smith',
      email: 'client@acmecorp.com',
      password: hashPassword('Envicion@2026!'),
      role: Role.CLIENT,
      active: true,
    },
  })
  console.log('Created client user: client@acmecorp.com')

  // Create test client
  const client = await prisma.client.upsert({
    where: { email: 'contact@acmecorp.com' },
    update: {},
    create: {
      companyName: 'Acme Corp',
      contactPerson: 'John Smith',
      email: 'contact@acmecorp.com',
      phone: '+60123456789',
      tier: ClientTier.GOLD,
      ltv: 50000,
      assignedCSId: csUser.id,
      assignedSalesId: salesUser.id,
    },
  })
  console.log(`Created client: ${client.companyName}`)

  // Create test project
  const project = await prisma.project.upsert({
    where: { code: 'PRJ-0001' },
    update: {},
    create: {
      code: 'PRJ-0001',
      clientId: client.id,
      status: ProjectStatus.ONGOING,
      assignedCSId: csUser.id,
      quotedAmount: 8500,
      billedAmount: 4250,
      paidAmount: 4250,
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
    },
  })
  console.log(`Created project: ${project.code}`)

  // Create project brief
  await prisma.projectBrief.upsert({
    where: { projectId: project.id },
    update: {},
    create: {
      projectId: project.id,
      packageType: 'Full Branding Package',
      specialInstructions: 'Client prefers minimalistic design language',
      styleNotes: 'Reference: Apple, Muji — clean lines, lots of whitespace',
      priority: 'HIGH',
      completedByCSId: csUser.id,
      completedByCSAt: new Date(),
    },
  })

  // Create deliverable items
  await prisma.deliverableItem.createMany({
    data: [
      {
        projectId: project.id,
        itemType: 'LOGO',
        description: 'Primary logo with variants (horizontal, stacked, icon only)',
        quantity: 1,
        revisionLimit: 3,
        status: 'IN_PROGRESS',
        assignedDesignerId: designer.id,
        estimatedMinutes: 240,
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project.id,
        itemType: 'BANNER',
        description: 'Web banners 1200x628 (5 variants)',
        quantity: 5,
        revisionLimit: 2,
        status: 'PENDING',
        assignedDesignerId: designer.id,
        estimatedMinutes: 90,
        deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project.id,
        itemType: 'BROCHURE',
        description: 'A4 corporate brochure, 8 pages',
        quantity: 1,
        revisionLimit: 2,
        status: 'PENDING',
        estimatedMinutes: 180,
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    ],
  })
  console.log(`Created deliverable items for ${project.code}`)

  // Create initial workload slot for designer
  await prisma.workloadSlot.upsert({
    where: {
      userId_date: {
        userId: designer.id,
        date: new Date(new Date().toISOString().split('T')[0]),
      },
    },
    update: {},
    create: {
      userId: designer.id,
      date: new Date(new Date().toISOString().split('T')[0]),
      committedMinutes: 240,
      capacityMinutes: 480,
    },
  })

  console.log('Seed completed successfully.')
}

main()
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
