import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Saran pos BTKI 8 digit untuk tool HS BTKI. Ke INSW hanya awalan HS yang dikirim; uraian barang
// dikirim ke LLM untuk dicocokkan dengan kandidat pos.

import { auth } from '@/auth'
import { BTKI_MATCH_MAX_ITEMS } from '@/lib/btki-match'
import { suggestBtki } from '@/lib/server/btki-suggest'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const requestSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        description: z.string().max(2000),
        hsCode: z.string().max(40),
      }),
    )
    .min(1)
    .max(BTKI_MATCH_MAX_ITEMS),
})

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 })

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Kirim 1 sampai ${BTKI_MATCH_MAX_ITEMS} baris barang.` },
      { status: 400 },
    )
  }

  try {
    return NextResponse.json(await suggestBtki(parsed.data.items), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('BTKI match failed', { message: error instanceof Error ? error.message : 'unknown' })
    return NextResponse.json({ error: 'Pencarian pos BTKI gagal. Coba lagi.' }, { status: 502 })
  }
}
