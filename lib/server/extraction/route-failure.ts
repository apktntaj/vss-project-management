import 'server-only'

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { eventApiFailure } from '@/lib/supabase/event-api'
import { DocumentExtractionError } from './errors'

export function extractionRouteFailure(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: error.issues[0]?.message ?? 'Data tidak valid.', code: 'VALIDATION_ERROR' },
      { status: 400 },
    )
  }
  if (error instanceof DocumentExtractionError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
  }
  if (error instanceof Error && error.message === 'Autentikasi diperlukan.') {
    return NextResponse.json({ error: error.message, code: 'AUTHENTICATION_REQUIRED' }, { status: 401 })
  }
  return eventApiFailure(error)
}
