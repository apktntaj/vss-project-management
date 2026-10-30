export type LinkedDocumentKind = 'CIPL' | 'BILL_OF_LADING' | 'AIR_WAYBILL' | 'SUPPORTING_DOCUMENT'

export type LinkedDocument = { id: string; kind: LinkedDocumentKind }

export type MandatoryDocumentView = {
  status: 'COMPLETE' | 'INCOMPLETE'
  ciplDocumentPresent: boolean
  transportDocumentPresent: boolean
  /** Pesan Indonesia untuk setiap dokumen wajib yang belum ada (R7.3, R7.4). */
  messages: string[]
}

const MISSING_CIPL = 'Shipment ini belum memiliki dokumen CIPL.'
const MISSING_TRANSPORT = 'Shipment ini belum memiliki dokumen B/L atau AWB.'

/** COMPLETE iff tepat satu CIPL dan satu Transport_Document hadir; SUPPORTING_DOCUMENT tidak berpengaruh (R7.1, R7.8). */
export function deriveMandatoryDocuments(documents: readonly LinkedDocument[]): MandatoryDocumentView {
  const ciplDocumentPresent = documents.some((document) => document.kind === 'CIPL')
  const transportDocumentPresent = documents.some(
    (document) => document.kind === 'BILL_OF_LADING' || document.kind === 'AIR_WAYBILL',
  )
  const messages: string[] = []
  if (!ciplDocumentPresent) messages.push(MISSING_CIPL)
  if (!transportDocumentPresent) messages.push(MISSING_TRANSPORT)
  return {
    status: messages.length ? 'INCOMPLETE' : 'COMPLETE',
    ciplDocumentPresent,
    transportDocumentPresent,
    messages,
  }
}
