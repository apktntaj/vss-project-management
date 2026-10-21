import 'server-only'

// Mengapa: satu-satunya pemilik query tabel `app_users` untuk slice auth. Repository murni I/O —
// tanpa aturan bisnis selain verifikasi kredensial yang memang milik lapisan ini. Setiap query
// disaring ke workspace single-tenant lewat `workspace_members` (Req 5.4). `import 'server-only'`
// di atas menjaga modul ini tidak pernah ikut ke bundle browser (Req 3.2, 20.2).

import { withWorkspace } from '@/lib/server/db'
import { verifyPassword } from '@/lib/auth/password'
import { validateCredential } from '@/domain/auth/validation'
import type { Credential, CurrentUser, Role, User, AuthenticatedPrincipal } from '@/domain/auth/types'

// Bentuk baris mentah dari `app_users` (snake_case apa adanya dari Postgres). Dipakai internal
// untuk memetakan ke tipe domain `User` yang camelCase.
type AppUserRow = {
  id: string
  email: string
  full_name: string
  role: Role
  is_admin: boolean
  is_active: boolean
  password_hash: string
}

// Kolom yang diambil — eksplisit agar tidak pernah menarik lebih dari yang dibutuhkan.
const USER_COLUMNS = 'id, email, full_name, role, is_admin, is_active, password_hash'

/**
 * Cari user berdasarkan email (di-normalisasi lower-case + trim) yang MERUPAKAN anggota workspace
 * default. Mengembalikan null bila tidak ditemukan atau bukan anggota workspace. Memetakan kolom
 * snake_case DB ke tipe domain `User` camelCase; `workspaceId` diisi dari konteks workspace aktif.
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  const normalizedEmail = email.trim().toLowerCase()
  if (normalizedEmail.length === 0) return null

  const { client, workspaceId } = await withWorkspace()

  // Batasi ke anggota workspace lewat inner join ke `workspace_members`; tanpa keanggotaan,
  // user tidak dianggap milik tenant ini.
  const { data, error } = await client
    .from('app_users')
    .select(`${USER_COLUMNS}, workspace_members!inner(workspace_id)`)
    .eq('email', normalizedEmail)
    .eq('workspace_members.workspace_id', workspaceId)
    .maybeSingle<AppUserRow>()

  if (error || !data) return null

  return {
    id: data.id,
    email: data.email,
    fullName: data.full_name,
    role: data.role,
    isAdmin: data.is_admin,
    isActive: data.is_active,
    passwordHash: data.password_hash,
    workspaceId,
  }
}

// Opsi anggota workspace untuk picker (mis. PIC pada form event) — identitas minimal saja.
type MemberOptionRow = { id: string; full_name: string }

/**
 * Daftar anggota workspace AKTIF (id + nama) untuk keperluan picker seperti pilihan PIC event.
 * Disaring ke anggota workspace aktif lewat inner join `workspace_members` (pola
 * `findUserByEmail`), hanya `is_active`, diurutkan nama agar pilihan di UI stabil. Tidak membawa
 * email/klaim lain — pemanggil hanya butuh opsi nama.
 */
export async function listWorkspaceMembers(): Promise<{ id: string; fullName: string }[]> {
  const { client, workspaceId } = await withWorkspace()

  const { data, error } = await client
    .from('app_users')
    .select('id, full_name, workspace_members!inner(workspace_id)')
    .eq('workspace_members.workspace_id', workspaceId)
    .eq('is_active', true)
    .order('full_name')
    .returns<MemberOptionRow[]>()

  if (error) {
    throw new Error(`Daftar anggota tidak dapat dimuat: ${error.message}`)
  }
  return (data ?? []).map((row) => ({ id: row.id, fullName: row.full_name }))
}

/**
 * Verifikasi kredensial sign-in dan turunkan AuthenticatedPrincipal. Mengembalikan
 * `{ id, role, workspaceId, isAdmin }` pada sukses — tidak pernah menyertakan `passwordHash`.
 * Mengembalikan null pada setiap kegagalan: bentuk kredensial tidak valid, user tidak ditemukan,
 * user nonaktif, atau kata sandi salah. Plaintext password maupun nilai hash tidak pernah di-log.
 */
export async function authenticateCredential(credential: Credential): Promise<AuthenticatedPrincipal | null> {
  const validated = validateCredential(credential)
  if (!validated.ok) return null

  const user = await findUserByEmail(validated.value.email)
  if (!user) return null

  // User nonaktif ditolak sebelum verifikasi hash.
  if (!user.isActive) return null

  const passwordMatches = await verifyPassword(validated.value.password, user.passwordHash)
  if (!passwordMatches) return null

  // Reduksi ke identitas yang dicetak ke token sesi: klaim otorisasi + display (email, fullName);
  // hash dibuang di sini.
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    workspaceId: user.workspaceId,
    isAdmin: user.isAdmin,
  }
}
