import 'server-only'

import { DocumentExtractionError } from '../errors'
import type { ParsedDocument } from './parsed-document'

const MIN_TEXT_LAYER_CHARS = 30
const UNREADABLE_MESSAGE = 'Dokumen tidak dapat dibaca. Coba unggah ulang atau gunakan dokumen lain.'

export async function parsePdfTextLayer(file: File): Promise<ParsedDocument & { hasTextLayer: boolean }> {
  const buffer = Buffer.from(await file.arrayBuffer())
  let text = ''
  let pages = 0
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false })
    const doc = await loadingTask.promise
    pages = doc.numPages
    const pageTexts: string[] = []
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber)
      const content = await page.getTextContent()
      pageTexts.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
    }
    await loadingTask.destroy()
    text = pageTexts.join('\n\n')
  } catch (error) {
    if (error instanceof DocumentExtractionError) throw error
    throw new DocumentExtractionError(UNREADABLE_MESSAGE, 400, 'UNREADABLE_DOCUMENT')
  }
  const hasTextLayer = text.replace(/\s/g, '').length >= MIN_TEXT_LAYER_CHARS
  return { text, pages, hasTextLayer, source: 'PDF_TEXT' }
}
