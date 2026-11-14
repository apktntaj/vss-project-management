import type { Job } from '@/domain/job/types'
import { jobLabel } from '@/domain/job/numbering'
import {
  summarizeKoli,
  summarizeKoliCollections,
  type KoliCollection,
  type KoliSummary,
  type OperationalNote,
} from '@/domain/job/manifest'

/** Dimensi pengelompokan baris exhibitor pada halaman event. */
export type ExhibitorGroupBy = 'hall' | 'agent'

export type ExhibitorRow = {
  /** id baris CIPL */
  key: string
  exhibitorName: string
  linked: boolean
  hall: string | null
  booth: string | null
  agent: string | null
  jobId: string
  jobNo: string
  summary: KoliSummary
  notes: OperationalNote[]
}

export type ExhibitorGroup = {
  /** Per hall: hall trim + uppercase; per agent: id agent. '' untuk grup tanpa hall/agent. */
  key: string
  /** Per hall: hall trim pertama yang ditemui; per agent: nama agent. null = tanpa hall/agent. */
  label: string | null
  rows: ExhibitorRow[]
  /** Jumlah distinct `exhibitorId ?? nameOnDocument`. */
  exhibitorCount: number
  totals: KoliSummary
}

const collator = new Intl.Collator('id', { numeric: true, sensitivity: 'base' })

type GroupDraft = {
  key: string
  label: string | null
  rows: ExhibitorRow[]
  exhibitors: Set<string>
  koli: KoliCollection[]
}

/**
 * Kelompokkan baris CIPL seluruh job event per hall exhibitor atau per agent job (tampilan
 * lapangan). Job batal dilewati. Per hall: baris tanpa exhibitor tertaut atau tanpa hall masuk
 * grup tanpa hall. Per agent: baris job yang pihaknya bukan agent masuk grup tanpa agent. Grup
 * tanpa hall/agent selalu terakhir.
 */
export function buildExhibitorGroups(jobs: ReadonlyArray<Job>, by: ExhibitorGroupBy): ExhibitorGroup[] {
  const drafts = new Map<string, GroupDraft>()

  for (const job of jobs) {
    if (job.status === 'CANCELLED') continue
    const jobNo = job.jobNumber?.trim() || jobLabel(job)
    const agentParty = job.party?.kind === 'AGENT' ? job.party : null
    const agent = agentParty?.name ?? null

    for (const line of job.ciplLines) {
      const hall = line.exhibitor?.hall?.trim() || null
      const key = by === 'hall' ? (hall?.toUpperCase() ?? '') : (agentParty?.id ?? '')
      let draft = drafts.get(key)
      if (!draft) {
        draft = { key, label: by === 'hall' ? hall : agent, rows: [], exhibitors: new Set(), koli: [] }
        drafts.set(key, draft)
      }

      draft.rows.push({
        key: line.id,
        exhibitorName: line.exhibitor?.name ?? line.nameOnDocument,
        linked: Boolean(line.exhibitorId),
        hall,
        booth: line.exhibitor?.booth?.trim() || null,
        agent,
        jobId: job.id,
        jobNo,
        summary: summarizeKoli(line.koli),
        notes: line.notes,
      })
      draft.exhibitors.add(line.exhibitorId ?? line.nameOnDocument)
      draft.koli.push(line.koli)
    }
  }

  return [...drafts.values()]
    .sort((a, b) => compareNullsLast(a.label, b.label))
    .map((draft) => ({
      key: draft.key,
      label: draft.label,
      rows: draft.rows.sort(compareRows),
      exhibitorCount: draft.exhibitors.size,
      totals: summarizeKoliCollections(draft.koli),
    }))
}

function compareNullsLast(a: string | null, b: string | null): number {
  if (a === null || b === null) return Number(a === null) - Number(b === null)
  return collator.compare(a, b)
}

/** Hall → booth → exhibitor → no job. Dalam grup per hall, hall semua baris setara. */
function compareRows(a: ExhibitorRow, b: ExhibitorRow): number {
  return (
    compareNullsLast(a.hall, b.hall) ||
    compareNullsLast(a.booth, b.booth) ||
    collator.compare(a.exhibitorName, b.exhibitorName) ||
    collator.compare(a.jobNo, b.jobNo)
  )
}
