import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getWorkspaceState, saveWorkspaceState } from '@/lib/supabase/workspace-state'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await auth())?.user) return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 })
  try {
    return NextResponse.json(await getWorkspaceState(), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Workspace tidak dapat dimuat.' }, { status: 503 })
  }
}

export async function PUT(request: NextRequest) {
  if (!(await auth())?.user) return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 })
  const body = await request.json().catch(() => null) as { id?: unknown; revision?: unknown; state?: unknown } | null
  if (!body || typeof body.id !== 'string' || typeof body.revision !== 'number' || !Number.isSafeInteger(body.revision) || !body.state || typeof body.state !== 'object' || Array.isArray(body.state)) {
    return NextResponse.json({ error: 'Payload workspace tidak valid.' }, { status: 400 })
  }
  try {
    const revision = await saveWorkspaceState(body.id, body.revision, body.state as Record<string, unknown>)
    return NextResponse.json({ revision }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Workspace tidak dapat disimpan.'
    return NextResponse.json({ error: message }, { status: message.includes('Workspace berubah') ? 409 : 503 })
  }
}
