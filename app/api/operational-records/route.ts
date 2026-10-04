import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/auth'
import {
  getRecord,
  listRecords,
  operationalTables,
  removeRecord,
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

export async function PUT(request: NextRequest) {
  if (!(await auth())?.user) return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 })
  const table = tableFrom(request.nextUrl.searchParams.get('table'))
  const record = await request.json().catch(() => null) as { id?: unknown } | null
  if (!table || !record || typeof record.id !== 'string') return NextResponse.json({ error: 'Payload tidak valid.' }, { status: 400 })
  try {
    return NextResponse.json(await saveRecord(table, record as { id: string }))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Data tidak dapat disimpan.' }, { status: 503 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await auth())?.user) return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 })
  const table = tableFrom(request.nextUrl.searchParams.get('table'))
  const recordId = request.nextUrl.searchParams.get('id')
  if (!table || !recordId) return NextResponse.json({ error: 'Payload tidak valid.' }, { status: 400 })
  try {
    await removeRecord(table, recordId)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Data tidak dapat dihapus.' }, { status: 503 })
  }
}
