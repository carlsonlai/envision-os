import Anthropic from '@anthropic-ai/sdk'

// Lazy singleton — throws a clear error if the key is missing rather than
// crashing the module at import time (which causes opaque 500s in Next.js).
let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (!_client) {
    const key = process.env.ANTHROPIC_API_KEY
    if (!key) {
      throw new Error(
        'ANTHROPIC_API_KEY is not set. Add your key to .env.local:\n  ANTHROPIC_API_KEY=sk-ant-...\nThen restart the dev server.'
      )
    }
    _client = new Anthropic({ apiKey: key })
  }
  return _client
}

// ─── Helper ────────────────────────────────────────────────────────────────

async function callClaude(prompt: string, maxTokens = 300): Promise<string> {
  const message = await getClient().messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  })
  return message.content[0].type === 'text' ? message.content[0].text.trim() : ''
}

function parseJSON<T>(text: string, fallback: T): T {
  const match = text.match(/[\[{][\s\S]*[\]}]/)
  if (!match) return fallback
  try { return JSON.parse(match[0]) as T } catch { return fallback }
}

export interface LeadScoreResult {
  score: 'HOT' | 'WARM' | 'COLD'
  reason: string
  suggestedAction: string
}

export async function scoreLead(lead: {
  industry: string
  projectType: string
  budget: string
  timeline: string
  source: string
}): Promise<LeadScoreResult> {
  const message = await getClient().messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 100,
    messages: [
      {
        role: 'user',
        content: `Score this lead HOT/WARM/COLD. Reply JSON only: {"score":"HOT|WARM|COLD","reason":"<10 words>","suggestedAction":"<10 words>"}
Industry:${lead.industry} Type:${lead.projectType} Budget:${lead.budget} Timeline:${lead.timeline} Source:${lead.source}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { score: 'COLD', reason: 'Unable to assess', suggestedAction: 'Manual review required' }
  }
  const parsed = JSON.parse(jsonMatch[0]) as { score: 'HOT' | 'WARM' | 'COLD'; reason: string; suggestedAction: string }
  return parsed
}

export async function draftUpsellMessage(params: {
  clientIndustry: string
  lastProjectType: string
  suggestedService: string
  channel: 'WHATSAPP' | 'EMAIL'
}): Promise<string> {
  const message = await getClient().messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 120,
    messages: [
      {
        role: 'user',
        content: `Write a ${params.channel === 'WHATSAPP' ? 'casual WhatsApp' : 'professional email'} upsell message. Max 2 sentences. No subject line.
Client industry:${params.clientIndustry} Last project:${params.lastProjectType} Suggest:${params.suggestedService}`,
      },
    ],
  })

  return message.content[0].type === 'text' ? message.content[0].text.trim() : ''
}

export async function personaliseProposal(params: {
  clientIndustry: string
  projectNeed: string
  agencyStrength: string
}): Promise<string> {
  const message = await getClient().messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 100,
    messages: [
      {
        role: 'user',
        content: `Write a 3-line proposal intro. Confident tone. No fluff.
Industry:${params.clientIndustry} Need:${params.projectNeed} Our strength:${params.agencyStrength}`,
      },
    ],
  })

  return message.content[0].type === 'text' ? message.content[0].text.trim() : ''
}

export interface KPINudge {
  userId: string
  nudge: string
}

export async function generateDailyKPINudges(
  teamKPIs: { userId: string; role: string; metrics: Record<string, number> }[]
): Promise<KPINudge[]> {
  if (teamKPIs.length === 0) return []

  const teamSummary = teamKPIs
    .map((t) => `${t.userId}|${t.role}|${JSON.stringify(t.metrics)}`)
    .join('\n')

  const message = await getClient().messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 400,
    messages: [
      {
        role: 'user',
        content: `Generate one coaching nudge per team member. Reply JSON array only: [{"userId":"id","nudge":"<15 words max"}]
Team data (userId|role|metrics):
${teamSummary}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return teamKPIs.map((t) => ({ userId: t.userId, nudge: 'Keep up the momentum today.' }))

  const parsed = JSON.parse(jsonMatch[0]) as KPINudge[]
  return parsed
}

export async function generateWeeklyStrategyBrief(data: {
  revenueVsTarget: number
  topUnbilledValue: number
  teamUtilisation: number
  topChurnRiskClients: string[]
  upcomingSeasonal: string[]
  competitorLosses: number
}): Promise<string> {
  const message = await getClient().messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 450,
    messages: [
      {
        role: 'user',
        content: `Weekly agency strategy brief for Carlson (MD). 4 bullet points max. Action-oriented. No fluff.
Revenue vs target:${data.revenueVsTarget}% Unbilled:RM${data.topUnbilledValue} Utilisation:${data.teamUtilisation}%
Churn risk:${data.topChurnRiskClients.join(',')} Seasonal:${data.upcomingSeasonal.join(',')} Competitor losses:${data.competitorLosses}`,
      },
    ],
  })

  return message.content[0].type === 'text' ? message.content[0].text.trim() : ''
}

