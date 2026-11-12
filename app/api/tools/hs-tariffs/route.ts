import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Tarif BM/PPN/PPH untuk pos BTKI 8 digit pilihan tool HS BTKI. Kode sudah berasal dari BTKI INSW,
// jadi pengecekan keberadaan kode dilewati dan hanya detail komoditas yang diminta.

import { auth } from '@/auth'
import { LARTAS_MAX_CODES_PER_REQUEST } from '@/domain/lartas/types'
import { inswLookupConfig } from '@/lib/insw-config'
import { lookupHsCodes } from '@/lib/insw-lartas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const requestSchema = z.object({
  hsCodes: z.array(z.string().regex(/^\d{8}$/)).min(1).max(LARTAS_MAX_CODES_PER_REQUEST),
})

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 })

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Kirim 1 sampai ${LARTAS_MAX_CODES_PER_REQUEST} kode HS 8 digit.` },
      { status: 400 },
    )
  }

  const results = await lookupHsCodes([...new Set(parsed.data.hsCodes)], inswLookupConfig(), undefined, {
    skipSearch: true,
  })
  return NextResponse.json(
    {
      results: results.map(({ hsCode, lookupStatus, tariffs }) => ({ hsCode, lookupStatus, tariffs })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
