import 'server-only'

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

// Modul fondasi kontrak error: satu tempat yang memetakan error apa pun ke bentuk
// seragam `{ error: '<pesan Indonesia>' }` + kode status HTTP (Error_Contract, Req 8).
// Teks untuk pengguna selalu bahasa Indonesia; identifier/kode bahasa Inggris (Req 8.8).

/** Bentuk body error seragam yang dikembalikan setiap Route_Handler (Req 8.1). */
export type ErrorBody = { error: string }

/** Pesan default untuk kegagalan Supabase/vendor atau error tak terduga (Req 8.7). */
const SERVICE_UNAVAILABLE_MESSAGE = 'Layanan sedang tidak tersedia. Coba lagi.'

/**
 * Error berkode status yang dilempar oleh Use_Case/Authorizer dan dipetakan ke
 * Error_Contract oleh `toErrorResponse`. Membawa status HTTP (401/403/404/400/409/503)
 * dan pesan bahasa Indonesia untuk pengguna (Req 8.2–8.7).
 */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    // Pulihkan prototype chain agar `instanceof ApiError` bekerja setelah transpile.
    Object.setPrototypeOf(this, ApiError.prototype)
  }
}

/** Ambil pesan validasi Zod yang paling relevan (issue pertama) untuk respons 400 (Req 8.5). */
function firstZodMessage(error: ZodError): string {
  return error.issues[0]?.message ?? 'Input tidak valid.'
}

/**
 * Memetakan error apa pun ke respons `NextResponse.json({ error }, { status })`:
 * - ZodError            → 400 dengan pesan validasi yang relevan (Req 8.5)
 * - ApiError            → status + pesannya sendiri (Req 8.2, 8.3, 8.4, 8.6)
 * - selain itu          → 503 `Layanan sedang tidak tersedia. Coba lagi.` (Req 8.7)
 *
 * Bentuk body selalu `{ error: '<pesan Indonesia>' }` (Req 8.1).
 */
export function toErrorResponse(error: unknown): NextResponse<ErrorBody> {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: firstZodMessage(error) }, { status: 400 })
  }
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  return NextResponse.json({ error: SERVICE_UNAVAILABLE_MESSAGE }, { status: 503 })
}
