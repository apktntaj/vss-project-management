import {
  getOperationalDetails,
  type JobDocumentKind,
  type LocalJob,
} from '@/lib/data-client'

/**
 * No Job operasional mengikuti jenis job (format: `<prefix>.<urutan>/<no invoice>`):
 * - Venue: prefix tipe pengiriman — `S` (Sea) atau `A` (Air) — contoh `S.01/234YFN`.
 * - Jenis lain (sementara tanpa spesifikasi): singkatan jenis — Local `L`,
 *   Road Shipment `RS`, Permanent Import `PI`, ATA Carnet `AC`, Ekspor Sementara `TE`.
 * - Urutan = urutan dokumen angkut masuk diterima (waktu upload); job tanpa dokumen
 *   angkut (mis. Local) memakai urutan waktu job dibuat.
 * - No invoice dilampirkan begitu tersedia; sebelum itu nomor bersifat sementara.
 * - Job lama tanpa penanda jenis, atau Venue yang belum ada dokumen angkut, belum
 *   bisa dinomori — pemanggil menampilkan nomor internal (VSS-xxxx) sebagai gantinya.
 */

const inboundDocumentKinds: ReadonlyArray<JobDocumentKind> = [
  'BILL_OF_LADING',
  'AIR_WAYBILL',
  'INBOUND_TRANSPORT',
]

export function jobNomorPrefix(job: LocalJob): string | null {
  if (job.kind === 'LOCAL') return 'L'
  switch (job.internationalJenis) {
    case 'ROAD_SHIPMENT':
      return 'RS'
    case 'PERMANENT_IMPORT':
      return 'PI'
    case 'ATA_CARNET':
      return 'AC'
    case 'TEMPORARY_EXPORT':
      return 'TE'
    case 'VENUE': {
      const mode = getOperationalDetails(job).inbound.mode
      if (mode === 'SEA') return 'S'
      if (mode === 'AIR') return 'A'
      return null
    }
    default:
      return null
  }
}

function documentReceivedAt(job: LocalJob): string {
  const times = job.documents
    .filter((document) => {
      if (!document.kind) return false
      return inboundDocumentKinds.includes(document.kind)
    })
    .map((document) => document.createdAt)
    .sort()
  return times[0] ?? job.createdAt
}

/** Peta jobId → No Job berformat; urutan dihitung per event per prefix. */
export function buildJobNomor(jobs: LocalJob[]): Map<string, string> {
  const groups = new Map<string, Array<{ job: LocalJob; prefix: string }>>()
  for (const job of jobs) {
    const prefix = jobNomorPrefix(job)
    if (!prefix) continue
    const key = `${job.eventId ?? 'tanpa-event'}|${prefix}`
    const bucket = groups.get(key)
    if (bucket) bucket.push({ job, prefix })
    else groups.set(key, [{ job, prefix }])
  }
  const nomorByJobId = new Map<string, string>()
  for (const bucket of groups.values()) {
    bucket
      .sort((left, right) =>
        documentReceivedAt(left.job).localeCompare(documentReceivedAt(right.job)),
      )
      .forEach((item, index) => {
        const invoiceNumber = getOperationalDetails(item.job).invoiceNumber
        nomorByJobId.set(
          item.job.id,
          `${item.prefix}.${String(index + 1).padStart(2, '0')}${invoiceNumber ? `/${invoiceNumber}` : ''}`,
        )
      })
  }
  return nomorByJobId
}
