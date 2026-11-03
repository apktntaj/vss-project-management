import {
  summarizeKoliCollections,
  type ExhibitorLogistics,
  type KoliSummary,
} from '@/domain/job/manifest'
import type { Job, JobCiplLine } from '@/domain/job/types'
import { jobLabel } from '@/domain/job/numbering'

/**
 * Satu peserta blok manifest = satu baris CIPL job. `logistics` menggabungkan dua pemilik data:
 * hall/booth milik exhibitor tertaut, koli & catatan milik baris CIPL (barang di kiriman ini).
 */
export type ManifestPeserta = {
  key: string
  line: JobCiplLine
  /** Nama exhibitor tertaut, atau nama seperti tertulis di CIPL bila belum tertaut. */
  name: string
  linked: boolean
  logistics: ExhibitorLogistics
}

/** View satu blok manifest: satu job (satu B/L/AWB) + baris CIPL-nya + total turunan. */
export type ManifestBlockView = {
  jobId: string
  /** No Job manifest (S.01/…) atau nomor internal VSS bila urutan belum ditetapkan. */
  jobNumber: string
  eventId: string
  partyName: string
  kind: Job['kind']
  internationalJenis: Job['internationalJenis']
  transportDocument: { type: 'BL' | 'AWB'; number: string } | null
  inward: Job['inward']
  kepulangan: Job['kepulangan']
  totals: KoliSummary
  peserta: ManifestPeserta[]
}

export function pesertaFromLine(line: JobCiplLine): ManifestPeserta {
  return {
    key: line.id,
    line,
    name: line.exhibitor?.name ?? line.nameOnDocument,
    linked: Boolean(line.exhibitorId),
    logistics: {
      hall: line.exhibitor?.hall ?? null,
      booth: line.exhibitor?.booth ?? null,
      koli: line.koli,
      notes: line.notes,
    },
  }
}

/** Assembler murni blok manifest dari satu job. */
export function buildManifestView(job: Job): ManifestBlockView {
  const peserta = job.ciplLines.map(pesertaFromLine)
  return {
    jobId: job.id,
    jobNumber: jobLabel(job),
    eventId: job.eventId,
    partyName: job.party?.name || 'Pihak belum ditetapkan',
    kind: job.kind,
    internationalJenis: job.internationalJenis,
    transportDocument:
      job.transportDocumentType && job.transportDocumentNumber
        ? { type: job.transportDocumentType, number: job.transportDocumentNumber }
        : null,
    inward: job.inward,
    kepulangan: job.kepulangan,
    totals: summarizeKoliCollections(peserta.map((item) => item.logistics.koli)),
    peserta,
  }
}
