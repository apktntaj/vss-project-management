import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ceisaFailure, ceisaNoStore, requireCeisaUser } from '@/lib/server/ceisa/http'
import { ceisaSettings, replaceCeisaCredentials } from '@/lib/server/ceisa/repository'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const input = z.object({ username: z.string().trim().min(1), password: z.string().min(1), apiKey: z.string().min(1), companyId: z.string().trim().min(1).optional(), idPlatform: z.string().trim().min(1).optional() })

export async function GET() { const denied = await requireCeisaUser(true); if (denied) return denied; try { return NextResponse.json(await ceisaSettings(), { headers: ceisaNoStore }) } catch (error) { return ceisaFailure(error) } }
export async function PUT(request: NextRequest) { const denied = await requireCeisaUser(true); if (denied) return denied; const parsed = input.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'Username, password, dan API key wajib diisi.' }, { status: 400 }); try { await replaceCeisaCredentials(parsed.data); return NextResponse.json(await ceisaSettings(), { headers: ceisaNoStore }) } catch (error) { return ceisaFailure(error) } }
