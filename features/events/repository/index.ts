import 'server-only'

// Mengapa: repository ini adalah SATU-SATUNYA pemilik query Postgres untuk slice event. Use-case
// dan komponen memanggilnya; ia tidak memegang aturan bisnis (murni I/O). `import 'server-only'`
// sebagai import efektif pertama adalah sabuk pengaman build-time — kunci service-role tidak boleh
// pernah ikut ke bundle browser (Req 3.2, 20.2). Setiap query menyaring `workspace_id` dari konteks
// `withWorkspace()` (single-tenant via `slug = 'default'`, Req 5.4). Mengikuti gaya
// `features/auth/repository.ts`: daftar kolom eksplisit, baris snake_case dipetakan ke camelCase,
// fungsi mengambil konteks via `withWorkspace()` sendiri dan hanya menerima argumen domain.
//
// Struktur direktori:
//   ./event-crud.ts     — CRUD + pencarian satu event + cancellation + pemeriksaan referensi
//   ./event-queries.ts  — daftar tersaring, ringkasan count, attention, insight, bentuk legacy
//   ./master-data.ts    — venue & event organizer (create-inline + pilihan yang sudah ada)
//   ./shared.ts         — helper + bentuk baris lintas modul (BUKAN bagian dari batas publik)
//
// Barrel ini adalah batas publik: hanya simbol di bawah yang boleh diimpor konsumen — tidak
// memakai `export *` agar permukaan API terlihat eksplisit di satu tempat.

export {
  type CancellationInput,
  type EventRow,
  type EventSummary,
  checkReferences,
  deleteEvent,
  findEventById,
  findEventSummary,
  hasDerivedData,
  insertCancellation,
  insertEvent,
  setEventStatus,
  updateEvent,
} from './event-crud'
export {
  type EventGrantee,
  deleteEventAccess,
  hasEventAccess,
  insertEventAccess,
  isActiveWorkspaceMember,
  listEventGrantees,
} from './event-access'
export { listLegacyEventRows, queryEventInsights, queryEventList } from './event-queries'
export {
  insertEventOrganizer,
  insertVenue,
  listEventOrganizers,
  listVenues,
} from './master-data'
