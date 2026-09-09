'use client'

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
import {
  validateCiplVersionReady,
  validateJobAllocation,
  validateJobTransition,
  validateShipmentAllocation,
} from '@/domain/exhibition/validation'
import { createMockData, MOCK_DATA_VERSION } from '@/lib/mock-data'
import type { Ticket, TicketContext, TicketPriority, TicketStatus } from '@/domain/ticket/types'
import { validateStatusTransition, validateTicket } from '@/domain/ticket/validation'

export type { Ticket, TicketContext, TicketPriority, TicketStatus } from '@/domain/ticket/types'

export type LocalUser = {
  id: string
  name: string
  email: string
  role: 'STAFF' | 'SUPERVISOR' | 'CUSTOMER_SERVICE' | 'DOCUMENT_ASSISTANT'
  isActive: boolean
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
  cipl: JobCiplInfo
  customs: Record<'BC_2_3' | 'BC_2_5' | 'BC_3_0', JobCustomsDocument>
}

export type JobDocumentKind =
  | 'SOURCE'
  | 'INBOUND_TRANSPORT'
  | 'OUTBOUND_TRANSPORT'
  | 'CIPL'
  | 'BC_2_3'
  | 'BC_2_5'
  | 'BC_3_0'
  | 'OTHER'

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
  eventId?: string | null
  exhibitorId?: string | null
  sourceDocumentName?: string | null
  createdAt: string
  updatedAt: string
  assignedTo?: LocalUser | null
  exhibitor?: LocalExhibitor | null
  stages: LocalStage[]
  documents: LocalJobDocument[]
  operational?: JobOperationalDetails
}

export type LocalJobDocument = {
  id: string
  jobId: string
  fileName: string
  mimeType: 'application/pdf'
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
  mimeType: 'application/pdf'
  fileSize: number
  content: Blob
  createdAt: string
}

export type LocalVenue = {
  id: string
  officialName: string
  aliasName: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  contactInfo: string | null
  createdAt: string
  updatedAt: string
}

export type LocalEo = {
  id: string
  legalName: string
  aliasName: string | null
  contactInfo: string | null
  createdAt: string
  updatedAt: string
}

export type LocalEvent = {
  id: string
  officialName: string
  alias: string | null
  startsAt: string
  endsAt: string
  /** Canonical show-period; date-only so calendar dates do not shift by timezone. */
  startsOn: string
  endsOn: string
  createdAt: string
  updatedAt: string
  status: 'ACTIVE' | 'CANCELLED'
  cancellationReason: string | null
  cancelledAt: string | null
  venueId: string
  eoId: string
  venue?: LocalVenue
  eventOrganizer?: LocalEo
}

export type LocalExhibitor = {
  id: string
  eventId: string
  legalName: string
  aliasName: string | null
  type: 'LOCAL' | 'INTERNATIONAL'
  email: string | null
  phone: string | null
  agent?: string | null
  address: string | null
  countryCode: string | null
  createdAt: string
  updatedAt: string
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
type RuntimeCounter = { id: string; value: number }

/**
 * Runtime-only tables. These explicit collections are the storage model to map
 * to real database tables/repositories later.
 */
type RuntimeStore = {
  jobs: LocalJob[]
  stages: LocalStage[]
  users: LocalUser[]
  events: LocalEvent[]
  venues: LocalVenue[]
  eos: LocalEo[]
  exhibitors: LocalExhibitor[]
  jobDocuments: LocalJobDocument[]
  coordinationAgents: CoordinationAgent[]
  cipls: Cipl[]
  ciplVersions: CiplVersion[]
  shipmentsV2: Shipment[]
  customsJobs: CustomsJob[]
  counters: RuntimeCounter[]
  migrationReviewItems: MigrationReviewItem[]
  files: StoredFile[]
  tickets: StoredTicket[]
  preferences: Preference[]
}

const runtimeStore: RuntimeStore = {
  jobs: [],
  stages: [],
  users: [],
  events: [],
  venues: [],
  eos: [],
  exhibitors: [],
  jobDocuments: [],
  coordinationAgents: [],
  cipls: [],
  ciplVersions: [],
  shipmentsV2: [],
  customsJobs: [],
  counters: [],
  migrationReviewItems: [],
  files: [],
  tickets: [],
  preferences: [],
}

function readAll<T>(storeName: StoreName): Promise<T[]> {
  return Promise.resolve([...runtimeStore[storeName]] as T[])
}

function put<T extends StoredRecord>(storeName: StoreName, value: T): Promise<T> {
  const records = runtimeStore[storeName] as StoredRecord[]
  const index = records.findIndex((record) => record.id === value.id)
  if (index === -1) records.push(value)
  else records[index] = value
  return Promise.resolve(value)
}

function remove(storeName: StoreName, recordId: string) {
  const records = runtimeStore[storeName] as StoredRecord[]
  const index = records.findIndex((record) => record.id === recordId)
  if (index !== -1) records.splice(index, 1)
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
    cipl: { status: 'MISSING', referenceNumber: null, receivedAt: null },
    customs: {
      BC_2_3: emptyCustomsDocument(),
      BC_2_5: emptyCustomsDocument(false),
      BC_3_0: emptyCustomsDocument(),
    },
  }
}

