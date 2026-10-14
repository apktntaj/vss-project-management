import { summarizeKoliCollections, type KoliSummary } from '@/domain/job/manifest'
import type { LocalExhibitor, LocalJob } from '@/lib/data-client'

export type ManifestPeserta = {
  exhibitor: LocalExhibitor
  logistics: LocalExhibitor['logistics']
}

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
 * Assembler murni blok manifest: peserta = exhibitor pada event yang sama yang
 * kepesertaannya dibawa agent job (invariant data definitions, bagian 4).
 */
export function buildManifestView(job: LocalJob, exhibitors: LocalExhibitor[]): ManifestBlockView {
  const peserta: ManifestPeserta[] =
    job.eventId && job.agentId
      ? exhibitors
          .filter((exhibitor) => exhibitor.eventId === job.eventId && exhibitor.agentId === job.agentId)
          .sort((left, right) => left.name.localeCompare(right.name))
          .map((exhibitor) => ({ exhibitor, logistics: exhibitor.logistics ?? null }))
      : []
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
