import type { Job } from '@/domain/job/types'
import { jobLabel } from '@/domain/job/numbering'
import {
  summarizeKoli,
  summarizeKoliCollections,
  type KoliCollection,
  type KoliSummary,
  type OperationalNote,
} from '@/domain/job/manifest'

export type HallRow = {
  /** id baris CIPL */
  key: string
  exhibitorName: string
  linked: boolean
  booth: string | null
  agent: string | null
  jobId: string
  jobNo: string
  summary: KoliSummary
  notes: OperationalNote[]
}

export type HallGroup = {
  /** Hall trim + uppercase; '' untuk "Tanpa hall". */
  key: string
  /** Hall trim pertama yang ditemui; null = "Tanpa hall". */
  label: string | null
  rows: HallRow[]
  /** Jumlah distinct `exhibitorId ?? nameOnDocument`. */
  exhibitorCount: number
  totals: KoliSummary
}

const collator = new Intl.Collator('id', { numeric: true, sensitivity: 'base' })

type GroupDraft = {
  key: string
  label: string | null
  rows: HallRow[]
  exhibitors: Set<string>
  koli: KoliCollection[]
}

/**
 * Kelompokkan baris CIPL seluruh job event per hall exhibitor (tampilan lapangan). Job batal
 * dilewati; baris tanpa exhibitor tertaut atau tanpa hall masuk grup "Tanpa hall" (terakhir).
 */
export function buildHallGroups(jobs: ReadonlyArray<Job>): HallGroup[] {
  const drafts = new Map<string, GroupDraft>()

  for (const job of jobs) {
    if (job.status === 'CANCELLED') continue
    const jobNo = job.jobNumber?.trim() || jobLabel(job)
    const agent = job.party?.kind === 'AGENT' ? job.party.name : null

    for (const line of job.ciplLines) {
      const hall = line.exhibitor?.hall?.trim() || null
      const key = hall ? hall.toUpperCase() : ''
      let draft = drafts.get(key)
      if (!draft) {
        draft = { key, label: hall, rows: [], exhibitors: new Set(), koli: [] }
        drafts.set(key, draft)
      }

      draft.rows.push({
        key: line.id,
        exhibitorName: line.exhibitor?.name ?? line.nameOnDocument,
        linked: Boolean(line.exhibitorId),
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
    .sort((a, b) => {
      if (a.label === null || b.label === null) return Number(a.label === null) - Number(b.label === null)
      return collator.compare(a.label, b.label)
    })
    .map((draft) => ({
      key: draft.key,
      label: draft.label,
      rows: draft.rows.sort(compareRows),
      exhibitorCount: draft.exhibitors.size,
      totals: summarizeKoliCollections(draft.koli),
    }))
}

function compareRows(a: HallRow, b: HallRow): number {
  if (a.booth === null || b.booth === null) {
    if (a.booth !== b.booth) return a.booth === null ? 1 : -1
  } else {
    const byBooth = collator.compare(a.booth, b.booth)
    if (byBooth !== 0) return byBooth
  }
  return collator.compare(a.exhibitorName, b.exhibitorName) || collator.compare(a.jobNo, b.jobNo)
}
