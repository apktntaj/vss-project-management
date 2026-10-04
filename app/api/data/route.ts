import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const stores: Record<string, true> = {
  jobs: true,
  stages: true,
  users: true,
  events: true,
  venues: true,
  eos: true,
  exhibitors: true,
  jobDocuments: true,
  coordinationAgents: true,
  cipls: true,
  ciplVersions: true,
  shipmentsV2: true,
  customsJobs: true,
  counters: true,
  migrationReviewItems: true,
  files: true,
  tickets: true,
  preferences: true,
}
function validStore(value: string | null): value is string {
  return value !== null && stores[value] === true
}
function failure(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

async function authenticated() {
  const session = await auth()
  return Boolean(session?.user)
}

export async function GET(request: Request) {
  if (!(await authenticated())) return failure('Sesi login diperlukan.', 401)

  const url = new URL(request.url)
  const attachmentId = url.searchParams.get('attachmentId')
  const supabase = getSupabaseAdmin()

  if (attachmentId) {
    const { data, error } = await supabase.storage.from('attachments').download(attachmentId)
    if (error) return failure(error.message, error.statusCode === '404' ? 404 : 500)
    return new Response(data, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Type': data.type || 'application/octet-stream',
      },
    })
  }

  const store = url.searchParams.get('store')
  if (!validStore(store)) return failure('Store data tidak valid.')

  const { data, error } = await supabase.from('app_records').select('data').eq('store_name', store)
  if (error) return failure(error.message, 500)
  return NextResponse.json(
    data.map((row) => row.data),
    {
      headers: { 'Cache-Control': 'private, no-store' },
    },
  )
}

export async function POST(request: Request) {
  if (!(await authenticated())) return failure('Sesi login diperlukan.', 401)

  const supabase = getSupabaseAdmin()
  const contentType = request.headers.get('content-type') ?? ''
  let store: string | null
  let record: Record<string, unknown>
  let file: File | null = null

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    store = String(form.get('store') ?? '')
    const rawRecord = form.get('record')
    const rawFile = form.get('file')
    if (typeof rawRecord !== 'string' || !(rawFile instanceof File)) {
      return failure('Metadata dan file lampiran wajib tersedia.')
    }
    try {
      record = JSON.parse(rawRecord) as Record<string, unknown>
    } catch {
      return failure('Metadata lampiran tidak valid.')
    }
    file = rawFile
  } else {
    const body = (await request.json()) as { store?: string; record?: Record<string, unknown> }
    store = body.store ?? null
    record = body.record ?? {}
  }

  if (!validStore(store)) return failure('Store data tidak valid.')
  if (typeof record.id !== 'string' || !record.id) return failure('ID record wajib tersedia.')
  if (store === 'files' && !file) return failure('Konten lampiran wajib tersedia.')

  if (file) {
    const upload = await supabase.storage
      .from('attachments')
      .upload(record.id, file, { contentType: file.type, upsert: true })
    if (upload.error) return failure(upload.error.message, 500)
  }

  const { error } = await supabase
    .from('app_records')
    .upsert(
      { store_name: store, record_id: record.id, data: record },
      { onConflict: 'store_name,record_id' },
    )
  if (error) {
    if (file) await supabase.storage.from('attachments').remove([record.id])
    return failure(error.message, 500)
  }

  return NextResponse.json(record)
}

export async function DELETE(request: Request) {
  if (!(await authenticated())) return failure('Sesi login diperlukan.', 401)

  const url = new URL(request.url)
  const store = url.searchParams.get('store')
  const recordId = url.searchParams.get('id')
  if (!validStore(store) || !recordId) return failure('Store dan ID record wajib valid.')

  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('app_records')
    .delete()
    .eq('store_name', store)
    .eq('record_id', recordId)
  if (error) return failure(error.message, 500)
  if (store === 'files') {
    const removal = await supabase.storage.from('attachments').remove([recordId])
    if (removal.error) return failure(removal.error.message, 500)
  }
  return new Response(null, { status: 204 })
}
