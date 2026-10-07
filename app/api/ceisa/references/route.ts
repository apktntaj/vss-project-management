import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { CeisaClient } from '@/lib/server/ceisa/client'
import { ceisaFailure, ceisaNoStore, requireCeisaUser } from '@/lib/server/ceisa/http'
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'
const kind = z.enum(['foreign-port', 'domestic-port', 'tps'])
const code = z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,20}$/)
export async function GET(request: NextRequest) { const denied = await requireCeisaUser(); if (denied) return denied; const parsed = kind.safeParse(request.nextUrl.searchParams.get('kind')); const value = request.nextUrl.searchParams.get('q') ?? request.nextUrl.searchParams.get('customsOfficeCode'); if (!parsed.success || !value) return NextResponse.json({ error: 'Referensi CEISA tidak valid.' }, { status: 400 }); if (parsed.data === 'foreign-port' && value.trim().length < 2) return NextResponse.json({ error: 'Pencarian pelabuhan minimal dua karakter.' }, { status: 400 }); try { const client = new CeisaClient(); const data = parsed.data === 'foreign-port' ? await client.searchForeignPorts(value.trim()) : parsed.data === 'domestic-port' ? await client.listDomesticPorts(code.parse(value)) : await client.listTpsWarehouses(code.parse(value)); return NextResponse.json(data, { headers: ceisaNoStore }) } catch (error) { if (error instanceof z.ZodError) return NextResponse.json({ error: 'Kode kantor tidak valid.' }, { status: 400 }); return ceisaFailure(error) } }
