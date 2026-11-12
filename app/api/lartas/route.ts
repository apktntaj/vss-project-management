import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { inswLookupConfig } from '@/lib/insw-config'
import { lookupHsCodes } from '@/lib/insw-lartas'
import { normalizeHsCode } from '@/lib/job-lartas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const requestSchema = z.object({
  hsCodes: z.array(z.string().min(1)).min(1).max(20),
})

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 })

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Masukkan 1 sampai 20 kode HS.' }, { status: 400 })
  }

  // Pos tarif 10 digit dipakai 8 digit pertamanya; kode lain diteruskan apa adanya agar INSW
  // menandainya `invalid` alih-alih diam-diam dianggap valid.
  const hsCodes = [
    ...new Set(
      parsed.data.hsCodes.map((value) => normalizeHsCode(value)?.digits ?? value.replace(/\D/g, '')),
    ),
  ]
  const results = await lookupHsCodes(hsCodes, inswLookupConfig())
  return NextResponse.json({
    notice: "Status LARTAS hanya boleh disimpulkan 'Tidak Ada' jika verification bernilai 'verified'.",
    results: results.map((result) => ({
      ...result,
      formattedHsCode: /^\d{8}$/.test(result.hsCode)
        ? result.hsCode.replace(/(\d{4})(\d{2})(\d{2})/, '$1.$2.$3')
        : result.hsCode,
    })),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
