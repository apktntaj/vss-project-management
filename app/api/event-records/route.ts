import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/auth'
import { eventOrganizerInputSchema, venueInputSchema } from '@/domain/event/validation'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Route legacy master data venue/EO untuk `lib/data-client.ts` (listVenues/listEos/saveVenue/
// saveEo). Skema redesign menyimpan nama di `legal_name` (tanpa kolom contacts/address/website/
// npwp/payload), sedangkan mapper client masih membaca kontrak lama — perbedaan bentuk itu
// didamai DI SINI lewat mapper baris→respons di bawah, bukan dengan mengubah client. Pengganti
// resmi jalur ini adalah `/api/references/*` slice events; route ini tinggal menunggu konsumen
// client dimigrasi lalu dibuang.

type Resource = 'venues' | 'event-organizers'
const resources: readonly Resource[] = ['venues', 'event-organizers']

function resourceFrom(value: string | null): Resource | null {
  return value && resources.includes(value as Resource) ? value as Resource : null
}

async function context() {
  const session = await auth()
  if (!session?.user?.email) throw new Error('Autentikasi diperlukan.')
  const client = getSupabaseAdmin()
  const [{ data: workspace, error: workspaceError }, { data: user, error: userError }] = await Promise.all([
    client.from('workspaces').select('id').eq('slug', 'default').single<{ id: string }>(),
    client.from('app_users').select('id').eq('email', session.user.email).single<{ id: string }>(),
  ])
  if (workspaceError || !workspace) throw new Error(`Workspace tidak dapat dimuat: ${workspaceError?.message ?? 'tidak ditemukan'}`)
  if (userError || !user) throw new Error(`User tidak dapat dimuat: ${userError?.message ?? 'tidak ditemukan'}`)
  return { client, workspaceId: workspace.id, userId: user.id }
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : 'Data event tidak dapat diproses.'
  return NextResponse.json({ error: message }, { status: message === 'Autentikasi diperlukan.' ? 401 : 400 })
}

// Kolom yang benar-benar ada di tabel redesign; id-nya dipakai event sebagai FK.
type ReferenceDbRow = {
  id: string
  legal_name: string
  created_at: string
  updated_at: string
}

// Proyeksi ke kontrak respons legacy (field `name` + timestamp snake_case). Kolom kaya (contacts,
// address, website, dst.) tidak ada di skema redesign → diisi nilai kosong; mapper client membaca
// semuanya secara defensif sehingga bentuk ini aman.
function venueResponse(row: ReferenceDbRow) {
  return {
    id: row.id,
    name: row.legal_name,
    contacts: [],
    address: null,
    website: null,
    loading_access_notes: null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function organizerResponse(row: ReferenceDbRow) {
  return {
    id: row.id,
    name: row.legal_name,
    npwp: null,
    contacts: [],
    address: null,
    website: null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

// Ternary diletakkan DI DALAM callback map: union fungsi sebagai callback membuat inferensi tipe
// TS saling membebani kedua bentuk respons; union nilai per elemen tidak.
function toResponses(resource: Resource, rows: ReferenceDbRow[]) {
  return rows.map((row) => (resource === 'event-organizers' ? organizerResponse(row) : venueResponse(row)))
}

export async function GET(request: NextRequest) {
  const resource = resourceFrom(request.nextUrl.searchParams.get('resource'))
  if (!resource) return NextResponse.json({ error: 'Resource tidak valid.' }, { status: 400 })
  try {
    const { client, workspaceId } = await context()
    const table = resource === 'event-organizers' ? 'event_organizers' : 'venues'
    const { data, error } = await client
      .from(table)
      .select('id, legal_name, created_at, updated_at')
      .eq('workspace_id', workspaceId)
      .order('legal_name')
    if (error) throw error
    return NextResponse.json(toResponses(resource, data ?? []), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return failure(error)
  }
}

export async function POST(request: NextRequest) {
  const resource = resourceFrom(request.nextUrl.searchParams.get('resource'))
  if (!resource) return NextResponse.json({ error: 'Resource tidak valid.' }, { status: 400 })
  try {
    const body = await request.json()
    const { client, workspaceId } = await context()
    const table = resource === 'event-organizers' ? 'event_organizers' : 'venues'
    // Skema redesign hanya menyimpan legal_name (+ kolom opsional venue); field legacy di luar itu
    // divalidasi skema input lalu tidak dipersist — tidak ada kolom tujuannya.
    const legalName =
      resource === 'venues' ? venueInputSchema.parse(body).name : eventOrganizerInputSchema.parse(body).name
    const { data, error } = await client
      .from(table)
      .insert({ workspace_id: workspaceId, legal_name: legalName })
      .select('id, legal_name, created_at, updated_at')
      .single<ReferenceDbRow>()
    if (error) throw error
    return NextResponse.json(toResponses(resource, [data])[0], {
      status: 201,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return failure(error)
  }
}
