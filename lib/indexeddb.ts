'use client'

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
  'jobs' | 'stages' | 'users' | 'events' | 'venues' | 'eos' | 'exhibitors' | 'jobDocuments'

const databaseName = 'vss-project-management'
const databaseVersion = 4

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion)
    request.onupgradeneeded = () => {
      const database = request.result
      for (const store of [
        'jobs',
        'stages',
        'users',
        'events',
        'venues',
        'eos',
        'exhibitors',
        'jobDocuments',
      ] as StoreName[]) {
        if (!database.objectStoreNames.contains(store))
          database.createObjectStore(store, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
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

export type EventExhibitorInput = Omit<LocalExhibitor, 'id' | 'eventId' | 'createdAt' | 'updatedAt'>

export async function saveEventExhibitors(eventId: string, inputs: EventExhibitorInput[]) {
  const database = await openDatabase()
  const existing = await listEventExhibitors(eventId)
  const timestamp = now()

  return new Promise<LocalExhibitor[]>((resolve, reject) => {
    const transaction = database.transaction('exhibitors', 'readwrite')
    const store = transaction.objectStore('exhibitors')
    existing.forEach((exhibitor) => store.delete(exhibitor.id))
    const exhibitors = inputs.map((input) => ({
      ...input,
      id: id(),
      eventId,
      createdAt: timestamp,
      updatedAt: timestamp,
    }))
    exhibitors.forEach((exhibitor) => store.put(exhibitor))
    transaction.oncomplete = () => resolve(exhibitors)
    transaction.onerror = () => reject(transaction.error)
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
    id: existingId ?? id(),
    jobNumber:
      previous?.jobNumber ??
      `VSS-${String((await readAll<LocalJob>('jobs')).length + 1).padStart(4, '0')}`,
    trackingToken: previous?.trackingToken ?? id(),
    createdAt: previous?.createdAt ?? timestamp,
    updatedAt: timestamp,
    stages: [],
    documents: [],
    ...input,
  }
  return put('jobs', job)
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