function initializeJobForExhibitor(
  exhibitor: LocalExhibitor,
  jobNumber: string,
  timestamp = now(),
): LocalJob {
  return {
    id: id(),
    jobNumber,
    awbNumber: null,
    blNumber: null,
    shipper: exhibitor.legalName,
    consignee: null,
    notifyParty: null,
    agent: exhibitor.agent ?? null,
    shippingLine: null,
    cargoDescription: null,
    shipmentMode: null,
    cargoDetails: null,
    journeyDetails: null,
    type: 'IMPORT',
    clientName: exhibitor.legalName,
    clientInfo: null,
    status: 'DRAFT',
    notes: null,
    trackingToken: id(),
    assignedToId: null,
    eventId: exhibitor.eventId,
    exhibitorId: exhibitor.id,
    sourceDocumentName: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    stages: [],
    documents: [],
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

/** Returns attachment bytes without leaking the active storage implementation to UI code. */
export async function getAttachmentContent(attachmentId: string): Promise<Blob | null> {
  const file = (await readAll<StoredFile>('files')).find((item) => item.id === attachmentId)
  return file?.content ?? null
}

let runtimeInitialized = false

async function ensureDemoEvents() {
  if (runtimeInitialized) return
  runtimeInitialized = true

  const mockData = createMockData()
  await Promise.all([
    ...mockData.users.map((user) => put('users', user)),
    ...mockData.venues.map((venue) => put('venues', venue)),
    ...mockData.eventOrganizers.map((eventOrganizer) => put('eos', eventOrganizer)),
    ...mockData.events.map((eventItem) => put('events', eventItem)),
    ...mockData.exhibitors.map((exhibitor) => put('exhibitors', exhibitor)),
    ...mockData.jobs.map((jobItem) => put('jobs', jobItem)),
    ...mockData.stages.map((stage) => put('stages', stage)),
  ])
  await put('counters', { id: 'mockDataVersion', value: MOCK_DATA_VERSION })
}

async function ensureSeeded() {
  await ensureDemoEvents()
  return readAll<LocalUser>('users')
}

export async function listUsers() {
  await ensureDemoEvents()
  return ensureSeeded()
}

type StoredTicket = Ticket
type Preference = { id: 'activeDemoUserId'; value: string }
export type TicketInput = {
  assigneeId: string
  title: string
  description?: string | null
  context: TicketContext
  priority?: TicketPriority
}

function ticketForStorage(ticket: Ticket): StoredTicket {
  return ticket
}

async function activeTicketUser() {
  const users = await ensureSeeded()
  const preference = (await readAll<Preference>('preferences')).find(
    (item) => item.id === 'activeDemoUserId',
  )
  const user =
    users.find((item) => item.id === preference?.value && item.isActive) ??
    users.find((item) => item.isActive)
  if (!user) throw new Error('User aktif wajib tersedia.')
  return user
}

export async function getActiveDemoUser() {
  return activeTicketUser()
}

export async function setActiveDemoUser(userId: string) {
  const users = await ensureSeeded()
  const user = users.find((item) => item.id === userId && item.isActive)
  if (!user) throw new Error('User demo tidak aktif atau tidak ditemukan.')
  await put('preferences', { id: 'activeDemoUserId', value: user.id })
  return user
}

export async function listMyTickets(): Promise<Ticket[]> {
  const user = await activeTicketUser()
  const tickets = (await readAll<StoredTicket>('tickets')).filter(
    (ticket) => ticket.assigneeId === user.id,
  )
  return tickets.sort((a, b) => a.status.localeCompare(b.status) || a.order - b.order)
}

async function assertTicketOwner(
  ticketId: string,
): Promise<{ ticket: StoredTicket; user: LocalUser }> {
  const [user, tickets] = await Promise.all([activeTicketUser(), readAll<StoredTicket>('tickets')])
  const ticket = tickets.find((item) => item.id === ticketId)
  if (!ticket || ticket.assigneeId !== user.id)
    throw new Error('Ticket tidak tersedia untuk user aktif.')
  return { ticket, user }
}

export async function createTicket(input: TicketInput): Promise<Ticket> {
  const users = await ensureSeeded()
  if (!users.some((user) => user.id === input.assigneeId && user.isActive))
    throw new Error('Assignee wajib aktif dan valid.')
  const eventId = await eventIdForTicketContext(input.context)
  const timestamp = now()
  const current = (await readAll<StoredTicket>('tickets')).filter(
    (ticket) => ticket.eventId === eventId,
  )
  const ticket: Ticket = {
    id: id(),
    ticketNumber: Math.max(0, ...current.map((ticket) => ticket.ticketNumber)) + 1,
    eventId,
    assigneeId: input.assigneeId,
    context: input.context,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    status: 'TODO',
    order:
      Math.max(0, ...current.filter((item) => item.status === 'TODO').map((item) => item.order)) +
      1,
    priority: input.priority ?? 'NORMAL',
    completion: null,
    statusHistory: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  const error = validateTicket(ticket)
  if (error) throw new Error(error)
  return put('tickets', ticketForStorage(ticket))
}

export async function listTicketsForUser(userId: string): Promise<Ticket[]> {
  const users = await ensureSeeded()
  if (!users.some((user) => user.id === userId && user.isActive))
    throw new Error('User tidak aktif atau tidak ditemukan.')
  const tickets = (await readAll<StoredTicket>('tickets')).filter(
    (ticket) => ticket.assigneeId === userId,
  )
  return tickets.sort((a, b) => a.status.localeCompare(b.status) || a.order - b.order)
}

async function assertTicketContext(context: TicketContext) {
  await eventIdForTicketContext(context)
}

async function eventIdForTicketContext(context: TicketContext): Promise<string> {
  if (context.kind === 'EVENT') {
    const event = (await listEvents()).find(
      (item) => item.id === context.id && item.status === 'ACTIVE',
    )
    if (!event) throw new Error('Event harus aktif dan valid.')
    return event.id
  }
  const job = (await listJobs()).find(
    (item) => item.id === context.id && item.status !== 'COMPLETED' && item.status !== 'CANCELLED',
  )
  const event =
    job?.eventId &&
    (await listEvents()).find((item) => item.id === job.eventId && item.status === 'ACTIVE')
  if (!event) throw new Error('Job harus aktif dan terkait Event aktif.')
  return event.id
}

export async function updateTicket(ticketId: string, input: Partial<TicketInput>): Promise<Ticket> {
  const { ticket } = await assertTicketOwner(ticketId)
  const eventId = input.context ? await eventIdForTicketContext(input.context) : ticket.eventId
  const updated: Ticket = {
    ...ticket,
    eventId,
    title: input.title === undefined ? ticket.title : input.title.trim(),
    description:
      input.description === undefined ? ticket.description : input.description?.trim() || null,
    priority: input.priority ?? ticket.priority,
    context: input.context ?? ticket.context,
    updatedAt: now(),
  }
  const error = validateTicket(updated)
  if (error) throw new Error(error)
  return put('tickets', ticketForStorage(updated))
}

export async function moveTicket(
  ticketId: string,
  status: TicketStatus,
  completionNote?: string,
  reopenReason?: string,
): Promise<Ticket> {
  const { ticket } = await assertTicketOwner(ticketId)
  const reason = ticket.status === 'DONE' && status !== 'DONE' ? reopenReason?.trim() || null : null
  const transitionError = validateStatusTransition(
    ticket.status,
    status,
    reason,
    completionNote?.trim() || null,
  )
  if (transitionError) throw new Error(transitionError)
  const timestamp = now()
  const updated: Ticket = {
    ...ticket,
    status,
    completion: status === 'DONE' ? { note: completionNote!.trim(), completedAt: timestamp } : null,
    statusHistory:
      ticket.status === status
        ? ticket.statusHistory
        : [
            ...ticket.statusHistory,
            { from: ticket.status, to: status, reason, changedAt: timestamp },
          ],
    updatedAt: timestamp,
  }
  return put('tickets', ticketForStorage(updated))
}

/** Rewrites all positions as one synchronous runtime operation. */
export async function reorderMyTickets(status: TicketStatus, ticketIds: string[]) {
  const user = await activeTicketUser()
  const tickets = await readAll<StoredTicket>('tickets')
  const owned = tickets.filter((ticket) => ticket.assigneeId === user.id)
  if (
    new Set(ticketIds).size !== ticketIds.length ||
    ticketIds.some((id) => !owned.some((ticket) => ticket.id === id))
  )
    throw new Error('Urutan ticket tidak valid.')
  await Promise.all(
    ticketIds.map((ticketId, index) => {
      const ticket = owned.find((item) => item.id === ticketId)!
      return put(
        'tickets',
        ticketForStorage({ ...ticket, status, order: index + 1, updatedAt: now() }),
      )
    }),
  )
}

/** Moves a ticket and rewrites its destination-column order in one synchronous runtime update. */
export async function moveAndReorderMyTickets(
  ticketId: string,
  status: TicketStatus,
  ticketIds: string[],
  completionNote?: string,
  reopenReason?: string,
) {
  const { ticket, user } = await assertTicketOwner(ticketId)
  if (!ticketIds.includes(ticketId))
    throw new Error('Urutan tujuan harus memuat ticket yang dipindahkan.')
  const reason = ticket.status === 'DONE' && status !== 'DONE' ? reopenReason?.trim() || null : null
  const transitionError = validateStatusTransition(
    ticket.status,
    status,
    reason,
    completionNote?.trim() || null,
  )
  if (transitionError) throw new Error(transitionError)
  const all = await readAll<StoredTicket>('tickets')
  if (
    new Set(ticketIds).size !== ticketIds.length ||
    ticketIds.some(
      (id) =>
        id !== ticketId &&
        !all.some(
          (item) => item.id === id && item.assigneeId === user.id && item.status === status,
        ),
    )
  )
    throw new Error('Urutan ticket tidak valid.')
  const timestamp = now()
  const moved: Ticket = {
    ...ticket,
    status,
    completion: status === 'DONE' ? { note: completionNote!.trim(), completedAt: timestamp } : null,
    statusHistory:
      ticket.status === status
        ? ticket.statusHistory
        : [
            ...ticket.statusHistory,
            { from: ticket.status, to: status, reason, changedAt: timestamp },
          ],
    updatedAt: timestamp,
  }
  await Promise.all(
    ticketIds.map((id, index) => {
      const value = id === ticketId ? moved : all.find((item) => item.id === id)!
      return put(
        'tickets',
        ticketForStorage({ ...value, status, order: index + 1, updatedAt: timestamp }),
      )
    }),
  )
}

export async function listJobs(filters: { search?: string; status?: string } = {}) {
  await ensureDemoEvents()
  const [jobs, stages, users, documents, exhibitors] = await Promise.all([
    readAll<LocalJob>('jobs'),
    readAll<LocalStage>('stages'),
    ensureSeeded(),
    readAll<LocalJobDocument>('jobDocuments'),
    readAll<LocalExhibitor>('exhibitors'),
  ])
  const linkedExhibitorIds = new Set(
    jobs.flatMap((job) => (job.exhibitorId ? [job.exhibitorId] : [])),
  )
  const missingJobs = exhibitors.filter((exhibitor) => !linkedExhibitorIds.has(exhibitor.id))
  if (missingJobs.length) {
    const usedNumbers = new Set(jobs.map((job) => job.jobNumber))
    let sequence = jobs.length + 1
    const nextNumber = () => {
      let value = `VSS-${String(sequence++).padStart(4, '0')}`
      while (usedNumbers.has(value)) value = `VSS-${String(sequence++).padStart(4, '0')}`
      usedNumbers.add(value)
      return value
    }
    await Promise.all(
      missingJobs.map((exhibitor) =>
        put('jobs', initializeJobForExhibitor(exhibitor, nextNumber())),
      ),
    )
    return listJobs(filters)
  }
  const search = filters.search?.toLowerCase() ?? ''
  return jobs
    .filter(
      (job) =>
        (!filters.status || job.status === filters.status) &&
        (!search ||
          [job.jobNumber, job.clientName, job.awbNumber, job.blNumber].some((value) =>
            value?.toLowerCase().includes(search),
          )),
    )
    .map((job) => ({
      ...job,
      operational: getOperationalDetails(job),
      assignedTo: users.find((user) => user.id === job.assignedToId) ?? null,
      exhibitor: exhibitors.find((exhibitor) => exhibitor.id === job.exhibitorId) ?? null,
      stages: stages.filter((stage) => stage.jobId === job.id).sort((a, b) => a.order - b.order),
      documents: documents.filter((document) => document.jobId === job.id),
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getJob(jobId: string) {
  return (await listJobs()).find((job) => job.id === jobId) ?? null
}

export async function listEventJobs(eventId: string) {
  const jobs = await listJobs()
  return jobs.filter((job) => job.eventId === eventId)
}

export async function listEvents() {
  await ensureDemoEvents()
  const [events, venues, eos] = await Promise.all([
    readAll<LocalEvent>('events'),
    readAll<LocalVenue>('venues'),
    readAll<LocalEo>('eos'),
  ])
  return events
    .map((storedEvent) => {
      const startsOn = storedEvent.startsOn ?? toDateOnly(storedEvent.startsAt)
      const endsOn = storedEvent.endsOn ?? toDateOnly(storedEvent.endsAt)
      const event = {
        ...storedEvent,
        startsOn,
        endsOn,
        startsAt: localMidnight(startsOn),
        endsAt: localMidnight(endsOn),
        status: storedEvent.status ?? 'ACTIVE',
        cancellationReason: storedEvent.cancellationReason ?? null,
        cancelledAt: storedEvent.cancelledAt ?? null,
      }
      return {
        ...event,
        venue: venues.find((venue) => venue.id === event.venueId),
        eventOrganizer: eos.find((eo) => eo.id === event.eoId),
      }
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

export async function listVenues() {
  return readAll<LocalVenue>('venues')
}

export async function listEos() {
  return readAll<LocalEo>('eos')
}

export async function listEventExhibitors(eventId: string) {
  const exhibitors = await readAll<LocalExhibitor>('exhibitors')
  return exhibitors.filter((exhibitor) => exhibitor.eventId === eventId)
}

export type EventExhibitorInput = Omit<
  LocalExhibitor,
  'id' | 'eventId' | 'createdAt' | 'updatedAt'
> & { id?: string }

export async function saveEventExhibitors(eventId: string, inputs: EventExhibitorInput[]) {
  const [existing, existingJobs, cipls] = await Promise.all([
    listEventExhibitors(eventId),
    readAll<LocalJob>('jobs'),
    readAll<Cipl>('cipls'),
  ])
  const timestamp = now()
  const existingById = new Map(existing.map((exhibitor) => [exhibitor.id, exhibitor]))
  const jobsByExhibitor = new Map(
    existingJobs.flatMap((job) => (job.exhibitorId ? [[job.exhibitorId, job] as const] : [])),
  )
  const submittedIds = new Set(inputs.flatMap((input) => (input.id ? [input.id] : [])))
  const exhibitors = inputs.map((input) => {
    const previous = input.id ? existingById.get(input.id) : undefined
    if (input.id && !previous) throw new Error('Exhibitor tidak ditemukan dalam event ini.')
    return {
      ...input,
      agent: input.type === 'LOCAL' ? null : (input.agent ?? null),
      id: previous?.id ?? id(),
      eventId,
      createdAt: previous?.createdAt ?? timestamp,
      updatedAt: timestamp,
    }
  })

  const removed = existing.filter((exhibitor) => !submittedIds.has(exhibitor.id))
  if (
    removed.some(
      (exhibitor) =>
        jobsByExhibitor.has(exhibitor.id) ||
        cipls.some((cipl) => cipl.eventExhibitorId === exhibitor.id),
    )
  ) {
    throw new Error(
      'Exhibitor yang sudah memiliki Job atau CIPL tidak dapat dihapus dari form ini.',
    )
  }

  const usedJobNumbers = new Set(existingJobs.map((job) => job.jobNumber))
  let sequence = existingJobs.length + 1
  const nextJobNumber = () => {
    let value = `VSS-${String(sequence++).padStart(4, '0')}`
    while (usedJobNumbers.has(value)) value = `VSS-${String(sequence++).padStart(4, '0')}`
    usedJobNumbers.add(value)
    return value
  }

  removed.forEach((exhibitor) => remove('exhibitors', exhibitor.id))
  await Promise.all(
    exhibitors.flatMap((exhibitor) => {
      const existingJob = jobsByExhibitor.get(exhibitor.id)
      const job = existingJob
        ? {
            ...existingJob,
            eventId,
            exhibitorId: exhibitor.id,
            clientName: exhibitor.legalName,
            shipper: exhibitor.legalName,
            agent: exhibitor.agent ?? null,
            updatedAt: timestamp,
          }
        : initializeJobForExhibitor(exhibitor, nextJobNumber(), timestamp)
      return [put('exhibitors', exhibitor), put('jobs', job)]
    }),
  )
  return exhibitors
}

export type EventInput = Pick<LocalEvent, 'officialName' | 'alias' | 'startsOn' | 'endsOn'> & {
  venue: Omit<LocalVenue, 'id' | 'createdAt' | 'updatedAt'>
  venueId?: string
  eventOrganizer: Omit<LocalEo, 'id' | 'createdAt' | 'updatedAt'>
  eoId?: string
}

export async function saveEvent(input: EventInput, existingId?: string) {
  const [previous, venues, eos] = await Promise.all([
    existingId
      ? readAll<LocalEvent>('events').then((events) =>
          events.find((event) => event.id === existingId),
        )
      : Promise.resolve(null),
    readAll<LocalVenue>('venues'),
    readAll<LocalEo>('eos'),
  ])
  const timestamp = now()
  const selectedVenue = input.venueId ? venues.find((venue) => venue.id === input.venueId) : null
  const selectedEo = input.eoId ? eos.find((eo) => eo.id === input.eoId) : null
  const venue: LocalVenue = selectedVenue ?? {
    ...input.venue,
    id: id(),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  const eventOrganizer: LocalEo = selectedEo ?? {
    ...input.eventOrganizer,
    id: id(),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  const event: LocalEvent = {
    id: existingId ?? id(),
    officialName: input.officialName,
    alias: input.alias,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    startsAt: localMidnight(input.startsOn),
    endsAt: localMidnight(input.endsOn),
    venueId: venue.id,
    eoId: eventOrganizer.id,
    createdAt: previous?.createdAt ?? timestamp,
    updatedAt: timestamp,
    status: previous?.status ?? 'ACTIVE',
    cancellationReason: previous?.cancellationReason ?? null,
    cancelledAt: previous?.cancelledAt ?? null,
  }
  await Promise.all([put('venues', venue), put('eos', eventOrganizer), put('events', event)])
  return event
}

export async function cancelEvent(eventId: string, reason: string) {
  const cancellationReason = reason.trim()
  if (!cancellationReason) throw new Error('Alasan pembatalan wajib diisi.')

  const event = (await readAll<LocalEvent>('events')).find((item) => item.id === eventId)
  if (!event) throw new Error('Event tidak ditemukan.')
  const timestamp = now()
  return put('events', {
    ...event,
    status: 'CANCELLED' as const,
    cancellationReason,
    cancelledAt: timestamp,
    updatedAt: timestamp,
  })
}

export async function deleteEvent(eventId: string) {
  const [exhibitors, cipls, shipments, customsJobs, legacyJobs] = await Promise.all([
    listEventExhibitors(eventId),
    readAll<Cipl>('cipls'),
    readAll<Shipment>('shipmentsV2'),
    readAll<CustomsJob>('customsJobs'),
    readAll<LocalJob>('jobs'),
  ])
  const eventExhibitorIds = new Set(exhibitors.map((exhibitor) => exhibitor.id))
  const ciplIds = new Set(
    cipls.filter((cipl) => eventExhibitorIds.has(cipl.eventExhibitorId)).map((cipl) => cipl.id),
  )
  const shipmentIds = new Set(
    shipments.filter((shipment) => ciplIds.has(shipment.ciplId)).map((shipment) => shipment.id),
  )
  if (
    exhibitors.length ||
    ciplIds.size ||
    shipmentIds.size ||
    customsJobs.some((job) => shipmentIds.has(job.shipmentId)) ||
    legacyJobs.some((job) => job.eventId === eventId)
  ) {
    throw new Error('Event tidak dapat dihapus karena masih mempunyai data turunan.')
  }
  remove('events', eventId)
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

export async function saveJobDocument(
  jobId: string,
  file: File,
  kind: JobDocumentKind = 'SOURCE',
): Promise<LocalJobDocument> {
  const timestamp = now()
  const document: LocalJobDocument = {
    id: id(),
    jobId,
    fileName: file.name,
    mimeType: 'application/pdf',
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
  await Promise.all([put('jobDocuments', document), put('files', storedFile)])
  return document
}

export type JobOperationalAttachment = { kind: JobDocumentKind; file: File }

/** Saves Job details and newly attached PDFs in one synchronous runtime update. */
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
  const job: LocalJob = {
    ...previous,
    id: existingId ?? id(),
    jobNumber:
      previous?.jobNumber ??
      `VSS-${String((await readAll<LocalJob>('jobs')).length + 1).padStart(4, '0')}`,
    trackingToken: previous?.trackingToken ?? id(),
    createdAt: previous?.createdAt ?? timestamp,
    updatedAt: timestamp,
    stages: previous?.stages ?? [],
    documents: previous?.documents ?? [],
    ...input,
  }
  return put('jobs', job)
}

/** Metadata Job dan PDF sumber diperbarui bersama di runtime store. */
export async function saveJobWithDocument(input: JobInput, file: File, existingId?: string) {
  const previous = existingId ? await getJob(existingId) : null
  const timestamp = now()
  const job: LocalJob = {
    ...previous,
    id: existingId ?? id(),
    jobNumber:
      previous?.jobNumber ??
      `VSS-${String((await readAll<LocalJob>('jobs')).length + 1).padStart(4, '0')}`,
    trackingToken: previous?.trackingToken ?? id(),
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

/** The counter and CustomsJob are updated together in the single-threaded runtime store. */
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
