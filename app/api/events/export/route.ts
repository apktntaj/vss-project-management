import { NextRequest, NextResponse } from 'next/server'

// Export daftar event ke Excel dengan filter yang sama dengan halaman events (`search`/`status`/
// `pic` di query string). Route tipis: autentikasi, parse filter, delegasi ke use-case baca
// (otorisasi `event:read` hidup di sana), lalu render workbook.

import { requireCurrentUser } from '@/features/auth'
import { listEventsForDashboard } from '@/features/events'
import { renderEventsWorkbook } from '@/features/events/export-workbook'
import { parseEventListQuery } from '@/features/events/list-query'
import { toErrorResponse } from '@/lib/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser()
    const { searchParams } = new URL(request.url)
    const page = await listEventsForDashboard(currentUser, parseEventListQuery((key) => searchParams.get(key)))
    const file = await renderEventsWorkbook(page.items)
    const filename = `events-${new Date().toISOString().slice(0, 10)}.xlsx`
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
