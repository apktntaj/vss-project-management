import 'server-only'

// Bentuk baris + mapper bersama modul repository job. BUKAN batas publik (lihat ./index.ts).

import { normalizeOperationalDetails } from '@/domain/job/operational'
import { formatJobNumber } from '@/domain/job/numbering'
import type { JobTransportExtraction } from '@/domain/exhibition/source-documents'
import type {
  Job,
  JobCiplLine,
  JobInvoice,
  JobOperationalDetails,
  JobParty,
  JobSummary,
} from '@/domain/job/types'

// Embed aggregate lain HANYA untuk tampilan. Hint FK wajib: `jobs` punya dua FK ke app_users
// (assigned_to_id + created_by_id) dan dua jalur ke exhibitors (pihak langsung + lewat baris CIPL).
const PARTY_EMBEDS = [
  'agent:agents!jobs_agent_fk(name:payload->>name)',
  'party_exhibitor:exhibitors!jobs_exhibitor_fk(id, name)',
]

export const JOB_COLUMNS = [
  'id, version, event_id, kind, international_jenis, transport_mode, status',
  'agent_id, exhibitor_id, manifest_prefix, manifest_seq, commercial_invoice_number',
  'transport_document, transport_document_type, transport_document_number, cipl_document',
  'invoice_number, invoice_amount, invoice_currency, invoice_status, invoice_sent_at, invoice_paid_at',
  'assigned_to_id, created_by_id, operational, inward, kepulangan, empty_storage, re_export, notes',
  'created_at, updated_at',
  ...PARTY_EMBEDS,
  'assigned_to:app_users!jobs_assigned_to_id_fkey(id, full_name)',
  'cipl_lines:job_cipl_lines(id, exhibitor_id, position, name_on_document, koli, items, notes, exhibitor:exhibitors(id, name, hall, booth))',
].join(', ')

export const JOB_SUMMARY_COLUMNS = [
  'id, event_id, kind, international_jenis, status, assigned_to_id',
  'agent_id, exhibitor_id, manifest_prefix, manifest_seq, commercial_invoice_number',
  ...PARTY_EMBEDS,
].join(', ')

type Relation<T> = T | T[] | null

type PartyEmbeds = {
  agent_id: string | null
  exhibitor_id: string | null
  agent: Relation<{ name: string | null }>
  party_exhibitor: Relation<{ id: string; name: string }>
}

type NumberColumns = {
  manifest_prefix: string | null
  manifest_seq: number | null
  commercial_invoice_number: string | null
}

type CiplLineRow = {
  id: string
  exhibitor_id: string | null
  position: number
  name_on_document: string
  koli: JobCiplLine['koli']
  items: JobCiplLine['items'] | null
  notes: JobCiplLine['notes'] | null
  exhibitor: Relation<{ id: string; name: string; hall: string | null; booth: string | null }>
}

export type JobRow = PartyEmbeds &
  NumberColumns & {
    id: string
    version: number
    event_id: string
    kind: Job['kind']
    international_jenis: Job['internationalJenis']
    transport_mode: Job['transportMode']
    status: Job['status']
    transport_document: JobTransportExtraction | null
    transport_document_type: Job['transportDocumentType']
    transport_document_number: string | null
    cipl_document: Job['ciplDocument']
    invoice_number: string | null
    invoice_amount: number | string | null
    invoice_currency: string | null
    invoice_status: JobInvoice['status']
    invoice_sent_at: string | null
    invoice_paid_at: string | null
    assigned_to_id: string | null
    created_by_id: string | null
    operational: Partial<JobOperationalDetails> | null
    inward: Job['inward']
    kepulangan: Job['kepulangan']
    empty_storage: string | null
    re_export: string | null
    notes: string | null
    created_at: string
    updated_at: string
    assigned_to: Relation<{ id: string; full_name: string }>
    cipl_lines: CiplLineRow[] | null
  }

export type JobSummaryRow = PartyEmbeds &
  NumberColumns &
  Pick<
    JobRow,
    'id' | 'event_id' | 'kind' | 'international_jenis' | 'status' | 'assigned_to_id'
  >

/** Kolom yang boleh ditulis use-case (snake_case, persis nama kolom). */
export type JobWritableColumns = Partial<{
  status: Job['status']
  transport_mode: Job['transportMode']
  agent_id: string | null
  exhibitor_id: string | null
  manifest_seq: number | null
  commercial_invoice_number: string | null
  transport_document: JobTransportExtraction | null
  transport_document_type: Job['transportDocumentType']
  transport_document_number: string | null
  invoice_number: string | null
  invoice_amount: number | null
  invoice_currency: string | null
  invoice_status: JobInvoice['status']
  invoice_sent_at: string | null
  invoice_paid_at: string | null
  operational: JobOperationalDetails
  inward: Job['inward']
  kepulangan: Job['kepulangan']
  empty_storage: string | null
  re_export: string | null
  notes: string | null
}>