export async function draftSentimentRecovery(params: {
  clientIndustry: string
  issueSignals: string[]
  lastProjectType: string
}): Promise<string> {
  const message = await getClient().messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 120,
    messages: [
      {
        role: 'user',
        content: `Draft a sincere client recovery message. 2 sentences max. Empathetic, no excuses.
Industry:${params.clientIndustry} Issues:${params.issueSignals.join(',')} Last project:${params.lastProjectType}`,
      },
    ],
  })

  return message.content[0].type === 'text' ? message.content[0].text.trim() : ''
}

export interface BriefQualityResult {
  passed: boolean
  missingFields: string[]
  suggestions: string[]
}

export async function checkBriefQuality(brief: {
  itemType: string
  description: string
  references: boolean
  dimensions: boolean
  colours: boolean
  fileFormat: boolean
}): Promise<BriefQualityResult> {
  // Rule-based check first — only call AI if ambiguous
  const missingFields: string[] = []
  if (!brief.references) missingFields.push('references')
  if (!brief.dimensions) missingFields.push('dimensions')
  if (!brief.colours) missingFields.push('colours')
  if (!brief.fileFormat) missingFields.push('fileFormat')

  if (missingFields.length === 0 && brief.description.length > 20) {
    return { passed: true, missingFields: [], suggestions: [] }
  }

  const message = await getClient().messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 100,
    messages: [
      {
        role: 'user',
        content: `Brief quality check. Reply JSON: {"passed":bool,"missingFields":[],"suggestions":[]}
Type:${brief.itemType} Desc:"${brief.description.slice(0, 80)}" Missing:${missingFields.join(',')}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return { passed: false, missingFields, suggestions: ['Provide more brief details'] }

  const parsed = JSON.parse(jsonMatch[0]) as BriefQualityResult
  return parsed
}

// ─── AI SALES AGENT FUNCTIONS ──────────────────────────────────────────────

export interface AdStrategy {
  platform: string
  objective: string
  targetAudience: string
  budget: string
  duration: string
  hooks: string[]
  adCopy: string
  visualConcept: string
  callToAction: string
  kpis: string[]
}

export async function generateAdStrategy(params: {
  service: string
  targetIndustry: string
  budget: string
  goal: string
}): Promise<AdStrategy> {
  const text = await callClaude(
    `You are an expert digital marketing strategist for a Malaysian creative agency called Envicion Studios.
Generate a complete ad strategy. Reply JSON only.
Service:${params.service} Industry:${params.targetIndustry} Budget:${params.budget} Goal:${params.goal}
JSON: {"platform":"FB|IG|TIKTOK|GOOGLE","objective":"LEADS|AWARENESS|CONVERSION","targetAudience":"<description>","budget":"<allocation>","duration":"<timeframe>","hooks":["hook1","hook2","hook3"],"adCopy":"<2-3 sentences>","visualConcept":"<visual description>","callToAction":"<CTA text>","kpis":["kpi1","kpi2","kpi3"]}`,
    500,
  )
  return parseJSON<AdStrategy>(text, {
    platform: 'INSTAGRAM',
    objective: 'LEADS',
    targetAudience: params.targetIndustry,
    budget: params.budget,
    duration: '30 days',
    hooks: ['Pain point hook', 'Curiosity hook', 'Social proof hook'],
    adCopy: `Get professional ${params.service} that converts. Trusted by Malaysia\'s top brands.`,
    visualConcept: 'Before/after creative showcase',
    callToAction: 'Get Free Quote',
    kpis: ['CPL < RM50', 'CTR > 2%', '10 qualified leads/month'],
  })
}

export interface HookAngles {
  hooks: Array<{
    angle: string
    headline: string
    openingLine: string
    platform: string
  }>
}

