import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { CeisaClient } from '@/lib/server/ceisa/client'
import { ceisaFailure, ceisaNoStore, requireCeisaUser } from '@/lib/server/ceisa/http'
import { recordCeisaObservation } from '@/lib/server/ceisa/repository'
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'
const text = z.string().trim().min(1).max(160); const office = z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,20}$/); const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
export async function GET(request: NextRequest) { const denied = await requireCeisaUser(); if (denied) return denied; try { const data = await new CeisaClient().getManifestBc11({ hostDocumentNumber: text.parse(request.nextUrl.searchParams.get('hostDocumentNumber')), hostDocumentDate: date.parse(request.nextUrl.searchParams.get('hostDocumentDate')), customsOfficeCode: office.parse(request.nextUrl.searchParams.get('customsOfficeCode')), importerName: text.parse(request.nextUrl.searchParams.get('importerName')) }); for (const item of data) await recordCeisaObservation({ operation: 'MANIFEST_BC11', correlationKey: `${item.documentNumber}:${item.documentDate}`, payload: item }); return NextResponse.json(data, { headers: ceisaNoStore }) } catch (error) { if (error instanceof z.ZodError) return NextResponse.json({ error: 'Parameter manifes CEISA tidak valid.' }, { status: 400 }); return ceisaFailure(error) } }
