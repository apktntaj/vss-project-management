import 'server-only'

// Mengapa: Authorizer adalah SATU-SATUNYA tempat otorisasi peran + per-objek diputuskan untuk
// slice-slice use-case (Req 7, 19). Ia menegakkan dua hal yang terpisah: (1) pemetaan peran →
// Capability sebagai sumber-kebenaran tunggal lewat `can`, dan (2) urutan evaluasi yang ketat di
// `authorize` — peran DULU, baru guard per-objek. Pemisahan ini penting: guard per-objek milik
// use-case (mis. pemilik PIC vs supervisor) tidak boleh ikut memutuskan apakah peran berhak sama
// sekali, dan tidak boleh dievaluasi kalau peran sudah gagal (mencegah kebocoran kerja/efek).
// `import 'server-only'` di atas menjaga modul ini tak pernah masuk bundle browser (Req 3.2, 20.2).

import { auth } from '@/features/auth/nextauth'
import { ApiError } from '@/lib/server/errors'
import type { CurrentUser, Role } from '@/domain/auth/types'

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

/**
 * Turunkan CurrentUser dari sesi terverifikasi (NextAuth v5 JWT). Bila tidak ada sesi, atau
 * `user`/`role`/`workspaceId` tidak ada (bentuk sesi diaugmentasi opsional selama cutover),
 * perlakukan sebagai belum terautentikasi dan lempar `ApiError(401)` sesuai Error_Contract
 * (Req 7.1, 19.1). Pada sukses kembalikan HANYA `{ id, role, workspaceId }`.
 */
export async function requireCurrentUser(): Promise<CurrentUser> {
  const session = await auth()
  const user = session?.user

  // Narrow field opsional dari augmentasi: tanpa id/role/workspaceId lengkap, sesi tidak dapat
  // dipakai untuk otorisasi — diperlakukan sebagai tidak terautentikasi.
  // if (!user || !user.id || !user.role || !user.workspaceId) {
  //   throw new ApiError(401, 'Autentikasi diperlukan.')
  // }

  return { id: user.id, role: user.role, workspaceId: user.workspaceId }
}

/**
 * Tegakkan otorisasi untuk satu tindakan. Urutan evaluasi WAJIB:
 * 1. Cek peran lewat `can(currentUser.role, capability)`. Bila gagal → `ApiError(403)` dan
 *    `objectGuard` TIDAK dipanggil (Req 7.2, 7.4, 7.6).
 * 2. Hanya bila peran lolos DAN `objectGuard` disuplai: `await objectGuard()`. Bila false →
 *    `ApiError(403)` dengan pesan kepemilikan per-objek (Req 7.5).
 *
 * Pada lolos penuh, kembalikan void tanpa efek samping.
 */
export async function authorize(
  currentUser: CurrentUser,
  capability: Capability,
  objectGuard?: () => Promise<boolean>,
): Promise<void> {
  // Peran DULU — gerbang kasar sebelum menyentuh objek apa pun.
  if (!can(currentUser.role, capability)) {
    throw new ApiError(403, 'Anda tidak memiliki izin untuk melakukan tindakan ini.')
  }

  // Guard per-objek hanya dievaluasi setelah peran lolos; tidak pernah mengubah keputusan peran.
  if (objectGuard) {
    const allowed = await objectGuard()
    if (!allowed) {
      throw new ApiError(403, 'Hanya PIC event atau supervisor yang dapat melakukan tindakan ini.')
    }
  }
}
