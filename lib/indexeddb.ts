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
  type: 'IMPORT' | 'EXPORT'
  clientName: string
  clientInfo: string | null
  status: 'DRAFT' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED'
  notes: string | null
  trackingToken: string
  assignedToId: string | null
  createdAt: string
  updatedAt: string
  assignedTo?: LocalUser | null
  stages: LocalStage[]
  documents: never[]
}

type StoreName = 'jobs' | 'stages' | 'users'

const databaseName = 'vss-project-management'
const databaseVersion = 1

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion)
    request.onupgradeneeded = () => {
      const database = request.result
      for (const store of ['jobs', 'stages', 'users'] as StoreName[]) {
        if (!database.objectStoreNames.contains(store)) database.createObjectStore(store, { keyPath: 'id' })
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
  const seeded: LocalUser[] = [{ id: 'local-user', name: 'Operator Lokal', email: 'operator@vss.local', role: 'SUPERVISOR', isActive: true }]
  await Promise.all(seeded.map((user) => put('users', user)))
  return seeded
}

export async function listUsers() {
  return ensureSeeded()
}

export async function listJobs(filters: { search?: string; status?: string } = {}) {
  const [jobs, stages, users] = await Promise.all([readAll<LocalJob>('jobs'), readAll<LocalStage>('stages'), ensureSeeded()])
  const search = filters.search?.toLowerCase() ?? ''
  return jobs
    .filter((job) => (!filters.status || job.status === filters.status) && (!search || [job.jobNumber, job.clientName, job.awbNumber, job.blNumber].some((value) => value?.toLowerCase().includes(search))))
    .map((job) => ({ ...job, assignedTo: users.find((user) => user.id === job.assignedToId) ?? null, stages: stages.filter((stage) => stage.jobId === job.id).sort((a, b) => a.order - b.order), documents: [] }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getJob(jobId: string) {
  return (await listJobs()).find((job) => job.id === jobId) ?? null
}

export type JobInput = Pick<LocalJob, 'awbNumber' | 'blNumber' | 'type' | 'clientName' | 'clientInfo' | 'status' | 'notes' | 'assignedToId'>

export async function saveJob(input: JobInput, existingId?: string) {
  const previous = existingId ? await getJob(existingId) : null
  const timestamp = now()
  const job: LocalJob = {
    id: existingId ?? id(),
    jobNumber: previous?.jobNumber ?? `VSS-${String((await readAll<LocalJob>('jobs')).length + 1).padStart(4, '0')}`,
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
  return put('stages', { id: id(), jobId, name: name.trim(), status: 'PENDING', order: stages.length, notes: null, createdAt: now(), updatedAt: now() })
}

export async function toggleStage(stage: LocalStage): Promise<LocalStage> {
  return put('stages', { ...stage, status: stage.status === 'DONE' ? 'IN_PROGRESS' : 'DONE', updatedAt: now() })
}