export async function planHookAngles(params: {
  service: string
  targetAudience: string
  painPoint: string
}): Promise<HookAngles> {
  const text = await callClaude(
    `Generate 5 scroll-stopping hook angles for a Malaysian creative agency ad.
Reply JSON only: {"hooks":[{"angle":"<type>","headline":"<headline>","openingLine":"<first line>","platform":"<best platform>"}]}
Service:${params.service} Audience:${params.targetAudience} PainPoint:${params.painPoint}`,
    400,
  )
  return parseJSON<HookAngles>(text, {
    hooks: [
      { angle: 'Pain Point', headline: `Still losing clients to bad design?`, openingLine: 'Your brand is the first thing clients judge.', platform: 'FACEBOOK' },
      { angle: 'Social Proof', headline: `50+ Malaysian brands trust us`, openingLine: 'From KLCC startups to Iskandar enterprises.', platform: 'INSTAGRAM' },
      { angle: 'Curiosity', headline: `Why your competitor looks more premium`, openingLine: 'It\'s not budget. It\'s strategy.', platform: 'TIKTOK' },
      { angle: 'Transformation', headline: `From RM3k logo to RM50k contracts`, openingLine: 'Professional branding pays for itself.', platform: 'LINKEDIN' },
      { angle: 'Urgency', headline: `Q2 slots filling fast`, openingLine: 'We only take 5 new clients per month.', platform: 'INSTAGRAM' },
    ],
  })
}

export interface ProspectConversationScript {
  stage: string
  openingMessage: string
  followUpMessages: string[]
  objectionHandlers: Array<{ objection: string; response: string }>
  closingMessage: string
}

export async function draftProspectConversation(params: {
  leadName: string
  company: string
  stage: string
  channel: string
  context: string
}): Promise<ProspectConversationScript> {
  const text = await callClaude(
    `You are an AI sales agent for Envicion Studios, a Malaysian creative agency.
Draft a ${params.channel} conversation script for a prospect at the ${params.stage} stage.
Reply JSON only: {"stage":"${params.stage}","openingMessage":"<msg>","followUpMessages":["<f1>","<f2>"],"objectionHandlers":[{"objection":"<obj>","response":"<res>"}],"closingMessage":"<msg>"}
Lead:${params.leadName} Company:${params.company} Context:${params.context}`,
    500,
  )
  return parseJSON<ProspectConversationScript>(text, {
    stage: params.stage,
    openingMessage: `Hi ${params.leadName}! I noticed ${params.company} might benefit from our creative services. Can I share how we've helped similar businesses?`,
    followUpMessages: ['Following up on my previous message!', 'Would love to schedule a 15-min call this week.'],
    objectionHandlers: [{ objection: 'Too expensive', response: 'Our packages start from RM2k. Most clients 3x their ROI within 6 months.' }],
    closingMessage: `Ready to elevate ${params.company}\'s brand? Let\'s set up a quick call!`,
  })
}

export interface LeadQualification {
  qualified: boolean
  score: number // 0-100
  signals: string[]
  redFlags: string[]
  recommendedAction: string
  estimatedDealSize: string
  priorityLevel: 'IMMEDIATE' | 'THIS_WEEK' | 'THIS_MONTH' | 'NURTURE'
}

export async function autoQualifyLead(params: {
  name: string
  company: string
  industry: string
  budget: string
  timeline: string
  source: string
  notes: string
}): Promise<LeadQualification> {
  const text = await callClaude(
    `Qualify this sales lead for a Malaysian creative agency. Reply JSON only.
{"qualified":bool,"score":0-100,"signals":["<positive signal>"],"redFlags":["<concern>"],"recommendedAction":"<action>","estimatedDealSize":"<RM range>","priorityLevel":"IMMEDIATE|THIS_WEEK|THIS_MONTH|NURTURE"}
Name:${params.name} Company:${params.company} Industry:${params.industry} Budget:${params.budget} Timeline:${params.timeline} Source:${params.source} Notes:${params.notes}`,
    350,
  )
  return parseJSON<LeadQualification>(text, {
    qualified: false,
    score: 40,
    signals: ['Inbound inquiry'],
    redFlags: ['Budget unclear'],
    recommendedAction: 'Schedule discovery call',
    estimatedDealSize: 'RM 5,000 – RM 15,000',
    priorityLevel: 'THIS_WEEK',
  })
}

export interface LeadGenPlan {
  weeklyGoal: number
  channels: Array<{ channel: string; tactic: string; expectedLeads: number; cost: string }>
  contentIdeas: string[]
  outreachSequence: string[]
  kpis: Array<{ metric: string; target: string }>
}

