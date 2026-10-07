import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { CeisaClient } from '@/lib/server/ceisa/client'
import { ceisaFailure, ceisaNoStore, requireCeisaUser } from '@/lib/server/ceisa/http'
import { recordCeisaObservation } from '@/lib/server/ceisa/repository'
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'
const submission = z.string().regex(/^[A-Za-z0-9]{26}$/)
const company = z.string().trim().min(1).max(64)
export async function GET(request: NextRequest) { const denied = await requireCeisaUser(); if (denied) return denied; const nomorAju = request.nextUrl.searchParams.get('nomorAju'); const idPerusahaan = request.nextUrl.searchParams.get('idPerusahaan'); if (!nomorAju && !idPerusahaan) return NextResponse.json({ error: 'nomorAju atau idPerusahaan wajib diisi.' }, { status: 400 }); try { const client = new CeisaClient(); const data = nomorAju ? await client.getStatusBySubmissionNumber(submission.parse(nomorAju)) : await client.getPendingStatuses(company.parse(idPerusahaan)); for (const item of Array.isArray(data) ? data : [data]) await recordCeisaObservation({ operation: 'STATUS', correlationKey: item.submissionNumber, documentType: item.documentType, submissionNumber: item.submissionNumber, responseCode: item.responseCode, responseName: item.responseName, payload: item }); return NextResponse.json(data, { headers: ceisaNoStore }) } catch (error) { if (error instanceof z.ZodError) return NextResponse.json({ error: 'Parameter CEISA tidak valid.' }, { status: 400 }); return ceisaFailure(error) } }
