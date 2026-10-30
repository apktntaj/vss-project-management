import 'server-only'

import * as XLSX from 'xlsx'
import { DocumentExtractionError } from '../errors'
import type { ParsedDocument } from './parsed-document'

const MAX_SPREADSHEET_TEXT_LENGTH = 80_000
const UNREADABLE_MESSAGE = 'Dokumen tidak dapat dibaca. Coba unggah ulang atau gunakan dokumen lain.'

export async function parseSpreadsheet(file: File): Promise<ParsedDocument> {
  const buffer = Buffer.from(await file.arrayBuffer())
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellText: true, cellFormula: false, cellNF: false })
  } catch {
    throw new DocumentExtractionError(UNREADABLE_MESSAGE, 400, 'UNREADABLE_DOCUMENT')
  }
  const text = workbook.SheetNames
    .map((sheetName) => `Sheet: ${sheetName}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName], { blankrows: false })}`)
    .join('\n\n')
  if (!text.trim()) throw new DocumentExtractionError(UNREADABLE_MESSAGE, 400, 'UNREADABLE_DOCUMENT')
  return {
    text: text.slice(0, MAX_SPREADSHEET_TEXT_LENGTH),
    pages: workbook.SheetNames.length,
    hasTextLayer: true,
    source: 'XLSX',
  }
}
