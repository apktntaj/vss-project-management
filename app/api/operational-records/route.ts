import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/auth'
import { agentRecordSchema } from '@/domain/agent/validation'
import {
  getRecord,
  listRecords,
  operationalTables,
  saveRecord,
  type OperationalTable,
} from '@/lib/supabase/operational-records'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function tableFrom(value: string | null): OperationalTable | null {
  return value && (operationalTables as readonly string[]).includes(value) ? value as OperationalTable : null
}

export async function GET(request: NextRequest) {
  if (!(await auth())?.user) return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 })
  const table = tableFrom(request.nextUrl.searchParams.get('table'))
  if (!table) return NextResponse.json({ error: 'Koleksi data tidak valid.' }, { status: 400 })
  try {
    const recordId = request.nextUrl.searchParams.get('id')
    return NextResponse.json(recordId ? await getRecord(table, recordId) : await listRecords(table), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Data tidak dapat dimuat.' }, { status: 503 })
  }
}

// Hanya master agent yang boleh ditulis lewat route ini; semua pengguna login boleh menyimpan.
export async function PUT(request: NextRequest) {
  if (!(await auth())?.user) return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 })
  const table = tableFrom(request.nextUrl.searchParams.get('table'))
  if (!table) return NextResponse.json({ error: 'Koleksi data tidak valid.' }, { status: 400 })
  if (table !== 'agents') return NextResponse.json({ error: 'Koleksi data ini tidak dapat diubah.' }, { status: 403 })
  const body = await request.json().catch(() => null)
  const parsed = agentRecordSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Payload tidak valid.' }, { status: 400 })
  try {
    return NextResponse.json(await saveRecord(table, parsed.data))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Data tidak dapat disimpan.' }, { status: 503 })
  }
}
