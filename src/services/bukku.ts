import axios, { AxiosError } from 'axios'
import { ItemType } from '@prisma/client'
import { logger, getErrorMessage } from '@/lib/logger'

const BUKKU_BASE = 'https://api.bukku.my'

export interface BukkuLineItem {
  description: string
  quantity: number
  unit_price: number
  amount: number
  item_code?: string
}

export interface BukkuInvoice {
  id: string
  number: string
  contact_id: string
  contact_name: string
  date: string
  due_date: string
  status: string
  total_amount: number
  line_items: BukkuLineItem[]
  created_at: string
  updated_at: string
}

export interface BukkuQuotation {
  id: string
  number: string
  contact_id: string
  contact_name: string
  date: string
  expiry_date: string
  status: string
  total_amount: number
  line_items: BukkuLineItem[]
}

export interface BukkuContact {
  id: string
  name: string
  email: string
  phone?: string
  company_name?: string
}

export interface BukkuPayment {
  id: string
  invoice_id: string
  invoice_number?: string
  contact_id?: string
  contact_name?: string
  amount: number
  payment_date: string
  payment_method: string
  reference?: string
  status?: string
  created_at?: string
  updated_at?: string
}

export interface CreateContactData {
  name: string
  email: string
  phone?: string
  company_name?: string
}

export interface CreateInvoiceData {
  contact_id: string
  date: string
  due_date: string
  line_items: Array<{
    description: string
    quantity: number
    unit_price: number
  }>
  notes?: string
}

export interface ParsedLineItem {
  description: string
  quantity: number
  unitPrice: number
  itemType: ItemType
}

const ITEM_TYPE_KEYWORDS: Record<string, ItemType> = {
  banner: ItemType.BANNER,
  banners: ItemType.BANNER,
  brochure: ItemType.BROCHURE,
  brochures: ItemType.BROCHURE,
  flyer: ItemType.BROCHURE,
  logo: ItemType.LOGO,
  branding: ItemType.LOGO,
  social: ItemType.SOCIAL,
  'social media': ItemType.SOCIAL,
  instagram: ItemType.SOCIAL,
  facebook: ItemType.SOCIAL,
  print: ItemType.PRINT,
  printing: ItemType.PRINT,
  '3d': ItemType.THREE_D,
  '3d render': ItemType.THREE_D,
  rendering: ItemType.THREE_D,
  video: ItemType.VIDEO,
  animation: ItemType.VIDEO,
  motion: ItemType.VIDEO,
}

