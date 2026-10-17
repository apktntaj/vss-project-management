// Mengapa: tipe entitas auth yang MURNI — User, Session, Role, dan kontrak logika hashing
// password. Modul ini bebas efek: tanpa storage, HTTP, React, Supabase, maupun node crypto.
// Implementasi hashing yang nyata (scrypt + salt acak) tinggal di lib/auth/password.ts
// (Server_Only_Module); di sini kita hanya mendeklarasikan KONTRAK-nya sebagai tipe/interface
// agar domain tetap dapat diuji dan digunakan ulang tanpa bergantung pada framework.
// Auth_Domain_Module — lihat Requirement 17.

// Peran pengguna yang benar-benar ditegakkan di server (bukan sekadar flag is_admin).
export type Role = 'STAFF' | 'SUPERVISOR' | 'CUSTOMER_SERVICE' | 'DOCUMENT_ASSISTANT'

// Daftar seluruh Role sebagai nilai runtime — berguna untuk iterasi/validasi tanpa menduplikasi
// anggota union. Dijaga sinkron dengan tipe Role oleh anotasi `satisfies`.
export const ROLES = ['STAFF', 'SUPERVISOR', 'CUSTOMER_SERVICE', 'DOCUMENT_ASSISTANT'] as const satisfies readonly Role[]

// Entitas pengguna. `passwordHash` adalah nilai hash self-describing berversi (lihat
// PasswordHashContract); plaintext TIDAK PERNAH hidup di tipe ini. Domain merujuk hash sebagai
// string buram — ia tidak tahu, dan tidak perlu tahu, cara menghitungnya.
export type User = {
  id: string
  email: string
  fullName: string
  role: Role
  isAdmin: boolean
  isActive: boolean
  passwordHash: string
  workspaceId: string
}

// CurrentUser = identitas terautentikasi yang direduksi ke hal yang dibutuhkan otorisasi.
// Bentuk ini yang dibawa token sesi JWT; tidak pernah menyertakan passwordHash.
// Bentuk ini TETAP TIDAK MENYERTAKAN isAdmin untuk menjaga kompatibilitas otorisasi.
export type CurrentUser = { id: string; role: Role; workspaceId: string }

// AuthenticatedPrincipal = identitas terautentikasi lengkap untuk dicetak ke token sesi.
// Membawa CurrentUser plus `isAdmin` untuk keperluan administratif.
export type AuthenticatedPrincipal = CurrentUser & { isAdmin: boolean }

// Sesi terotentikasi berbasis JWT (NextAuth v5). Membawa bentuk CurrentUser tanpa mempersist
// tabel sesi. `expiresAt` adalah epoch milidetik kedaluwarsa token.
export type Session = {
  user: CurrentUser
  expiresAt: number
}

// Kredensial mentah yang dikirim saat sign-in, sebelum divalidasi.
export type Credential = {
  email: string
  password: string
}

// Kredensial yang sudah lolos validasi murni (email ter-normalisasi lower-case, non-kosong).
// Tipe terpisah agar pemanggil tidak bisa keliru meneruskan Credential mentah ke verifikasi.
export type ValidatedCredential = {
  email: string
  password: string
}

// ── Kontrak logika hashing password (Requirement 17.2) ──────────────────────────────────────
// Domain HANYA mendeklarasikan kontrak; implementasi (scrypt) ada di lib/auth/password.ts.
// Kontrak menetapkan: scrypt + salt acak, nilai hash self-describing berversi, dan perbandingan
// hash dengan waktu konstan (timingSafeEqual).

// Algoritma hash yang didukung. Self-describing: algoritma disimpan DI DALAM string hash sehingga
// nilai lama tetap dapat diverifikasi walau parameter default berubah di kemudian hari.
export type PasswordHashAlgorithm = 'scrypt'

// Parameter scrypt yang tertanam di nilai hash self-describing (bagian "berversi" dari kontrak).
// cost = faktor biaya CPU/memori (N), blockSize = r, parallelization = p.
export type ScryptParameters = {
  cost: number
  blockSize: number
  parallelization: number
}

// Hasil penguraian nilai hash self-describing menjadi komponen-komponennya. Salt dan hash
// disimpan sebagai string ter-encode (base64url) agar tipe tetap bebas dari Buffer/node crypto.
export type ParsedPasswordHash = {
  algorithm: PasswordHashAlgorithm
  parameters: ScryptParameters
  salt: string
  hash: string
}

// Kontrak fungsi hashing password. Implementasi WAJIB: memakai scrypt dengan salt acak per hash,
// mengembalikan nilai self-describing berversi (mencantumkan algoritma + parameter + salt), dan
// memverifikasi dengan perbandingan waktu konstan. Kontrak ini disuntik/di-implementasi di tepi
// (lib/auth/password.ts) — domain tidak pernah memanggil node crypto sendiri.
export type PasswordHasher = {
  // Menghasilkan nilai hash self-describing berversi dari password plaintext.
  hash(password: string): Promise<string>
  // Membandingkan password plaintext terhadap nilai hash self-describing dengan waktu konstan.
  // Mengembalikan false (bukan throw) bila nilai hash tidak dapat diurai.
  verify(password: string, encoded: string): Promise<boolean>
}