export async function generateLeadGenPlan(params: {
  targetIndustry: string
  monthlyRevenueGoal: string
  avgDealSize: string
  currentChannels: string
}): Promise<LeadGenPlan> {
  const text = await callClaude(
    `Create a 4-week lead generation plan for a Malaysian creative agency.
Reply JSON only: {"weeklyGoal":10,"channels":[{"channel":"<name>","tactic":"<description>","expectedLeads":5,"cost":"<RM amount>"}],"contentIdeas":["<idea>"],"outreachSequence":["<step>"],"kpis":[{"metric":"<name>","target":"<value>"}]}
Industry:${params.targetIndustry} Revenue Goal:${params.monthlyRevenueGoal} Avg Deal:${params.avgDealSize} Current Channels:${params.currentChannels}`,
    600,
  )
  return parseJSON<LeadGenPlan>(text, {
    weeklyGoal: 10,
    channels: [
      { channel: 'Instagram Ads', tactic: 'Portfolio showcase reels targeting SME owners', expectedLeads: 8, cost: 'RM 1,500/month' },
      { channel: 'LinkedIn Outreach', tactic: 'Connect with marketing managers in target industry', expectedLeads: 5, cost: 'RM 0 (time only)' },
      { channel: 'WhatsApp Broadcast', tactic: 'Monthly tips newsletter to existing network', expectedLeads: 3, cost: 'RM 0' },
      { channel: 'Referral Programme', tactic: '10% commission for client referrals', expectedLeads: 4, cost: 'Revenue share' },
    ],
    contentIdeas: ['Before/after branding case study', 'Client testimonial video', '5 signs your brand needs a refresh', 'Package pricing carousel'],
    outreachSequence: ['Day 1: Connect + intro message', 'Day 3: Send portfolio link', 'Day 7: Follow up with relevant case study', 'Day 14: Offer free brand audit'],
    kpis: [{ metric: 'Leads/month', target: '20' }, { metric: 'Conversion rate', target: '25%' }, { metric: 'CPL', target: '< RM 75' }],
  })
}

export interface ProposalDraft {
  subject: string
  executiveSummary: string
  problemStatement: string
  proposedSolution: string
  deliverables: string[]
  timeline: string
  pricing: string
  whyUs: string
  nextSteps: string
}

export async function draftProposal(params: {
  clientName: string
  company: string
  industry: string
  projectType: string
  budget: string
  painPoints: string
}): Promise<ProposalDraft> {
  const text = await callClaude(
    `Write a winning proposal for a Malaysian creative agency. Reply JSON only.
{"subject":"<email subject>","executiveSummary":"<2 sentences>","problemStatement":"<2 sentences>","proposedSolution":"<3 sentences>","deliverables":["<item>"],"timeline":"<timeframe>","pricing":"<strategy>","whyUs":"<2 sentences>","nextSteps":"<3 action items>"}
Client:${params.clientName} Company:${params.company} Industry:${params.industry} Project:${params.projectType} Budget:${params.budget} PainPoints:${params.painPoints}`,
    600,
  )
  return parseJSON<ProposalDraft>(text, {
    subject: `Creative Partnership Proposal for ${params.company}`,
    executiveSummary: `We understand ${params.company} needs impactful ${params.projectType} that drives real business results. Envicion Studios specialises in exactly this.`,
    problemStatement: `Many ${params.industry} businesses struggle with inconsistent brand identity that fails to convert. This costs revenue and credibility.`,
    proposedSolution: `We propose a comprehensive ${params.projectType} solution tailored to ${params.industry}. Our process ensures brand consistency, market differentiation, and measurable results.`,
    deliverables: [`${params.projectType} design files`, 'Brand guidelines', '3 revision rounds', 'Final delivery in all required formats'],
    timeline: '3-4 weeks from brief sign-off',
    pricing: `Within your ${params.budget} budget with 50% deposit to commence`,
    whyUs: `We\'ve delivered for 50+ Malaysian businesses across F&B, retail, and professional services. Our clients average 40% more engagement after rebranding.`,
    nextSteps: 'Review this proposal → Schedule 30-min kick-off call → Sign brief and pay deposit',
  })
}

// ─── AI CS AGENT FUNCTIONS ────────────────────────────────────────────────

export interface ClientUpdate {
  subject: string
  greeting: string
  progressSummary: string
  nextMilestone: string
  actionRequired: string
  closing: string
  tone: 'FORMAL' | 'FRIENDLY' | 'URGENT'
}

