'use client'

import type {
  Attachment,
  Cipl,
  CiplItem,
  CiplStatus,
  CiplVersion,
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

const databaseName = 'vss-project-management'
const databaseVersion = 7

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion)
    request.onupgradeneeded = (upgradeEvent) => {
      const database = request.result
      const upgradeTransaction = request.transaction!
      for (const store of [
        'jobs',
        'stages',
        'users',
        'events',
        'venues',
        'eos',
        'exhibitors',
        'jobDocuments',
        'coordinationAgents',
        'cipls',
        'ciplVersions',
        'shipmentsV2',
        'customsJobs',
        'counters',
        'migrationReviewItems',
        'files',
      ] as StoreName[]) {
        if (!database.objectStoreNames.contains(store))
          database.createObjectStore(store, { keyPath: 'id' })
      }
      createIndex(upgradeTransaction, 'coordinationAgents', 'eventExhibitorId')
      createIndex(upgradeTransaction, 'coordinationAgents', 'status')
      createIndex(upgradeTransaction, 'cipls', 'eventExhibitorId')
      createIndex(upgradeTransaction, 'cipls', 'status')
      createIndex(upgradeTransaction, 'cipls', 'activeVersionId')
      createIndex(upgradeTransaction, 'ciplVersions', 'ciplId')
      createIndex(upgradeTransaction, 'shipmentsV2', 'ciplId')
      createIndex(upgradeTransaction, 'shipmentsV2', 'sourceCiplVersionId')
      createIndex(upgradeTransaction, 'shipmentsV2', 'documentNumber')
      createIndex(upgradeTransaction, 'shipmentsV2', 'status')
      createIndex(upgradeTransaction, 'customsJobs', 'shipmentId')
      createIndex(upgradeTransaction, 'customsJobs', 'jobNumber')
      createIndex(upgradeTransaction, 'customsJobs', 'documentType')
      createIndex(upgradeTransaction, 'customsJobs', 'status')
      createIndex(upgradeTransaction, 'migrationReviewItems', 'legacyStore')
      createIndex(upgradeTransaction, 'migrationReviewItems', 'legacyId')
      createIndex(upgradeTransaction, 'migrationReviewItems', 'status')
      createIndex(upgradeTransaction, 'files', 'ownerType')
      createIndex(upgradeTransaction, 'files', 'ownerId')
      if (upgradeEvent.oldVersion < 7) {
        const events = upgradeTransaction.objectStore('events')
        events.openCursor().onsuccess = (cursorEvent) => {
          const cursor = (cursorEvent.target as IDBRequest<IDBCursorWithValue | null>).result
          if (!cursor) return
          const event = cursor.value as Partial<LocalEvent>
          cursor.update({
            ...event,
            status: event.status ?? 'ACTIVE',
            cancellationReason: event.cancellationReason ?? null,
            cancelledAt: event.cancelledAt ?? null,
          })
          cursor.continue()
        }
      }
    }
    request.onsuccess = async () => {
      try {
        await migrateLegacyRecords(request.result)
        await migrateAttachmentRecords(request.result)
        resolve(request.result)
      } catch (error) {
        reject(error)
      }
    }
    request.onerror = () => reject(request.error)
  })
}

function createIndex(transaction: IDBTransaction, storeName: StoreName, indexName: string) {
  const store = transaction.objectStore(storeName)
  if (!store.indexNames.contains(indexName)) store.createIndex(indexName, indexName)
}

async function readAll<T>(storeName: StoreName): Promise<T[]> {
  const database = await openDatabase()
  return readAllFromDatabase<T>(database, storeName)
}

function readAllFromDatabase<T>(database: IDBDatabase, storeName: StoreName): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, 'readonly').objectStore(storeName).getAll()
    request.onsuccess = () => resolve(request.result as T[])
    request.onerror = () => reject(request.error)
  })
}

async function put<T extends { id: string }>(storeName: StoreName, value: T): Promise<T> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, 'readwrite').objectStore(storeName).put(value)
    request.onsuccess = () => resolve(value)
    request.onerror = () => reject(request.error)
  })
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

function requestValue<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
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

