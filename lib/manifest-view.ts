import { summarizeKoliCollections, type ExhibitorLogistics, type KoliSummary } from '@/domain/job/manifest'
import { normalizeExhibitorName } from '@/domain/event/exhibitor-matching'
import type { LocalExhibitor, LocalJob } from '@/lib/data-client'

/** Peserta dari data master exhibitor — koli-nya diedit lewat modal logistik. */
export type MasterPeserta = {
  origin: 'MASTER'
  key: string
  name: string
  exhibitor: LocalExhibitor
  logistics: LocalExhibitor['logistics']
}

/**
 * Peserta hasil scan CIPL yang belum punya pasangan di master exhibitor event — baris lama
 * (sebelum autofill menautkan) atau baris yang namanya cocok dengan lebih dari satu exhibitor.
 */
export type ScanPeserta = {
  origin: 'CIPL_SCAN'
  key: string
  name: string
  /** Terisi bila autofill berhasil menautkan, meski exhibitor-nya di luar blok agent job ini. */
  exhibitorId: string | null
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

/**
 * Assembler murni blok manifest: peserta job dengan agent = exhibitor pada event yang
 * sama yang dibawa agent job; peserta job tanpa agent = exhibitor pengatur pengiriman
 * sendiri (job.exhibitorId), fase 1 relasi peserta eksplisit (data definitions 2026-10-24).
 *
 * Baris hasil scan CIPL (job.manifestExhibitors) DILEBUR ke peserta master, bukan ditumpuk:
 * pertama lewat `exhibitorId` hasil autofill, lalu — untuk baris lama tanpa id — lewat nama
 * ternormalisasi. Tanpa peleburan ini satu exhibitor yang ejaannya beda setipis "CO., LTD" vs
 * "CO.,LTD" muncul dua kali dan total koli blok terhitung ganda.
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
  const masterById = new Map(master.map((item) => [item.exhibitor.id, item]))
  const masterByName = new Map(
    master.flatMap((item) => {
      const key = normalizeExhibitorName(item.name)
      return key ? [[key, item] as const] : []
    }),
  )
  const scanned: ScanPeserta[] = []
  for (const [index, row] of (job.manifestExhibitors ?? []).entries()) {
    const name = row.name?.trim() ?? ''
    if (!name) continue
    const linked =
      (row.exhibitorId ? masterById.get(row.exhibitorId) : undefined) ??
      masterByName.get(normalizeExhibitorName(name))
    if (linked) {
      // Logistik master adalah hasil tulis autofill yang sama dan bisa sudah dikoreksi
      // operator, jadi ia menang; snapshot job hanya mengisi saat master masih kosong.
      linked.logistics = linked.logistics ?? row.logistics
      continue
    }
    scanned.push({
      origin: 'CIPL_SCAN',
      key: `cipl-${index}`,
      name,
      exhibitorId: row.exhibitorId ?? null,
      logistics: row.logistics,
    })
  }
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