export async function draftClientUpdate(params: {
  clientName: string
  projectCode: string
  currentStatus: string
  completedItems: string[]
  pendingItems: string[]
  deadline: string
  issues: string
}): Promise<ClientUpdate> {
  const text = await callClaude(
    `Draft a professional client project update for a Malaysian creative agency. Reply JSON only.
{"subject":"<email subject>","greeting":"<personalised greeting>","progressSummary":"<2 sentences>","nextMilestone":"<what happens next>","actionRequired":"<what client needs to do, or NONE>","closing":"<warm closing>","tone":"FORMAL|FRIENDLY|URGENT"}
Client:${params.clientName} Project:${params.projectCode} Status:${params.currentStatus}
Done:${params.completedItems.join(',')} Pending:${params.pendingItems.join(',')} Deadline:${params.deadline} Issues:${params.issues}`,
    400,
  )
  return parseJSON<ClientUpdate>(text, {
    subject: `Project ${params.projectCode} – Progress Update`,
    greeting: `Hi ${params.clientName}, hope you're doing well!`,
    progressSummary: `We've completed ${params.completedItems.join(', ')} and are currently working on ${params.pendingItems.join(', ')}.`,
    nextMilestone: `We'll share the first draft for your review within 2 business days.`,
    actionRequired: 'Please review and approve the brief we shared earlier.',
    closing: 'Excited to show you what we\'ve been working on. Talk soon!',
    tone: 'FRIENDLY',
  })
}

export interface ClientFeedbackResponse {
  response: string
  internalNote: string
  escalate: boolean
  escalationReason: string
  designerBrief: string
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'CRITICAL'
}

export async function handleClientFeedback(params: {
  clientName: string
  feedback: string
  projectCode: string
  revisionCount: number
  revisionLimit: number
}): Promise<ClientFeedbackResponse> {
  const text = await callClaude(
    `You are a senior client servicing manager. Analyse this client feedback and generate a response + internal note.
Reply JSON only: {"response":"<client response>","internalNote":"<for internal team>","escalate":bool,"escalationReason":"<reason or NONE>","designerBrief":"<instruction for designer>","sentiment":"POSITIVE|NEUTRAL|NEGATIVE|CRITICAL"}
Client:${params.clientName} Project:${params.projectCode} Revisions:${params.revisionCount}/${params.revisionLimit}
Feedback: "${params.feedback}"`,
    450,
  )
  return parseJSON<ClientFeedbackResponse>(text, {
    response: `Hi ${params.clientName}, thank you for your detailed feedback! We've noted all your points and will incorporate them in the next revision. We'll have the updated version to you within 1-2 business days.`,
    internalNote: `Client wants changes to: ${params.feedback.slice(0, 100)}`,
    escalate: false,
    escalationReason: 'NONE',
    designerBrief: `Please address client feedback: ${params.feedback.slice(0, 200)}`,
    sentiment: 'NEUTRAL',
  })
}

export interface SatisfactionAnalysis {
  score: number // 0-10
  status: 'HAPPY' | 'NEUTRAL' | 'AT_RISK' | 'CRITICAL'
  signals: string[]
  recommendedAction: string
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'IMMEDIATE'
  retentionRisk: number // 0-100%
}

export async function analyseClientSatisfaction(params: {
  clientName: string
  recentMessages: string[]
  revisionCount: number
  projectDaysOverdue: number
  lastContactDays: number
}): Promise<SatisfactionAnalysis> {
  const text = await callClaude(
    `Analyse client satisfaction for a Malaysian creative agency. Reply JSON only.
{"score":0-10,"status":"HAPPY|NEUTRAL|AT_RISK|CRITICAL","signals":["<signal>"],"recommendedAction":"<action>","urgency":"LOW|MEDIUM|HIGH|IMMEDIATE","retentionRisk":0-100}
Client:${params.clientName} RecentMessages:${params.recentMessages.slice(-3).join(' | ')}
Revisions:${params.revisionCount} DaysOverdue:${params.projectDaysOverdue} DaysSinceContact:${params.lastContactDays}`,
    300,
  )
  return parseJSON<SatisfactionAnalysis>(text, {
    score: 6,
    status: 'NEUTRAL',
    signals: ['Multiple revision requests', 'Delayed responses'],
    recommendedAction: 'Schedule a call to align on expectations',
    urgency: 'MEDIUM',
    retentionRisk: 30,
  })
}

