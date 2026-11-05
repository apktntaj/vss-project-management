import 'server-only'

// Daftar job tersaring di SQL — menggantikan pola "muat semua tabel lalu saring di browser".

import { withWorkspace } from '@/lib/server/db'
import type { Job, JobSummary } from '@/domain/job/types'
import type { JobListQuery } from '@/domain/job/validation'
import {
  JOB_COLUMNS,
  JOB_SUMMARY_COLUMNS,
  raise,
  toJobs,
  toJobSummary,
  type JobRow,
  type JobSummaryRow,
} from './shared'

type ListFilter = Omit<JobListQuery, 'view'>

// Karakter yang punya makna di sintaks filter `or=(...)` PostgREST / pola ILIKE.
function searchPattern(search: string): string | null {
  const cleaned = search.replace(/[,()*%\\:"]/g, ' ').trim()
  return cleaned ? `%${cleaned}%` : null
}

/** Filter `or=(...)` untuk pencarian, atau null bila tidak ada kata kunci yang tersisa. */
function searchFilter(filter: ListFilter): string | null {
  const pattern = filter.search ? searchPattern(filter.search) : null
  return pattern
    ? `transport_document_number.ilike.${pattern},commercial_invoice_number.ilike.${pattern}`
    : null
}

export async function listJobs(filter: ListFilter): Promise<Job[]> {
  const context = await withWorkspace()
  const { client, workspaceId } = context
  let query = client.from('jobs').select(JOB_COLUMNS).eq('workspace_id', workspaceId)
  if (filter.eventId) query = query.eq('event_id', filter.eventId)
  if (filter.status) query = query.eq('status', filter.status)
  const search = searchFilter(filter)
  if (search) query = query.or(search)
  const { data, error } = await query
    .order('updated_at', { ascending: false })
    .returns<JobRow[]>()
  if (error) raise('Gagal memuat daftar job', error)
  return toJobs(context, data ?? [])
}

export async function listJobSummaries(filter: ListFilter): Promise<JobSummary[]> {
  const { client, workspaceId } = await withWorkspace()
  let query = client.from('jobs').select(JOB_SUMMARY_COLUMNS).eq('workspace_id', workspaceId)
  if (filter.eventId) query = query.eq('event_id', filter.eventId)
  if (filter.status) query = query.eq('status', filter.status)
  const search = searchFilter(filter)
  if (search) query = query.or(search)
  const { data, error } = await query
    .order('updated_at', { ascending: false })
    .returns<JobSummaryRow[]>()
  if (error) raise('Gagal memuat daftar job', error)
  return (data ?? []).map(toJobSummary)
}
