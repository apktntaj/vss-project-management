import 'server-only'

// I/O satu aggregate Job: muat, sisipkan, tulis-terjaga-versi, simpan CIPL (RPC atomik), hapus —
// plus pengecekan rujukan ke aggregate lain. Tanpa aturan bisnis.

import { withWorkspace } from '@/lib/server/db'
import type { Job, JobCiplLineInput, JobOperationalDetails } from '@/domain/job/types'
import type { CiplDocument } from '@/domain/exhibition/cipl-document'
import {
  JOB_COLUMNS,
  isUuid,
  raise,
  toJobs,
  type JobRow,
  type JobWritableColumns,
} from './shared'

export async function findJobById(jobId: string): Promise<Job | null> {
  if (!isUuid(jobId)) return null
  const context = await withWorkspace()
  const { client, workspaceId } = context
  const { data, error } = await client
    .from('jobs')
    .select(JOB_COLUMNS)
    .eq('workspace_id', workspaceId)
    .eq('id', jobId)
    .maybeSingle<JobRow>()
  if (error) raise('Gagal memuat job', error)
  return data ? (await toJobs(context, [data]))[0] : null
}

export type NewJobRow = {
  event_id: string
  kind: Job['kind']
  international_jenis: Job['internationalJenis']
  transport_mode: Job['transportMode']
  agent_id: string | null
  exhibitor_id: string | null
  created_by_id: string
  operational: JobOperationalDetails
}

export async function insertJob(row: NewJobRow): Promise<Job> {
  const context = await withWorkspace()
  const { client, workspaceId } = context
  const { data, error } = await client
    .from('jobs')
    .insert({ ...row, workspace_id: workspaceId })
    .select(JOB_COLUMNS)
    .single<JobRow>()
  if (error) raise('Gagal membuat job', error)
  return (await toJobs(context, [data]))[0]
}

/**
 * Tulis kolom aggregate HANYA bila versi di DB masih `expectedVersion`, lalu naikkan versinya.
 * Mengembalikan null bila tidak ada baris yang cocok (job hilang atau sudah diubah orang lain);
 * use-case yang membedakan keduanya.
 */
export async function updateJobGuarded(
  jobId: string,
  expectedVersion: number,
  columns: JobWritableColumns,
): Promise<Job | null> {
  if (!isUuid(jobId)) return null
  const context = await withWorkspace()
  const { client, workspaceId } = context
  const { data, error } = await client
    .from('jobs')
    .update({ ...columns, version: expectedVersion + 1, updated_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('id', jobId)
    .eq('version', expectedVersion)
    .select(JOB_COLUMNS)
    .maybeSingle<JobRow>()
  if (error) raise('Gagal menyimpan job', error)
  return data ? (await toJobs(context, [data]))[0] : null
}

/**
 * Simpan dokumen CIPL mentah + seluruh baris CIPL dalam satu transaksi (fungsi DB
 * `save_job_cipl`). Mengembalikan false bila versi basi / job tidak ada.
 */
export async function saveJobCiplGuarded(
  jobId: string,
  expectedVersion: number,
  ciplDocument: CiplDocument | null,
  lines: JobCiplLineInput[],
): Promise<boolean> {
  if (!isUuid(jobId)) return false
  const { client, workspaceId } = await withWorkspace()
  const { data, error } = await client.rpc('save_job_cipl', {
    p_workspace_id: workspaceId,
    p_job_id: jobId,
    p_expected_version: expectedVersion,
    p_cipl_document: ciplDocument,
    p_lines: lines,
  })
  if (error) raise('Gagal menyimpan CIPL job', error)
  return data !== null
}

/** Hapus baris job beserta rujukan polimorfik yang tak bisa dijaga FK (tiket berkonteks JOB). */
export async function deleteJobRow(jobId: string): Promise<void> {
  const { client, workspaceId } = await withWorkspace()
  const { error: ticketsError } = await client
    .from('tickets')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('context_kind', 'JOB')
    .eq('context_id', jobId)
  if (ticketsError) raise('Gagal menghapus tiket job', ticketsError)
  const { error } = await client
    .from('jobs')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('id', jobId)
  if (error) raise('Gagal menghapus job', error)
}

/** Nama agent (master data payload) atau null bila agent tidak ada di workspace. */
export async function findAgentName(agentId: string): Promise<string | null> {
  const { client, workspaceId } = await withWorkspace()
  const { data, error } = await client
    .from('agents')
    .select('name:payload->>name')
    .eq('workspace_id', workspaceId)
    .eq('id', agentId)
    .maybeSingle<{ name: string | null }>()
  if (error) raise('Gagal memuat agent', error)
  return data ? (data.name ?? '') : null
}

/** Apakah exhibitor terdaftar pada event yang sama dengan job? */
export async function exhibitorBelongsToEvent(exhibitorId: string, eventId: string): Promise<boolean> {
  if (!isUuid(exhibitorId)) return false
  const { client, workspaceId } = await withWorkspace()
  const { count, error } = await client
    .from('exhibitors')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('id', exhibitorId)
    .eq('event_id', eventId)
  if (error) raise('Gagal memeriksa exhibitor', error)
  return (count ?? 0) > 0
}

/** Daftarkan agent sebagai peserta event (idempoten) — agent pembawa job wajib terdaftar di event. */
export async function ensureEventAgent(eventId: string, agentId: string, userId: string): Promise<void> {
  const { client, workspaceId } = await withWorkspace()
  const { error } = await client.from('event_agents').upsert(
    {
      workspace_id: workspaceId,
      id: crypto.randomUUID(),
      event_id: eventId,
      agent_id: agentId,
      created_by_id: userId,
    },
    { onConflict: 'workspace_id,event_id,agent_id', ignoreDuplicates: true },
  )
  if (error) raise('Gagal mendaftarkan agent ke event', error)
}

/** Urutan No Job yang sudah dipakai di satu event untuk satu awalan. */
export async function listManifestSeqs(eventId: string, prefix: string): Promise<number[]> {
  const { client, workspaceId } = await withWorkspace()
  const { data, error } = await client
    .from('jobs')
    .select('manifest_seq')
    .eq('workspace_id', workspaceId)
    .eq('event_id', eventId)
    .eq('manifest_prefix', prefix)
    .not('manifest_seq', 'is', null)
    .returns<Array<{ manifest_seq: number }>>()
  if (error) raise('Gagal memuat nomor job', error)
  return (data ?? []).map((row) => row.manifest_seq)
}
