'use client'

/** Public Supabase-backed data access boundary for all browser UI code. */

import type { Role } from '@/domain/auth/types'
import type {
  Contact,
  Event as EventRecord,
  EventOrganizer,
  Venue,
} from '@/domain/event/types'
import type { Exhibitor, ExhibitorContact, ExhibitorKind } from '@/domain/exhibitor/types'
import type {
  JobInvoiceExtraction,
  JobInvoiceItem,
  JobTransportExtraction,
} from '@/domain/exhibition/source-documents'
import type {
  Ticket,
  TicketActivity,
  TicketComment,
  TicketContext,
  TicketPriority,
  TicketStatus,
} from '@/domain/ticket/types'
import type { Agent, EventAgent } from '@/domain/agent/types'
import type {
  InternationalJobJenis,
  Job,
  JobCiplLineInput,
  JobDocumentKind,
  JobInvoice,
  JobKind,
  JobOperationalDetails,
  JobSummary,
  TransportMode,
} from '@/domain/job/types'
import { normalizeOperationalDetails } from '@/domain/job/operational'
import {
  exhibitorLogisticsSchema,
  type ExhibitorLogistics,
  type InwardManifest,
  type JobReturn,
} from '@/domain/job/manifest'
import type { CiplAutofillRow } from '@/domain/exhibition/cipl-autofill'
import type { CiplDocument } from '@/domain/exhibition/cipl-document'

export type {
  Ticket,
  TicketActivity,
  TicketComment,
  TicketContext,
  TicketPriority,
  TicketStatus,
} from '@/domain/ticket/types'
export type { Agent, EventAgent } from '@/domain/agent/types'
export type { Exhibitor, ExhibitorContact, ExhibitorKind } from '@/domain/exhibitor/types'
export type {
  BcDocumentKind,
  InternationalJobJenis,
  InvoiceStatus,
  Job,
  JobCiplLine,
  JobCiplLineInput,
  JobCustomsDocument,
  JobDocumentKind,
  JobInvoice,
  JobKind,
  JobOperationalDetails,
  JobParty,
  JobStatus,
  JobSummary,
  JobTransportLeg,
  TransportDocumentType,
  TransportMode,
} from '@/domain/job/types'
export type {
  ContainerSize,
  ExhibitorLogistics,
  InwardManifest,
  JobReturn,
  Koli,
  KoliCollection,
  KoliSummary,
  LoadConfiguration,
  Milestone,
  MilestoneKind,
  OperationalNote,
  OperationalNoteKind,
  ReturnMode,
  ShippingContainer,
} from '@/domain/job/manifest'

