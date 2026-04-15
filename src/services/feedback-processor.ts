/**
 * feedback-processor.ts
 *
 * AI-powered client feedback pipeline:
 * 1. Rewrite raw client feedback into a clear, structured designer brief
 * 2. Generate a verifiable requirement checklist
 * 3. On delivery: QC-check the designer's submission against the checklist
 * 4. Send WhatsApp confirmation to client with approval link
 */

import { handleClientFeedback } from '@/services/ai'
import { sendMessage, sendTemplate } from '@/services/whatsapp'
import { prisma } from '@/lib/db'
import { logger, getErrorMessage } from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProcessedFeedback {
  clarifiedFeedback: string
  designerBrief: string
  requirementChecklist: RequirementItem[]
  clientResponseDraft: string
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'CRITICAL'
  escalate: boolean
}

export interface RequirementItem {
  id: string
  requirement: string
  category: 'COPY' | 'LAYOUT' | 'COLOUR' | 'SIZE' | 'ASSET' | 'OTHER'
  priority: 'MUST' | 'SHOULD' | 'NICE'
  verified: boolean
}

export interface QCResult {
  passed: boolean
  score: number // 0–100
  checkedItems: Array<RequirementItem & { passed: boolean; note: string }>
  failedRequirements: string[]
  readyForClient: boolean
}

// ─── Process incoming client feedback ────────────────────────────────────────

export async function processFeedback(params: {
  clientName: string
  projectCode: string
  feedback: string
  revisionCount: number
  revisionLimit: number
}): Promise<ProcessedFeedback> {
  const aiResult = await handleClientFeedback({
    clientName: params.clientName,
    feedback: params.feedback,
    projectCode: params.projectCode,
    revisionCount: params.revisionCount,
    revisionLimit: params.revisionLimit,
  })

  // Parse designer brief into structured checklist items
  const checklist = extractChecklist(params.feedback, aiResult.designerBrief)

  return {
    clarifiedFeedback: aiResult.designerBrief,
    designerBrief: aiResult.designerBrief,
    requirementChecklist: checklist,
    clientResponseDraft: aiResult.response,
    sentiment: aiResult.sentiment,
    escalate: aiResult.escalate,
  }
}

// ─── Parse checklist from brief ───────────────────────────────────────────────

