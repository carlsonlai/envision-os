import axios, { AxiosError } from 'axios'
import { createHmac } from 'crypto'
import { logger, getErrorMessage } from '@/lib/logger'

const LARK_BASE = 'https://open.larksuite.com/open-apis'

export type FolderStage = 'WIP' | 'APPROVED' | 'FA' | 'FA_SIGNED' | 'AUDIT'

export type LarkChannel = 'CREATIVE' | 'CS' | 'SALES' | 'MANAGEMENT'

export interface LarkEvent {
  title: string
  body: string
  projectCode?: string
  actionLabel?: string
  actionUrl?: string
}

export interface LarkFolderMap {
  root: string
  brief: string
  references: string
  wip: string
  approved: string
  fa: string
  faSigned: string
  audit: string
}

interface TokenCache {
  token: string
  expiresAt: number
}

let tokenCache: TokenCache | null = null

export async function getToken(): Promise<string> {
  const now = Date.now()

  if (tokenCache && tokenCache.expiresAt > now) {
    return tokenCache.token
  }

  const appId = process.env.LARK_APP_ID
  const appSecret = process.env.LARK_APP_SECRET

  if (!appId || !appSecret) {
    throw new Error('Lark credentials not configured. Set LARK_APP_ID and LARK_APP_SECRET.')
  }

  try {
    const response = await axios.post<{
      code: number
      tenant_access_token: string
      expire: number
    }>(`${LARK_BASE}/auth/v3/tenant_access_token/internal`, {
      app_id: appId,
      app_secret: appSecret,
    })

    if (response.data.code !== 0) {
      throw new Error(`Lark auth failed with code ${response.data.code}`)
    }

    // Cache for 110 minutes (token expires at 120)
    tokenCache = {
      token: response.data.tenant_access_token,
      expiresAt: now + 110 * 60 * 1000,
    }

    return tokenCache.token
  } catch (error) {
    const axiosError = error as AxiosError
    logger.error('Lark getToken error', { error: axiosError.message })
    throw new Error(`Failed to get Lark access token: ${axiosError.message}`)
  }
}

async function createFolder(parentToken: string, name: string): Promise<string> {
  const token = await getToken()

  const response = await axios.post<{
    code: number
    data: { token: string }
  }>(
    `${LARK_BASE}/drive/v1/files/create_folder`,
    {
      name,
      folder_token: parentToken,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (response.data.code !== 0) {
    throw new Error(`Failed to create Lark folder "${name}": code ${response.data.code}`)
  }

  return response.data.data.token
}

export async function createProjectFolders(projectCode: string): Promise<LarkFolderMap> {
  const rootFolderToken = process.env.LARK_ROOT_FOLDER_TOKEN

  if (!rootFolderToken) {
    throw new Error('LARK_ROOT_FOLDER_TOKEN is not configured.')
  }

  try {
    const rootToken = await createFolder(rootFolderToken, projectCode)
    const briefToken = await createFolder(rootToken, 'Brief')
    const referencesToken = await createFolder(rootToken, 'References')
    const wipToken = await createFolder(rootToken, 'WIP')
    const approvedToken = await createFolder(rootToken, 'Approved')
    const faToken = await createFolder(rootToken, 'FA')
    const faSignedToken = await createFolder(faToken, 'Signed')
    const auditToken = await createFolder(rootToken, 'Audit')

    return {
      root: rootToken,
      brief: briefToken,
      references: referencesToken,
      wip: wipToken,
      approved: approvedToken,
      fa: faToken,
      faSigned: faSignedToken,
      audit: auditToken,
    }
  } catch (error) {
    const axiosError = error as AxiosError
    logger.error('Lark createProjectFolders error', { error: axiosError.message })
    throw new Error(`Failed to create Lark project folders: ${axiosError.message}`)
  }
}

const STAGE_FOLDER_MAP: Record<FolderStage, keyof LarkFolderMap> = {
  WIP: 'wip',
  APPROVED: 'approved',
  FA: 'fa',
  FA_SIGNED: 'faSigned',
  AUDIT: 'audit',
}

export async function uploadFile(
  fileBuffer: Buffer,
  fileName: string,
  stage: FolderStage,
  folderMap: LarkFolderMap
): Promise<string> {
  const token = await getToken()
  const folderKey = STAGE_FOLDER_MAP[stage]
  const folderToken = folderMap[folderKey]

  try {
    const { default: FormData } = await import('form-data')
    const form = new FormData()
    form.append('file_name', fileName)
    form.append('parent_type', 'explorer')
    form.append('parent_node', folderToken)
    form.append('size', String(fileBuffer.length))
    form.append('file', fileBuffer, { filename: fileName })

    const response = await axios.post<{
      code: number
      data: { file_token: string }
    }>(`${LARK_BASE}/drive/v1/files/upload_all`, form, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...form.getHeaders(),
      },
    })

    if (response.data.code !== 0) {
      throw new Error(`Lark file upload failed: code ${response.data.code}`)
    }

    return response.data.data.file_token
  } catch (error) {
    const axiosError = error as AxiosError
    logger.error('Lark uploadFile error', { error: axiosError.message })
    throw new Error(`Failed to upload file to Lark: ${axiosError.message}`)
  }
}