function first<T>(relation: Relation<T>): T | null {
  if (relation == null) return null
  return Array.isArray(relation) ? (relation[0] ?? null) : relation
}

function toParty(row: PartyEmbeds): JobParty | null {
  if (row.agent_id) {
    return { kind: 'AGENT', id: row.agent_id, name: first(row.agent)?.name ?? '' }
  }
  if (row.exhibitor_id) {
    return { kind: 'EXHIBITOR', id: row.exhibitor_id, name: first(row.party_exhibitor)?.name ?? '' }
  }
  return null
}

function toJobNumber(row: NumberColumns): string | null {
  return formatJobNumber(row.manifest_prefix, row.manifest_seq, row.commercial_invoice_number)
}

function toCiplLine(row: CiplLineRow): JobCiplLine {
  const exhibitor = first(row.exhibitor)
  return {
    id: row.id,
    exhibitorId: row.exhibitor_id,
    exhibitor: exhibitor
      ? { id: exhibitor.id, name: exhibitor.name, hall: exhibitor.hall, booth: exhibitor.booth }
      : null,
    nameOnDocument: row.name_on_document,
    koli: row.koli,
    items: row.items ?? [],
    notes: row.notes ?? [],
  }
}

export function toJob(row: JobRow): Job {
  const assignedTo = first(row.assigned_to)
  return {
    id: row.id,
    version: row.version,
    eventId: row.event_id,
    kind: row.kind,
    internationalJenis: row.international_jenis,
    transportMode: row.transport_mode,
    status: row.status,
    agentId: row.agent_id,
    exhibitorId: row.exhibitor_id,
    party: toParty(row),
    manifestPrefix: row.manifest_prefix,
    manifestSeq: row.manifest_seq,
    commercialInvoiceNumber: row.commercial_invoice_number,
    jobNumber: toJobNumber(row),
    transportDocumentType: row.transport_document_type,
    transportDocumentNumber: row.transport_document_number,
    transportDocument: row.transport_document,
    ciplDocument: row.cipl_document,
    ciplLines: [...(row.cipl_lines ?? [])]
      .sort((left, right) => left.position - right.position)
      .map(toCiplLine),
    invoice: {
      number: row.invoice_number,
      // `numeric` dikirim PostgREST sebagai number atau string tergantung presisi.
      amount: row.invoice_amount === null ? null : Number(row.invoice_amount),
      currency: row.invoice_currency,
      status: row.invoice_status,
      sentAt: row.invoice_sent_at,
      paidAt: row.invoice_paid_at,
    },
    assignedToId: row.assigned_to_id,
    createdById: row.created_by_id,
    assignedTo: assignedTo ? { id: assignedTo.id, name: assignedTo.full_name } : null,
    operational: normalizeOperationalDetails(row.operational),
    inward: row.inward,
    kepulangan: row.kepulangan,
    emptyStorage: row.empty_storage,
    reExport: row.re_export,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toJobSummary(row: JobSummaryRow): JobSummary {
  return {
    id: row.id,
    manifestPrefix: row.manifest_prefix,
    eventId: row.event_id,
    jobNumber: toJobNumber(row),
    status: row.status,
    kind: row.kind,
    internationalJenis: row.international_jenis,
    assignedToId: row.assigned_to_id,
    partyName: toParty(row)?.name || null,
  }
}

/**
 * Error Postgres yang perlu diterjemahkan use-case menjadi pesan pengguna (unique/FK/check, atau
 * `raise exception` bernama dari fungsi DB). Membawa kode SQLSTATE + nama constraint.
 */
export class JobConstraintError extends Error {
  readonly code: string
  readonly constraint: string | null

  constructor(code: string, message: string) {
    super(message)
    this.name = 'JobConstraintError'
    this.code = code
    // Constraint biasa: `... constraint "nama"`. Raise dari fungsi DB: pesannya nama itu sendiri.
    this.constraint =
      /constraint "([^"]+)"/.exec(message)?.[1] ?? (/^[a-z_]+$/.test(message) ? message : null)
    Object.setPrototypeOf(this, JobConstraintError.prototype)
  }
}

const CONSTRAINT_CODES = new Set(['23505', '23503', '23514'])

/** Lempar `JobConstraintError` untuk pelanggaran constraint, selain itu Error biasa. */
export function raise(context: string, error: { code?: string; message: string }): never {
  if (error.code && CONSTRAINT_CODES.has(error.code)) {
    throw new JobConstraintError(error.code, error.message)
  }
  throw new Error(`${context}: ${error.message}`)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Id selalu uuid; nilai lain (mis. dari URL lama) tidak mungkin cocok — jangan kirim ke Postgres. */
export function isUuid(value: string): boolean {
  return UUID.test(value)
}