export type LocalUser = {
  id: string
  name: string
  email: string
  jobRole: Role
  accessLevel: 'ADMIN' | 'MEMBER'
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type JobDocumentMimeType =
  | 'application/pdf'
  | 'application/vnd.ms-excel'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  | 'application/vnd.ms-excel.sheet.macroenabled.12'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.template'
  | 'application/vnd.ms-excel.template.macroenabled.12'
  | 'application/vnd.ms-excel.sheet.binary.macroenabled.12'

type StoredFile = {
  id: string
  ownerType: 'JOB'
  ownerId: string
  kind: string | null
  fileName: string
  mimeType: JobDocumentMimeType
  fileSize: number
  content: Blob
  createdAt: string
}

/** Display adapter for legacy non-event pages; persistence uses `Venue`. */
export type LocalVenue = Venue & {
  officialName: string
  aliasName: string | null
  latitude: number | null
  longitude: number | null
  contactInfo: string | null
}
/** Display adapter for legacy non-event pages; persistence uses `EventOrganizer`. */
export type LocalEo = EventOrganizer & {
  legalName: string
  aliasName: string | null
  contactInfo: string | null
}
/** Display adapter; status stays cancellation-derived for historical rows (pembuatan cancel baru sudah dihapus). */
export type LocalEvent = Omit<EventRecord, 'venue' | 'eventOrganizer'> & {
  officialName: string
  alias: string | null
  startsAt: string
  endsAt: string
  status: 'ACTIVE' | 'CANCELLED'
  cancellationReason: string | null
  cancelledAt: string | null
  eoId: string
  picName: string | null
  venue?: LocalVenue
  eventOrganizer?: LocalEo
}

type StoreName =
  | 'users'
  | 'events'
  | 'venues'
  | 'eos'
  | 'agents'
  | 'files'
  | 'tickets'
  | 'preferences'

type StoredRecord = { id: string }

const collectionTable: Record<Exclude<StoreName, 'files'>, string> = {
  users: 'operational_users',
  events: 'events',
  venues: 'venues',
  eos: 'event_organizers',
  agents: 'agents',
  tickets: 'tickets',
  preferences: 'preferences',
}

async function records<T>(storeName: StoreName, init?: RequestInit, recordId?: string): Promise<T> {
  if (storeName === 'files') throw new Error('Gunakan repository lampiran.')
  const table = collectionTable[storeName]
  const params = new URLSearchParams({ table })
  if (recordId) params.set('id', recordId)
  const response = await fetch(`/api/operational-records?${params}`, {
    cache: 'no-store',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const data = (await response.json().catch(() => null)) as T | { error?: string } | null
  if (!response.ok)
    throw new Error(
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : 'Data Supabase tidak dapat diproses.',
    )
  return data as T
}

function readAll<T>(storeName: StoreName): Promise<T[]> {
  if (storeName === 'files') return Promise.resolve([])
  return records<T[]>(storeName)
}

function put<T extends StoredRecord>(storeName: StoreName, value: T): Promise<T> {
  if (storeName === 'files') return saveFile(value as unknown as StoredFile).then(() => value)
  return records<T>(storeName, { method: 'PUT', body: JSON.stringify(value) })
}

function now() {
  return new Date().toISOString()
}

function toDateOnly(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function localMidnight(dateOnly: string) {
  return `${dateOnly}T00:00:00`
}

function id() {
  return crypto.randomUUID()
}

/** Bentuk operational lengkap untuk tampilan (server sudah menyimpan bentuk utuh). */
export function getOperationalDetails(job: Pick<Job, 'operational'>): JobOperationalDetails {
  return normalizeOperationalDetails(job.operational)
}

async function saveFile(file: StoredFile) {
  const form = new FormData()
  form.set('id', file.id)
  form.set('ownerType', file.ownerType)
  form.set('ownerId', file.ownerId)
  if (file.kind) form.set('kind', file.kind)
  form.set(
    'file',
    file.content instanceof File
      ? file.content
      : new File([file.content], file.fileName, { type: file.mimeType }),
  )
  const response = await fetch('/api/attachments', { method: 'POST', body: form })
  const body = (await response.json().catch(() => null)) as { error?: string } | null
  if (!response.ok) throw new Error(body?.error ?? 'Lampiran tidak dapat diunggah.')
}

/**
 * Unduh inward manifest satu event (Excel, format dokumen klien). Mengembalikan isi file + nama
 * file dari server; pemanggil yang memicu unduhan di browser.
 */
export async function downloadEventManifest(eventId: string): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`/api/events/${encodeURIComponent(eventId)}/manifest-export`, {
    cache: 'no-store',
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? 'Manifest tidak dapat diekspor.')
  }
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const encoded = /filename\*=UTF-8''([^;]+)/.exec(disposition)?.[1]
  const filename = encoded ? decodeURIComponent(encoded) : 'INWARD-MANIFEST.xlsx'
  return { blob: await response.blob(), filename }
}

/**
 * Unduh daftar event (Excel) dengan filter yang sama dengan layar. `search` adalah query string
 * halaman events (`search`/`status`/`pic`); parameter lain diabaikan server.
 */
export async function downloadEventsExport(search: string): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`/api/events/export${search ? `?${search}` : ''}`, {
    cache: 'no-store',
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? 'Daftar event tidak dapat diekspor.')
  }
  const filename = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') ?? '')?.[1] ?? 'events.xlsx'
  return { blob: await response.blob(), filename }
}

/** Returns attachment bytes without leaking the active storage implementation to UI code. */
export async function getAttachmentContent(attachmentId: string): Promise<Blob | null> {
  const response = await fetch(`/api/attachments?id=${encodeURIComponent(attachmentId)}`, {
    cache: 'no-store',
  })
  return response.ok ? response.blob() : null
}

export type JobAttachmentMeta = {
  id: string
  kind: string | null
  fileName: string
  mimeType: string
  fileSize: number
  createdAt: string
}

/** Metadata lampiran milik satu job (terbaru dulu); isi file lewat `getAttachmentContent`. */
export async function listJobAttachments(jobId: string): Promise<JobAttachmentMeta[]> {
  const response = await fetch(
    `/api/attachments?ownerType=JOB&ownerId=${encodeURIComponent(jobId)}`,
    { cache: 'no-store' },
  )
  if (!response.ok) throw new Error('Lampiran tidak dapat dimuat.')
  return (await response.json()) as JobAttachmentMeta[]
}

async function ensureSeeded() {
  return readAll<LocalUser>('users')
}

export async function listUsers() {
  return ensureSeeded()
}

export type TicketInput = {
  title: string
  description?: string | null
  context: TicketContext
  priority?: TicketPriority
  assigneeId?: string | null
}

export type TicketDetail = {
  ticket: Ticket
  comments: TicketComment[]
  activities: TicketActivity[]
}

async function ticketRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    cache: 'no-store',
  })
  const body = (await response.json().catch(() => null)) as T | { error?: string } | null
  if (!response.ok)
    throw new Error(
      body && typeof body === 'object' && 'error' in body
        ? (body.error ?? 'Ticket tidak dapat diproses.')
        : 'Ticket tidak dapat diproses.',
    )
  return body as T
}

