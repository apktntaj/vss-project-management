// Mengapa: tabel peran → Capability adalah logika MURNI tanpa I/O — ia dipisah dari
// `authorize.ts` (yang `server-only` karena membaca sesi) agar dapat diuji unit oleh bun test
// dan dipakai di konteks edge tanpa menarik `server-only`. `authorize.ts` tetap SATU-SATUNYA
// tempat keputusan otorisasi dieksekusi; modul ini hanya sumber tabelnya.

import type { Role } from '@/domain/auth/types'

/**
 * Capability = tindakan berbutir yang dilindungi otorisasi. Union ini, bersama tabel pemetaan di
 * bawah, adalah sumber kebenaran tunggal untuk "peran mana boleh melakukan apa" (Req 7.3, 19.4).
 * Tambah capability baru di sini lalu daftarkan di `ROLE_CAPABILITIES` — tanpa percabangan ad-hoc
 * di tempat lain.
 */
export type Capability =
  | 'event:create'
  | 'event:update'
  | 'event:cancel'
  | 'event:delete'
  | 'event:read'
  | 'reference:create'
  | 'job:read'
  | 'job:create'
  | 'job:update'
  | 'job:delete'
  | 'exhibitor:write'
  | 'job:invoice:write'
  | 'event:access:manage'

/**
 * Pemetaan peran → Capability: SATU tabel eksplisit, tanpa logika bercabang.
 *
 * Admin (`is_admin`) adalah super-user yang melewati gerbang ini di `authorize`; ia tidak didaftar.
 *
 * Intent desain:
 * - CS — PIC event: kelola event (buat/ubah/batal/hapus) + beri akses event (`event:access:manage`),
 *   master data referensi, baca job, dan tulis exhibitor.
 * - STAFF — operator luas: event + job + referensi, tanpa tagihan. Bukan PIC (PIC hanya CS).
 * - OPERATIONS — pipeline job/shipment: job + exhibitor, baca event.
 * - DOCUMENT_ASSISTANT — dokumen job: baca, ubah job, tulis exhibitor.
 * - FINANCE — baca event/job dan SATU-SATUNYA yang boleh MENULIS tagihan job (`job:invoice:write`);
 *   membaca tagihan terbuka untuk semua peran, jadi tidak digerbang capability.
 * - `event:update|cancel|delete` selain capability juga butuh guard per-objek (PIC / penerima akses
 *   / admin) yang DISUPLAI use-case, bukan dibakar ke dalam `can`.
 */
const ROLE_CAPABILITIES: Record<Role, ReadonlySet<Capability>> = {
  CS: new Set<Capability>([
    'event:read',
    'event:create',
    'event:update',
    'event:cancel',
    'event:delete',
    'event:access:manage',
    'reference:create',
    'job:read',
    'exhibitor:write',
  ]),
  STAFF: new Set<Capability>([
    'event:read',
    'event:create',
    'event:update',
    'event:cancel',
    'event:delete',
    'reference:create',
    'job:read',
    'job:create',
    'job:update',
    'job:delete',
    'exhibitor:write',
  ]),
  OPERATIONS: new Set<Capability>([
    'event:read',
    'job:read',
    'job:create',
    'job:update',
    'job:delete',
    'exhibitor:write',
  ]),
  DOCUMENT_ASSISTANT: new Set<Capability>([
    'event:read',
    'job:read',
    'job:update',
    'exhibitor:write',
  ]),
  FINANCE: new Set<Capability>([
    'event:read',
    'job:read',
    'job:invoice:write',
  ]),
}

/**
 * Fungsi MURNI: true iff `role` dipetakan ke `capability` di tabel sumber-kebenaran tunggal.
 * Tanpa I/O, tanpa throw (Req 7.3, 19.4).
 */
export function can(role: Role, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].has(capability)
}