async function getHeaders(): Promise<Record<string, string>> {
  const token = process.env.BUKKU_ACCESS_TOKEN
  const subdomain = process.env.BUKKU_SUBDOMAIN

  if (!token || !subdomain) {
    throw new Error('Bukku credentials not configured. Set BUKKU_ACCESS_TOKEN and BUKKU_SUBDOMAIN.')
  }

  return {
    Authorization: `Bearer ${token}`,
    'Company-Subdomain': subdomain,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

/**
 * List all Bukku contacts (paginated, returns up to 500).
 * Used by the reconcile endpoint to match local Clients to Bukku by company name.
 */
export async function listContacts(search?: string): Promise<BukkuContact[]> {
  try {
    const headers = await getHeaders()
    const contacts: BukkuContact[] = []
    let page = 1

    for (;;) {
      const params: Record<string, string | number> = { per_page: 100, page }
      if (search) params.search = search

      const res = await axios.get<{ data?: BukkuContact[]; meta?: { last_page?: number } }>(
        `${BUKKU_BASE}/contacts`,
        { headers, params }
      )
      const items = res.data.data ?? []
      contacts.push(...items)
      if (page >= (res.data.meta?.last_page ?? 1)) break
      page++
    }

    return contacts
  } catch (error) {
    const axiosError = error as AxiosError
    throw new Error(`Failed to list Bukku contacts: ${axiosError.message}`)
  }
}

export async function pollNewInvoices(since: Date): Promise<BukkuInvoice[]> {
  try {
    const headers = await getHeaders()
    const sinceIso = since.toISOString().split('T')[0]

    const response = await axios.get<{ data: BukkuInvoice[] }>(`${BUKKU_BASE}/invoices`, {
      headers,
      params: {
        updated_after: sinceIso,
        per_page: 100,
      },
    })

    return response.data.data ?? []
  } catch (error) {
    const axiosError = error as AxiosError
    logger.error('Bukku pollNewInvoices error', { error: axiosError.message })
    throw new Error(`Failed to poll Bukku invoices: ${axiosError.message}`)
  }
}

export async function getQuotation(id: string): Promise<BukkuQuotation> {
  try {
    const headers = await getHeaders()
    const response = await axios.get<{ data: BukkuQuotation }>(`${BUKKU_BASE}/quotations/${id}`, {
      headers,
    })
    return response.data.data
  } catch (error) {
    const axiosError = error as AxiosError
    logger.error('Bukku getQuotation error', { error: axiosError.message })
    throw new Error(`Failed to get Bukku quotation ${id}: ${axiosError.message}`)
  }
}

export async function createContact(data: CreateContactData): Promise<BukkuContact> {
  try {
    const headers = await getHeaders()
    const response = await axios.post<{ data: BukkuContact }>(`${BUKKU_BASE}/contacts`, data, {
      headers,
    })
    return response.data.data
  } catch (error) {
    const axiosError = error as AxiosError
    logger.error('Bukku createContact error', { error: axiosError.message })
    throw new Error(`Failed to create Bukku contact: ${axiosError.message}`)
  }
}

export async function createInvoice(data: CreateInvoiceData): Promise<BukkuInvoice> {
  try {
    const headers = await getHeaders()
    const response = await axios.post<{ data: BukkuInvoice }>(`${BUKKU_BASE}/invoices`, data, {
      headers,
    })
    return response.data.data
  } catch (error) {
    const axiosError = error as AxiosError
    logger.error('Bukku createInvoice error', { error: axiosError.message })
    throw new Error(`Failed to create Bukku invoice: ${axiosError.message}`)
  }
}

export async function getInvoice(id: string): Promise<BukkuInvoice> {
  try {
    const headers = await getHeaders()
    const response = await axios.get<{ data: BukkuInvoice }>(`${BUKKU_BASE}/invoices/${id}`, {
      headers,
    })
    return response.data.data
  } catch (error) {
    const axiosError = error as AxiosError
    throw new Error(`Failed to get Bukku invoice ${id}: ${axiosError.message}`)
  }
}

export interface BukkuListParams {
  page?: number
  per_page?: number
  status?: string
  updated_after?: string
}

export interface BukkuListMeta {
  total: number
  page: number
  per_page: number
  last_page: number
}

export interface BukkuListResponse<T> {
  data: T[]
  meta: BukkuListMeta
}

export async function listInvoices(params: BukkuListParams = {}): Promise<BukkuListResponse<BukkuInvoice>> {
  try {
    const headers = await getHeaders()
    const response = await axios.get<BukkuListResponse<BukkuInvoice>>(`${BUKKU_BASE}/invoices`, {
      headers,
      params: {
        per_page: 50,
        ...params,
      },
    })
    return {
      data: response.data.data ?? [],
      meta: response.data.meta ?? { total: 0, page: 1, per_page: 50, last_page: 1 },
    }
  } catch (error) {
    const axiosError = error as AxiosError
    throw new Error(`Failed to list Bukku invoices: ${axiosError.message}`)
  }
}

export async function pollQuotations(since: Date): Promise<BukkuQuotation[]> {
  try {
    const headers = await getHeaders()
    const sinceIso = since.toISOString().split('T')[0]

    const response = await axios.get<{ data: BukkuQuotation[] }>(`${BUKKU_BASE}/quotations`, {
      headers,
      params: {
        updated_after: sinceIso,
        per_page: 100,
      },
    })

    return response.data.data ?? []
  } catch (error) {
    const axiosError = error as AxiosError
    throw new Error(`Failed to poll Bukku quotations: ${axiosError.message}`)
  }
}

export async function listQuotations(params: BukkuListParams = {}): Promise<BukkuListResponse<BukkuQuotation>> {
  try {
    const headers = await getHeaders()
    const response = await axios.get<BukkuListResponse<BukkuQuotation>>(`${BUKKU_BASE}/quotations`, {
      headers,
      params: {
        per_page: 50,
        ...params,
      },
    })
    return {
      data: response.data.data ?? [],
      meta: response.data.meta ?? { total: 0, page: 1, per_page: 50, last_page: 1 },
    }
  } catch (error) {
    const axiosError = error as AxiosError
    throw new Error(`Failed to list Bukku quotations: ${axiosError.message}`)
  }
}

export async function pollPayments(since: Date): Promise<BukkuPayment[]> {
  try {
    const headers = await getHeaders()
    const sinceIso = since.toISOString().split('T')[0]

    const response = await axios.get<{ data: BukkuPayment[] }>(`${BUKKU_BASE}/payments`, {
      headers,
      params: {
        updated_after: sinceIso,
        per_page: 100,
      },
    })

    return response.data.data ?? []
  } catch (error) {
    const axiosError = error as AxiosError
    logger.error('Bukku pollPayments error', { error: axiosError.message })
    throw new Error(`Failed to poll Bukku payments: ${axiosError.message}`)
  }
}

export async function listPayments(params: BukkuListParams = {}): Promise<BukkuListResponse<BukkuPayment>> {
  try {
    const headers = await getHeaders()
    const response = await axios.get<BukkuListResponse<BukkuPayment>>(`${BUKKU_BASE}/payments`, {
      headers,
      params: {
        per_page: 50,
        ...params,
      },
    })
    return {
      data: response.data.data ?? [],
      meta: response.data.meta ?? { total: 0, page: 1, per_page: 50, last_page: 1 },
    }
  } catch (error) {
    const axiosError = error as AxiosError
    throw new Error(`Failed to list Bukku payments: ${axiosError.message}`)
  }
}

export async function listAllPayments(): Promise<BukkuPayment[]> {
  const payments: BukkuPayment[] = []
  let page = 1

  for (;;) {
    const result = await listPayments({ page, per_page: 100 })
    payments.push(...result.data)
    if (page >= result.meta.last_page) break
    page++
  }

  return payments
}

export function parseLineItems(doc: BukkuInvoice | BukkuQuotation): ParsedLineItem[] {
  return doc.line_items.map((item) => {
    const descLower = item.description.toLowerCase()
    let detectedType: ItemType = ItemType.OTHER

    for (const [keyword, type] of Object.entries(ITEM_TYPE_KEYWORDS)) {
      if (descLower.includes(keyword)) {
        detectedType = type
        break
      }
    }

    return {
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      itemType: detectedType,
    }
  })
}
