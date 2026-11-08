import 'server-only'

// Batas publik repository job: SATU-SATUNYA pemilik query tabel `jobs` dan `job_cipl_lines`.
// Murni I/O, tanpa aturan bisnis; setiap query disaring `workspace_id` dari `withWorkspace()`.
//
//   ./job-crud.ts    — satu aggregate: muat, sisipkan, tulis-terjaga-versi, simpan CIPL, hapus
//   ./job-queries.ts — daftar tersaring (lengkap / ringkas)
//   ./shared.ts      — kolom select, mapper baris → DTO, error constraint (internal)

export {
  type NewJobRow,
  cancelJobGuarded,
  ensureEventAgent,
  exhibitorBelongsToEvent,
  findAgentName,
  findJobById,
  insertJob,
  saveJobCiplGuarded,
  updateJobGuarded,
} from './job-crud'
export { listJobSummaries, listJobs } from './job-queries'
export { JobConstraintError, type JobWritableColumns } from './shared'