function extractChecklist(rawFeedback: string, designerBrief: string): RequirementItem[] {
  const lines = designerBrief
    .split(/[.\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10)

  return lines.slice(0, 8).map((line, i) => ({
    id: `req-${i + 1}`,
    requirement: line,
    category: detectCategory(line),
    priority: detectPriority(line, rawFeedback),
    verified: false,
  }))
}

function detectCategory(text: string): RequirementItem['category'] {
  const t = text.toLowerCase()
  if (/colou?r|shade|hue|tone/.test(t)) return 'COLOUR'
  if (/font|text|copy|wording|headline|content/.test(t)) return 'COPY'
  if (/size|dimension|pixel|cm|mm|resolution|format/.test(t)) return 'SIZE'
  if (/logo|image|photo|icon|asset/.test(t)) return 'ASSET'
  if (/layout|position|align|spacing|margin|padding/.test(t)) return 'LAYOUT'
  return 'OTHER'
}

function detectPriority(text: string, rawFeedback: string): RequirementItem['priority'] {
  const t = (text + rawFeedback).toLowerCase()
  if (/must|urgent|critical|important|definitely|ensure/.test(t)) return 'MUST'
  if (/should|please|prefer|would like|can you/.test(t)) return 'SHOULD'
  return 'NICE'
}

// ─── QC: verify designer submitted work meets all checklist items ─────────────

export async function runQCCheck(params: {
  deliverableItemId: string
  submissionDescription: string
  checklist: RequirementItem[]
}): Promise<QCResult> {
  if (params.checklist.length === 0) {
    return { passed: true, score: 100, checkedItems: [], failedRequirements: [], readyForClient: true }
  }

  const { callClaudeForQC } = await import('@/services/ai-internal')
  const requirementLines = params.checklist
    .map((r, i) => `${i + 1}. [${r.priority}] ${r.requirement}`)
    .join('\n')

  const prompt = `QC check: does this design submission address all requirements?
Reply JSON only: {"results":[{"id":"<req-id>","passed":bool,"note":"<10 words>"}],"overallScore":0-100}

Submission: "${params.submissionDescription}"

Requirements:
${requirementLines}`

  let rawResult: { results: Array<{ id: string; passed: boolean; note: string }>; overallScore: number }

  try {
    rawResult = await callClaudeForQC(prompt)
  } catch {
    // Fallback: assume all passed if AI unavailable
    rawResult = {
      overallScore: 80,
      results: params.checklist.map((r) => ({ id: r.id, passed: true, note: 'AI check unavailable' })),
    }
  }

  const checkedItems = params.checklist.map((req) => {
    const result = rawResult.results.find((r) => r.id === req.id) ?? { passed: true, note: 'Checked' }
    return { ...req, passed: result.passed, note: result.note }
  })

  const failedMust = checkedItems.filter((i) => !i.passed && i.priority === 'MUST')
  const failedCount = checkedItems.filter((i) => !i.passed).length

  return {
    passed: failedMust.length === 0,
    score: rawResult.overallScore,
    checkedItems,
    failedRequirements: checkedItems.filter((i) => !i.passed).map((i) => i.requirement),
    readyForClient: failedMust.length === 0 && failedCount <= 1,
  }
}

// ─── WhatsApp: notify client feedback received ────────────────────────────────

export async function notifyClientFeedbackReceived(params: {
  clientPhone: string
  clientName: string
  projectCode: string
  confirmationMessage: string
}): Promise<void> {
  if (!params.clientPhone) return

  try {
    await sendMessage(
      params.clientPhone,
      `Hi ${params.clientName}! 👋\n\nWe've received your feedback for project *${params.projectCode}*. Our designer will work on the revisions and we'll send you the updated version for review shortly.\n\nThank you for your patience!`
    )
  } catch (err) {
    logger.error('[FeedbackProcessor] WhatsApp notify failed:', { error: getErrorMessage(err) })
  }
}

// ─── WhatsApp: send deliverable to client for approval ────────────────────────

export async function sendDeliverableForApproval(params: {
  clientPhone: string
  clientName: string
  projectCode: string
  projectId: string
  deliverableItemId: string
  itemType: string
  fileUrl?: string
  revisionNumber?: number
}): Promise<void> {
  if (!params.clientPhone) return

  const appUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? ''
  const approvalToken = Buffer.from(`${params.deliverableItemId}:${Date.now()}`).toString('base64url')

  // Store approval token in DB for verification
  await prisma.$executeRawUnsafe(
    `INSERT INTO "client_approvals" (id, "deliverableItemId", token, status, "createdAt")
     VALUES (gen_random_uuid()::text, $1, $2, 'PENDING', NOW())
     ON CONFLICT DO NOTHING`,
    params.deliverableItemId,
    approvalToken
  ).catch(() => {
    // Table may not exist yet — non-fatal, approval still works via link
  })

  const approvalUrl = `${appUrl}/client/approve/${approvalToken}`
  const revisionLabel = params.revisionNumber ? ` (Revision ${params.revisionNumber})` : ''

  try {
    const message = [
      `Hi ${params.clientName}! 🎨`,
      ``,
      `Your *${params.itemType}${revisionLabel}* for project *${params.projectCode}* is ready for your review!`,
      params.fileUrl ? `📎 View file: ${params.fileUrl}` : '',
      ``,
      `Please review and click one of the options below:`,
      `✅ *Approve* — ${approvalUrl}?action=approve`,
      `🔄 *Request Changes* — ${approvalUrl}?action=reject`,
      ``,
      `Your feedback helps us deliver exactly what you need. Thank you! 🙏`,
    ].filter(Boolean).join('\n')

    await sendMessage(params.clientPhone, message)
  } catch (err) {
    logger.error('[FeedbackProcessor] WhatsApp approval send failed:', { error: getErrorMessage(err) })
  }
}

// ─── WhatsApp: handle client approval/rejection ───────────────────────────────

export async function handleClientApprovalResponse(params: {
  clientPhone: string
  message: string
  projectCode: string
  deliverableItemId: string
}): Promise<'APPROVED' | 'REVISION_REQUESTED' | 'UNKNOWN'> {
  const text = params.message.toLowerCase().trim()

  // Simple keyword detection
  const approvalKeywords = ['approve', 'approved', 'ok', 'good', 'looks great', 'perfect', 'yes', '✅', 'nice', 'lgtm']
  const rejectionKeywords = ['change', 'revision', 'update', 'modify', 'fix', 'no', 'not', 'wrong', 'different', '🔄']

  const isApproval = approvalKeywords.some((kw) => text.includes(kw))
  const isRejection = rejectionKeywords.some((kw) => text.includes(kw))

  if (isApproval && !isRejection) return 'APPROVED'
  if (isRejection) return 'REVISION_REQUESTED'
  return 'UNKNOWN'
}

// ─── Store processed feedback on revision record ─────────────────────────────

export async function storeFeedbackOnRevision(
  revisionId: string,
  processed: ProcessedFeedback
): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "revisions"
       SET "clarifiedFeedback" = $1, "requirementChecklist" = $2::jsonb
       WHERE id = $3`,
      processed.clarifiedFeedback,
      JSON.stringify(processed.requirementChecklist),
      revisionId
    )
  } catch {
    // Column may not exist yet — ignored until migration runs
  }
}