export interface InvoiceFollowUp {
  subject: string
  message: string
  tone: 'GENTLE' | 'FIRM' | 'URGENT' | 'FINAL_NOTICE'
  paymentLink: boolean
  escalate: boolean
}

export async function draftInvoiceFollowUp(params: {
  clientName: string
  invoiceAmount: string
  daysOverdue: number
  invoiceNumber: string
  previousFollowUps: number
}): Promise<InvoiceFollowUp> {
  const tone = params.daysOverdue <= 7 ? 'GENTLE' : params.daysOverdue <= 21 ? 'FIRM' : params.daysOverdue <= 45 ? 'URGENT' : 'FINAL_NOTICE'
  const text = await callClaude(
    `Draft an invoice follow-up ${tone.toLowerCase()} message for a Malaysian creative agency. Reply JSON only.
{"subject":"<email subject>","message":"<message body>","tone":"${tone}","paymentLink":bool,"escalate":bool}
Client:${params.clientName} Invoice:${params.invoiceNumber} Amount:${params.invoiceAmount} DaysOverdue:${params.daysOverdue} PreviousFollowUps:${params.previousFollowUps}`,
    350,
  )
  return parseJSON<InvoiceFollowUp>(text, {
    subject: `Invoice ${params.invoiceNumber} – ${tone === 'GENTLE' ? 'Friendly Reminder' : 'Payment Due'}`,
    message: `Hi ${params.clientName}, this is a ${tone.toLowerCase()} reminder that Invoice ${params.invoiceNumber} for ${params.invoiceAmount} is ${params.daysOverdue} days overdue. Please arrange payment at your earliest convenience.`,
    tone,
    paymentLink: true,
    escalate: params.daysOverdue > 45,
  })
}

// ─── ADMIN REPLACEMENT REPORT ─────────────────────────────────────────────

export interface RoleReplacementReport {
  role: string
  currentEfficiency: number // 0-100
  automationPotential: number // 0-100
  timeToReplace: string
  automatedTasks: string[]
  humanOnlyTasks: string[]
  aiToolsNeeded: string[]
  estimatedMonthlySavings: string
  replacementRoadmap: Array<{ phase: string; timeline: string; action: string }>
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  recommendation: string
}

export async function generateRoleReplacementReport(params: {
  role: string
  responsibilities: string[]
  teamSize: number
  avgSalary: string
  currentAIUsage: string
}): Promise<RoleReplacementReport> {
  const text = await callClaude(
    `Analyse this agency role for AI replacement potential. Be honest and data-driven. Reply JSON only.
{"role":"${params.role}","currentEfficiency":0-100,"automationPotential":0-100,"timeToReplace":"<timeframe>","automatedTasks":["<task>"],"humanOnlyTasks":["<task>"],"aiToolsNeeded":["<tool>"],"estimatedMonthlySavings":"<RM amount>","replacementRoadmap":[{"phase":"<name>","timeline":"<when>","action":"<what to do>"}],"riskLevel":"LOW|MEDIUM|HIGH","recommendation":"<strategic advice>"}
Role:${params.role} Responsibilities:${params.responsibilities.join(',')} TeamSize:${params.teamSize} AvgSalary:${params.avgSalary} CurrentAI:${params.currentAIUsage}`,
    700,
  )
  return parseJSON<RoleReplacementReport>(text, {
    role: params.role,
    currentEfficiency: 65,
    automationPotential: 70,
    timeToReplace: '12-18 months',
    automatedTasks: ['Routine reporting', 'Status updates', 'Scheduling', 'Data entry'],
    humanOnlyTasks: ['Strategic decisions', 'Relationship management', 'Creative direction', 'Conflict resolution'],
    aiToolsNeeded: ['Claude AI', 'Automation workflows', 'CRM AI', 'Scheduling AI'],
    estimatedMonthlySavings: 'RM 3,000 – RM 8,000',
    replacementRoadmap: [
      { phase: 'Automate Repetitive Tasks', timeline: '0-3 months', action: 'Deploy AI for reporting, emails, and status updates' },
      { phase: 'Augment Decision Making', timeline: '3-9 months', action: 'Use AI scoring and recommendations; human reviews and approves' },
      { phase: 'Supervised Automation', timeline: '9-18 months', action: 'AI handles 80% independently; human handles exceptions' },
    ],
    riskLevel: 'MEDIUM',
    recommendation: 'Start with task automation while retaining human oversight. Full replacement in 18 months is realistic with proper tooling.',
  })
}
