import { NextRequest, NextResponse } from 'next/server'

// Export manifest satu event ke Excel, berformat dokumen klien: inward (default) atau outward
// (barang re-ekspor per job BC 3.0). Data diambil dari server — tidak dari klien.

import { requireCurrentUser } from '@/features/auth'
import { findEventSummary } from '@/features/events/repository'
import { listEventExhibitors } from '@/features/exhibitors'
import { listJobsForUser } from '@/features/jobs'
import { buildEventManifestWorkbook, buildEventOutwardManifestWorkbook } from '@/lib/manifest-export'
import { renderManifestWorkbook } from '@/lib/server/manifest-workbook'
import { ApiError, toErrorResponse } from '@/lib/server/errors'
import type { Job } from '@/domain/job/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { eventId: string } }

const fileSafe = (value: string) => value.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser()
    const event = await findEventSummary(params.eventId)
    if (!event) throw new ApiError(404, 'Event tidak ditemukan.')
    const [jobs, exhibitors] = await Promise.all([
      listJobsForUser(currentUser, { eventId: params.eventId, view: 'full' }) as Promise<Job[]>,
      listEventExhibitors(currentUser, params.eventId),
    ])
    const pic = new Map(
      exhibitors.flatMap((exhibitor) =>
        exhibitor.contact.name ? [[exhibitor.id, exhibitor.contact.name] as const] : [],
      ),
    )
    const eventInfo = {
      name: event.name,
      venueName: event.venueName || null,
      startsOn: event.startsOn,
      endsOn: event.endsOn,
    }
    const outward = request.nextUrl.searchParams.get('direction') === 'outward'
    const model = outward
      ? buildEventOutwardManifestWorkbook(eventInfo, jobs)
      : buildEventManifestWorkbook(eventInfo, jobs, pic)
    const file = await renderManifestWorkbook(model)
    const filename = `${outward ? 'OUTWARD' : 'INWARD'}-MANIFEST-${fileSafe(event.name)}.xlsx`
    return new NextResponse(file, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
