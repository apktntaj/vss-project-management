import 'server-only'

// Perintah tulis aggregate Job. Masing-masing: otorisasi → (muat bila perlu) → validasi invariant
// → tulis HANYA kolom yang berubah dengan guard versi. Bentuk input sudah dijaga Zod di route.

import { authorize } from '@/features/auth'
import {
  exhibitorBelongsToEvent,
  findAgentName,
  findJobById,
  ensureEventAgent,
  saveJobCiplGuarded,
  type JobWritableColumns,
} from '@/features/jobs/repository'
import {
  STALE_VERSION_MESSAGE,
  assertNotCancelled,
  loadJobForWrite,
  translateConstraint,
  writeJob,
} from '@/features/jobs/use-cases/errors'
import { authorizeJobWrite } from '@/features/jobs/use-cases/job-guards'
import { applyDocumentExtraction, normalizeOperationalDetails } from '@/domain/job/operational'
import { exhibitorOnlyJob } from '@/domain/job/validation'
import { ApiError } from '@/lib/server/errors'
import type { CurrentUser } from '@/domain/auth/types'
import type { Job } from '@/domain/job/types'
import type { InwardManifest, JobReturn } from '@/domain/job/manifest'
import type {
  JobCiplPut,
  JobDetailsPatch,
  JobExtractionInput,
  JobInvoiceInput,
} from '@/domain/job/validation'

/** Edit detail job: status, jalur, pihak, No Job, dokumen angkut, catatan, operational. */
export async function updateJobDetails(
  currentUser: CurrentUser,
  jobId: string,
  patch: JobDetailsPatch,
): Promise<Job> {
  await authorizeJobWrite(currentUser, 'job:update', jobId)
  const columns: JobWritableColumns = {}

  // Pihak & jalur butuh konteks job (jenis, event) untuk divalidasi.
  if (patch.party !== undefined || patch.transportMode !== undefined) {
    const job = await loadJobForWrite(jobId, patch.version)
    if (patch.party !== undefined) {
      const { agentId, exhibitorId } = patch.party
      if (agentId && exhibitorOnlyJob(job)) {
        throw new ApiError(400, 'Job Local selalu dipegang exhibitor, bukan agent.')
      }
      if (agentId && (await findAgentName(agentId)) === null) {
        throw new ApiError(400, 'Agent tidak ditemukan.')
      }
      if (exhibitorId && !(await exhibitorBelongsToEvent(exhibitorId, job.eventId))) {
        throw new ApiError(400, 'Exhibitor tidak terdaftar di event job ini.')
      }
      if (agentId) await ensureEventAgent(job.eventId, agentId, currentUser.id)
      columns.agent_id = agentId
      columns.exhibitor_id = exhibitorId
    }
    if (patch.transportMode !== undefined) {
      if (job.internationalJenis === 'ROAD_SHIPMENT' && patch.transportMode !== 'ROAD') {
        throw new ApiError(400, 'Road Shipment hanya lewat jalur darat.')
      }
      columns.transport_mode = patch.transportMode
    }
  }

  if (patch.status !== undefined) columns.status = patch.status
  if (patch.manifestSeq !== undefined) columns.manifest_seq = patch.manifestSeq
  if (patch.commercialInvoiceNumber !== undefined) {
    columns.commercial_invoice_number = patch.commercialInvoiceNumber
  }
  if (patch.transportDocumentType !== undefined) {
    columns.transport_document_type = patch.transportDocumentType
  }
  if (patch.transportDocumentNumber !== undefined) {
    columns.transport_document_number = patch.transportDocumentNumber
  }
  if (patch.notes !== undefined) columns.notes = patch.notes
  if (patch.emptyStorage !== undefined) columns.empty_storage = patch.emptyStorage
  if (patch.reExport !== undefined) columns.re_export = patch.reExport
  if (patch.operational !== undefined) {
    columns.operational = normalizeOperationalDetails(patch.operational)
  }
  return writeJob(jobId, patch.version, columns)
}

/** Tagihan job ke pihaknya. Satu job = satu tagihan. Hanya FINANCE (dan admin). */
export async function saveJobInvoice(
  currentUser: CurrentUser,
  jobId: string,
  version: number,
  invoice: JobInvoiceInput,
): Promise<Job> {
  await authorize(currentUser, 'job:invoice:write')
  return writeJob(jobId, version, {
    invoice_number: invoice.number,
    invoice_amount: invoice.amount,
    invoice_currency: invoice.currency,
    invoice_status: invoice.status,
    invoice_sent_at: invoice.sentAt,
    invoice_paid_at: invoice.paidAt,
  })
}

/**
 * Terapkan hasil ekstraksi dokumen (commercial invoice / B/L / AWB). Butuh isi job saat ini, jadi
 * job dimuat dulu; tulisnya tetap terjaga versi sehingga balapan dengan editor lain terdeteksi.
 */
export async function applyJobExtraction(
  currentUser: CurrentUser,
  jobId: string,
  input: JobExtractionInput,
): Promise<Job> {
  await authorizeJobWrite(currentUser, 'job:update', jobId)
  const job = await loadJobForWrite(jobId, input.version)
  const { operational, fields } = applyDocumentExtraction(job, input)
  const columns: JobWritableColumns = { operational }
  if (fields.transportDocument) columns.transport_document = fields.transportDocument
  if (fields.transportDocumentType) columns.transport_document_type = fields.transportDocumentType
  if (fields.transportDocumentNumber !== undefined) {
    columns.transport_document_number = fields.transportDocumentNumber
  }
  if (fields.commercialInvoiceNumber) {
    columns.commercial_invoice_number = fields.commercialInvoiceNumber
  }
  return writeJob(jobId, input.version, columns)
}

/**
 * Simpan CIPL job: dokumen mentah + seluruh baris (diganti utuh) dalam satu transaksi DB.
 * Penautan baris ke exhibitor juga lewat perintah ini (kirim ulang baris dengan exhibitorId).
 */
export async function saveJobCipl(
  currentUser: CurrentUser,
  jobId: string,
  input: JobCiplPut,
): Promise<Job> {
  await authorizeJobWrite(currentUser, 'job:update', jobId)
  const current = await findJobById(jobId)
  if (!current) throw new ApiError(404, 'Job tidak ditemukan.')
  assertNotCancelled(current)
  let saved: boolean
  try {
    saved = await saveJobCiplGuarded(jobId, input.version, input.ciplDocument, input.lines)
  } catch (error) {
    translateConstraint(error)
  }
  const job = await findJobById(jobId)
  if (!job) throw new ApiError(404, 'Job tidak ditemukan.')
  if (!saved) throw new ApiError(409, STALE_VERSION_MESSAGE)
  return job
}

/** Blok inward manifest — hanya bermakna untuk job International. */
export async function saveJobInward(
  currentUser: CurrentUser,
  jobId: string,
  version: number,
  inward: InwardManifest,
): Promise<Job> {
  await authorizeJobWrite(currentUser, 'job:update', jobId)
  const job = await loadJobForWrite(jobId, version)
  if (job.kind === 'LOCAL') throw new ApiError(400, 'Job Local tidak memiliki dokumen kepabeanan.')
  return writeJob(jobId, version, { inward })
}

/** Fase kepulangan (return list); null mengosongkannya. */
export async function saveJobKepulangan(
  currentUser: CurrentUser,
  jobId: string,
  version: number,
  kepulangan: JobReturn | null,
): Promise<Job> {
  await authorizeJobWrite(currentUser, 'job:update', jobId)
  return writeJob(jobId, version, { kepulangan })
}
