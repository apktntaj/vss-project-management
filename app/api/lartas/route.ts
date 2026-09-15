import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { lookupHsCodes } from '@/lib/insw-lartas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const requestSchema = z.object({
  hsCodes: z.array(z.string().min(1)).min(1).max(20),
})

function lookupConfig() {
  const timeout = Number(process.env.LARTAS_REQUEST_TIMEOUT_MS)
  return {
    baseUrl: process.env.LARTAS_BASE_URL?.trim() || 'https://api.insw.go.id',
    token: process.env.LARTAS_TOKEN?.trim(),
    tokenFilePath: process.env.LARTAS_TOKEN_FILE_PATH?.trim() || undefined,
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 30_000,
    clientId: process.env.INSW_CLIENT_ID?.trim(),
    clientBearer: process.env.INSW_CLIENT_BEARER?.trim(),
  }
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 })

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Masukkan 1 sampai 20 kode HS.' }, { status: 400 })
  }

  const hsCodes = [...new Set(parsed.data.hsCodes.map((value) => value.replace(/\D/g, '')))]
  const results = await lookupHsCodes(hsCodes, lookupConfig())
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
