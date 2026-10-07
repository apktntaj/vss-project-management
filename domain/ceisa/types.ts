export type CeisaStatusObservation = {
  documentType: string
  submissionNumber: string
  responseCode: string
  responseName: string
  observedAt: string
  registrationNumber?: string
  registrationDate?: string
  responsePath?: string
  billingCode?: string
}

export type CeisaLocationReference = {
  kind: 'FOREIGN_PORT' | 'DOMESTIC_PORT' | 'TPS_WAREHOUSE'
  code: string
  name: string
  customsOfficeCode?: string
  source: 'CEISA'
  fetchedAt: string
}

export type CeisaExchangeRateObservation = {
  currencyCode: string
  rate: number
  effectiveDate: string
  fetchedAt: string
}

export type CeisaTariffObservation = {
  hsCode: string
  effectiveDate: string
  tariff: Record<string, unknown>
  fetchedAt: string
}

export type CeisaManifestEntry = {
  submissionNumber?: string
  documentNumber: string
  documentDate: string
  position?: string
  subposition?: string
  portCode?: string
  warehouseCode?: string
  transportCode?: string
  fetchedAt: string
}

export type CeisaObservationRecord = CeisaStatusObservation & { id: string; operation: string }