const CHANNEL_ENV_MAP: Record<LarkChannel, string> = {
  CREATIVE: 'LARK_CHANNEL_CREATIVE',
  CS: 'LARK_CHANNEL_CS',
  SALES: 'LARK_CHANNEL_SALES',
  MANAGEMENT: 'LARK_CHANNEL_MANAGEMENT',
}

/**
 * Keywords that must NEVER be sent to Lark.
 * Per business rule: no invoice, quotation, or pricing data in group chats.
 */
const LARK_BLOCKED_KEYWORDS = [
  'invoice',
  'quotation',
  'quote',
  'pricing',
  'price',
  'billing',
  'payment',
  'balance invoice',
  'rm ',   // Ringgit amounts e.g. "RM 5,000"
  'rm\u00a0', // non-breaking space variant
]

function containsBlockedContent(event: LarkEvent): boolean {
  const combined = [
    event.title,
    event.body,
    event.actionLabel ?? '',
    event.actionUrl ?? '',
  ]
    .join(' ')
    .toLowerCase()

  return LARK_BLOCKED_KEYWORDS.some(kw => combined.includes(kw))
}

export async function notify(channel: LarkChannel, event: LarkEvent): Promise<void> {
  // Business rule: never send invoice / quotation / pricing content to Lark
  if (containsBlockedContent(event)) {
    logger.warn(`[Lark notify] Blocked message containing sensitive content: "${event.title}"`)
    return
  }

  const token = await getToken()
  const webhookOrChatId = process.env[CHANNEL_ENV_MAP[channel]]

  if (!webhookOrChatId) {
    logger.warn(`Lark channel not configured: ${channel}`)
    return
  }

  const actionElements =
    event.actionLabel && event.actionUrl
      ? [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: event.actionLabel },
            type: 'primary',
            url: event.actionUrl,
          },
        ]
      : []

  const cardContent = {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: event.title },
      template: 'blue',
    },
    elements: [
      {
        tag: 'div',
        text: { tag: 'lark_md', content: event.body },
      },
      ...(event.projectCode
        ? [
            {
              tag: 'div',
              fields: [
                {
                  is_short: true,
                  text: {
                    tag: 'lark_md',
                    content: `**Project:** ${event.projectCode}`,
                  },
                },
              ],
            },
          ]
        : []),
      ...(actionElements.length > 0
        ? [
            {
              tag: 'action',
              actions: actionElements,
            },
          ]
        : []),
    ],
  }

  try {
    await axios.post(
      `${LARK_BASE}/im/v1/messages?receive_id_type=chat_id`,
      {
        receive_id: webhookOrChatId,
        msg_type: 'interactive',
        content: JSON.stringify(cardContent),
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error) {
    const axiosError = error as AxiosError
    logger.error(`Lark notify error (${channel})`, { error: axiosError.message })
    // Non-fatal: log but don't throw to avoid blocking the main workflow
  }
}

// ─── Staff / Contact API ──────────────────────────────────────────────────────

export interface LarkDepartment {
  openDepartmentId: string
  name: string
  parentOpenDepartmentId?: string
}

export interface LarkStaffMember {
  openId: string
  name: string
  email?: string
  jobTitle?: string
  employeeNo?: string
  departmentIds: string[]
  /** Department display name — resolved after getDepartments() call */
  departmentName?: string
  avatar?: string
  isActive: boolean
}

/**
 * Fetch all departments in the workspace.
 * Requires: contact:department.base:readonly  (or contact:contact:readonly)
 */
export async function getDepartments(): Promise<LarkDepartment[]> {
  const token = await getToken()
  const depts: LarkDepartment[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({
      department_id_type: 'open_department_id',
      fetch_child: 'true',
      page_size: '50',
    })
    if (pageToken) params.set('page_token', pageToken)

    const res = await axios.get<{
      code: number
      data: {
        items?: Array<{
          open_department_id: string
          name: string
          parent_department_id?: string
        }>
        page_token?: string
        has_more?: boolean
      }
    }>(`${LARK_BASE}/contact/v3/departments?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (res.data.code !== 0) break // permission not granted yet — return empty

    for (const d of res.data.data.items ?? []) {
      depts.push({
        openDepartmentId: d.open_department_id,
        name: d.name,
        parentOpenDepartmentId: d.parent_department_id,
      })
    }

    pageToken = res.data.data.has_more ? res.data.data.page_token : undefined
  } while (pageToken)

  return depts
}

type LarkUserItem = {
  open_id: string
  name: string
  email?: string
  job_title?: string
  employee_no?: string
  department_ids?: string[]
  avatar?: { avatar_240?: string }
  status?: { is_active?: boolean; is_resigned?: boolean }
}

/**
 * Fetch members of a single Lark group chat by chat_id.
 * Requires: im:chat:members:readonly (usually granted alongside im:chat:readonly).
 * Only returns human members (skips bot/app members whose member_id starts with 'cli_').
 */
async function fetchChatMembers(chatId: string, token: string): Promise<LarkUserItem[]> {
  const items: LarkUserItem[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({ member_id_type: 'open_id', page_size: '100' })
    if (pageToken) params.set('page_token', pageToken)

    const res = await axios.get<{
      code: number
      data: {
        items?: Array<{ member_id_type: string; member_id: string; name: string }>
        page_token?: string
        has_more?: boolean
      }
    }>(`${LARK_BASE}/im/v1/chats/${chatId}/members?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (res.data.code !== 0) break

    for (const m of res.data.data.items ?? []) {
      // Skip bots / apps (open_id starts with 'cli_') and non-open_id types
      if (m.member_id_type !== 'open_id') continue
      if (m.member_id.startsWith('cli_')) continue
      items.push({ open_id: m.member_id, name: m.name })
    }

    pageToken = res.data.data.has_more ? res.data.data.page_token : undefined
  } while (pageToken)

  return items
}

/**
 * Fetch all users for a single department_id, handling pagination.
 * Root department (sentinel '__root__') uses numeric department_id=0.
 */
async function fetchUsersForDept(
  deptId: string,
  token: string
): Promise<LarkUserItem[]> {
  const ROOT_SENTINEL = '__root__'
  const items: LarkUserItem[] = []
  let pageToken: string | undefined

  const isRoot = deptId === ROOT_SENTINEL
  do {
    const params = new URLSearchParams({
      user_id_type: 'open_id',
      department_id_type: isRoot ? 'department_id' : 'open_department_id',
      department_id: isRoot ? '0' : deptId,
      page_size: '50',
    })
    if (pageToken) params.set('page_token', pageToken)

    const res = await axios.get<{
      code: number
      msg?: string
      data: {
        items?: LarkUserItem[]
        page_token?: string
        has_more?: boolean
      }
    }>(`${LARK_BASE}/contact/v3/users?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (res.data.code !== 0) break   // no permission for this dept — skip silently

    items.push(...(res.data.data.items ?? []))
    pageToken = res.data.data.has_more ? res.data.data.page_token : undefined
  } while (pageToken)

  return items
}

/**
 * Fetch a single user by open_id.
 * Used when /contact/v3/scopes returns individual authed_users (user-level grants).
 */
async function fetchUserById(
  openId: string,
  token: string
): Promise<LarkUserItem | null> {
  try {
    const res = await axios.get<{
      code: number
      data?: { user?: LarkUserItem }
    }>(`${LARK_BASE}/contact/v3/users/${openId}?user_id_type=open_id`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.data.code !== 0 || !res.data.data?.user) return null
    return res.data.data.user
  } catch {
    return null
  }
}

/**
 * Fetch all active staff members visible to this app.
 *
 * Strategy (in order):
 *  1. Call /contact/v3/scopes to discover what the app is authorised to see.
 *     - authed_departments → fetch users dept-by-dept (handles restricted scope)
 *     - authed_users       → fetch individual users (handles user-level grants)
 *  2. If scopes returned nothing, fall back to iterating getDepartments() result.
 *  3. Last-resort: try the root department (dept_id=0).
 *
 * Requires: contact:user.base:readonly  (and contact:department.base:readonly for dept names)
 */
export async function getStaff(): Promise<LarkStaffMember[]> {
  const token = await getToken()

  // ── Build dept name map (best-effort — empty is fine) ─────────────────────
  const depts = await getDepartments()
  const deptMap = new Map(depts.map(d => [d.openDepartmentId, d.name]))

  // ── Helper: convert raw Lark user → LarkStaffMember ───────────────────────
  function mapUser(u: LarkUserItem): LarkStaffMember {
    const userDeptIds = u.department_ids ?? []
    return {
      openId: u.open_id,
      name: u.name,
      email: u.email,
      jobTitle: u.job_title,
      employeeNo: u.employee_no,
      departmentIds: userDeptIds,
      departmentName: userDeptIds.length > 0
        ? (deptMap.get(userDeptIds[0]) ?? undefined)
        : undefined,
      avatar: u.avatar?.avatar_240,
      isActive: true,
    }
  }

  const seen = new Set<string>()
  const staff: LarkStaffMember[] = []

  function addUser(u: LarkUserItem): void {
    if (seen.has(u.open_id)) return
    if (u.status?.is_resigned === true) return
    if (u.status?.is_active === false) return
    seen.add(u.open_id)
    staff.push(mapUser(u))
  }

  // ── Step 1: use /contact/v3/scopes to find authorised depts + users ────────
  let authedDepts: string[] = []
  let authedUsers: string[] = []

  try {
    const scopeRes = await axios.get<{
      code: number
      data?: {
        authed_departments?: string[]
        authed_users?: string[]
        has_more?: boolean
      }
    }>(`${LARK_BASE}/contact/v3/scopes?user_id_type=open_id&department_id_type=open_department_id`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (scopeRes.data.code === 0) {
      authedDepts = scopeRes.data.data?.authed_departments ?? []
      authedUsers = scopeRes.data.data?.authed_users ?? []
    }
  } catch {
    // scopes call failed — will fall through to fallbacks below
  }

  // Fetch users from each authorised department
  for (const deptId of authedDepts) {
    try {
      const items = await fetchUsersForDept(deptId, token)
      items.forEach(addUser)
    } catch {
      // skip inaccessible dept
    }
  }

  // Fetch individually-authorised users (user-level scope grants)
  for (const openId of authedUsers) {
    if (seen.has(openId)) continue
    const u = await fetchUserById(openId, token)
    if (u) addUser(u)
  }

  // ── Step 2: fallback — iterate departments from getDepartments() ───────────
  if (staff.length === 0 && depts.length > 0) {
    for (const dept of depts) {
      try {
        const items = await fetchUsersForDept(dept.openDepartmentId, token)
        items.forEach(addUser)
      } catch {
        // skip
      }
    }
  }

  // ── Step 3: last resort — try root department (dept_id=0) ──────────────────
  if (staff.length === 0) {
    try {
      const items = await fetchUsersForDept('__root__', token)
      items.forEach(addUser)
    } catch {
      // root also inaccessible
    }
  }

  // ── Step 4: final fallback — scrape members from all group chats the bot is in
  // This works with im:chat:members:readonly even when contact scopes are missing.
  // Members discovered this way will have openId + name but no email or job title.
  if (staff.length === 0) {
    try {
      const chats = await getLarkGroupChats()
      for (const chat of chats) {
        try {
          const members = await fetchChatMembers(chat.chatId, token)
          members.forEach(addUser)
        } catch {
          // skip chats we can't read members from
        }
      }
    } catch {
      // group chat listing also inaccessible
    }
  }

  if (staff.length === 0) {
    throw new Error(
      'No staff returned from Lark. Check that the app has contact:user.base:readonly scope ' +
      'and that the app availability covers all members in the Lark Developer Console ' +
      '(Version Management & Release → App Availability → All members).'
    )
  }

  return staff
}

// ─── Gantt Chart Card ─────────────────────────────────────────────────────────

export interface GanttRow {
  description: string
  itemType: string
  status: string
  deadline: Date | null
  estimatedMinutes: number | null
  assignedDesigner: string | null
}

const STATUS_EMOJI: Record<string, string> = {
  PENDING: '⏳',
  IN_PROGRESS: '🔵',
  WIP_UPLOADED: '🟣',
  QC_REVIEW: '🟡',
  APPROVED: '✅',
  DELIVERED: '✅',
  FA_SIGNED: '🏁',
}

const ITEM_LABELS: Record<string, string> = {
  BANNER: 'Banner',
  BROCHURE: 'Brochure',
  LOGO: 'Logo',
  SOCIAL: 'Social',
  PRINT: 'Print',
  THREE_D: '3D',
  VIDEO: 'Video',
  OTHER: 'Other',
}

/**
 * Send a rich Gantt-style project timeline card to the CREATIVE Lark channel.
 * This replaces the SVG/image Gantt with a structured Lark card table — no image
 * server required. Each deliverable is a row with status, deadline, assignee.
 */
export async function sendGanttCard(
  projectCode: string,
  clientName: string,
  deadline: Date | null,
  rows: GanttRow[],
  mode: 'AUTOPILOT' | 'COPILOT'
): Promise<void> {
  const token = await getToken()
  const chatId = process.env.LARK_CHANNEL_CREATIVE ?? process.env.LARK_CHANNEL_CS

  if (!chatId) {
    logger.warn('[Lark] No LARK_CHANNEL_CREATIVE configured — skipping Gantt card')
    return
  }

  const deadlineStr = deadline
    ? deadline.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'TBD'

  const modeLabel = mode === 'AUTOPILOT' ? '🤖 Autopilot' : '🧑‍💼 Copilot'
  const projectUrl = `${process.env.NEXTAUTH_URL ?? ''}/cs/projects`

  // Build table rows as markdown text blocks
  const tableHeader = `| # | Type | Deliverable | Assignee | Deadline | Status |`
  const tableSep = `|---|---|---|---|---|---|`
  const tableRows = rows
    .map((row, i) => {
      const emoji = STATUS_EMOJI[row.status] ?? '⏳'
      const dl = row.deadline
        ? row.deadline.toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })
        : 'TBD'
      const designer = row.assignedDesigner ?? '_Unassigned_'
      const type = ITEM_LABELS[row.itemType] ?? row.itemType
      const desc = (row.description ?? type).slice(0, 35)
      return `| ${i + 1} | ${type} | ${desc} | ${designer} | ${dl} | ${emoji} ${row.status.replace('_', ' ')} |`
    })
    .join('\n')

  const ganttMarkdown = `${tableHeader}\n${tableSep}\n${tableRows}`

  const cardContent = {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: `📋 Project Timeline: ${projectCode}` },
      template: 'indigo',
    },
    elements: [
      {
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**Client:** ${clientName}` },
          },
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**Project Deadline:** ${deadlineStr}` },
          },
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**Mode:** ${modeLabel}` },
          },
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**Deliverables:** ${rows.length} item(s)` },
          },
        ],
      },
      { tag: 'hr' },
      {
        tag: 'div',
        text: { tag: 'lark_md', content: ganttMarkdown },
      },
      { tag: 'hr' },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: 'View in EnvicionOS' },
            type: 'primary',
            url: projectUrl,
          },
        ],
      },
    ],
  }

  try {
    await axios.post(
      `${LARK_BASE}/im/v1/messages?receive_id_type=chat_id`,
      {
        receive_id: chatId,
        msg_type: 'interactive',
        content: JSON.stringify(cardContent),
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error) {
    const axiosError = error as AxiosError
    logger.error('[Lark] sendGanttCard error', { error: axiosError.message })
    // Non-fatal
  }
}

/**
 * In Copilot mode: send a review card to CS/Management asking them to
 * review and confirm a newly auto-created project.
 */
export async function sendCopilotReview(
  projectCode: string,
  projectId: string,
  clientName: string,
  source: 'quotation' | 'invoice',
  referenceNumber: string,
  deliverableCount: number
): Promise<void> {
  const token = await getToken()
  const chatId = process.env.LARK_CHANNEL_CS

  if (!chatId) {
    logger.warn('[Lark] No LARK_CHANNEL_CS configured — skipping copilot review card')
    return
  }

  const projectUrl = `${process.env.NEXTAUTH_URL ?? ''}/cs/projects/${projectId}`
  const sourceLabel = source === 'quotation' ? 'Quotation' : 'Invoice'

  const cardContent = {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: `🧑‍💼 Copilot: New Project Needs Review — ${projectCode}` },
      template: 'yellow',
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `A new project has been created from Bukku ${sourceLabel} **#${referenceNumber}** and is waiting for your review.\n\n**Action required:** Please review the project brief, confirm deliverables, and assign designers before marking as Ongoing.`,
        },
      },
      { tag: 'hr' },
      {
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**Client:** ${clientName}` },
          },
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**Source:** ${sourceLabel} #${referenceNumber}` },
          },
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**Deliverables:** ${deliverableCount} item(s)` },
          },
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**Status:** ⏸ PROJECTED (awaiting CS review)` },
          },
        ],
      },
      { tag: 'hr' },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '📋 Review Project Brief' },
            type: 'primary',
            url: projectUrl,
          },
        ],
      },
    ],
  }

  try {
    await axios.post(
      `${LARK_BASE}/im/v1/messages?receive_id_type=chat_id`,
      {
        receive_id: chatId,
        msg_type: 'interactive',
        content: JSON.stringify(cardContent),
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error) {
    const axiosError = error as AxiosError
    logger.error('[Lark] sendCopilotReview error', { error: axiosError.message })
    // Non-fatal
  }
}

// ─── Drive / Project Folder Listing ──────────────────────────────────────────

export interface LarkProjectFolder {
  /** Lark Drive folder token — use as larkFolderId in DB */
  token: string
  /** Folder name — expected to match project code e.g. "PRJ-0001" */
  name: string
  createdAt?: number
  modifiedAt?: number
}

/**
 * List all child folders inside a given Lark Drive folder.
 * Uses drive/v1/files with page_size=200 and auto-paginates.
 * Requires: drive:drive:readonly scope on the Lark app.
 */
export async function listFolderChildren(folderToken: string): Promise<LarkProjectFolder[]> {
  const token = await getToken()
  const results: LarkProjectFolder[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({
      folder_token: folderToken,
      page_size: '200',
      order_by: 'EditedTime',
      direction: 'DESC',
    })
    if (pageToken) params.set('page_token', pageToken)

    const res = await axios.get<{
      code: number
      msg?: string
      data: {
        files?: Array<{
          token: string
          name: string
          type: string
          created_time?: string
          modified_time?: string
        }>
        next_page_token?: string
        has_more?: boolean
      }
    }>(`${LARK_BASE}/drive/v1/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (res.data.code !== 0) {
      throw new Error(
        `Lark Drive listFolderChildren failed: code ${res.data.code} — ${res.data.msg ?? 'unknown error'}. ` +
        `Ensure the Lark app has drive:drive:readonly scope and access to folder ${folderToken}.`
      )
    }

    for (const file of res.data.data.files ?? []) {
      if (file.type === 'folder') {
        results.push({
          token: file.token,
          name: file.name,
          createdAt: file.created_time ? parseInt(file.created_time) : undefined,
          modifiedAt: file.modified_time ? parseInt(file.modified_time) : undefined,
        })
      }
    }

    pageToken = res.data.data.has_more ? res.data.data.next_page_token : undefined
  } while (pageToken)

  return results
}

/**
 * Fetch all project folders from the Lark root folder (LARK_ROOT_FOLDER_TOKEN).
 * Returns folders whose names match the PRJ-XXXX pattern.
 */
export async function getLarkProjectFolders(): Promise<LarkProjectFolder[]> {
  const rootToken = process.env.LARK_ROOT_FOLDER_TOKEN
  if (!rootToken) {
    throw new Error('LARK_ROOT_FOLDER_TOKEN is not set in environment variables.')
  }

  const all = await listFolderChildren(rootToken)

  // Filter to folders that look like project codes (PRJ-NNNN or any alphanumeric code)
  return all.filter(f => /^[A-Z]{2,5}-\d{3,6}$/i.test(f.name.trim()))
}

// ─── Group Chat Listing ───────────────────────────────────────────────────────

export interface LarkGroupChat {
  chatId: string
  name: string
  memberCount?: number
  description?: string
}

/** Fixed internal group name keywords — add here to permanently exclude a group pattern */
const INTERNAL_GROUP_KEYWORDS = [
  'envicion crm',
  'tasks assistant',
  'envicion studio',
  'envicion marketing',
  'all staff',
  'leads report',
  'confirmed job',
  'pitching job',
  'approval',
  'upgrade',
  'bot test',
  'system',
]

/** Matches "january 2024", "april 2025", "dec 2026", etc. */
const MONTH_YEAR_RE = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+20\d{2}\b/i

function isInternalGroup(name: string): boolean {
  const lower = name.toLowerCase()
  if (INTERNAL_GROUP_KEYWORDS.some(kw => lower.includes(kw))) return true
  if (MONTH_YEAR_RE.test(lower)) return true
  return false
}

/**
 * Fetch the detail of a single Lark group chat, including create_time.
 * Returns null if the request fails (e.g. bot not a member).
 */
export async function getLarkGroupChatDetail(chatId: string): Promise<{
  chatId: string
  name: string
  createTime: Date
} | null> {
  try {
    const token = await getToken()
    const res = await axios.get<{
      code: number
      data?: {
        chat_id: string
        name: string
        create_time?: string  // Unix timestamp as string
      }
    }>(`${LARK_BASE}/im/v1/chats/${chatId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.data.code !== 0 || !res.data.data) return null
    const raw = res.data.data
    return {
      chatId: raw.chat_id,
      name: raw.name,
      createTime: raw.create_time
        ? new Date(Number(raw.create_time) * 1000)  // Lark returns seconds
        : new Date(0),
    }
  } catch {
    return null
  }
}

/**
 * List all group chats the bot is a member of.
 * Filters out known internal/system groups and 1-on-1 chats.
 * Requires: im:chat:readonly scope on the Lark app.
 */
export async function getLarkGroupChats(): Promise<LarkGroupChat[]> {
  const token = await getToken()
  const results: LarkGroupChat[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({ page_size: '100' })
    if (pageToken) params.set('page_token', pageToken)

    const res = await axios.get<{
      code: number
      msg?: string
      data: {
        items?: Array<{
          chat_id: string
          name: string
          member_count?: number
          description?: string
          chat_type?: string
        }>
        page_token?: string
        has_more?: boolean
      }
    }>(`${LARK_BASE}/im/v1/chats?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (res.data.code !== 0) {
      throw new Error(
        `Lark getLarkGroupChats failed: code ${res.data.code} — ${res.data.msg ?? 'unknown error'}`
      )
    }

    for (const item of res.data.data.items ?? []) {
      // Skip 1-on-1 chats and internal groups
      if (item.chat_type === 'p2p') continue
      if (!item.name || isInternalGroup(item.name)) continue
      results.push({
        chatId: item.chat_id,
        name: item.name,
        memberCount: item.member_count,
        description: item.description,
      })
    }

    pageToken = res.data.data.has_more ? res.data.data.page_token : undefined
  } while (pageToken)

  return results
}

/**
 * Create a Lark group chat for a project and return its chat_id.
 * Adds the provided member open_ids plus the bot itself.
 * Requires: im:chat scope.
 */
export async function createProjectChat(
  projectCode: string,
  clientName: string,
  memberOpenIds: string[] = []
): Promise<string | null> {
  try {
    const token = await getToken()
    const appId = process.env.LARK_APP_ID

    // Deduplicate and filter out any empty strings
    const members = [...new Set(memberOpenIds.filter(Boolean))]

    const res = await axios.post<{
      code: number
      msg?: string
      data?: { chat_id: string }
    }>(
      `${LARK_BASE}/im/v1/chats`,
      {
        name: `${projectCode} — ${clientName}`,
        description: `Project workspace for ${projectCode}`,
        owner_id: appId,
        owner_id_type: 'app_id',
        user_id_list: members,
        user_id_type: 'open_id',
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (res.data.code !== 0 || !res.data.data?.chat_id) {
      logger.error(`[Lark] createProjectChat failed: code ${res.data.code} — ${res.data.msg}`)
      return null
    }

    return res.data.data.chat_id
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('[Lark] createProjectChat error', { error: msg })
    return null
  }
}

export function verifyWebhookSignature(headers: Headers, body: string): boolean {
  const verifyToken = process.env.LARK_VERIFY_TOKEN
  const encryptKey = process.env.LARK_ENCRYPT_KEY

  if (!verifyToken || !encryptKey) {
    logger.warn('Lark webhook verification keys not configured')
    return false
  }

  const timestamp = headers.get('x-lark-request-timestamp')
  const nonce = headers.get('x-lark-request-nonce')
  const signature = headers.get('x-lark-signature')

  if (!timestamp || !nonce || !signature) {
    return false
  }

  const toSign = `${timestamp}${nonce}${encryptKey}${body}`
  const computed = createHmac('sha256', encryptKey).update(toSign).digest('hex')

  return computed === signature
}
