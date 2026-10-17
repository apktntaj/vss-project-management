'use server'

// Mengapa: `signInAction` adalah SATU dari HANYA DUA Server Action di sistem (yang lain adalah
// `signOutAction`) — DD-A6 / Req 18.6. Semua mutasi data lain berjalan lewat route handler, bukan
// Server Action. Direktif `'use server'` di atas sudah menjamin eksekusi server dan menandai tiap
// fungsi async yang diekspor sebagai Server Action; karena itu modul ini TIDAK memakai
// `import 'server-only'` (itu untuk modul server biasa, bukan Server Action) dan BUKAN `'use client'`.

import { AuthError } from 'next-auth'
import { signIn } from '@/features/auth/nextauth'

// Hasil yang serializable agar leaf klien login dapat merendernya. Sukses tidak membawa payload
// (sesi sudah terbentuk sebagai cookie oleh NextAuth); gagal membawa pesan bahasa Indonesia siap
// tampil. Bentuk diskriminasi `{ ok: true } | { error: string }` menjaga pemanggil eksplisit.
export type SignInResult = { ok: true } | { error: string }

// Pesan untuk kredensial salah WAJIB persis seperti ini (Req 18.5). Dipisah sebagai konstanta agar
// tidak ada risiko salah ketik di cabang penanganan error.
const INVALID_CREDENTIAL_MESSAGE = 'Email atau kata sandi salah.'

// Pesan generik untuk kegagalan tak terduga — sengaja tidak membocorkan detail internal/stack.
const GENERIC_FAILURE_MESSAGE = 'Gagal masuk. Coba lagi beberapa saat.'

// Server Action sign-in. Menerima `FormData` karena ia menopang form login
// (`<form action={signInAction}>`), jadi email/password dibaca langsung dari field form.
export async function signInAction(formData: FormData): Promise<SignInResult> {
  // Baca sebagai string; NextAuth/`authorize` yang memvalidasi bentuk sebenarnya. Kita tidak
  // pernah menyentuh atau mencatat plaintext password di sini.
  const email = typeof formData.get('email') === 'string' ? (formData.get('email') as string) : ''
  const password =
    typeof formData.get('password') === 'string' ? (formData.get('password') as string) : ''

  try {
    // `redirect: false` → NextAuth mengembalikan ke kita alih-alih melempar redirect; pada sukses
    // sesi JWT (membawa role lewat callback di nextauth.ts) sudah terbentuk sebagai cookie.
    await signIn('credentials', { email, password, redirect: false })
    return { ok: true }
  } catch (error) {
    // Kredensial salah di NextAuth v5 muncul sebagai AuthError dengan `type === 'CredentialsSignin'`.
    // Petakan ke pesan user yang pasti; JANGAN membentuk sesi, JANGAN melempar ulang error mentah.
    if (error instanceof AuthError) {
      if (error.type === 'CredentialsSignin') return { error: INVALID_CREDENTIAL_MESSAGE }
      // AuthError lain (mis. konfigurasi) → pesan generik tanpa membocorkan internal.
      return { error: GENERIC_FAILURE_MESSAGE }
    }
    // Catatan: bila di masa depan cabang sukses memakai `redirect()`, Next.js melempar error
    // kontrol-alur khusus yang HARUS dibiarkan merambat; ia bukan `AuthError`, jadi akan jatuh ke
    // sini. Karena saat ini kita memakai `redirect: false`, error non-AuthError apa pun adalah
    // kegagalan tak terduga yang kita rangkum sebagai pesan generik, bukan dilempar ulang, agar
    // tidak membocorkan stack ke klien.
    return { error: GENERIC_FAILURE_MESSAGE }
  }
}
