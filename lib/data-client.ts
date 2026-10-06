'use client'

/** Public Supabase-backed data access boundary for all browser UI code. */

import type {
  Attachment,
  Cipl,
  CiplItem,
  CiplStatus,
  CiplVersion,
  CoordinationAgent,
  CustomsJob,
  CustomsJobStatus,
  JobAllocation,
  MigrationReviewItem,
  Shipment,
  ShipmentAllocation,
} from '@/domain/exhibition/types'
import type {
  Contact,
  Event as EventRecord,
  EventOrganizer,
  Exhibitor,
  ExhibitorContact,
  Venue,
} from '@/domain/event/types'
import {
  validateCiplVersionReady,
  validateJobAllocation,
  validateJobTransition,
  validateShipmentAllocation,
} from '@/domain/exhibition/validation'
import type { Ticket, TicketActivity, TicketComment, TicketContext, TicketPriority, TicketStatus } from '@/domain/ticket/types'

export type { Ticket, TicketActivity, TicketComment, TicketContext, TicketPriority, TicketStatus } from '@/domain/ticket/types'

export type LocalUser = {
  id: string
  name: string
  email: string
  jobRole: 'STAFF' | 'SUPERVISOR' | 'CUSTOMER_SERVICE' | 'DOCUMENT_ASSISTANT'
  accessLevel: 'ADMIN' | 'MEMBER'
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type LocalStage = {
  id: string
  jobId: string
  name: string
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE'
  order: number
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type JobTransportLeg = {
  mode: 'SEA' | 'AIR' | 'LOCAL' | null
  documentType: 'BL' | 'AWB' | null
  documentNumber: string | null
  carrier: string | null
  scheduleAt: string | null
  actualAt: string | null
}

export type JobCiplInfo = {
  status: 'MISSING' | 'REQUESTED' | 'RECEIVED' | 'VERIFIED'
  referenceNumber: string | null
  receivedAt: string | null
}

export type JobBilling =
  | { kind: 'NOT_READY' }
  | { kind: 'NOT_APPLICABLE' }
  | { kind: 'READY'; amount: number; currency: string }
  | { kind: 'INVOICED'; amount: number; currency: string; reference: string }
  | { kind: 'PAID'; reference: string }

export type JobCustomsDocument = {
  applicable: boolean
  status:
    'NOT_STARTED' | 'PREPARING' | 'SUBMITTED' | 'REGISTERED' | 'RELEASED' | 'COMPLETED' | 'ON_HOLD'
  ajuNumber: string | null
  registrationNumber: string | null
  registrationDate: string | null
  warehouseName: string | null
  billing: JobBilling
}

export type JobOperationalDetails = {
  inbound: JobTransportLeg
  outbound: JobTransportLeg
  /** Optional for compatibility with Jobs saved before invoice tracking existed. */
  invoiceNumber?: string | null
  invoiceItems?: JobInvoiceItem[]
  /** Complete commercial invoice extraction retained as the source for BC 2.3. */
  invoice?: JobInvoiceExtraction | null
  /** Complete B/L or AWB extraction retained alongside the inbound leg summary. */
  inboundDocument?: JobTransportExtraction | null
  cipl: JobCiplInfo
  customs: Record<'BC_2_3' | 'BC_2_5' | 'BC_3_0', JobCustomsDocument>
}

/** A party printed on a commercial or transport document. */
export type JobDocumentParty = {
  name: string | null
  address: string | null
  countryCode: string | null
  taxId: string | null
}

export type JobInvoiceItem = {
  lineNumber: number | null
  itemCode: string | null
  description: string
  hsCode: string | null
  quantity: number | null
  unit: string | null
  unitPrice: number | null
  lineTotal: number | null
  currency: string | null
  grossWeightKg: number | null
  netWeightKg: number | null
  countryOfOrigin: string | null
  packageCount: number | null
  packageType: string | null
}

/** Provisional values extracted from one Commercial Invoice; users may correct them later. */
export type JobInvoiceExtraction = {
  invoiceNumber: string | null
  invoiceDate: string | null
  seller: JobDocumentParty | null
  buyer: JobDocumentParty | null
  currency: string | null
  incoterm: string | null
  incotermLocation: string | null
  totalAmount: number | null
  freightAmount: number | null
  insuranceAmount: number | null
  totalGrossWeightKg: number | null
  totalNetWeightKg: number | null
  totalPackageCount: number | null
  packageType: string | null
  items: JobInvoiceItem[]
}

export type JobTransportContainer = {
  containerNumber: string | null
  size: string | null
  type: string | null
  sealNumber: string | null
}

/** Values printed on a B/L or AWB that describe the inbound transport. */
export type JobTransportExtraction = {
  documentNumber: string | null
  documentDate: string | null
  carrier: string | null
  vesselOrFlight: string | null
  voyageOrFlightNumber: string | null
  bookingNumber: string | null
  shipper: JobDocumentParty | null
  consignee: JobDocumentParty | null
  notifyParty: JobDocumentParty | null
  portOfLoading: string | null
  portOfDischarge: string | null
  placeOfReceipt: string | null
  placeOfDelivery: string | null
  etd: string | null
  eta: string | null
  packageCount: number | null
  packageType: string | null
  marksAndNumbers: string | null
  grossWeightKg: number | null
  netWeightKg: number | null
  volumeM3: number | null
  containers: JobTransportContainer[]
}

export type JobDocumentKind =
  | 'SOURCE'
  | 'INBOUND_TRANSPORT'
  | 'OUTBOUND_TRANSPORT'
  | 'BILL_OF_LADING'
  | 'AIR_WAYBILL'
  | 'COMMERCIAL_INVOICE'
  | 'CIPL'
  | 'BC_2_3'
  | 'BC_2_5'
  | 'BC_3_0'
  | 'OTHER'

export type JobDocumentMimeType =
  | 'application/pdf'
  | 'application/vnd.ms-excel'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  | 'application/vnd.ms-excel.sheet.macroenabled.12'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.template'
  | 'application/vnd.ms-excel.template.macroenabled.12'
  | 'application/vnd.ms-excel.sheet.binary.macroenabled.12'

export type LocalJob = {
  id: string
  jobNumber: string
  awbNumber: string | null
  blNumber: string | null
  shipper: string | null
  consignee: string | null
  notifyParty: string | null
  agent: string | null
  shippingLine: string | null
  cargoDescription: string | null
  shipmentMode: 'FCL' | 'LCL' | null
  cargoDetails: string | null
  journeyDetails: string | null
  type: 'IMPORT' | 'EXPORT'
  clientName: string
  clientInfo: string | null
  status: 'DRAFT' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED'
  notes: string | null
  trackingToken: string
  assignedToId: string | null
  createdById?: string | null
  eventId?: string | null
  exhibitorId?: string | null
  sourceDocumentName?: string | null
  createdAt: string
  updatedAt: string
  assignedTo?: LocalUser | null
  createdBy?: LocalUser | null
  exhibitor?: LocalExhibitor | null
  stages: LocalStage[]
  documents: LocalJobDocument[]
  operational?: JobOperationalDetails
}

export type LocalJobDocument = {
  id: string
  jobId: string
  fileName: string
  mimeType: JobDocumentMimeType
  fileSize: number
  attachmentId: string
  createdAt: string
  kind?: JobDocumentKind
}

/** File bytes are an application input, never part of a persisted domain entity. */
export type AttachmentUpload = {
  id: string
  fileName: string
  mimeType: 'application/pdf'
  fileSize: number
  content: Blob
  createdAt: string
}

type StoredFile = {
  id: string
  ownerType: 'CIPL_VERSION' | 'SHIPMENT' | 'CUSTOMS_JOB' | 'LEGACY_JOB'
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
/** Display adapter; Event itself remains immutable and status is cancellation-derived. */
export type LocalEvent = Omit<EventRecord, 'venue' | 'eventOrganizer'> & {
  officialName: string
  alias: string | null
  startsAt: string
  endsAt: string
  status: 'ACTIVE' | 'CANCELLED'
  cancellationReason: string | null
  cancelledAt: string | null
  eoId: string
  venue?: LocalVenue
  eventOrganizer?: LocalEo
}
/** Display adapter; the domain form remains a discriminated union on `kind`. */
export type LocalExhibitor = Exhibitor & {
  legalName: string
  aliasName: string | null
  type: 'LOCAL' | 'INTERNATIONAL'
  email: string | null
  phone: string | null
  agent: string | null
  address: string | null
  countryCode: string | null
}

type StoreName =
  | 'jobs'
  | 'stages'
  | 'users'
  | 'events'
  | 'venues'
  | 'eos'
  | 'exhibitors'
  | 'jobDocuments'
  | 'coordinationAgents'
  | 'cipls'
  | 'ciplVersions'
  | 'shipmentsV2'
  | 'customsJobs'
  | 'counters'
  | 'migrationReviewItems'
  | 'files'
  | 'tickets'
  | 'preferences'

type StoredRecord = { id: string }

const collectionTable: Record<Exclude<StoreName, 'files' | 'counters'>, string> = {
  jobs: 'jobs', stages: 'job_stages', users: 'operational_users', events: 'events', venues: 'venues',
  eos: 'event_organizers', exhibitors: 'exhibitors', jobDocuments: 'job_documents',
  coordinationAgents: 'coordination_agents', cipls: 'cipls', ciplVersions: 'cipl_versions',
  shipmentsV2: 'shipments', customsJobs: 'customs_jobs', migrationReviewItems: 'migration_review_items',
  tickets: 'tickets', preferences: 'preferences',
}

async function records<T>(storeName: StoreName, init?: RequestInit, recordId?: string): Promise<T> {
  if (storeName === 'files') throw new Error('Gunakan repository lampiran.')
  const table = storeName === 'counters' ? 'preferences' : collectionTable[storeName]
  const params = new URLSearchParams({ table })
  if (recordId) params.set('id', recordId)
  const response = await fetch(`/api/operational-records?${params}`, {
    cache: 'no-store', ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const data = await response.json().catch(() => null) as T | { error?: string } | null
  if (!response.ok) throw new Error(data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'Data Supabase tidak dapat diproses.')
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

function remove(storeName: StoreName, recordId: string) {
  if (storeName === 'files') return
  void records<void>(storeName, { method: 'DELETE' }, recordId)
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

function emptyCustomsDocument(applicable = true): JobCustomsDocument {
  return {
    applicable,
    status: 'NOT_STARTED',
    ajuNumber: null,
    registrationNumber: null,
    registrationDate: null,
    warehouseName: null,
    billing: applicable ? { kind: 'NOT_READY' } : { kind: 'NOT_APPLICABLE' },
  }
}

/** Gives pre-existing event-initialized Jobs a useful operational starting point. */
export function getOperationalDetails(
  job: Pick<LocalJob, 'operational' | 'blNumber' | 'awbNumber' | 'shippingLine'>,
): JobOperationalDetails {
  if (job.operational) return job.operational
  const documentType = job.blNumber ? 'BL' : job.awbNumber ? 'AWB' : null
  return {
    inbound: {
      mode: documentType === 'BL' ? 'SEA' : documentType === 'AWB' ? 'AIR' : null,
      documentType,
      documentNumber: job.blNumber ?? job.awbNumber,
      carrier: job.shippingLine,
      scheduleAt: null,
      actualAt: null,
    },
    outbound: {
      mode: null,
      documentType: null,
      documentNumber: null,
      carrier: null,
      scheduleAt: null,
      actualAt: null,
    },
    invoiceNumber: null,
    cipl: { status: 'MISSING', referenceNumber: null, receivedAt: null },
    customs: {
      BC_2_3: emptyCustomsDocument(),
      BC_2_5: emptyCustomsDocument(false),
      BC_3_0: emptyCustomsDocument(),
    },
  }
}


function attachmentMetadata(upload: AttachmentUpload): Attachment {
  const { content: _content, ...attachment } = upload
  return attachment
}

function toStoredFile(
  upload: AttachmentUpload,
  ownerType: StoredFile['ownerType'],
  ownerId: string,
  kind: string | null = null,
): StoredFile {
  return { ...upload, ownerType, ownerId, kind }
}

async function saveFile(file: StoredFile) {
  const form = new FormData()
  form.set('id', file.id)
  form.set('ownerType', file.ownerType)
  form.set('ownerId', file.ownerId)
  if (file.kind) form.set('kind', file.kind)
  form.set('file', file.content instanceof File ? file.content : new File([file.content], file.fileName, { type: file.mimeType }))
  const response = await fetch('/api/attachments', { method: 'POST', body: form })
  const body = await response.json().catch(() => null) as { error?: string } | null
  if (!response.ok) throw new Error(body?.error ?? 'Lampiran tidak dapat diunggah.')
}

/** Returns attachment bytes without leaking the active storage implementation to UI code. */
export async function getAttachmentContent(attachmentId: string): Promise<Blob | null> {
  const response = await fetch(`/api/attachments?id=${encodeURIComponent(attachmentId)}`, { cache: 'no-store' })
  return response.ok ? response.blob() : null
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
  const body = await response.json().catch(() => null) as T | { error?: string } | null
  if (!response.ok) throw new Error(body && typeof body === 'object' && 'error' in body ? body.error ?? 'Ticket tidak dapat diproses.' : 'Ticket tidak dapat diproses.')
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

type JobsApiPayload = {
  jobs: LocalJob[]
  stages: LocalStage[]
  users: LocalUser[]
  documents: LocalJobDocument[]
  exhibitors: Record<string, unknown>[]
  events: Record<string, unknown>[]
}

export async function listJobsWithEvents() {
  const response = await fetch('/api/jobs', { cache: 'no-store' })
  const data = await response.json().catch(() => null) as
    | JobsApiPayload
    | { error?: string }
    | null
  if (!response.ok || !data || ('error' in data && typeof data.error === 'string')) {
    throw new Error(
      data && 'error' in data && typeof data.error === 'string'
        ? data.error
        : 'Data jobs tidak dapat dimuat.',
    )
  }

  const payload = data as JobsApiPayload
  const exhibitors = payload.exhibitors.map(exhibitorFromRow)
  const jobs = payload.jobs
    .map((job) => ({
      ...job,
      operational: getOperationalDetails(job),
      assignedTo: payload.users.find((user) => user.id === job.assignedToId) ?? null,
      createdBy: payload.users.find((user) => user.id === job.createdById) ?? null,
      exhibitor: exhibitors.find((exhibitor) => exhibitor.id === job.exhibitorId) ?? null,
      stages: payload.stages
        .filter((stage) => stage.jobId === job.id)
        .sort((left, right) => left.order - right.order),
      documents: payload.documents.filter((document) => document.jobId === job.id),
    }))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))

  return { jobs, events: payload.events.map(eventFromRow) }
}

export async function listJobs(filters: { search?: string; status?: string } = {}) {
  const { jobs } = await listJobsWithEvents()
  const search = filters.search?.toLowerCase() ?? ''
  return jobs.filter(
    (job) =>
      (!filters.status || job.status === filters.status) &&
      (!search ||
        [job.jobNumber, job.clientName, job.awbNumber, job.blNumber].some((value) =>
          value?.toLowerCase().includes(search),
        )),
  )
}

export async function getJob(jobId: string) {
  return (await listJobs()).find((job) => job.id === jobId) ?? null
}

export async function listEventJobs(eventId: string) {
  const jobs = await listJobs()
  return jobs.filter((job) => job.eventId === eventId)
}

type EventResource = 'venues' | 'event-organizers'

async function eventRecords<T>(
  resource: EventResource,
  init?: RequestInit,
  search?: URLSearchParams,
): Promise<T> {
  const response = await fetch(`/api/event-records?${new URLSearchParams({ resource, ...Object.fromEntries(search ?? []) })}`, {
    cache: 'no-store',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const data = await response.json().catch(() => null) as T | { error?: string } | null
  if (!response.ok) throw new Error(data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'Data event tidak dapat diproses.')
  return data as T
}
async function eventsRequest<T>(path = '/api/events', init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    cache: 'no-store',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const data = await response.json().catch(() => null) as T | { error?: string } | null
  if (!response.ok) {
    throw new Error(
      data &&
        typeof data === 'object' &&
        'error' in data &&
        typeof data.error === 'string'
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
  const cancellation =
    cancellationRow && typeof cancellationRow === 'object'
      ? {
          eventId: String(row.id),
          reason: String((cancellationRow as Record<string, unknown>).reason),
          cancelledAt: String((cancellationRow as Record<string, unknown>).cancelled_at),
          cancelledById: String((cancellationRow as Record<string, unknown>).cancelled_by_id),
        }
      : null
  const venue =
    venueRow && typeof venueRow === 'object'
      ? {
          id: String(row.venue_id),
          name: String((venueRow as Record<string, unknown>).name),
          officialName: String((venueRow as Record<string, unknown>).name),
          aliasName: null,
          contacts: Array.isArray((venueRow as Record<string, unknown>).contacts)
            ? ((venueRow as Record<string, unknown>).contacts as Record<string, unknown>[]).map(
                contactFromRow,
              )
            : [],
          address: ((venueRow as Record<string, unknown>).address as string | null) ?? null,
          website: ((venueRow as Record<string, unknown>).website as string | null) ?? null,
          loadingAccessNotes:
            ((venueRow as Record<string, unknown>).loading_access_notes as string | null) ?? null,
          latitude: null,
          longitude: null,
          contactInfo: null,
          createdAt: String((venueRow as Record<string, unknown>).created_at),
          updatedAt: String((venueRow as Record<string, unknown>).updated_at),
        }
      : undefined
  const eventOrganizer =
    organizerRow && typeof organizerRow === 'object'
      ? {
          id: String(row.event_organizer_id),
          name: String((organizerRow as Record<string, unknown>).name),
          legalName: String((organizerRow as Record<string, unknown>).name),
          aliasName: null,
          contactInfo: null,
          npwp: ((organizerRow as Record<string, unknown>).npwp as string | null) ?? null,
          contacts: Array.isArray((organizerRow as Record<string, unknown>).contacts)
            ? (
                (organizerRow as Record<string, unknown>).contacts as Record<string, unknown>[]
              ).map(contactFromRow)
            : [],
          address: ((organizerRow as Record<string, unknown>).address as string | null) ?? null,
          website: ((organizerRow as Record<string, unknown>).website as string | null) ?? null,
          createdAt: String((organizerRow as Record<string, unknown>).created_at),
          updatedAt: String((organizerRow as Record<string, unknown>).updated_at),
        }
      : undefined
  return {
    id: String(row.id),
    name: String(row.name),
    officialName: String(row.name),
    alias: null,
    venueId: String(row.venue_id),
    eventOrganizerId: String(row.event_organizer_id),
    eoId: String(row.event_organizer_id),
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
    venue,
    eventOrganizer,
  }
}

function exhibitorFromRow(row: Record<string, unknown>): LocalExhibitor {
  const contact = contactFromRow((row.contact as Record<string, unknown>) ?? {})
  const shared = {
    id: String(row.id),
    eventId: String(row.event_id),
    name: String(row.name),
    legalName: String(row.name),
    aliasName: null,
    type: row.kind === 'LOCAL' ? 'LOCAL' as const : 'INTERNATIONAL' as const,
    contact,
    email: contact.email,
    phone: contact.phone,
    agentId: (row.agent_id as string | null) ?? null,
    agent: null,
    address: null,
    countryCode: null,
    createdAt: String(row.created_at),
    createdById: String(row.created_by_id),
    updatedAt: String(row.updated_at),
  }
  return row.kind === 'LOCAL'
    ? { ...shared, kind: 'LOCAL', npwp: (row.npwp as string | null) ?? null }
    : { ...shared, kind: 'INTERNATIONAL' }
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
    ) as Record<string, LocalExhibitor[]>,
  }
}


export async function listVenues(): Promise<LocalVenue[]> {
  const rows = await eventRecords<Array<Record<string, unknown>>>('venues')
  return rows.map((row) => ({ id: String(row.id), name: String(row.name), officialName: String(row.name), aliasName: null, contacts: Array.isArray(row.contacts) ? (row.contacts as Record<string, unknown>[]).map(contactFromRow) : [], address: (row.address as string | null) ?? null, website: (row.website as string | null) ?? null, loadingAccessNotes: (row.loading_access_notes as string | null) ?? null, latitude: null, longitude: null, contactInfo: null, createdAt: String(row.created_at), updatedAt: String(row.updated_at) }))
}

export async function listEos(): Promise<LocalEo[]> {
  const rows = await eventRecords<Array<Record<string, unknown>>>('event-organizers')
  return rows.map((row) => ({ id: String(row.id), name: String(row.name), legalName: String(row.name), aliasName: null, contactInfo: null, npwp: (row.npwp as string | null) ?? null, contacts: Array.isArray(row.contacts) ? (row.contacts as Record<string, unknown>[]).map(contactFromRow) : [], address: (row.address as string | null) ?? null, website: (row.website as string | null) ?? null, createdAt: String(row.created_at), updatedAt: String(row.updated_at) }))
}

export type EventExhibitorInput =
  | {
      kind: 'LOCAL'
      name: string
      contact: ExhibitorContact
      agentId: string | null
      npwp: string | null
    }
  | {
      kind: 'INTERNATIONAL'
      name: string
      contact: ExhibitorContact
      agentId: string | null
    }
export type VenueInput = Pick<Venue, 'name' | 'contacts' | 'address' | 'website' | 'loadingAccessNotes'>
export type EoInput = Pick<EventOrganizer, 'name' | 'npwp' | 'contacts' | 'address' | 'website'>
export type EventInput = Pick<EventRecord, 'name' | 'venueId' | 'eventOrganizerId' | 'startsOn' | 'endsOn'>

export async function saveEventExhibitors(eventId: string, inputs: EventExhibitorInput[]) {
  return eventsRequest<LocalExhibitor[]>(
    `/api/events/${encodeURIComponent(eventId)}/exhibitors`,
    { method: 'POST', body: JSON.stringify(inputs) },
  )
}

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
  jobRole?: string
  isAdmin: boolean
  isActive?: boolean
}
export type SettingsVenue = Pick<LocalVenue, 'id' | 'name' | 'address' | 'website' | 'loadingAccessNotes'>
export type SettingsOrganizer = Pick<LocalEo, 'id' | 'name' | 'npwp' | 'address' | 'website'>
export type SettingsData = { users: SettingsUser[]; venues: SettingsVenue[]; organizers: SettingsOrganizer[] }

async function settingsRequest<T>(method: 'GET' | 'POST' | 'PATCH', body?: unknown): Promise<T> {
  const response = await fetch('/api/settings', {
    method,
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json().catch(() => null) as T | { error?: string } | null
  if (!response.ok) throw new Error(data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'Pengaturan tidak dapat diproses.')
  return data as T
}

/** Reads administrator-managed users, venues, and event organizers. */
export function getSettingsData() {
  return settingsRequest<SettingsData>('GET')
}

export function createSettingsRecord<T>(resource: 'users' | 'venues' | 'organizers', input: unknown) {
  return settingsRequest<T>('POST', { resource, input })
}

export function updateSettingsRecord<T>(resource: 'users' | 'venues' | 'organizers', id: string, input: unknown) {
  return settingsRequest<T>('PATCH', { resource, id, input })
}

export async function saveEvent(input: EventInput) {
  return eventsRequest<LocalEvent>('/api/events', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function cancelEvent(eventId: string, reason: string) {
  await eventsRequest<void>(`/api/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    body: JSON.stringify({ reason }),
  })
  return (await listEvents()).find((event) => event.id === eventId) ?? null
}

export async function deleteEvent() {
  throw new Error('Event bersifat immutable dan tidak dapat dihapus.')
}

export type JobInput = Pick<
  LocalJob,
  | 'awbNumber'
  | 'blNumber'
  | 'shipper'
  | 'consignee'
  | 'notifyParty'
  | 'agent'
  | 'shippingLine'
  | 'cargoDescription'
  | 'shipmentMode'
  | 'cargoDetails'
  | 'journeyDetails'
  | 'type'
  | 'clientName'
  | 'clientInfo'
  | 'status'
  | 'notes'
  | 'assignedToId'
> & {
  eventId?: string | null
  exhibitorId?: string | null
  sourceDocumentName?: string | null
}

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

export async function saveJobDocument(
  jobId: string,
  file: File,
  kind: JobDocumentKind = 'SOURCE',
  invoiceExtraction?: JobInvoiceExtraction | null,
  transportExtraction?: JobTransportExtraction | null,
): Promise<LocalJobDocument> {
  const timestamp = now()
  const mimeType = jobDocumentMimeType(file)
  const document: LocalJobDocument = {
    id: id(),
    jobId,
    fileName: file.name,
    mimeType,
    fileSize: file.size,
    attachmentId: id(),
    createdAt: timestamp,
    kind,
  }
  const storedFile: StoredFile = {
    id: document.attachmentId,
    ownerType: 'LEGACY_JOB',
    ownerId: jobId,
    kind,
    fileName: document.fileName,
    mimeType: document.mimeType,
    fileSize: document.fileSize,
    content: file,
    createdAt: timestamp,
  }
  const invoice = invoiceExtraction ?? null
  const transport = transportExtraction ?? null
  const isTransportDocument = kind === 'BILL_OF_LADING' || kind === 'AIR_WAYBILL'
  const previous = invoice || (isTransportDocument && transport) ? await getJob(jobId) : null
  if ((invoice || (isTransportDocument && transport)) && !previous) throw new Error('Job tidak ditemukan.')
  const updatedJob = previous
    ? (() => {
        const operational = getOperationalDetails(previous)
        const inbound = isTransportDocument && transport
          ? {
              ...operational.inbound,
              mode: kind === 'BILL_OF_LADING' ? 'SEA' as const : 'AIR' as const,
              documentType: kind === 'BILL_OF_LADING' ? 'BL' as const : 'AWB' as const,
              documentNumber: transport.documentNumber,
              carrier: transport.carrier,
              scheduleAt: transport.eta ?? operational.inbound.scheduleAt,
            }
          : operational.inbound
        return {
          ...previous,
          ...(isTransportDocument && transport
            ? kind === 'BILL_OF_LADING'
              ? { blNumber: transport.documentNumber }
              : { awbNumber: transport.documentNumber }
            : {}),
          ...(isTransportDocument && transport ? { shippingLine: transport.carrier } : {}),
          ...(isTransportDocument && transport?.shipper?.name ? { shipper: transport.shipper.name } : {}),
          ...(isTransportDocument && transport?.consignee?.name ? { consignee: transport.consignee.name } : {}),
          ...(isTransportDocument && transport?.notifyParty?.name ? { notifyParty: transport.notifyParty.name } : {}),
          operational: {
            ...operational,
            inbound,
            ...(isTransportDocument && transport ? { inboundDocument: transport } : {}),
            ...(invoice
              ? {
                  invoiceNumber: invoice.invoiceNumber ?? operational.invoiceNumber ?? null,
                  invoiceItems: invoice.items,
                  invoice,
                }
              : {}),
          },
          updatedAt: timestamp,
        }
      })()
    : null
  await Promise.all([
    put('jobDocuments', document),
    put('files', storedFile),
    ...(updatedJob ? [put('jobs', updatedJob)] : []),
  ])
  return document
}

export async function saveJobInvoiceExtraction(jobId: string, invoice: JobInvoiceExtraction) {
  const previous = await getJob(jobId)
  if (!previous) throw new Error('Job tidak ditemukan.')
  const operational = getOperationalDetails(previous)
  const updated: LocalJob = {
    ...previous,
    operational: {
      ...operational,
      invoiceNumber: invoice.invoiceNumber,
      invoiceItems: invoice.items,
      invoice,
    },
    updatedAt: now(),
  }
  await put('jobs', updated)
  return updated
}

export async function saveJobTransportExtraction(jobId: string, transport: JobTransportExtraction) {
  const previous = await getJob(jobId)
  if (!previous) throw new Error('Job tidak ditemukan.')
  const operational = getOperationalDetails(previous)
  const documentType = operational.inbound.documentType ?? (previous.blNumber ? 'BL' : previous.awbNumber ? 'AWB' : 'BL')
  const updated: LocalJob = {
    ...previous,
    ...(documentType === 'BL' ? { blNumber: transport.documentNumber } : { awbNumber: transport.documentNumber }),
    shippingLine: transport.carrier,
    ...(transport.shipper?.name ? { shipper: transport.shipper.name } : {}),
    ...(transport.consignee?.name ? { consignee: transport.consignee.name } : {}),
    ...(transport.notifyParty?.name ? { notifyParty: transport.notifyParty.name } : {}),
    operational: {
      ...operational,
      inbound: {
        ...operational.inbound,
        mode: documentType === 'BL' ? 'SEA' : 'AIR',
        documentType,
        documentNumber: transport.documentNumber,
        carrier: transport.carrier,
        scheduleAt: transport.eta ?? operational.inbound.scheduleAt,
      },
      inboundDocument: transport,
    },
    updatedAt: now(),
  }
  await put('jobs', updated)
  return updated
}

export type JobOperationalAttachment = { kind: JobDocumentKind; file: File }

/** Saves Job details and uploads new PDFs to Supabase Storage. */
export async function saveJobOperationalDetails(
  jobId: string,
  patch: Pick<
    LocalJob,
    | 'clientName'
    | 'agent'
    | 'shipper'
    | 'consignee'
    | 'notifyParty'
    | 'assignedToId'
    | 'status'
    | 'notes'
  > & { operational: JobOperationalDetails },
  attachments: JobOperationalAttachment[] = [],
) {
  const previous = await getJob(jobId)
  if (!previous) throw new Error('Job tidak ditemukan.')
  const timestamp = now()
  const job: LocalJob = {
    ...previous,
    ...patch,
    id: previous.id,
    jobNumber: previous.jobNumber,
    eventId: previous.eventId,
    createdAt: previous.createdAt,
    updatedAt: timestamp,
    stages: previous.stages,
    documents: previous.documents,
  }
  const documents: LocalJobDocument[] = attachments.map(({ kind, file }) => ({
    id: id(),
    jobId,
    kind,
    fileName: file.name,
    mimeType: 'application/pdf',
    fileSize: file.size,
    attachmentId: id(),
    createdAt: timestamp,
  }))
  await Promise.all([
    put('jobs', job),
    ...documents.map((document) => put('jobDocuments', document)),
    ...documents.map((document, index) =>
      put('files', {
        id: document.attachmentId,
        ownerType: 'LEGACY_JOB',
        ownerId: jobId,
        kind: document.kind ?? null,
        fileName: document.fileName,
        mimeType: document.mimeType,
        fileSize: document.fileSize,
        content: attachments[index].file,
        createdAt: timestamp,
      } satisfies StoredFile),
    ),
  ])
  return job
}

export async function saveJob(input: JobInput, existingId?: string) {
  const previous = existingId ? await getJob(existingId) : null
  const timestamp = now()
  const createdById = previous ? previous.createdById ?? null : (await listUsers()).find((user) => user.isActive)?.id ?? null
  const job: LocalJob = {
    ...previous,
    id: existingId ?? id(),
    jobNumber:
      previous?.jobNumber ??
      `VSS-${String((await readAll<LocalJob>('jobs')).length + 1).padStart(4, '0')}`,
    trackingToken: previous?.trackingToken ?? id(),
    createdById,
    createdAt: previous?.createdAt ?? timestamp,
    updatedAt: timestamp,
    stages: previous?.stages ?? [],
    documents: previous?.documents ?? [],
    ...input,
  }
  return put('jobs', job)
}

/** Metadata Job dan PDF sumber disimpan melalui Supabase. */
export async function saveJobWithDocument(input: JobInput, file: File, existingId?: string) {
  const previous = existingId ? await getJob(existingId) : null
  const timestamp = now()
  const createdById = previous ? previous.createdById ?? null : (await listUsers()).find((user) => user.isActive)?.id ?? null
  const job: LocalJob = {
    ...previous,
    id: existingId ?? id(),
    jobNumber:
      previous?.jobNumber ??
      `VSS-${String((await readAll<LocalJob>('jobs')).length + 1).padStart(4, '0')}`,
    trackingToken: previous?.trackingToken ?? id(),
    createdById,
    createdAt: previous?.createdAt ?? timestamp,
    updatedAt: timestamp,
    stages: previous?.stages ?? [],
    documents: previous?.documents ?? [],
    ...input,
  }
  const document: LocalJobDocument = {
    id: id(),
    jobId: job.id,
    fileName: file.name,
    mimeType: 'application/pdf',
    fileSize: file.size,
    attachmentId: id(),
    createdAt: timestamp,
  }
  await Promise.all([
    put('jobs', job),
    put('jobDocuments', document),
    put('files', {
      id: document.attachmentId,
      ownerType: 'LEGACY_JOB',
      ownerId: job.id,
      kind: 'SOURCE',
      fileName: document.fileName,
      mimeType: document.mimeType,
      fileSize: document.fileSize,
      content: file,
      createdAt: timestamp,
    } satisfies StoredFile),
  ])
  return job
}

export async function addStage(jobId: string, name: string): Promise<LocalStage> {
  const stages = (await readAll<LocalStage>('stages')).filter((stage) => stage.jobId === jobId)
  return put('stages', {
    id: id(),
    jobId,
    name: name.trim(),
    status: 'PENDING',
    order: stages.length,
    notes: null,
    createdAt: now(),
    updatedAt: now(),
  })
}

export async function toggleStage(stage: LocalStage): Promise<LocalStage> {
  return put('stages', {
    ...stage,
    status: stage.status === 'DONE' ? 'IN_PROGRESS' : 'DONE',
    updatedAt: now(),
  })
}

export type CiplVersionInput = {
  receivedAt: string
  receivedBy: string
  sourceDocumentName?: string | null
  sourceDocument?: AttachmentUpload | null
  items: CiplItem[]
  revisionNote?: string | null
}

export async function listCipls(eventExhibitorId: string) {
  return (await readAll<Cipl>('cipls'))
    .filter((cipl) => cipl.eventExhibitorId === eventExhibitorId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export async function getCipl(ciplId: string) {
  return (await readAll<Cipl>('cipls')).find((cipl) => cipl.id === ciplId) ?? null
}

export async function listCiplVersions(ciplId: string) {
  return (await readAll<CiplVersion>('ciplVersions'))
    .filter((version) => version.ciplId === ciplId)
    .sort((left, right) => right.versionNumber - left.versionNumber)
}

export async function createCipl(eventExhibitorId: string, initialVersion?: CiplVersionInput) {
  const exhibitor = (await readAll<LocalExhibitor>('exhibitors')).find(
    (item) => item.id === eventExhibitorId,
  )
  if (!exhibitor) throw new Error('Exhibitor tidak ditemukan.')
  const timestamp = now()
  const cipl: Cipl = {
    id: id(),
    eventExhibitorId,
    referenceNumber: null,
    status: initialVersion ? 'RECEIVED' : 'AWAITING_DOCUMENT',
    activeVersionId: null,
    sourceDocumentUnavailable: !initialVersion,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  await put('cipls', cipl)
  if (initialVersion) {
    const version: CiplVersion = {
      id: id(),
      ciplId: cipl.id,
      versionNumber: 1,
      receivedAt: initialVersion.receivedAt,
      receivedBy: initialVersion.receivedBy,
      sourceDocumentName: initialVersion.sourceDocumentName ?? null,
      sourceDocument: initialVersion.sourceDocument
        ? attachmentMetadata(initialVersion.sourceDocument)
        : null,
      items: initialVersion.items,
      revisionNote: initialVersion.revisionNote ?? null,
      createdAt: timestamp,
    }
    cipl.activeVersionId = version.id
    await Promise.all([
      put('cipls', cipl),
      put('ciplVersions', version),
      ...(initialVersion.sourceDocument
        ? [
            put(
              'files',
              toStoredFile(initialVersion.sourceDocument, 'CIPL_VERSION', version.id, 'SOURCE'),
            ),
          ]
        : []),
    ])
  }
  return cipl
}

export async function addCiplVersion(ciplId: string, input: CiplVersionInput) {
  const [cipl, versions, shipments] = await Promise.all([
    getCipl(ciplId),
    listCiplVersions(ciplId),
    listShipments(ciplId),
  ])
  if (!cipl) throw new Error('CIPL tidak ditemukan.')
  if (
    cipl.activeVersionId &&
    shipments.some((shipment) => shipment.sourceCiplVersionId === cipl.activeVersionId)
  ) {
    // Version lama tetap immutable setelah dipakai Shipment; versi baru selalu aman dibuat.
  }
  const timestamp = now()
  const version: CiplVersion = {
    id: id(),
    ciplId,
    versionNumber: (versions[0]?.versionNumber ?? 0) + 1,
    receivedAt: input.receivedAt,
    receivedBy: input.receivedBy,
    sourceDocumentName: input.sourceDocumentName ?? null,
    sourceDocument: input.sourceDocument ? attachmentMetadata(input.sourceDocument) : null,
    items: input.items,
    revisionNote: input.revisionNote ?? null,
    createdAt: timestamp,
  }
  const validation = validateCiplVersionReady(version)
  if (!validation.ok && cipl.status === 'READY')
    throw new Error(validation.issues.map((issue) => issue.message).join(' '))
  await Promise.all([
    put('ciplVersions', version),
    ...(input.sourceDocument
      ? [put('files', toStoredFile(input.sourceDocument, 'CIPL_VERSION', version.id, 'SOURCE'))]
      : []),
  ])
  return version
}

export async function activateCiplVersion(
  ciplId: string,
  versionId: string,
  status: CiplStatus = 'UNDER_REVIEW',
) {
  const version = (await listCiplVersions(ciplId)).find((item) => item.id === versionId)
  const cipl = await getCipl(ciplId)
  if (!cipl || !version) throw new Error('Versi CIPL bukan milik CIPL yang dipilih.')
  return put('cipls', {
    ...cipl,
    activeVersionId: versionId,
    status,
    sourceDocumentUnavailable: false,
    updatedAt: now(),
  })
}

export async function listShipments(ciplId: string) {
  return (await readAll<Shipment>('shipmentsV2'))
    .filter((shipment) => shipment.ciplId === ciplId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export async function getShipment(shipmentId: string) {
  return (
    (await readAll<Shipment>('shipmentsV2')).find((shipment) => shipment.id === shipmentId) ?? null
  )
}

export type ShipmentInput = Omit<
  Shipment,
  | 'id'
  | 'ciplId'
  | 'sourceCiplVersionId'
  | 'allocations'
  | 'createdAt'
  | 'updatedAt'
  | 'legacyReference'
> & { legacyReference?: string | null }

export async function createShipment(
  ciplId: string,
  sourceVersionId: string,
  input: ShipmentInput,
  allocations: ShipmentAllocation[],
) {
  const [cipl, versions, existing] = await Promise.all([
    getCipl(ciplId),
    listCiplVersions(ciplId),
    listShipments(ciplId),
  ])
  const version = versions.find((item) => item.id === sourceVersionId)
  if (!cipl || !version) throw new Error('CIPL atau versi sumber tidak ditemukan.')
  if (input.documentType !== 'BL' && input.documentType !== 'AWB')
    throw new Error('Shipment harus memiliki tepat satu B/L atau AWB.')
  const allocationValidation = validateShipmentAllocation(version, existing, allocations)
  if (!allocationValidation.ok)
    throw new Error(allocationValidation.issues.map((issue) => issue.message).join(' '))
  const timestamp = now()
  const shipment: Shipment = {
    ...input,
    id: id(),
    ciplId,
    sourceCiplVersionId: sourceVersionId,
    allocations,
    legacyReference: input.legacyReference ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  return put('shipmentsV2', shipment)
}

export async function listCustomsJobs(shipmentId: string) {
  return (await readAll<CustomsJob>('customsJobs'))
    .filter((job) => job.shipmentId === shipmentId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export async function getCustomsJob(jobId: string) {
  return (await readAll<CustomsJob>('customsJobs')).find((job) => job.id === jobId) ?? null
}

export type CustomsJobInput = Omit<
  CustomsJob,
  'id' | 'jobNumber' | 'shipmentId' | 'allocations' | 'statusHistory' | 'createdAt' | 'updatedAt'
>

/** CustomsJob numbering is derived from persisted Supabase records. */
export async function createCustomsJob(
  shipmentId: string,
  input: CustomsJobInput,
  allocations: JobAllocation[],
) {
  const shipment = (await readAll<Shipment>('shipmentsV2')).find((item) => item.id === shipmentId)
  if (!shipment) throw new Error('Shipment tidak ditemukan.')
  const existing = await listCustomsJobs(shipmentId)
  const allocationValidation = validateJobAllocation(shipment, existing, allocations)
  if (!allocationValidation.ok)
    throw new Error(allocationValidation.issues.map((issue) => issue.message).join(' '))
  const timestamp = now()
  const counter = (await readAll<{ id: string; value: number }>('counters')).find(
    (item) => item.id === 'customsJobNumber',
  ) ?? { id: 'customsJobNumber', value: 0 }
  const next = counter.value + 1
  const job: CustomsJob = {
    ...input,
    id: id(),
    jobNumber: `VSS-${String(next).padStart(5, '0')}`,
    shipmentId,
    allocations,
    statusHistory: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  await Promise.all([put('counters', { ...counter, value: next }), put('customsJobs', job)])
  return job
}

export async function updateCustomsJob(
  jobId: string,
  patch: Partial<
    Omit<
      CustomsJob,
      'id' | 'jobNumber' | 'shipmentId' | 'createdAt' | 'allocations' | 'statusHistory'
    >
  >,
  changeReason?: string,
) {
  const previous = (await readAll<CustomsJob>('customsJobs')).find((job) => job.id === jobId)
  if (!previous) throw new Error('Customs Job tidak ditemukan.')
  const nextStatus = patch.status ?? previous.status
  const transition = validateJobTransition(
    previous.status,
    nextStatus,
    patch.attachments ?? previous.attachments,
    changeReason,
  )
  if (!transition.ok) throw new Error(transition.issues.map((issue) => issue.message).join(' '))
  const statusHistory =
    nextStatus === previous.status
      ? previous.statusHistory
      : [
          ...previous.statusHistory,
          {
            from: previous.status,
            to: nextStatus,
            reason: changeReason?.trim() ?? '',
            changedAt: now(),
          },
        ]
  return put('customsJobs', {
    ...previous,
    ...patch,
    id: previous.id,
    jobNumber: previous.jobNumber,
    shipmentId: previous.shipmentId,
    allocations: previous.allocations,
    statusHistory,
    createdAt: previous.createdAt,
    updatedAt: now(),
  })
}
