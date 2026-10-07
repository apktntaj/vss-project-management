import 'server-only'

import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { CeisaError } from './client'

export async function requireCeisaUser(admin = false) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 })
  if (admin && !session.user.isAdmin) return NextResponse.json({ error: 'Hanya admin yang dapat mengelola CEISA.' }, { status: 403 })
  return null
}

export function ceisaFailure(error: unknown) {
  if (error instanceof CeisaError) {
    const status = error.code === 'CEISA_NOT_FOUND' ? 404 : error.code === 'CEISA_CONTRACT_MISMATCH' ? 502 : 503
    return NextResponse.json({ error: error.message, code: error.code }, { status, headers: { 'Cache-Control': 'no-store' } })
  }
  return NextResponse.json({ error: error instanceof Error ? error.message : 'CEISA service is unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
}

export const ceisaNoStore = { 'Cache-Control': 'no-store' }
