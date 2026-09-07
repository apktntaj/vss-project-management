'use client'

import type {
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
import { validateCiplVersionReady, validateJobAllocation, validateJobTransition, validateShipmentAllocation } from '@/domain/exhibition/validation'

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
  stages: LocalStage[]
  documents: LocalJobDocument[]
}

export type LocalJobDocument = {
  id: string
  jobId: string
  fileName: string
  mimeType: 'application/pdf'
  fileSize: number
  file: Blob
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
  createdAt: string
  updatedAt: string
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
  address: string | null
  countryCode: string | null
  createdAt: string
  updatedAt: string
}

type StoreName =
  | 'jobs' | 'stages' | 'users' | 'events' | 'venues' | 'eos' | 'exhibitors' | 'jobDocuments'
  | 'coordinationAgents' | 'cipls' | 'ciplVersions' | 'shipmentsV2' | 'customsJobs' | 'counters' | 'migrationReviewItems'

const databaseName = 'vss-project-management'
const databaseVersion = 5

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion)
    request.onupgradeneeded = () => {
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
    }
    request.onsuccess = async () => {
      try {
        await migrateLegacyRecords(request.result)
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

function id() {
  return crypto.randomUUID()
}

function requestValue<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Legacy jobs deliberately never become CustomsJob: their BC document type is unknown.
 * A marker uses the legacy id, making migration safe to retry after an interrupted upgrade.
 */
async function migrateLegacyRecords(database: IDBDatabase) {
  if (!database.objectStoreNames.contains('jobs')) return
  const readTransaction = database.transaction('jobs', 'readonly')
  const jobs = await requestValue(readTransaction.objectStore('jobs').getAll()) as LocalJob[]
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
    const item: MigrationReviewItem = { id: markerId, legacyStore: 'jobs', legacyId: legacyJob.id, status: 'REVIEW_REQUIRED', reason, relatedIds, createdAt: timestamp, updatedAt: timestamp }
    markers.put(item)
  }
  if (!legacyJob.eventId || !legacyJob.exhibitorId) {
    review('Parent event atau exhibitor tidak tersedia; pilih relasi yang benar sebelum migrasi.', [])
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
    id: ciplId, eventExhibitorId: legacyJob.exhibitorId, referenceNumber: null, status: 'AWAITING_DOCUMENT', activeVersionId: null,
    sourceDocumentUnavailable: true, createdAt: legacyJob.createdAt, updatedAt: timestamp,
  }
  transaction.objectStore('cipls').put(cipl)
  const createShipment = (documentType: Shipment['documentType'], documentNumber: string) => {
    const shipment: Shipment = {
      id: `legacy-shipment:${legacyJob.id}:${documentType}`, ciplId, sourceCiplVersionId: '', documentType, documentNumber,
      shipmentMode: documentType === 'BL' ? legacyJob.shipmentMode : null, direction: legacyJob.type, shipper: legacyJob.shipper,
      consignee: legacyJob.consignee, notifyParty: legacyJob.notifyParty, carrier: legacyJob.shippingLine, etaOrEtd: null,
      origin: null, destination: null, allocations: [], attachment: null,
      status: 'DOCUMENT_RECEIVED', legacyReference: legacyJob.jobNumber, createdAt: legacyJob.createdAt, updatedAt: timestamp,
    }
    transaction.objectStore('shipmentsV2').put(shipment)
    return shipment.id
  }
  const shipmentIds = [
    ...(legacyJob.blNumber ? [createShipment('BL', legacyJob.blNumber)] : []),
    ...(legacyJob.awbNumber ? [createShipment('AWB', legacyJob.awbNumber)] : []),
  ]
  const item: MigrationReviewItem = {
    id: markerId, legacyStore: 'jobs', legacyId: legacyJob.id, status: legacyJob.blNumber && legacyJob.awbNumber ? 'REVIEW_REQUIRED' : 'MIGRATED',
    reason: legacyJob.blNumber && legacyJob.awbNumber ? 'B/L dan AWB dipisahkan menjadi dua shipment; alokasi dan attachment perlu direkonsiliasi.' : 'Legacy shipment berhasil dipetakan; jenis BC belum ditentukan sehingga CustomsJob tidak dibuat.',
    relatedIds: [ciplId, ...shipmentIds], createdAt: timestamp, updatedAt: timestamp,
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
  const events = await readAll<LocalEvent>('events')
  if (events.length) return

  const timestamp = now()
  const venueJakarta: LocalVenue = {
    id: 'demo-venue-jakarta',
    officialName: 'JAKARTA INTERNATIONAL EXPO',
    aliasName: 'JIEXPO',
    address: 'Kemayoran, Jakarta',
    latitude: null,
    longitude: null,
    contactInfo: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  const venueBali: LocalVenue = {
    id: 'demo-venue-bali',
    officialName: 'BALI INTERNATIONAL CONVENTION CENTRE',
    aliasName: 'BICC',
    address: 'Nusa Dua, Bali',
    latitude: null,
    longitude: null,
    contactInfo: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  const eoJakarta: LocalEo = {
    id: 'demo-eo-jakarta',
    legalName: 'NUSANTARA EVENT ORGANIZER',
    aliasName: 'NEO',
    contactInfo: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  const eoBali: LocalEo = {
    id: 'demo-eo-bali',
    legalName: 'ARCHIPELAGO EXHIBITION',
    aliasName: 'AE',
    contactInfo: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  const eventsToSeed: LocalEvent[] = [
    {
      id: 'demo-event-tech-expo',
      officialName: 'INDONESIA TECH EXPO 2026',
      alias: 'ITE 2026',
      startsAt: '2026-09-08T00:00:00.000Z',
      endsAt: '2026-09-12T23:59:59.000Z',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: timestamp,
      venueId: venueJakarta.id,
      eoId: eoJakarta.id,
    },
    {
      id: 'demo-event-retail-summit',
      officialName: 'INDONESIA RETAIL SUMMIT 2026',
      alias: 'IRS 2026',
      startsAt: '2026-09-10T00:00:00.000Z',
      endsAt: '2026-09-14T23:59:59.000Z',
      createdAt: '2026-08-15T00:00:00.000Z',
      updatedAt: timestamp,
      venueId: venueJakarta.id,
      eoId: eoJakarta.id,
    },
    {
      id: 'demo-event-mice-forum',
      officialName: 'BALI MICE FORUM 2026',
      alias: 'BMF 2026',
      startsAt: '2026-08-20T00:00:00.000Z',
      endsAt: '2026-08-22T23:59:59.000Z',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: timestamp,
      venueId: venueBali.id,
      eoId: eoBali.id,
    },
  ]
  const jobDefaults = {
    awbNumber: null,
    blNumber: null,
    shipper: null,
    consignee: null,
    notifyParty: null,
    agent: null,
    shippingLine: null,
    cargoDescription: 'Exhibition equipment',
    shipmentMode: 'LCL' as const,
    cargoDetails: null,
    journeyDetails: null,
    type: 'IMPORT' as const,
    clientInfo: null,
    status: 'DRAFT' as const,
    notes: null,
    assignedToId: null,
    exhibitorId: null,
    sourceDocumentName: null,
    stages: [],
    documents: [],
  }
  const jobsToSeed: LocalJob[] = [
    {
      ...jobDefaults,
      id: 'demo-job-tech-1',
      jobNumber: 'DEMO-0001',
      trackingToken: 'demo-token-tech-1',
      clientName: 'PT DIGITAL NUSANTARA',
      eventId: 'demo-event-tech-expo',
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: timestamp,
    },
    {
      ...jobDefaults,
      id: 'demo-job-tech-2',
      jobNumber: 'DEMO-0002',
      trackingToken: 'demo-token-tech-2',
      clientName: 'GLOBAL ROBOTICS LTD',
      eventId: 'demo-event-tech-expo',
      createdAt: '2026-08-12T00:00:00.000Z',
      updatedAt: timestamp,
    },
    {
      ...jobDefaults,
      id: 'demo-job-retail-1',
      jobNumber: 'DEMO-0003',
      trackingToken: 'demo-token-retail-1',
      clientName: 'PT RETAIL MAJU',
      eventId: 'demo-event-retail-summit',
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: timestamp,
    },
    {
      ...jobDefaults,
      id: 'demo-job-bali-1',
      jobNumber: 'DEMO-0004',
      trackingToken: 'demo-token-bali-1',
      clientName: 'PACIFIC MICE GROUP',
      eventId: 'demo-event-mice-forum',
      createdAt: '2026-07-15T00:00:00.000Z',
      updatedAt: timestamp,
    },
    {
      ...jobDefaults,
      id: 'demo-job-bali-2',
      jobNumber: 'DEMO-0005',
      trackingToken: 'demo-token-bali-2',
      clientName: 'PT EVENT INTERNASIONAL',
      eventId: 'demo-event-mice-forum',
      createdAt: '2026-07-20T00:00:00.000Z',
      updatedAt: timestamp,
    },
    {
      ...jobDefaults,
      id: 'demo-job-bali-3',
      jobNumber: 'DEMO-0006',
      trackingToken: 'demo-token-bali-3',
      clientName: 'ASIA CONGRESS NETWORK',
      eventId: 'demo-event-mice-forum',
      createdAt: '2026-07-25T00:00:00.000Z',
      updatedAt: timestamp,
    },
  ]
  await Promise.all([
    put('venues', venueJakarta),
    put('venues', venueBali),
    put('eos', eoJakarta),
    put('eos', eoBali),
    ...eventsToSeed.map((event) => put('events', event)),
    ...jobsToSeed.map((job) => put('jobs', job)),
  ])
}

export async function listUsers() {
  return ensureSeeded()
}

export async function listJobs(filters: { search?: string; status?: string } = {}) {
  await ensureDemoEvents()
  const [jobs, stages, users, documents] = await Promise.all([
    readAll<LocalJob>('jobs'),
    readAll<LocalStage>('stages'),
    ensureSeeded(),
    readAll<LocalJobDocument>('jobDocuments'),
  ])
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
      assignedTo: users.find((user) => user.id === job.assignedToId) ?? null,
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
    .map((event) => ({
      ...event,
      venue: venues.find((venue) => venue.id === event.venueId),
      eventOrganizer: eos.find((eo) => eo.id === event.eoId),
    }))
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

export type EventExhibitorInput = Omit<LocalExhibitor, 'id' | 'eventId' | 'createdAt' | 'updatedAt'> & { id?: string }

export async function saveEventExhibitors(eventId: string, inputs: EventExhibitorInput[]) {
  const database = await openDatabase()
  const existing = await listEventExhibitors(eventId)
  const timestamp = now()

  return new Promise<LocalExhibitor[]>((resolve, reject) => {
    const transaction = database.transaction(['exhibitors', 'cipls'], 'readwrite')
    const store = transaction.objectStore('exhibitors')
    const existingById = new Map(existing.map((exhibitor) => [exhibitor.id, exhibitor]))
    const submittedIds = new Set(inputs.flatMap((input) => input.id ? [input.id] : []))
    const exhibitors = inputs.map((input) => {
      const previous = input.id ? existingById.get(input.id) : undefined
      if (input.id && !previous) throw new Error('Exhibitor tidak ditemukan dalam event ini.')
      return {
        ...input,
        id: previous?.id ?? id(),
        eventId,
        createdAt: previous?.createdAt ?? timestamp,
        updatedAt: timestamp,
      }
    })
    const ciplStore = transaction.objectStore('cipls')
    existing.filter((exhibitor) => !submittedIds.has(exhibitor.id)).forEach((exhibitor) => {
      const request = ciplStore.index('eventExhibitorId').count(exhibitor.id)
      request.onsuccess = () => {
        if (request.result > 0) transaction.abort()
        else store.delete(exhibitor.id)
      }
    })
    exhibitors.forEach((exhibitor) => store.put(exhibitor))
    transaction.oncomplete = () => resolve(exhibitors)
    transaction.onerror = () => reject(transaction.error ?? new Error('Gagal menyimpan exhibitor.'))
    transaction.onabort = () => reject(new Error('Exhibitor yang masih dirujuk CIPL tidak dapat dihapus.'))
  })
}

export type EventInput = Pick<LocalEvent, 'officialName' | 'alias' | 'startsAt' | 'endsAt'> & {
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
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    venueId: venue.id,
    eoId: eventOrganizer.id,
    createdAt: previous?.createdAt ?? timestamp,
    updatedAt: timestamp,
  }
  await Promise.all([put('venues', venue), put('eos', eventOrganizer), put('events', event)])
  return event
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
  const ciplIds = new Set(cipls.filter((cipl) => eventExhibitorIds.has(cipl.eventExhibitorId)).map((cipl) => cipl.id))
  const shipmentIds = new Set(shipments.filter((shipment) => ciplIds.has(shipment.ciplId)).map((shipment) => shipment.id))
  if (exhibitors.length || ciplIds.size || shipmentIds.size || customsJobs.some((job) => shipmentIds.has(job.shipmentId)) || legacyJobs.some((job) => job.eventId === eventId)) {
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

export async function saveJobDocument(jobId: string, file: File): Promise<LocalJobDocument> {
  const document: LocalJobDocument = {
    id: id(),
    jobId,
    fileName: file.name,
    mimeType: 'application/pdf',
    fileSize: file.size,
    file,
    createdAt: now(),
  }
  return put('jobDocuments', document)
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
    jobNumber: previous?.jobNumber ?? `VSS-${String((await readAll<LocalJob>('jobs')).length + 1).padStart(4, '0')}`,
    trackingToken: previous?.trackingToken ?? id(), createdAt: previous?.createdAt ?? timestamp, updatedAt: timestamp,
    stages: previous?.stages ?? [], documents: previous?.documents ?? [], ...input,
  }
  const document: LocalJobDocument = { id: id(), jobId: job.id, fileName: file.name, mimeType: 'application/pdf', fileSize: file.size, file, createdAt: timestamp }
  return new Promise<LocalJob>((resolve, reject) => {
    const transaction = database.transaction(['jobs', 'jobDocuments'], 'readwrite')
    transaction.objectStore('jobs').put(job)
    transaction.objectStore('jobDocuments').put(document)
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
  sourceDocument?: CiplVersion['sourceDocument']
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
  const exhibitor = (await readAll<LocalExhibitor>('exhibitors')).find((item) => item.id === eventExhibitorId)
  if (!exhibitor) throw new Error('Exhibitor tidak ditemukan.')
  const timestamp = now()
  const cipl: Cipl = {
    id: id(), eventExhibitorId, referenceNumber: null,
    status: initialVersion ? 'RECEIVED' : 'AWAITING_DOCUMENT', activeVersionId: null,
    sourceDocumentUnavailable: !initialVersion, createdAt: timestamp, updatedAt: timestamp,
  }
  const database = await openDatabase()
  return new Promise<Cipl>((resolve, reject) => {
    const transaction = database.transaction(['cipls', 'ciplVersions'], 'readwrite')
    transaction.objectStore('cipls').put(cipl)
    if (initialVersion) {
      const version: CiplVersion = {
        id: id(), ciplId: cipl.id, versionNumber: 1, receivedAt: initialVersion.receivedAt, receivedBy: initialVersion.receivedBy,
        sourceDocumentName: initialVersion.sourceDocumentName ?? null, sourceDocument: initialVersion.sourceDocument ?? null,
        items: initialVersion.items, revisionNote: initialVersion.revisionNote ?? null, createdAt: timestamp,
      }
      cipl.activeVersionId = version.id
      transaction.objectStore('cipls').put(cipl)
      transaction.objectStore('ciplVersions').put(version)
    }
    transaction.oncomplete = () => resolve(cipl)
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

export async function addCiplVersion(ciplId: string, input: CiplVersionInput) {
  const [cipl, versions, shipments] = await Promise.all([getCipl(ciplId), listCiplVersions(ciplId), listShipments(ciplId)])
  if (!cipl) throw new Error('CIPL tidak ditemukan.')
  if (cipl.activeVersionId && shipments.some((shipment) => shipment.sourceCiplVersionId === cipl.activeVersionId)) {
    // Version lama tetap immutable setelah dipakai Shipment; versi baru selalu aman dibuat.
  }
  const timestamp = now()
  const version: CiplVersion = {
    id: id(), ciplId, versionNumber: (versions[0]?.versionNumber ?? 0) + 1,
    receivedAt: input.receivedAt, receivedBy: input.receivedBy, sourceDocumentName: input.sourceDocumentName ?? null,
    sourceDocument: input.sourceDocument ?? null, items: input.items, revisionNote: input.revisionNote ?? null, createdAt: timestamp,
  }
  const validation = validateCiplVersionReady(version)
  if (!validation.ok && cipl.status === 'READY') throw new Error(validation.issues.map((issue) => issue.message).join(' '))
  await put('ciplVersions', version)
  return version
}

export async function activateCiplVersion(ciplId: string, versionId: string, status: CiplStatus = 'UNDER_REVIEW') {
  const version = (await listCiplVersions(ciplId)).find((item) => item.id === versionId)
  const cipl = await getCipl(ciplId)
  if (!cipl || !version) throw new Error('Versi CIPL bukan milik CIPL yang dipilih.')
  return put('cipls', { ...cipl, activeVersionId: versionId, status, sourceDocumentUnavailable: false, updatedAt: now() })
}

export async function listShipments(ciplId: string) {
  return (await readAll<Shipment>('shipmentsV2'))
    .filter((shipment) => shipment.ciplId === ciplId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export async function getShipment(shipmentId: string) {
  return (await readAll<Shipment>('shipmentsV2')).find((shipment) => shipment.id === shipmentId) ?? null
}

export type ShipmentInput = Omit<Shipment, 'id' | 'ciplId' | 'sourceCiplVersionId' | 'allocations' | 'createdAt' | 'updatedAt' | 'legacyReference'> & { legacyReference?: string | null }

export async function createShipment(ciplId: string, sourceVersionId: string, input: ShipmentInput, allocations: ShipmentAllocation[]) {
  const [cipl, versions, existing] = await Promise.all([getCipl(ciplId), listCiplVersions(ciplId), listShipments(ciplId)])
  const version = versions.find((item) => item.id === sourceVersionId)
  if (!cipl || !version) throw new Error('CIPL atau versi sumber tidak ditemukan.')
  if (input.documentType !== 'BL' && input.documentType !== 'AWB') throw new Error('Shipment harus memiliki tepat satu B/L atau AWB.')
  const allocationValidation = validateShipmentAllocation(version, existing, allocations)
  if (!allocationValidation.ok) throw new Error(allocationValidation.issues.map((issue) => issue.message).join(' '))
  const timestamp = now()
  const shipment: Shipment = { ...input, id: id(), ciplId, sourceCiplVersionId: sourceVersionId, allocations, legacyReference: input.legacyReference ?? null, createdAt: timestamp, updatedAt: timestamp }
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

export type CustomsJobInput = Omit<CustomsJob, 'id' | 'jobNumber' | 'shipmentId' | 'allocations' | 'statusHistory' | 'createdAt' | 'updatedAt'>

/** The counter and CustomsJob live in one transaction, so issued numbers are never reused. */
export async function createCustomsJob(shipmentId: string, input: CustomsJobInput, allocations: JobAllocation[]) {
  const shipment = (await readAll<Shipment>('shipmentsV2')).find((item) => item.id === shipmentId)
  if (!shipment) throw new Error('Shipment tidak ditemukan.')
  const existing = await listCustomsJobs(shipmentId)
  const allocationValidation = validateJobAllocation(shipment, existing, allocations)
  if (!allocationValidation.ok) throw new Error(allocationValidation.issues.map((issue) => issue.message).join(' '))
  const database = await openDatabase()
  const timestamp = now()
  return new Promise<CustomsJob>((resolve, reject) => {
    const transaction = database.transaction(['customsJobs', 'counters'], 'readwrite')
    const counterStore = transaction.objectStore('counters')
    const counterRequest = counterStore.get('customsJobNumber')
    counterRequest.onsuccess = () => {
      const counter = (counterRequest.result as { id: string; value: number } | undefined) ?? { id: 'customsJobNumber', value: 0 }
      const next = counter.value + 1
      const job: CustomsJob = {
        ...input, id: id(), jobNumber: `VSS-${String(next).padStart(5, '0')}`, shipmentId, allocations,
        statusHistory: [], createdAt: timestamp, updatedAt: timestamp,
      }
      counterStore.put({ ...counter, value: next })
      transaction.objectStore('customsJobs').put(job)
      transaction.oncomplete = () => resolve(job)
    }
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

export async function updateCustomsJob(jobId: string, patch: Partial<Omit<CustomsJob, 'id' | 'jobNumber' | 'shipmentId' | 'createdAt' | 'allocations' | 'statusHistory'>>, changeReason?: string) {
  const previous = (await readAll<CustomsJob>('customsJobs')).find((job) => job.id === jobId)
  if (!previous) throw new Error('Customs Job tidak ditemukan.')
  const nextStatus = patch.status ?? previous.status
  const transition = validateJobTransition(previous.status, nextStatus, patch.attachments ?? previous.attachments, changeReason)
  if (!transition.ok) throw new Error(transition.issues.map((issue) => issue.message).join(' '))
  const statusHistory = nextStatus === previous.status ? previous.statusHistory : [
    ...previous.statusHistory,
    { from: previous.status, to: nextStatus, reason: changeReason?.trim() ?? '', changedAt: now() },
  ]
  return put('customsJobs', { ...previous, ...patch, id: previous.id, jobNumber: previous.jobNumber, shipmentId: previous.shipmentId, allocations: previous.allocations, statusHistory, createdAt: previous.createdAt, updatedAt: now() })
}
