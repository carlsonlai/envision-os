import { prisma, generateProjectCode, createAuditLog } from '@/lib/db'
import { parseLineItems, type BukkuInvoice, type BukkuQuotation } from '@/services/bukku'
import { createProjectFolders, createProjectChat, notify, sendGanttCard, sendCopilotReview, type GanttRow } from '@/services/lark'
import { autoAssign } from '@/services/workload'
import { getSettings } from '@/services/settings'
import { ItemType, Project, Role } from '@prisma/client'
import { logger, getErrorMessage } from '@/lib/logger'

const DEFAULT_DEADLINES_DAYS: Record<ItemType, number> = {
  [ItemType.BANNER]: 3,
  [ItemType.BROCHURE]: 5,
  [ItemType.LOGO]: 7,
  [ItemType.SOCIAL]: 3,
  [ItemType.PRINT]: 5,
  [ItemType.THREE_D]: 10,
  [ItemType.VIDEO]: 7,
  [ItemType.OTHER]: 5,
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

// ─── Shared post-creation logic ───────────────────────────────────────────────

/**
 * After a project is created, this runs the full automation pipeline:
 * 1. Reads current Autopilot / Copilot setting
 * 2. Autopilot: auto-assigns every deliverable to best-fit designer
 *    Copilot:   leaves deliverables unassigned, asks CS to review
 * 3. Sends Gantt card to Lark CREATIVE channel
 * 4. Copilot sends an additional review card to CS channel
 */
async function postCreateAutomation(
  projectId: string,
  projectCode: string,
  clientName: string,
  source: 'invoice' | 'quotation',
  referenceNumber: string
): Promise<void> {
  const settings = await getSettings()
  const mode = settings.autopilotMode ? 'AUTOPILOT' : 'COPILOT'

  // Fetch project with deliverables
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      deliverableItems: true,
    },
  })

  if (!project) return

  const ganttRows: GanttRow[] = []

  // ── Autopilot: auto-assign every deliverable ────────────────────────────
  if (mode === 'AUTOPILOT' && settings.autoAssignEnabled) {
    for (const item of project.deliverableItems) {
      try {
        const assignee = await autoAssign(item)
        ganttRows.push({
          description: item.description ?? item.itemType,
          itemType: item.itemType,
          status: item.status,
          deadline: item.deadline,
          estimatedMinutes: item.estimatedMinutes,
          assignedDesigner: assignee.name,
        })
      } catch (err) {
        logger.error(`[BriefCreator] Auto-assign failed for item ${item.id}`, { error: getErrorMessage(err) })
        ganttRows.push({
          description: item.description ?? item.itemType,
          itemType: item.itemType,
          status: item.status,
          deadline: item.deadline,
          estimatedMinutes: item.estimatedMinutes,
          assignedDesigner: null,
        })
      }
    }

    // Mark project as ONGOING in Autopilot (brief auto-accepted)
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'ONGOING' },
    })
  } else {
    // Copilot: build Gantt rows without assignments
    for (const item of project.deliverableItems) {
      ganttRows.push({
        description: item.description ?? item.itemType,
        itemType: item.itemType,
        status: item.status,
        deadline: item.deadline,
        estimatedMinutes: item.estimatedMinutes,
        assignedDesigner: null,
      })
    }
  }

  // ── Send Gantt card to CREATIVE channel ──────────────────────────────────
  if (settings.larkGanttEnabled) {
    try {
      await sendGanttCard(
        projectCode,
        clientName,
        project.deadline,
        ganttRows,
        mode
      )
    } catch (err) {
      logger.error('[BriefCreator] Gantt card send failed:', { error: getErrorMessage(err) })
    }
  }

  // ── Copilot: send review card to CS channel ──────────────────────────────
  if (mode === 'COPILOT') {
    try {
      await sendCopilotReview(
        projectCode,
        projectId,
        clientName,
        source,
        referenceNumber,
        project.deliverableItems.length
      )
    } catch (err) {
      logger.error('[BriefCreator] Copilot review card send failed:', { error: getErrorMessage(err) })
    }
  }
}

// ─── Create from Invoice ──────────────────────────────────────────────────────

