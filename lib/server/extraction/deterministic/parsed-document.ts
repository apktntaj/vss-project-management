export type ParsedDocumentSource = 'XLSX' | 'PDF_TEXT' | 'OCR'

/** Teks terstruktur hasil parser deterministik; konsumen hilir: scorer, classifier, field-extractor. */
export type ParsedDocument = {
  text: string
  pages: number
  hasTextLayer: boolean
  source: ParsedDocumentSource
}