export async function listTickets(filters: {
  scope: 'mine' | 'unassigned' | 'all'
  contextKind?: 'EVENT' | 'JOB'
  contextId?: string
}): Promise<Ticket[]> {
  const params = new URLSearchParams({ scope: filters.scope })
  if (filters.contextKind && filters.contextId) {
    params.set('contextKind', filters.contextKind)
    params.set('contextId', filters.contextId)
  }
  return ticketRequest(`/api/tickets?${params}`)
}

export function getTicketDetail(ticketId: string): Promise<TicketDetail> {
  return ticketRequest(`/api/tickets/${encodeURIComponent(ticketId)}`)
}

export function createTicket(input: TicketInput): Promise<Ticket> {
  return ticketRequest('/api/tickets', { method: 'POST', body: JSON.stringify(input) })
}

export function updateTicketDetails(ticketId: string, input: TicketInput): Promise<Ticket> {
  return ticketRequest(`/api/tickets/${encodeURIComponent(ticketId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'EDIT', input }),
  })
}

export function assignTicket(ticketId: string, assigneeId: string | null): Promise<Ticket> {
  return ticketRequest(`/api/tickets/${encodeURIComponent(ticketId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'ASSIGN', input: { assigneeId } }),
  })
}

export function takeTicket(ticketId: string): Promise<Ticket> {
  return ticketRequest(`/api/tickets/${encodeURIComponent(ticketId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'TAKE' }),
  })
}

export function moveAndReorderTickets(
  ticketId: string,
  status: TicketStatus,
  orderedTicketIds?: string[],
  completionNote?: string,
  reopenReason?: string,
): Promise<Ticket> {
  return ticketRequest(`/api/tickets/${encodeURIComponent(ticketId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      action: 'MOVE',
      input: { status, orderedTicketIds, completionNote, reopenReason },
    }),
  })
}