export async function createProjectFromInvoice(invoice: BukkuInvoice): Promise<Project> {
  const lineItems = parseLineItems(invoice)
  const projectCode = await generateProjectCode()
  const now = new Date()

  const client = await prisma.client.findFirst({
    where: { bukkuContactId: invoice.contact_id },
  })

  const project = await prisma.project.create({
    data: {
      code: projectCode,
      clientId: client?.id ?? null,
      status: 'PROJECTED',
      quotedAmount: invoice.total_amount,
      bukkuInvoiceId: invoice.id,
      deadline: addDays(now, 14),
    },
  })

  // Link Invoice record with human-readable number so the system tracks
  // which Bukku invoice belongs to this project
  await prisma.$executeRawUnsafe(
    `INSERT INTO "invoices" (id, "projectId", "bukkuInvoiceId", "invoiceNumber", type, amount, status, "dueAt", "createdAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, 'FULL'::"InvoiceType", $4, 'PENDING'::"InvoiceStatus", $5, NOW())
     ON CONFLICT DO NOTHING`,
    project.id,
    invoice.id,
    invoice.number,
    invoice.total_amount,
    invoice.due_date ? new Date(invoice.due_date) : null,
  )

  await prisma.projectBrief.create({
    data: {
      projectId: project.id,
      packageType: 'Auto-generated from Bukku invoice',
    },
  })

  const deliverableItems = await Promise.all(
    lineItems.map((item) =>
      prisma.deliverableItem.create({
        data: {
          projectId: project.id,
          itemType: item.itemType,
          description: item.description,
          quantity: item.quantity,
          revisionLimit: 2,
          status: 'PENDING',
          estimatedMinutes: getDefaultEstimatedMinutes(item.itemType),
          deadline: addDays(now, DEFAULT_DEADLINES_DAYS[item.itemType]),
        },
      })
    )
  )

  // ── Lark: create Drive folders + group chat ──────────────────────────────
  try {
    const folderMap = await createProjectFolders(projectCode)

    // Fetch CS & management team open_ids to add to the group (raw SQL — safe against Prisma version drift)
    const csTeam = await prisma.$queryRawUnsafe<{ larkOpenId: string | null }[]>(
      `SELECT "larkOpenId" FROM "users"
       WHERE active = true
         AND role IN ('CLIENT_SERVICING','CREATIVE_DIRECTOR','ADMIN')
         AND "larkOpenId" IS NOT NULL`
    )
    const memberIds = csTeam.map(u => u.larkOpenId).filter(Boolean) as string[]

    const chatId = await createProjectChat(projectCode, invoice.contact_name, memberIds)

    await prisma.$executeRawUnsafe(
      `UPDATE "projects" SET "larkFolderId" = $1, "larkChatId" = $2 WHERE id = $3`,
      folderMap.root,
      chatId,
      project.id,
    )
  } catch (error) {
    logger.error(`[BriefCreator] Lark setup failed for ${projectCode}`, { error: getErrorMessage(error) })
  }

  // ── Create deposit invoice record (upfront billing) ──────────────────────
  const settingsForDeposit = await getSettings()
  const upfrontPct: number = (settingsForDeposit as unknown as Record<string, unknown>).defaultUpfrontPercent as number ?? 50
  const depositAmount = Math.round(invoice.total_amount * upfrontPct / 100 * 100) / 100
  if (depositAmount > 0) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "invoices" (id, "projectId", "invoiceNumber", type, amount, status, "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, 'DEPOSIT'::"InvoiceType", $3, 'PENDING'::"InvoiceStatus", NOW())
       ON CONFLICT DO NOTHING`,
      project.id,
      `${invoice.number}-DEP`,
      depositAmount,
    )
    await prisma.$executeRawUnsafe(
      `UPDATE "projects" SET "upfrontPercent" = $1 WHERE id = $2`,
      upfrontPct,
      project.id,
    )
  }

  // Record sync log
  await prisma.bukkuSyncLog.create({
    data: {
      type: 'INVOICE',
      bukkuId: invoice.id,
      data: JSON.parse(JSON.stringify(invoice)),
    },
  })

  // Audit log
  const adminUser = await prisma.user.findFirst({ where: { role: Role.ADMIN } })
  if (adminUser) {
    await createAuditLog({
      projectId: project.id,
      action: 'PROJECT_AUTO_CREATED',
      performedById: adminUser.id,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        contactId: invoice.contact_id,
        totalAmount: invoice.total_amount,
        source: 'invoice',
      },
    })
  }

  // Run post-create automation (autopilot/copilot, Gantt, Lark cards)
  try {
    await postCreateAutomation(
      project.id,
      projectCode,
      invoice.contact_name,
      'invoice',
      invoice.number
    )
  } catch (err) {
    logger.error('[BriefCreator] postCreateAutomation error:', { error: getErrorMessage(err) })
  }

  // CS notification (brief summary)
  const notifySettings = await getSettings()
  if (notifySettings.larkBriefEnabled) {
    try {
      await notify('CS', {
        title: `New Project: ${projectCode}`,
        body: `**Client:** ${invoice.contact_name}\n**Deliverables:** ${deliverableItems.length} item(s)\n**Mode:** ${notifySettings.autopilotMode ? '🤖 Autopilot — designers auto-assigned' : '🧑‍💼 Copilot — awaiting your review'}`,
        projectCode,
        actionLabel: 'View Project',
        actionUrl: `${process.env.NEXTAUTH_URL}/cs/projects/${project.id}`,
      })
    } catch (err) {
      logger.error('[BriefCreator] CS notify error:', { error: getErrorMessage(err) })
    }
  }

  return project
}

// ─── Create from Quotation ────────────────────────────────────────────────────

export async function createProjectFromQuotation(quotation: BukkuQuotation): Promise<Project> {
  const lineItems = parseLineItems(quotation)
  const projectCode = await generateProjectCode()
  const now = new Date()

  const client = await prisma.client.findFirst({
    where: { bukkuContactId: quotation.contact_id },
  })

  const deadline = quotation.expiry_date
    ? new Date(quotation.expiry_date)
    : addDays(now, 21)

  const project = await prisma.project.create({
    data: {
      code: projectCode,
      clientId: client?.id ?? null,
      status: 'PROJECTED',
      quotedAmount: quotation.total_amount,
      bukkuQuoteId: quotation.id,
      deadline,
    },
  })

  // Link Quotation record with human-readable number so the system tracks
  // which Bukku quotation belongs to this project
  await prisma.$executeRawUnsafe(
    `INSERT INTO "quotations" (id, "projectId", "quoteNumber", "bukkuQuoteId", amount, status, "issuedAt", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 'ACCEPTED'::"QuotationStatus", $5, NOW(), NOW())
     ON CONFLICT DO NOTHING`,
    project.id,
    quotation.number,
    quotation.id,
    quotation.total_amount,
    quotation.date ? new Date(quotation.date) : null,
  )

  await prisma.projectBrief.create({
    data: {
      projectId: project.id,
      packageType: 'Auto-generated from Bukku quotation',
      specialInstructions: `Quotation #${quotation.number} accepted on ${quotation.date}. Review and complete remaining brief fields.`,
    },
  })

  const deliverableItems = await Promise.all(
    lineItems.map((item) =>
      prisma.deliverableItem.create({
        data: {
          projectId: project.id,
          itemType: item.itemType,
          description: item.description,
          quantity: item.quantity,
          revisionLimit: 2,
          status: 'PENDING',
          estimatedMinutes: getDefaultEstimatedMinutes(item.itemType),
          deadline: addDays(now, DEFAULT_DEADLINES_DAYS[item.itemType]),
        },
      })
    )
  )

  // ── Lark: create Drive folders + group chat ──────────────────────────────
  try {
    const folderMap = await createProjectFolders(projectCode)

    const csTeam = await prisma.$queryRawUnsafe<{ larkOpenId: string | null }[]>(
      `SELECT "larkOpenId" FROM "users"
       WHERE active = true
         AND role IN ('CLIENT_SERVICING','CREATIVE_DIRECTOR','ADMIN')
         AND "larkOpenId" IS NOT NULL`
    )
    const memberIds = csTeam.map(u => u.larkOpenId).filter(Boolean) as string[]

    const chatId = await createProjectChat(projectCode, quotation.contact_name, memberIds)

    await prisma.$executeRawUnsafe(
      `UPDATE "projects" SET "larkFolderId" = $1, "larkChatId" = $2 WHERE id = $3`,
      folderMap.root,
      chatId,
      project.id,
    )
  } catch (error) {
    logger.error(`[BriefCreator] Lark setup failed for ${projectCode}`, { error: getErrorMessage(error) })
  }

  // Record sync log
  await prisma.bukkuSyncLog.create({
    data: {
      type: 'QUOTE',
      bukkuId: quotation.id,
      data: JSON.parse(JSON.stringify(quotation)),
    },
  })

  // Audit log
  const adminUser = await prisma.user.findFirst({ where: { role: Role.ADMIN } })
  if (adminUser) {
    await createAuditLog({
      projectId: project.id,
      action: 'PROJECT_AUTO_CREATED',
      performedById: adminUser.id,
      metadata: {
        quotationId: quotation.id,
        quotationNumber: quotation.number,
        contactId: quotation.contact_id,
        totalAmount: quotation.total_amount,
        source: 'quotation',
      },
    })
  }

  // Run post-create automation (autopilot/copilot, Gantt, Lark cards)
  try {
    await postCreateAutomation(
      project.id,
      projectCode,
      quotation.contact_name,
      'quotation',
      quotation.number
    )
  } catch (err) {
    logger.error('[BriefCreator] postCreateAutomation error:', { error: getErrorMessage(err) })
  }

  // CS notification (brief summary)
  const settings = await getSettings()
  if (settings.larkBriefEnabled) {
    try {
      await notify('CS', {
        title: `New Project: ${projectCode}`,
        body: `**Client:** ${quotation.contact_name}\n**Deliverables:** ${deliverableItems.length} item(s)\n**Mode:** ${settings.autopilotMode ? '🤖 Autopilot — designers auto-assigned' : '🧑‍💼 Copilot — awaiting your review'}`,
        projectCode,
        actionLabel: 'View Project',
        actionUrl: `${process.env.NEXTAUTH_URL}/cs/projects/${project.id}`,
      })
    } catch (err) {
      logger.error('[BriefCreator] CS notify error:', { error: getErrorMessage(err) })
    }
  }

  return project
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDefaultEstimatedMinutes(itemType: ItemType): number {
  const estimates: Record<ItemType, number> = {
    [ItemType.BANNER]: 90,
    [ItemType.BROCHURE]: 180,
    [ItemType.LOGO]: 240,
    [ItemType.SOCIAL]: 60,
    [ItemType.PRINT]: 120,
    [ItemType.THREE_D]: 300,
    [ItemType.VIDEO]: 240,
    [ItemType.OTHER]: 120,
  }
  return estimates[itemType]
}
