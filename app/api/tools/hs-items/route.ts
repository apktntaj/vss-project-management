import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

// Baca baris barang (uraian + HS code) dari invoice untuk tool HS BTKI. Excel dibaca langsung dari
// kolomnya; PDF — dan Excel yang kolom HS-nya tak dikenali — dibaca LLM. Berkas tidak disimpan.

import { auth } from '@/auth'
import { INVOICE_HS_MAX_ITEMS, hsCellText, readInvoiceHsItems, type InvoiceHsItem } from '@/lib/invoice-hs-items'
import type { SheetMatrix } from '@/lib/lartas-sheet'
import { configuredLlmProvider } from '@/lib/server/extraction/config'
import { DocumentExtractionError } from '@/lib/server/extraction/errors'
import { assertSupportedDocumentFile, isPdf } from '@/lib/server/extraction/file-guard'
import { chatDocumentJson } from '@/lib/server/extraction/llm/document-json'
import { extractionRouteFailure } from '@/lib/server/extraction/route-failure'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const ITEMS_SYSTEM_PROMPT =
  'You read commercial invoices and packing lists. List every goods line that is printed in the document, in document order. ' +
  'Return only JSON: {"items":[{"description":"<goods description exactly as printed, one line>","hsCode":"<HS / HTS / tariff code exactly as printed, or null>"}]}. ' +
  'Copy HS codes character for character; never guess, complete, or correct a code. If one HS code is printed once for several goods lines, repeat it on each of those lines. ' +
  'Skip totals, freight, insurance, and other non-goods lines. Return {"items":[]} when the document has no goods lines.'

function readExcel(buffer: Buffer): InvoiceHsItem[] {
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' })
  } catch {
    throw new DocumentExtractionError('Berkas tidak dapat dibaca sebagai Excel.', 400, 'UNREADABLE_DOCUMENT')
  }
  const sheets: SheetMatrix[] = workbook.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, blankrows: false, defval: null }),
  }))
  return readInvoiceHsItems(sheets)
}

async function readWithLlm(file: File): Promise<InvoiceHsItem[]> {
  const provider = configuredLlmProvider()
  if (!provider) {
    throw new DocumentExtractionError(
      'Pembacaan invoice PDF butuh LLM (LLM_API_KEY belum dikonfigurasi). Unggah invoice Excel sebagai gantinya.',
      503,
      'LLM_NOT_CONFIGURED',
    )
  }
  const payload = await chatDocumentJson(provider, 'List the goods lines of this document as the JSON object described.', file, ITEMS_SYSTEM_PROMPT)
  const raw = Array.isArray(payload.items) ? payload.items : []
  const items: InvoiceHsItem[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || items.length >= INVOICE_HS_MAX_ITEMS) continue
    const record = entry as Record<string, unknown>
    const description = typeof record.description === 'string' ? record.description.replace(/\s+/g, ' ').trim() : ''
    const hsCode = typeof record.hsCode === 'string' || typeof record.hsCode === 'number' ? (hsCellText(String(record.hsCode)) ?? '') : ''
    if (!description && !hsCode) continue
    items.push({ id: String(items.length + 1), sheet: null, row: null, description, hsCode })
  }
  return items
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 })

  try {
    const form = await request.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof File) || file.size === 0) {
      throw new DocumentExtractionError('Unggah invoice berupa PDF atau Excel.', 400, 'FILE_REQUIRED')
    }
    assertSupportedDocumentFile(file)

    let source: 'excel' | 'ai' = 'excel'
    let items = isPdf(file) ? [] : readExcel(Buffer.from(await file.arrayBuffer()))
    // Excel tanpa kolom HS yang dikenali (mis. HS terselip di teks uraian) masih bisa dibaca LLM.
    if (items.length === 0 && (isPdf(file) || configuredLlmProvider())) {
      items = await readWithLlm(file)
      source = 'ai'
    }
    return NextResponse.json({ items, source }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return extractionRouteFailure(error)
  }
}
