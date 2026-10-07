import { NextResponse } from 'next/server'
import { CeisaClient } from '@/lib/server/ceisa/client'
import { ceisaFailure, ceisaNoStore, requireCeisaUser } from '@/lib/server/ceisa/http'
import { markCeisaVerification } from '@/lib/server/ceisa/repository'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function POST() {
  const denied = await requireCeisaUser(true)
  if (denied) return denied
  try {
    await new CeisaClient().request('kurs/USD')
    await markCeisaVerification('VERIFIED')
    return NextResponse.json({ verified: true }, { headers: ceisaNoStore })
  } catch (error) {
    try { await markCeisaVerification('FAILED') } catch { /* unavailable connection remains unavailable */ }
    return ceisaFailure(error)
  }
}
