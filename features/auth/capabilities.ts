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

/**
 * Pemetaan peran → Capability: SATU tabel eksplisit, tanpa logika bercabang.
 *
 * Intent desain:
 * - `event:read` — semua peran boleh membaca.
 * - `event:create` / `event:update` — STAFF dan SUPERVISOR (operator utama pipeline).
 * - `event:cancel` / `event:delete` — digerbang di tingkat capability ke STAFF dan SUPERVISOR;
 *   pengecekan kepemilikan PIC-vs-SUPERVISOR adalah guard per-objek yang DISUPLAI use-case,
 *   bukan dibakar ke dalam `can`.
 * - `reference:create` — STAFF dan SUPERVISOR (pembuatan master data venue/EO inline).
 *
 * SUPERVISOR memegang set capability terluas. CUSTOMER_SERVICE dan DOCUMENT_ASSISTANT saat ini
 * hanya boleh membaca event.
 */
const ROLE_CAPABILITIES: Record<Role, ReadonlySet<Capability>> = {
  SUPERVISOR: new Set<Capability>([
    'event:read',
    'event:create',
    'event:update',
    'event:cancel',
    'event:delete',
    'reference:create',
  ]),
  STAFF: new Set<Capability>([
    'event:read',
    'event:create',
    'event:update',
    'event:cancel',
    'event:delete',
    'reference:create',
  ]),
  CUSTOMER_SERVICE: new Set<Capability>(['event:read']),
  DOCUMENT_ASSISTANT: new Set<Capability>(['event:read']),
}

/**
 * Fungsi MURNI: true iff `role` dipetakan ke `capability` di tabel sumber-kebenaran tunggal.
 * Tanpa I/O, tanpa throw (Req 7.3, 19.4).
 */
export function can(role: Role, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].has(capability)
}