type LegacyAttachment = Attachment & { file?: Blob }
type LegacyJobDocument = Omit<LocalJobDocument, 'attachmentId'> & {
  file?: Blob
  attachmentId?: string
}

/**
 * Moves file bytes out of aggregate records after the v5 -> v6 schema upgrade.
 * The writes share one transaction and use stable attachment IDs, so retrying is safe.
 */
async function migrateAttachmentRecords(database: IDBDatabase) {
  const [versions, shipments, customsJobs, documents] = await Promise.all([
    readAllFromDatabase<CiplVersion>(database, 'ciplVersions'),
    readAllFromDatabase<Shipment>(database, 'shipmentsV2'),
    readAllFromDatabase<CustomsJob>(database, 'customsJobs'),
    readAllFromDatabase<LegacyJobDocument>(database, 'jobDocuments'),
  ])
  const versionUpdates: CiplVersion[] = []
  const shipmentUpdates: Shipment[] = []
  const jobUpdates: CustomsJob[] = []
  const documentUpdates: LocalJobDocument[] = []
  const files: StoredFile[] = []
  const collect = (
    attachment: LegacyAttachment | null,
    ownerType: StoredFile['ownerType'],
    ownerId: string,
    kind: string | null,
  ) => {
    if (!attachment || !(attachment.file instanceof Blob)) return attachment
    const { file, ...metadata } = attachment
    files.push({ ...metadata, content: file, ownerType, ownerId, kind })
    return metadata
  }

  versions.forEach((version) => {
    const sourceDocument = collect(
      version.sourceDocument as LegacyAttachment | null,
      'CIPL_VERSION',
      version.id,
      'SOURCE',
    )
    if (sourceDocument !== version.sourceDocument)
      versionUpdates.push({ ...version, sourceDocument })
  })
  shipments.forEach((shipment) => {
    const attachment = collect(
      shipment.attachment as LegacyAttachment | null,
      'SHIPMENT',
      shipment.id,
      'TRANSPORT',
    )
    if (attachment !== shipment.attachment) shipmentUpdates.push({ ...shipment, attachment })
  })
  customsJobs.forEach((job) => {
    const attachments = job.attachments.map(
      (attachment) =>
        collect(attachment as LegacyAttachment, 'CUSTOMS_JOB', job.id, 'EVIDENCE') as Attachment,
    )
    if (attachments.some((attachment, index) => attachment !== job.attachments[index]))
      jobUpdates.push({ ...job, attachments })
  })
  documents.forEach((document) => {
    if (!(document.file instanceof Blob)) return
    const { file, ...metadata } = document
    files.push({
      id: document.attachmentId ?? document.id,
      ownerType: 'LEGACY_JOB',
      ownerId: document.jobId,
      kind: document.kind ?? 'SOURCE',
      fileName: document.fileName,
      mimeType: document.mimeType,
      fileSize: document.fileSize,
      content: file,
      createdAt: document.createdAt,
    })
    documentUpdates.push({ ...metadata, attachmentId: document.attachmentId ?? document.id })
  })
  if (!files.length) return

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(
      ['files', 'ciplVersions', 'shipmentsV2', 'customsJobs', 'jobDocuments'],
      'readwrite',
    )
    files.forEach((file) => transaction.objectStore('files').put(file))
    versionUpdates.forEach((version) => transaction.objectStore('ciplVersions').put(version))
    shipmentUpdates.forEach((shipment) => transaction.objectStore('shipmentsV2').put(shipment))
    jobUpdates.forEach((job) => transaction.objectStore('customsJobs').put(job))
    documentUpdates.forEach((document) => transaction.objectStore('jobDocuments').put(document))
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

/** Returns attachment bytes without leaking the active storage implementation to UI code. */
export async function getAttachmentContent(attachmentId: string): Promise<Blob | null> {
  const database = await openDatabase()
  const file = (await requestValue(
    database.transaction('files', 'readonly').objectStore('files').get(attachmentId),
  )) as StoredFile | undefined
  return file?.content ?? null
}

/**
 * Legacy jobs deliberately never become CustomsJob: their BC document type is unknown.
 * A marker uses the legacy id, making migration safe to retry after an interrupted upgrade.
 */
async function migrateLegacyRecords(database: IDBDatabase) {
  if (!database.objectStoreNames.contains('jobs')) return
  const readTransaction = database.transaction('jobs', 'readonly')
  const jobs = (await requestValue(readTransaction.objectStore('jobs').getAll())) as LocalJob[]
  await Promise.all(jobs.map((legacyJob) => migrateLegacyJob(database, legacyJob)))
}

async function migrateLegacyJob(database: IDBDatabase, legacyJob: LocalJob) {
  const markerId = `jobs:${legacyJob.id}`
  const transaction = database.transaction(
    ['events', 'exhibitors', 'cipls', 'shipmentsV2', 'migrationReviewItems'],
    'readwrite',
  )
  const markers = transaction.objectStore('migrationReviewItems')
  if (await requestValue(markers.get(markerId))) return

  const timestamp = now()
  const review = (reason: string, relatedIds: string[] = []) => {
    const item: MigrationReviewItem = {
      id: markerId,
      legacyStore: 'jobs',
      legacyId: legacyJob.id,
      status: 'REVIEW_REQUIRED',
      reason,
      relatedIds,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    markers.put(item)
  }
  if (!legacyJob.eventId || !legacyJob.exhibitorId) {
    review(
      'Parent event atau exhibitor tidak tersedia; pilih relasi yang benar sebelum migrasi.',
      [],
    )
    return transactionDone(transaction)
  }
  const [event, exhibitor] = await Promise.all([
    requestValue(transaction.objectStore('events').get(legacyJob.eventId)),
    requestValue(transaction.objectStore('exhibitors').get(legacyJob.exhibitorId)),
  ])
  if (!event || !exhibitor || exhibitor.eventId !== legacyJob.eventId) {
    review('Relasi parent legacy tidak lagi valid; tidak dibuat event atau exhibitor fiktif.', [])
    return transactionDone(transaction)
  }
  if (!legacyJob.blNumber && !legacyJob.awbNumber) {
    review('Nomor B/L atau AWB tidak tersedia; shipment operasional tidak dapat dibentuk.', [])
    return transactionDone(transaction)
  }
  const ciplId = `legacy-cipl:${legacyJob.id}`
  const cipl: Cipl = {
    id: ciplId,
    eventExhibitorId: legacyJob.exhibitorId,
    referenceNumber: null,
    status: 'AWAITING_DOCUMENT',
    activeVersionId: null,
    sourceDocumentUnavailable: true,
    createdAt: legacyJob.createdAt,
    updatedAt: timestamp,
  }
  transaction.objectStore('cipls').put(cipl)
  const createShipment = (documentType: Shipment['documentType'], documentNumber: string) => {
    const shipment: Shipment = {
      id: `legacy-shipment:${legacyJob.id}:${documentType}`,
      ciplId,
      sourceCiplVersionId: '',
      documentType,
      documentNumber,
      shipmentMode: documentType === 'BL' ? legacyJob.shipmentMode : null,
      direction: legacyJob.type,
      shipper: legacyJob.shipper,
      consignee: legacyJob.consignee,
      notifyParty: legacyJob.notifyParty,
      carrier: legacyJob.shippingLine,
      etaOrEtd: null,
      origin: null,
      destination: null,
      allocations: [],
      attachment: null,
      status: 'DOCUMENT_RECEIVED',
      legacyReference: legacyJob.jobNumber,
      createdAt: legacyJob.createdAt,
      updatedAt: timestamp,
    }
    transaction.objectStore('shipmentsV2').put(shipment)
    return shipment.id
  }
  const shipmentIds = [
    ...(legacyJob.blNumber ? [createShipment('BL', legacyJob.blNumber)] : []),
    ...(legacyJob.awbNumber ? [createShipment('AWB', legacyJob.awbNumber)] : []),
  ]
  const item: MigrationReviewItem = {
    id: markerId,
    legacyStore: 'jobs',
    legacyId: legacyJob.id,
    status: legacyJob.blNumber && legacyJob.awbNumber ? 'REVIEW_REQUIRED' : 'MIGRATED',
    reason:
      legacyJob.blNumber && legacyJob.awbNumber
        ? 'B/L dan AWB dipisahkan menjadi dua shipment; alokasi dan attachment perlu direkonsiliasi.'
        : 'Legacy shipment berhasil dipetakan; jenis BC belum ditentukan sehingga CustomsJob tidak dibuat.',
    relatedIds: [ciplId, ...shipmentIds],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  markers.put(item)
  return transactionDone(transaction)
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

async function ensureSeeded() {
  const users = await readAll<LocalUser>('users')
  if (users.length) return users
  const seeded: LocalUser[] = [
    {
      id: 'local-user',
      name: 'Operator Lokal',
      email: 'operator@vss.local',
      role: 'SUPERVISOR',
      isActive: true,
    },
  ]
  await Promise.all(seeded.map((user) => put('users', user)))
  return seeded
}

async function ensureDemoEvents() {
  const seedMarkers = await readAll<{ id: string; value: number }>('counters')
  const marker = seedMarkers.find((item) => item.id === 'mockDataVersion')
  if (marker && marker.value >= MOCK_DATA_VERSION) return

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

export async function listUsers() {
  return ensureSeeded()
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
  const database = await openDatabase()
  const [existing, existingJobs] = await Promise.all([
    listEventExhibitors(eventId),
    readAll<LocalJob>('jobs'),
  ])
  const timestamp = now()

  return new Promise<LocalExhibitor[]>((resolve, reject) => {
    const transaction = database.transaction(['exhibitors', 'cipls', 'jobs'], 'readwrite')
    const store = transaction.objectStore('exhibitors')
    const jobStore = transaction.objectStore('jobs')
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
    const ciplStore = transaction.objectStore('cipls')
    existing
      .filter((exhibitor) => !submittedIds.has(exhibitor.id))
      .forEach((exhibitor) => {
        if (jobsByExhibitor.has(exhibitor.id)) {
          transaction.abort()
          return
        }
        const request = ciplStore.index('eventExhibitorId').count(exhibitor.id)
        request.onsuccess = () => {
          if (request.result > 0) transaction.abort()
          else store.delete(exhibitor.id)
        }
      })
    const usedJobNumbers = new Set(existingJobs.map((job) => job.jobNumber))
    let sequence = existingJobs.length + 1
    const nextJobNumber = () => {
      let value = `VSS-${String(sequence++).padStart(4, '0')}`
      while (usedJobNumbers.has(value)) value = `VSS-${String(sequence++).padStart(4, '0')}`
      usedJobNumbers.add(value)
      return value
    }
    exhibitors.forEach((exhibitor) => {
      store.put(exhibitor)
      const existingJob = jobsByExhibitor.get(exhibitor.id)
      if (existingJob) {
        jobStore.put({
          ...existingJob,
          eventId,
          exhibitorId: exhibitor.id,
          clientName: exhibitor.legalName,
          shipper: exhibitor.legalName,
          agent: exhibitor.agent ?? null,
          updatedAt: timestamp,
        })
        return
      }
      const job = initializeJobForExhibitor(exhibitor, nextJobNumber(), timestamp)
      jobStore.put(job)
    })
    transaction.oncomplete = () => resolve(exhibitors)
    transaction.onerror = () => reject(transaction.error ?? new Error('Gagal menyimpan exhibitor.'))
    transaction.onabort = () =>
      reject(
        new Error('Exhibitor yang sudah memiliki Job atau CIPL tidak dapat dihapus dari form ini.'),
      )
  })
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

  const database = await openDatabase()
  return new Promise<LocalEvent>((resolve, reject) => {
    const transaction = database.transaction('events', 'readwrite')
    const store = transaction.objectStore('events')
    const request = store.get(eventId)
    request.onsuccess = () => {
      const event = request.result as LocalEvent | undefined
      if (!event) {
        transaction.abort()
        return
      }
      const updated = {
        ...event,
        status: 'CANCELLED' as const,
        cancellationReason,
        cancelledAt: now(),
        updatedAt: now(),
      }
      store.put(updated)
      resolve(updated)
    }
    request.onerror = () => reject(request.error)
    transaction.onerror = () => reject(transaction.error ?? new Error('Gagal membatalkan event.'))
    transaction.onabort = () => reject(new Error('Event tidak ditemukan.'))
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
  const database = await openDatabase()
  return new Promise<void>((resolve, reject) => {
    const request = database
      .transaction('events', 'readwrite')
      .objectStore('events')
      .delete(eventId)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
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
  const database = await openDatabase()
  return new Promise<LocalJobDocument>((resolve, reject) => {
    const transaction = database.transaction(['jobDocuments', 'files'], 'readwrite')
    transaction.objectStore('jobDocuments').put(document)
    transaction.objectStore('files').put(storedFile)
    transaction.oncomplete = () => resolve(document)
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

export type JobOperationalAttachment = { kind: JobDocumentKind; file: File }

/** Saves Job details and newly attached PDFs as one IndexedDB transaction. */
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
  const database = await openDatabase()
  return new Promise<LocalJob>((resolve, reject) => {
    const transaction = database.transaction(['jobs', 'jobDocuments', 'files'], 'readwrite')
    transaction.objectStore('jobs').put(job)
    documents.forEach((document) => transaction.objectStore('jobDocuments').put(document))
    documents.forEach((document, index) =>
      transaction.objectStore('files').put({
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
    )
    transaction.oncomplete = () => resolve(job)
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
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

/** Metadata Job dan PDF sumber adalah satu aksi pengguna; kegagalan Blob membatalkan keduanya. */
export async function saveJobWithDocument(input: JobInput, file: File, existingId?: string) {
  const previous = existingId ? await getJob(existingId) : null
  const database = await openDatabase()
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
  return new Promise<LocalJob>((resolve, reject) => {
    const transaction = database.transaction(['jobs', 'jobDocuments', 'files'], 'readwrite')
    transaction.objectStore('jobs').put(job)
    transaction.objectStore('jobDocuments').put(document)
    transaction.objectStore('files').put({
      id: document.attachmentId,
      ownerType: 'LEGACY_JOB',
      ownerId: job.id,
      kind: 'SOURCE',
      fileName: document.fileName,
      mimeType: document.mimeType,
      fileSize: document.fileSize,
      content: file,
      createdAt: timestamp,
    } satisfies StoredFile)
    transaction.oncomplete = () => resolve(job)
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
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
  const database = await openDatabase()
  return new Promise<Cipl>((resolve, reject) => {
    const transaction = database.transaction(['cipls', 'ciplVersions', 'files'], 'readwrite')
    transaction.objectStore('cipls').put(cipl)
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
      transaction.objectStore('cipls').put(cipl)
      transaction.objectStore('ciplVersions').put(version)
      if (initialVersion.sourceDocument)
        transaction
          .objectStore('files')
          .put(toStoredFile(initialVersion.sourceDocument, 'CIPL_VERSION', version.id, 'SOURCE'))
    }
    transaction.oncomplete = () => resolve(cipl)
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
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
  const database = await openDatabase()
  return new Promise<CiplVersion>((resolve, reject) => {
    const transaction = database.transaction(['ciplVersions', 'files'], 'readwrite')
    transaction.objectStore('ciplVersions').put(version)
    if (input.sourceDocument)
      transaction
        .objectStore('files')
        .put(toStoredFile(input.sourceDocument, 'CIPL_VERSION', version.id, 'SOURCE'))
    transaction.oncomplete = () => resolve(version)
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
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

/** The counter and CustomsJob live in one transaction, so issued numbers are never reused. */
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
  const database = await openDatabase()
  const timestamp = now()
  return new Promise<CustomsJob>((resolve, reject) => {
    const transaction = database.transaction(['customsJobs', 'counters'], 'readwrite')
    const counterStore = transaction.objectStore('counters')
    const counterRequest = counterStore.get('customsJobNumber')
    counterRequest.onsuccess = () => {
      const counter = (counterRequest.result as { id: string; value: number } | undefined) ?? {
        id: 'customsJobNumber',
        value: 0,
      }
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
      counterStore.put({ ...counter, value: next })
      transaction.objectStore('customsJobs').put(job)
      transaction.oncomplete = () => resolve(job)
    }
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
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
