/** Storage-agnostic values extracted from a commercial or transport document. */
export type JobDocumentParty = {
  name: string | null
  address: string | null
  countryCode: string | null
  taxId: string | null
}

export type JobInvoiceItem = {
  lineNumber: number | null
  itemCode: string | null
  description: string
  hsCode: string | null
  quantity: number | null
  unit: string | null
  unitPrice: number | null
  lineTotal: number | null
  currency: string | null
  grossWeightKg: number | null
  netWeightKg: number | null
  countryOfOrigin: string | null
  packageCount: number | null
  packageType: string | null
}

/** Provisional values extracted from one Commercial Invoice; users may correct them later. */
export type JobInvoiceExtraction = {
  invoiceNumber: string | null
  invoiceDate: string | null
  seller: JobDocumentParty | null
  buyer: JobDocumentParty | null
  currency: string | null
  incoterm: string | null
  incotermLocation: string | null
  totalAmount: number | null
  freightAmount: number | null
  insuranceAmount: number | null
  totalGrossWeightKg: number | null
  totalNetWeightKg: number | null
  totalPackageCount: number | null
  packageType: string | null
  items: JobInvoiceItem[]
}

export type JobTransportContainer = {
  containerNumber: string | null
  size: string | null
  type: string | null
  sealNumber: string | null
}

/** Values printed on a B/L or AWB that describe the inbound transport. */
export type JobTransportExtraction = {
  documentNumber: string | null
  documentDate: string | null
  carrier: string | null
  vesselOrFlight: string | null
  voyageOrFlightNumber: string | null
  bookingNumber: string | null
  shipper: JobDocumentParty | null
  consignee: JobDocumentParty | null
  notifyParty: JobDocumentParty | null
  portOfLoading: string | null
  portOfDischarge: string | null
  placeOfReceipt: string | null
  placeOfDelivery: string | null
  etd: string | null
  eta: string | null
  packageCount: number | null
  packageType: string | null
  marksAndNumbers: string | null
  grossWeightKg: number | null
  netWeightKg: number | null
  volumeM3: number | null
  containers: JobTransportContainer[]
}

export type DocumentClassificationType =
  | 'CIPL_COMBINED'
  | 'PACKING_LIST'
  | 'COMMERCIAL_INVOICE'
  | 'BILL_OF_LADING'
  | 'AIR_WAYBILL'
  | 'SUPPORTING_DOCUMENT'
  | 'UNREADABLE'

export type ConfidenceBand = 'LOW_CONFIDENCE' | 'MEDIUM_CONFIDENCE' | 'HIGH_CONFIDENCE'

/** Kunci adalah dot-path field (mis. invoice.invoiceNumber); nilai 0.00–1.00. */
export type ConfidenceMap = Record<string, number>

export type DocumentClassification = {
  documentType: DocumentClassificationType
  confidence: number
  needsUserConfirmation: boolean
  rationale: string | null
}

export type ExtractionMethod = 'DETERMINISTIC' | 'LLM'

export type ExtractionResult = {
  method: ExtractionMethod
  classification: DocumentClassification
  invoice: JobInvoiceExtraction | null
  transport: JobTransportExtraction | null
  fieldConfidence: ConfidenceMap
  aggregateConfidence: number
  band: ConfidenceBand
}

export type IntendedKind = 'CIPL' | 'TRANSPORT' | 'SUPPORTING'

export type CiplMergeInput = { packingList: JobInvoiceExtraction; invoice: JobInvoiceExtraction }

export type CiplMergeResult =
  | { ok: true; merged: JobInvoiceExtraction }
  | {
      ok: false
      unmatched: { source: 'PACKING_LIST' | 'COMMERCIAL_INVOICE'; description: string }[]
    }
