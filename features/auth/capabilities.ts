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
  | 'job:cancel'
  | 'exhibitor:write'
  | 'job:invoice:write'
  | 'event:access:manage'

/**
 * Pemetaan peran → Capability: SATU tabel eksplisit, tanpa logika bercabang.
 *
 * Admin (`is_admin`) adalah super-user yang melewati gerbang ini di `authorize`; ia tidak didaftar.
 *
 * Pola "peran dulu, lalu guard per-objek": capability menyatakan peran *boleh* melakukan jenis
 * tindakan itu; kaitan dengan event (PIC / penerima akses) menentukan *objek mana*.
 *
 * - CS — PIC event: kelola event miliknya (ubah/batal/hapus + beri akses), baca, tulis job dan
 *   exhibitor. `event:create` dan `reference:create` hanya admin (tidak didaftar di sini).
 * - SPESIALIS — pegang jenis job tertentu di event yang ia diberi akses: baca, tulis job dan
 *   exhibitor (cakupan `'OWN` lewat guard per-objek `write-scope`).
 * - FINANCE — baca dan SATU-SATUNYA yang boleh MENULIS tagihan job (`job:invoice:write`);
 *   membaca tagihan terbuka untuk semua peran.
 */
const ROLE_CAPABILITIES: Record<Role, ReadonlySet<Capability>> = {
  CS: new Set<Capability>([
    'event:read',
    'event:update',
    'event:cancel',
    'event:delete',
    'event:access:manage',
    'job:read',
    'job:create',
    'job:update',
    'job:cancel',
    'exhibitor:write',
  ]),
  SPESIALIS: new Set<Capability>([
    'event:read',
    'job:read',
    'job:create',
    'job:update',
    'job:cancel',
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
 * Peran tak dikenal (token lama) → false. Tanpa I/O, tanpa throw (Req 7.3, 19.4).
 */
export function can(role: Role, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role]?.has(capability) ?? false
}
