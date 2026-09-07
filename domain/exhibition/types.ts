/** Domain model khusus MVP pameran. Tidak bergantung pada model project v2. */
export type DateOnly = string
export type Attachment = { id: string; fileName: string; mimeType: 'application/pdf'; fileSize: number; file: Blob; createdAt: string }

export type CoordinationAgent = {
  id: string; eventExhibitorId: string; organizationName: string; contactName: string | null
  email: string | null; phone: string | null; address: string | null; countryCode: string | null
  status: 'ACTIVE' | 'INACTIVE'; createdAt: string; updatedAt: string
}

export type CiplStatus = 'AWAITING_DOCUMENT' | 'RECEIVED' | 'UNDER_REVIEW' | 'READY' | 'ON_HOLD' | 'CANCELLED'
export type Cipl = {
  id: string; eventExhibitorId: string; referenceNumber: string | null; status: CiplStatus
  activeVersionId: string | null; sourceDocumentUnavailable: boolean; createdAt: string; updatedAt: string
}
export type CiplItem = {
  id: string; lineNumber: number; description: string; quantity: number; unit: string
  unitValue: number | null; currency: string | null; grossWeightKg: number | null; netWeightKg: number | null
  countryOfOrigin: string | null; identifiers: string[]; intendedUse: string | null; intendedDisposal: string | null
}
export type CiplVersion = {
  id: string; ciplId: string; versionNumber: number; receivedAt: string; receivedBy: string
  sourceDocumentName: string | null; sourceDocument: Attachment | null; items: CiplItem[]; revisionNote: string | null; createdAt: string
}

export type ShipmentStatus = 'DRAFT' | 'DOCUMENT_RECEIVED' | 'UNDER_REVIEW' | 'READY_FOR_CUSTOMS' | 'ON_HOLD' | 'CANCELLED'
export type ShipmentAllocation = { ciplVersionId: string; ciplItemId: string; quantity: number; unit: string; unresolved?: boolean }
export type Shipment = {
  id: string; ciplId: string; sourceCiplVersionId: string; documentType: 'BL' | 'AWB'; documentNumber: string
  shipmentMode: 'FCL' | 'LCL' | null; direction: 'IMPORT' | 'EXPORT'; shipper: string | null; consignee: string | null
  notifyParty: string | null; carrier: string | null; etaOrEtd: string | null; origin: string | null; destination: string | null
  allocations: ShipmentAllocation[]; attachment: Attachment | null; status: ShipmentStatus; legacyReference: string | null
  createdAt: string; updatedAt: string
}

export type CustomsJobStatus = 'DRAFT' | 'PREPARING' | 'SUBMITTED' | 'REGISTERED' | 'RELEASED' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED'
export type BillingInformation =
  | { kind: 'NOT_APPLICABLE'; reason: string } | { kind: 'NOT_READY' }
  | { kind: 'READY'; amount: number; currency: string } | { kind: 'INVOICED'; invoiceReference: string; amount: number; currency: string; invoicedAt: string }
  | { kind: 'PAID'; paymentReference: string; paidAt: string }
export type JobAllocation = { ciplItemId: string; quantity: number; unit: string }
export type StatusChange = { from: CustomsJobStatus; to: CustomsJobStatus; reason: string; changedAt: string }
export type CustomsJob = {
  id: string; jobNumber: string; shipmentId: string; documentType: 'BC_2_3' | 'BC_2_5' | 'BC_3_0'; ajuNumber: string | null
  registrationNumber: string | null; registrationDate: string | null; warehouseId: string | null; warehouseName: string | null
  assignedToId: string | null; billing: BillingInformation; status: CustomsJobStatus; allocations: JobAllocation[]
  attachments: Attachment[]; notes: string | null; statusHistory: StatusChange[]; createdAt: string; updatedAt: string
}

export type Counter = { name: string; value: number }
export type MigrationReviewItem = {
  id: string; legacyStore: 'jobs' | 'jobDocuments' | 'stages'; legacyId: string; status: 'REVIEW_REQUIRED' | 'MIGRATED'
  reason: string; relatedIds: string[]; createdAt: string; updatedAt: string
}
