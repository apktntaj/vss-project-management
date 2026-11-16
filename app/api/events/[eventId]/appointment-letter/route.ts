import { NextRequest, NextResponse } from 'next/server'

// Mengapa: route TIPIS surat penunjukan EO. GET membaca surat aktif (null bila belum ada), POST
// (multipart `file`) mengunggah/mengganti surat, DELETE menghapusnya. Otorisasi, validasi file,
// dan aturan satu surat per event ada di use-case.

import { requireCurrentUser } from '@/features/auth'
import { getAppointmentLetter, removeAppointmentLetter, uploadAppointmentLetter } from '@/features/events'
import { ApiError, toErrorResponse } from '@/lib/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { eventId: string } }

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser()
    return NextResponse.json(await getAppointmentLetter(currentUser, params.eventId), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser()
    const file = (await request.formData()).get('file')
    if (!(file instanceof File)) throw new ApiError(400, 'File surat penunjukan wajib diisi.')
    return NextResponse.json(await uploadAppointmentLetter(currentUser, params.eventId, file))
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser()
    await removeAppointmentLetter(currentUser, params.eventId)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return toErrorResponse(error)
  }
}
