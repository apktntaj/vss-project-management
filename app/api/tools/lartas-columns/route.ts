import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

// Pindai kolom HS pada invoice Excel untuk tool Cek LARTAS. Berkas dibaca di memori dan tidak
// disimpan; respons hanya berisi kolom yang terdeteksi dan HS per baris.

import { auth } from '@/auth'
import { scanHsColumns, uniqueHsCodes, type SheetMatrix } from '@/lib/lartas-sheet'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 15 * 1024 * 1024

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 })

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Unggah berkas Excel (.xls/.xlsx).' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Berkas terlalu besar (maksimal 15 MB).' }, { status: 413 })
  }

  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer' })
  } catch {
    return NextResponse.json(
      { error: 'Berkas tidak dapat dibaca sebagai Excel.' },
      { status: 400 },
    )
  }

  const sheets: SheetMatrix[] = workbook.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
      header: 1,
      blankrows: false,
      defval: null,
    }),
  }))

  const scan = scanHsColumns(sheets)
  return NextResponse.json(
    { ...scan, codes: uniqueHsCodes(scan) },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
