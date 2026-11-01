import { summarizeKoliCollections, type ExhibitorLogistics, type KoliSummary } from '@/domain/job/manifest'
import type { LocalExhibitor, LocalJob } from '@/lib/data-client'

/** Peserta dari data master exhibitor — koli-nya diedit lewat modal logistik. */
export type MasterPeserta = {
  origin: 'MASTER'
  key: string
  name: string
  exhibitor: LocalExhibitor
  logistics: LocalExhibitor['logistics']
}

/** Peserta hasil scan CIPL saat job dibuat — hanya hidup di payload job. */
export type ScanPeserta = {
  origin: 'CIPL_SCAN'
  key: string
  name: string
  logistics: ExhibitorLogistics
}

export type ManifestPeserta = MasterPeserta | ScanPeserta

/** View satu blok manifest: job + peserta binaan agent + total turunan. */
export type ManifestBlockView = {
  jobNumber: string
  eventId: string | null
  agentId: string | null
  agentName: string
  kind: LocalJob['kind']
  internationalJenis: LocalJob['internationalJenis']
  inward: LocalJob['inward']
  kepulangan: LocalJob['kepulangan']
  totals: KoliSummary
  peserta: ManifestPeserta[]
}

const normalizeName = (value: string) => value.trim().toLowerCase()

/**
 * Assembler murni blok manifest: peserta job dengan agent = exhibitor pada event yang
 * sama yang dibawa agent job; peserta job tanpa agent = exhibitor pengatur pengiriman
 * sendiri (job.exhibitorId), fase 1 relasi peserta eksplisit (data definitions 2026-10-24).
 * Baris hasil scan CIPL saat pembuatan job (job.manifestExhibitors) ikut ditampilkan,
 * kecuali namanya sama persis dengan peserta master agar tidak terhitung dua kali.
 */
export function buildManifestView(job: LocalJob, exhibitors: LocalExhibitor[]): ManifestBlockView {
  const master: MasterPeserta[] = (
    job.eventId && (job.agentId || job.exhibitorId)
      ? exhibitors.filter((exhibitor) =>
          job.agentId
            ? exhibitor.eventId === job.eventId && exhibitor.agentId === job.agentId
            : exhibitor.eventId === job.eventId && exhibitor.id === job.exhibitorId,
        )
      : []
  ).map((exhibitor) => ({
    origin: 'MASTER',
    key: exhibitor.id,
    name: exhibitor.name,
    exhibitor,
    logistics: exhibitor.logistics ?? null,
  }))
  const masterNames = new Set(master.map((item) => normalizeName(item.name)).filter(Boolean))
  const scanned: ScanPeserta[] = (job.manifestExhibitors ?? [])
    .map((row, index): ScanPeserta => ({
      origin: 'CIPL_SCAN',
      key: `cipl-${index}`,
      name: row.name,
      logistics: row.logistics,
    }))
    .filter((row) => normalizeName(row.name) && !masterNames.has(normalizeName(row.name)))
  const peserta = [...master, ...scanned].sort((left, right) => left.name.localeCompare(right.name))
  return {
    jobNumber: job.jobNumber,
    eventId: job.eventId ?? null,
    agentId: job.agentId ?? null,
    agentName: job.agent || job.clientName,
    kind: job.kind ?? null,
    internationalJenis: job.internationalJenis ?? null,
    inward: job.inward ?? null,
    kepulangan: job.kepulangan ?? null,
    totals: summarizeKoliCollections(peserta.map((item) => item.logistics?.koli ?? null)),
    peserta,
  }
}