export function addTicketComment(ticketId: string, body: string): Promise<TicketComment> {
  return ticketRequest(`/api/tickets/${encodeURIComponent(ticketId)}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  })
}

async function jobsRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    cache: 'no-store',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (response.status === 204) return undefined as T
  const data = (await response.json().catch(() => null)) as T | { error?: string } | null
  if (!response.ok) {
    throw new Error(
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : 'Data job tidak dapat diproses.',
    )
  }
  return data as T
}

function jobPath(jobId: string, suffix = '') {
  return `/api/jobs/${encodeURIComponent(jobId)}${suffix}`
}

export type JobListFilter = {
  eventId?: string
  status?: string
  search?: string
}

function jobListParams(filter: JobListFilter, view: 'full' | 'summary') {
  const params = new URLSearchParams({ view })
  if (filter.eventId) params.set('eventId', filter.eventId)
  if (filter.status) params.set('status', filter.status)
  if (filter.search?.trim()) params.set('search', filter.search.trim())
  return params
}

/** Job lengkap, disaring server. */
export function listJobs(filter: JobListFilter = {}): Promise<Job[]> {
  return jobsRequest<Job[]>(`/api/jobs?${jobListParams(filter, 'full')}`)
}

/** Bentuk ringkas untuk dropdown/label (tiket, dashboard). */
export function listJobSummaries(filter: JobListFilter = {}): Promise<JobSummary[]> {
  return jobsRequest<JobSummary[]>(`/api/jobs?${jobListParams(filter, 'summary')}`)
}

export function listEventJobs(eventId: string): Promise<Job[]> {
  return listJobs({ eventId })
}

/** Satu job; null bila tidak ditemukan. */
export async function getJob(jobId: string): Promise<Job | null> {
  const response = await fetch(jobPath(jobId), { cache: 'no-store' })
  if (response.status === 404) return null
  const data = (await response.json().catch(() => null)) as Job | { error?: string } | null
  if (!response.ok || !data) {
    throw new Error(
      data && 'error' in data && typeof data.error === 'string'
        ? data.error
        : 'Job tidak dapat dimuat.',
    )
  }
  return data as Job
}

type EventResource = 'venues' | 'event-organizers'

async function eventRecords<T>(
  resource: EventResource,
  init?: RequestInit,
  search?: URLSearchParams,
): Promise<T> {
  const response = await fetch(
    `/api/event-records?${new URLSearchParams({ resource, ...Object.fromEntries(search ?? []) })}`,
    {
      cache: 'no-store',
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    },
  )
  const data = (await response.json().catch(() => null)) as T | { error?: string } | null
  if (!response.ok)
    throw new Error(
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : 'Data event tidak dapat diproses.',
    )
  return data as T
}
async function eventsRequest<T>(path = '/api/events', init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    cache: 'no-store',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const data = (await response.json().catch(() => null)) as T | { error?: string } | null
  if (!response.ok) {
    throw new Error(
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : 'Data event tidak dapat diproses.',
    )
  }
  return data as T
}

function contactFromRow(value: Record<string, unknown>): Contact {
  return {
    name: typeof value.name === 'string' ? value.name : '',
    role: typeof value.role === 'string' ? value.role : null,
    email: typeof value.email === 'string' ? value.email : null,
    phone: typeof value.phone === 'string' ? value.phone : null,
    isPrimary: Boolean(value.isPrimary),
  }
}

function eventFromRow(row: Record<string, unknown>): LocalEvent {
  const venueRow = Array.isArray(row.venues) ? row.venues[0] : row.venues
  const organizerRow = Array.isArray(row.event_organizers)
    ? row.event_organizers[0]
    : row.event_organizers
  const cancellationRow = Array.isArray(row.event_cancellations)
    ? row.event_cancellations[0]
    : row.event_cancellations
  const picRow = Array.isArray(row.pic) ? row.pic[0] : row.pic
  const cancellation =
    cancellationRow && typeof cancellationRow === 'object'
      ? {
          eventId: String(row.id),
          reason: String((cancellationRow as Record<string, unknown>).reason),
          cancelledAt: String((cancellationRow as Record<string, unknown>).cancelled_at),
          cancelledById: String((cancellationRow as Record<string, unknown>).cancelled_by_id),
        }
      : null
  const venueSource = (venueRow ?? {}) as Record<string, unknown>
  const venue =
    venueRow && typeof venueRow === 'object'
      ? {
          id: String(row.venue_id),
          name: String(venueSource.legal_name ?? venueSource.name),
          officialName: String(venueSource.legal_name ?? venueSource.name),
          aliasName: (venueSource.alias_name as string | null) ?? null,
          contacts: [],
          address: null,
          website: null,
          loadingAccessNotes: null,
          latitude: null,
          longitude: null,
          contactInfo: null,
          createdAt: String(venueSource.created_at),
          updatedAt: String(venueSource.updated_at),
        }
      : undefined
  const organizerSource = (organizerRow ?? {}) as Record<string, unknown>
  const eventOrganizer =
    organizerRow && typeof organizerRow === 'object'
      ? {
          id: String(row.event_organizer_id),
          name: String(organizerSource.legal_name ?? organizerSource.name),
          legalName: String(organizerSource.legal_name ?? organizerSource.name),
          aliasName: null,
          contactInfo: null,
          npwp: null,
          contacts: [],
          address: null,
          website: null,
          createdAt: String(organizerSource.created_at),
          updatedAt: String(organizerSource.updated_at),
        }
      : undefined
  return {
    id: String(row.id),
    name: String(row.name),
    officialName: String(row.name),
    alias: null,
    venueId: String(row.venue_id),
    eventOrganizerId: String(row.event_organizer_id ?? ''),
    eoId: String(row.event_organizer_id ?? ''),
    startsOn: String(row.starts_on),
    endsOn: String(row.ends_on),
    startsAt: `${String(row.starts_on)}T00:00:00`,
    endsAt: `${String(row.ends_on)}T00:00:00`,
    createdAt: String(row.created_at),
    createdById: String(row.created_by_id),
    status: cancellation ? 'CANCELLED' : 'ACTIVE',
    cancellationReason: cancellation?.reason ?? null,
    cancelledAt: cancellation?.cancelledAt ?? null,
    cancellation,
    picId: row.pic_id ? String(row.pic_id) : null,
    picName:
      picRow && typeof picRow === 'object'
        ? String((picRow as Record<string, unknown>).full_name ?? '') || null
        : null,
    venue,
    eventOrganizer,
  }
}

function exhibitorFromRow(row: Record<string, unknown>): Exhibitor {
  const contact = (row.contact ?? {}) as Partial<ExhibitorContact>
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    kind: row.kind === 'LOCAL' ? 'LOCAL' : 'INTERNATIONAL',
    name: String(row.name),
    npwp: (row.npwp as string | null) ?? null,
    contact: {
      name: contact.name ?? null,
      role: contact.role ?? null,
      email: contact.email ?? null,
      phone: contact.phone ?? null,
    },
    hall: (row.hall as string | null) ?? null,
    booth: (row.booth as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export async function listEvents(): Promise<LocalEvent[]> {
  const rows = await eventsRequest<Array<Record<string, unknown>>>()
  return rows.map(eventFromRow)
}

export async function listEventsWithExhibitors() {
  const rows = await eventsRequest<Array<Record<string, unknown>>>()
  return {
    events: rows.map(eventFromRow),
    exhibitorsByEvent: Object.fromEntries(
      rows.map((row) => [
        String(row.id),
        Array.isArray(row.exhibitors)
          ? (row.exhibitors as Record<string, unknown>[]).map(exhibitorFromRow)
          : [],
      ]),
    ) as Record<string, Exhibitor[]>,
  }
}

export async function listVenues(): Promise<LocalVenue[]> {
  const rows = await eventRecords<Array<Record<string, unknown>>>('venues')
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    officialName: String(row.name),
    aliasName: null,
    contacts: Array.isArray(row.contacts)
      ? (row.contacts as Record<string, unknown>[]).map(contactFromRow)
      : [],
    address: (row.address as string | null) ?? null,
    website: (row.website as string | null) ?? null,
    loadingAccessNotes: (row.loading_access_notes as string | null) ?? null,
    latitude: null,
    longitude: null,
    contactInfo: null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }))
}

export async function listEos(): Promise<LocalEo[]> {
  const rows = await eventRecords<Array<Record<string, unknown>>>('event-organizers')
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    legalName: String(row.name),
    aliasName: null,
    contactInfo: null,
    npwp: (row.npwp as string | null) ?? null,
    contacts: Array.isArray(row.contacts)
      ? (row.contacts as Record<string, unknown>[]).map(contactFromRow)
      : [],
    address: (row.address as string | null) ?? null,
    website: (row.website as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }))
}

export type VenueInput = Pick<
  Venue,
  'name' | 'contacts' | 'address' | 'website' | 'loadingAccessNotes'
>
export type EoInput = Pick<EventOrganizer, 'name' | 'npwp' | 'contacts' | 'address' | 'website'>
export type EventInput = Pick<
  EventRecord,
  'name' | 'venueId' | 'eventOrganizerId' | 'startsOn' | 'endsOn'
> & {
  /** PIC wajib saat pembuatan; berhak menghapus event. */
  picId: string
}

export type AgentInput = {
  name: string
  contact: ExhibitorContact
  address: string | null
  countryCode: string | null
}

export async function listAgents(): Promise<Agent[]> {
  return (await readAll<Agent>('agents'))
    .filter((agent) => agent.status !== 'INACTIVE')
    .sort((left, right) => left.name.localeCompare(right.name))
}

export async function saveAgent(input: AgentInput, existingId?: string): Promise<Agent> {
  if (!input.name.trim()) throw new Error('Nama agent wajib diisi.')
  const existing = existingId
    ? ((await readAll<Agent>('agents')).find((agent) => agent.id === existingId) ?? null)
    : null
  const timestamp = now()
  return put('agents', {
    id: existing?.id ?? id(),
    name: input.name.trim(),
    contact: input.contact,
    address: input.address,
    countryCode: input.countryCode,
    status: existing?.status ?? 'ACTIVE',
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  })
}

export type EventAgentView = EventAgent & { agent: Agent }

export async function listEventAgents(eventId: string): Promise<EventAgentView[]> {
  return eventsRequest<EventAgentView[]>(`/api/events/${encodeURIComponent(eventId)}/agents`)
}

export async function addAgentToEvent(eventId: string, agentId: string): Promise<EventAgentView> {
  return eventsRequest<EventAgentView>(`/api/events/${encodeURIComponent(eventId)}/agents`, {
    method: 'POST',
    body: JSON.stringify({ agentId }),
  })
}

export type EventGrantee = { userId: string; fullName: string; grantedAt: string }
export type EventAccessView = {
  grantees: EventGrantee[]
  candidates: { id: string; fullName: string }[]
}

const eventAccessPath = (eventId: string) => `/api/events/${encodeURIComponent(eventId)}/access`

/** Penerima akses event + calon penerima. Hanya PIC/admin; selain itu 403. */
export function listEventAccess(eventId: string): Promise<EventAccessView> {
  return eventsRequest<EventAccessView>(eventAccessPath(eventId))
}

/** Beri `userId` akses kelola event (PIC/admin). */
export async function grantEventAccess(eventId: string, userId: string): Promise<void> {
  await eventsRequest<void>(eventAccessPath(eventId), {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })
}

/** Cabut akses kelola event dari `userId` (PIC/admin). */
export async function revokeEventAccess(eventId: string, userId: string): Promise<void> {
  await eventsRequest<void>(eventAccessPath(eventId), {
    method: 'DELETE',
    body: JSON.stringify({ userId }),
  })
}

/** Exhibitor satu event (pihak bisnis: nama, jenis, NPWP, kontak, hall, booth). */
export function listEventExhibitors(eventId: string): Promise<Exhibitor[]> {
  return eventsRequest<Exhibitor[]>(`/api/events/${encodeURIComponent(eventId)}/exhibitors`)
}

export type ExhibitorInput = {
  name: string
  kind: ExhibitorKind
  npwp?: string | null
  contact?: ExhibitorContact
  hall?: string | null
  booth?: string | null
}

/** Daftarkan exhibitor baru pada sebuah event; respons berurutan sama dengan masukan. */
export function createEventExhibitors(eventId: string, inputs: ExhibitorInput[]): Promise<Exhibitor[]> {
  return eventsRequest<Exhibitor[]>(`/api/events/${encodeURIComponent(eventId)}/exhibitors`, {
    method: 'POST',
    body: JSON.stringify(inputs),
  })
}

/** Ubah sebagian data exhibitor; hanya field yang dikirim yang ditulis. */
export function updateExhibitor(exhibitorId: string, patch: Partial<ExhibitorInput>): Promise<Exhibitor> {
  return eventsRequest<Exhibitor>(`/api/exhibitors/${encodeURIComponent(exhibitorId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

/** Simpan venue master data. */
export async function saveVenue(input: VenueInput) {
  return eventRecords<LocalVenue>('venues', { method: 'POST', body: JSON.stringify(input) })
}

export async function saveEo(input: EoInput) {
  return eventRecords<LocalEo>('event-organizers', { method: 'POST', body: JSON.stringify(input) })
}

export type SettingsUser = {
  id: string
  nama: string
  email: string
  role: Role
  isAdmin: boolean
  isActive?: boolean
}
export type SettingsVenue = {
  id: string
  legalName: string
  aliasName: string | null
  city: string | null
}
export type SettingsOrganizer = { id: string; legalName: string }
export type SettingsData = {
  users: SettingsUser[]
  venues: SettingsVenue[]
  organizers: SettingsOrganizer[]
}

async function settingsRequest<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<T> {
  const response = await fetch('/api/settings', {
    method,
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = (await response.json().catch(() => null)) as T | { error?: string } | null
  if (!response.ok)
    throw new Error(
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : 'Pengaturan tidak dapat diproses.',
    )
  return data as T
}

/** Reads administrator-managed users, venues, and event organizers. */
export function getSettingsData() {
  return settingsRequest<SettingsData>('GET')
}

export function createSettingsRecord<T>(
  resource: 'users' | 'venues' | 'organizers',
  input: unknown,
) {
  return settingsRequest<T>('POST', { resource, input })
}

export function updateSettingsRecord<T>(
  resource: 'users' | 'venues' | 'organizers',
  id: string,
  input: unknown,
) {
  return settingsRequest<T>('PATCH', { resource, id, input })
}

export function deleteSettingsRecord(resource: 'users' | 'venues' | 'organizers', id: string) {
  return settingsRequest<void>('DELETE', { resource, id })
}

export async function changePassword(input: { currentPassword: string; newPassword: string }) {
  const response = await fetch('/api/account/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await response.json().catch(() => null)) as { error?: string } | null
  if (!response.ok)
    throw new Error(
      data && typeof data === 'object' && typeof data.error === 'string'
        ? data.error
        : 'Kata sandi tidak dapat diganti.',
    )
}

export async function saveEvent(input: EventInput) {
  return eventsRequest<LocalEvent>('/api/events', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateEvent(eventId: string, input: EventInput) {
  return eventsRequest<{ id: string }>(`/api/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

/** Hapus permanen event beserta rekam operasional yang terikat padanya. */
export async function deleteEvent(eventId: string) {
  await eventsRequest<void>(`/api/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
  })
}

/** Hapus permanen job beserta lampiran dan ticket yang terikat padanya. */
export async function deleteJob(jobId: string) {
  await jobsRequest<void>(jobPath(jobId), { method: 'DELETE' })
}

/** Rujukan minimal untuk menulis aggregate Job: id + versi yang terakhir dibaca. */
export type JobRef = Pick<Job, 'id' | 'version'>

const jobDocumentMimeTypes: Record<string, JobDocumentMimeType> = {
  pdf: 'application/pdf',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xlsm: 'application/vnd.ms-excel.sheet.macroenabled.12',
  xltx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
  xltm: 'application/vnd.ms-excel.template.macroenabled.12',
  xlsb: 'application/vnd.ms-excel.sheet.binary.macroenabled.12',
}

function jobDocumentMimeType(file: File): JobDocumentMimeType {
  const extension = file.name.split('.').pop()?.toLowerCase()
  const mimeType = extension ? jobDocumentMimeTypes[extension] : undefined
  if (!mimeType) throw new Error('Dokumen harus berupa PDF atau file Excel.')
  return mimeType
}

/** Unggah satu berkas sebagai lampiran milik job; mengembalikan id lampiran. */
async function uploadJobAttachment(jobId: string, file: File, kind: JobDocumentKind) {
  const attachmentId = id()
  await saveFile({
    id: attachmentId,
    ownerType: 'JOB',
    ownerId: jobId,
    kind,
    fileName: file.name,
    mimeType: jobDocumentMimeType(file),
    fileSize: file.size,
    content: file,
    createdAt: now(),
  })
  return attachmentId
}

export type JobExtractionInput = {
  invoice?: JobInvoiceExtraction | null
  transport?: JobTransportExtraction | null
  transportDocumentType?: 'BL' | 'AWB' | null
}

/** Terapkan hasil ekstraksi dokumen ke job; penggabungan ke operational terjadi di server. */
export function applyJobExtraction(job: JobRef, extraction: JobExtractionInput): Promise<Job> {
  return jobsRequest<Job>(jobPath(job.id, '/extraction'), {
    method: 'POST',
    body: JSON.stringify({ version: job.version, ...extraction }),
  })
}

export type JobDocumentUploadResult = {
  attachmentId: string
  /** Job terbaru bila hasil ekstraksi ikut diterapkan; null bila hanya lampiran. */
  job: Job | null
}

/**
 * Unggah dokumen job. Bila disertai hasil ekstraksi, terapkan ke job sesudah lampiran tersimpan.
 * Ekstraksi B/L/AWB hanya dipakai bila dokumennya memang dokumen angkut.
 */
export async function saveJobDocument(
  job: JobRef,
  file: File,
  kind: JobDocumentKind = 'SOURCE',
  invoiceExtraction?: JobInvoiceExtraction | null,
  transportExtraction?: JobTransportExtraction | null,
): Promise<JobDocumentUploadResult> {
  const attachmentId = await uploadJobAttachment(job.id, file, kind)
  const isTransportDocument = kind === 'BILL_OF_LADING' || kind === 'AIR_WAYBILL'
  const invoice = invoiceExtraction ?? null
  const transport = isTransportDocument ? (transportExtraction ?? null) : null
  if (!invoice && !transport) return { attachmentId, job: null }
  const updated = await applyJobExtraction(job, {
    invoice,
    transport,
    transportDocumentType: transport ? (kind === 'BILL_OF_LADING' ? 'BL' : 'AWB') : null,
  })
  return { attachmentId, job: updated }
}

export function saveJobInvoiceExtraction(job: JobRef, invoice: JobInvoiceExtraction) {
  return applyJobExtraction(job, { invoice })
}

export function saveJobTransportExtraction(job: JobRef, transport: JobTransportExtraction) {
  return applyJobExtraction(job, { transport })
}

export type JobOperationalAttachment = { kind: JobDocumentKind; file: File }

export type JobDetailsInput = Partial<
  Pick<
    Job,
    | 'status'
    | 'transportMode'
    | 'manifestSeq'
    | 'commercialInvoiceNumber'
    | 'transportDocumentType'
    | 'transportDocumentNumber'
    | 'notes'
    | 'emptyStorage'
    | 'reExport'
    | 'operational'
  >
> & {
  /** Ganti pihak yang ditagih: agent ATAU exhibitor (yang lain null). */
  party?: { agentId: string | null; exhibitorId: string | null }
}

/** Simpan detail job (hanya field yang dikirim), lalu unggah lampiran baru. */
export async function saveJobOperationalDetails(
  job: JobRef,
  patch: JobDetailsInput,
  attachments: JobOperationalAttachment[] = [],
): Promise<Job> {
  const updated = await jobsRequest<Job>(jobPath(job.id), {
    method: 'PATCH',
    body: JSON.stringify({ version: job.version, ...patch }),
  })
  for (const { kind, file } of attachments) await uploadJobAttachment(job.id, file, kind)
  return updated
}

export type JobCreateInput = {
  eventId: string
  kind: JobKind
  internationalJenis: InternationalJobJenis | null
  transportMode: TransportMode | null
  /** Pihak yang ditagih: agent ATAU exhibitor. Job Local selalu exhibitor. */
  agentId: string | null
  exhibitorId: string | null
}

/**
 * Buat job (satu kiriman). Server mendaftarkan agent ke event bila perlu dan membuat nomor
 * internal VSS otomatis; No Job manifest ditetapkan belakangan.
 */
export function createJob(input: JobCreateInput): Promise<Job> {
  return jobsRequest<Job>('/api/jobs', { method: 'POST', body: JSON.stringify(input) })
}

/** Tagihan job ke pihaknya (satu job = satu tagihan). */
export function saveJobInvoice(job: JobRef, invoice: JobInvoice): Promise<Job> {
  return jobsRequest<Job>(jobPath(job.id, '/invoice'), {
    method: 'PUT',
    body: JSON.stringify({ version: job.version, invoice }),
  })
}

/** Saran urutan No Job berikutnya untuk awalan job ini di event-nya. */
export function getNextManifestSeq(
  jobId: string,
): Promise<{ prefix: string | null; suggestedSeq: number | null }> {
  return jobsRequest(jobPath(jobId, '/next-manifest-seq'))
}

/** Simpan blok inward manifest (dokumen angkut, konfigurasi muatan, milestone, catatan). */
export function saveJobInward(job: JobRef, inward: InwardManifest): Promise<Job> {
  return jobsRequest<Job>(jobPath(job.id, '/inward'), {
    method: 'PUT',
    body: JSON.stringify({ version: job.version, inward }),
  })
}

/** Simpan CIPL job: dokumen mentah + SELURUH baris per exhibitor (diganti utuh), atomik. */
export function saveJobCipl(
  job: JobRef,
  ciplDocument: CiplDocument | null,
  lines: JobCiplLineInput[],
): Promise<Job> {
  return jobsRequest<Job>(jobPath(job.id, '/cipl'), {
    method: 'PUT',
    body: JSON.stringify({ version: job.version, ciplDocument, lines }),
  })
}

/** Baris CIPL job dalam bentuk masukan (untuk dikirim ulang setelah diubah). */
export function ciplLineInputs(job: Pick<Job, 'ciplLines'>): JobCiplLineInput[] {
  return job.ciplLines.map(({ exhibitorId, nameOnDocument, koli, items, notes }) => ({
    exhibitorId,
    nameOnDocument,
    koli,
    items,
    notes,
  }))
}

/** Simpan fase kepulangan (return list) pada job; null mengosongkannya. */
export function saveJobKepulangan(job: JobRef, kepulangan: JobReturn | null): Promise<Job> {
  return jobsRequest<Job>(jobPath(job.id, '/kepulangan'), {
    method: 'PUT',
    body: JSON.stringify({ version: job.version, kepulangan }),
  })
}

export type CiplAutofillOutcome = {
  /** Job terbaru (versi naik) sesudah CIPL tersimpan. */
  job: Job
  /** Exhibitor event yang baru dibuat karena belum terdaftar di event. */
  created: Exhibitor[]
  /** Baris yang belum tertaut (nama cocok dengan lebih dari satu exhibitor event). */
  unlinked: string[]
}

/**
 * Simpan hasil scan CIPL ke job, dalam satu urutan yang jelas:
 *
 *   1. entri yang belum terdaftar → dibuat sebagai exhibitor event (hall/booth dari dokumen),
 *   2. exhibitor tertaut yang hall/booth-nya masih kosong → dilengkapi dari dokumen,
 *   3. dokumen CIPL mentah + baris CIPL (koli & barang per exhibitor) → disimpan pada job.
 *
 * Baris AMBIGU tetap tersimpan sebagai nama (belum tertaut) supaya datanya tidak hilang, dan
 * dilaporkan lewat `unlinked` agar operator dapat menautkannya manual di detail job.
 */
export async function applyCiplAutofill(input: {
  job: JobRef & Pick<Job, 'eventId' | 'kind'>
  rows: CiplAutofillRow[]
  ciplDocument: CiplDocument | null
  /** Exhibitor event yang sudah ada — untuk melengkapi hall/booth yang kosong. */
  eventExhibitors: Exhibitor[]
  /** Baris CIPL job yang sudah ada — dipertahankan karena penyimpanan mengganti seluruh baris. */
  keepLines?: JobCiplLineInput[]
}): Promise<CiplAutofillOutcome> {
  const exhibitorKind: ExhibitorKind = input.job.kind === 'LOCAL' ? 'LOCAL' : 'INTERNATIONAL'
  const pending = input.rows.filter((row) => row.resolution === 'BARU' && !row.exhibitorId)
  const created = pending.length
    ? await createEventExhibitors(
        input.job.eventId,
        pending.map((row) => ({
          name: row.name,
          kind: exhibitorKind,
          hall: row.logistics.hall,
          booth: row.logistics.booth,
        })),
      )
    : []
  const idByRow = new Map<CiplAutofillRow, string>()
  pending.forEach((row, index) => {
    const exhibitor = created[index]
    if (exhibitor) idByRow.set(row, exhibitor.id)
  })

  const existingById = new Map(input.eventExhibitors.map((exhibitor) => [exhibitor.id, exhibitor]))
  await Promise.all(
    input.rows.flatMap((row) => {
      const exhibitor = row.exhibitorId ? existingById.get(row.exhibitorId) : undefined
      if (!exhibitor) return []
      const patch: Partial<ExhibitorInput> = {}
      if (!exhibitor.hall && row.logistics.hall) patch.hall = row.logistics.hall
      if (!exhibitor.booth && row.logistics.booth) patch.booth = row.logistics.booth
      return Object.keys(patch).length ? [updateExhibitor(exhibitor.id, patch)] : []
    }),
  )

  const lines: JobCiplLineInput[] = input.rows.map((row) => ({
    exhibitorId: row.exhibitorId ?? idByRow.get(row) ?? null,
    nameOnDocument: row.namaTertera,
    koli: row.logistics.koli,
    items: row.items,
    notes: row.logistics.notes,
  }))
  const job = await saveJobCipl(input.job, input.ciplDocument, [...(input.keepLines ?? []), ...lines])
  return {
    job,
    created,
    unlinked: lines.filter((line) => !line.exhibitorId).map((line) => line.nameOnDocument),
  }
}
