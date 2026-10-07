import {
  BC23_SCHEMA,
  bc23DraftSchema,
  bc23RequiredPaths,
  type Bc23Draft,
  type Bc23DraftIssue,
  type Bc23DraftStatus,
  type Bc23Provenance,
} from '@/domain/ceisa/bc23'
import type { JobInvoiceExtraction, JobTransportExtraction } from '@/domain/exhibition/source-documents'
import { compareInvoiceWithTransport } from '@/lib/document-comparison'

export type Bc23DraftResponse = {
  draftStatus: Bc23DraftStatus
  schema: typeof BC23_SCHEMA
  draft: Bc23Draft
  sources: {
    invoice: JobInvoiceExtraction
    transport: JobTransportExtraction
  }
  provenance: Record<string, Bc23Provenance>
  issues: Bc23DraftIssue[]
  generatedAt: string
}

const missing = (path: string): Bc23DraftIssue => ({
  severity: 'ERROR',
  code: 'REQUIRED_FIELD_MISSING',
  path,
  message: `${path} belum tersedia dari dokumen sumber.`,
})

const sourceConflict = (path: string, message: string): Bc23DraftIssue => ({
  severity: 'WARNING',
  code: 'SOURCE_CONFLICT',
  path,
  message,
})

function isMissing(value: unknown) {
  return value === null || value === undefined || (Array.isArray(value) && value.length === 0)
}

function recordProvenance(
  provenance: Record<string, Bc23Provenance>,
  path: string,
  value: unknown,
  source: Bc23Provenance,
) {
  if (!isMissing(value)) provenance[path] = source
  return value
}

function party(party: JobInvoiceExtraction['seller'], series: number) {
  return party
    ? {
        seriEntitas: series,
        kodeEntitas: null,
        kodeJenisIdentitas: null,
        nomorIdentitas: party.taxId,
        namaEntitas: party.name,
        alamatEntitas: party.address,
        kodeNegara: party.countryCode,
        nibEntitas: null,
        nomorIjinEntitas: null,
        tanggalIjinEntitas: null,
        kodeStatus: null,
      }
    : null
}

function item(value: JobInvoiceExtraction['items'][number], series: number) {
  return {
    seriBarang: value.lineNumber ?? series,
    kodeBarang: value.itemCode,
    uraian: value.description,
    kodeHs: value.hsCode,
    jumlahSatuan: value.quantity,
    kodeSatuanBarang: value.unit,
    hargaSatuan: value.unitPrice,
    nilaiBarang: value.lineTotal,
    kodeNegaraAsal: value.countryOfOrigin,
    netto: value.netWeightKg,
    bruto: value.grossWeightKg,
    jumlahKemasan: value.packageCount,
    kodeJenisKemasan: value.packageType,
  }
}

export function createBc23Draft(input: {
  invoice: JobInvoiceExtraction
  transport: JobTransportExtraction
  generatedAt: string
}): Bc23DraftResponse {
  const { invoice, transport, generatedAt } = input
  const provenance: Record<string, Bc23Provenance> = {
    asalData: 'CONSTANT',
    kodeDokumen: 'CONSTANT',
  }
  const invoiceTotal = invoice.totalAmount
  const containers = transport.containers.map((container, index) => ({
    seriKontainer: index + 1,
    nomorKontainer: container.containerNumber,
    kodeUkuranKontainer: container.size,
    kodeTipeKontainer: container.type,
    nomorSegel: container.sealNumber,
  }))
  const invoiceDocument = invoice.invoiceNumber
    ? [{ seriDokumen: 1, kodeDokumen: '380', nomorDokumen: invoice.invoiceNumber, tanggalDokumen: invoice.invoiceDate }]
    : []
  const transportDocument = transport.documentNumber
    ? [{ seriDokumen: invoiceDocument.length + 1, kodeDokumen: '705', nomorDokumen: transport.documentNumber, tanggalDokumen: transport.documentDate }]
    : []
  const entities = [party(invoice.seller, 1), party(invoice.buyer, 2)].filter((value): value is NonNullable<typeof value> => value !== null)
  const packages = transport.packageCount !== null
    ? [{
        seriKemasan: 1,
        jumlahKemasan: transport.packageCount,
        kodeJenisKemasan: transport.packageType,
        merkKemasan: transport.marksAndNumbers,
      }]
    : []

  const draft = bc23DraftSchema.parse({
    asalData: 'S',
    asuransi: recordProvenance(provenance, 'asuransi', invoice.insuranceAmount, 'INVOICE'),
    bruto: recordProvenance(provenance, 'bruto', transport.grossWeightKg, 'TRANSPORT'),
    cif: recordProvenance(provenance, 'cif', invoiceTotal, 'INVOICE'),
    fob: recordProvenance(provenance, 'fob', invoiceTotal, 'INVOICE'),
    freight: recordProvenance(provenance, 'freight', invoice.freightAmount, 'INVOICE'),
    hargaPenyerahan: recordProvenance(provenance, 'hargaPenyerahan', invoiceTotal, 'INVOICE'),
    jabatanTtd: null,
    jumlahKontainer: recordProvenance(provenance, 'jumlahKontainer', containers.length || null, 'TRANSPORT'),
    kodeAsuransi: null,
    kodeDokumen: '23',
    kodeIncoterm: recordProvenance(provenance, 'kodeIncoterm', invoice.incoterm, 'INVOICE'),
    kodeKantor: null,
    kodeKantorBongkar: null,
    kodePelBongkar: null,
    kodePelMuat: null,
    kodePelTransit: null,
    kodeTps: null,
    kodeTujuanTpb: null,
    kodeTutupPu: null,
    kodeValuta: recordProvenance(provenance, 'kodeValuta', invoice.currency, 'INVOICE'),
    kotaTtd: null,
    namaTtd: null,
    ndpbm: null,
    netto: recordProvenance(provenance, 'netto', transport.netWeightKg, 'TRANSPORT'),
    nilaiBarang: recordProvenance(provenance, 'nilaiBarang', invoiceTotal, 'INVOICE'),
    nomorAju: null,
    nomorBc11: null,
    posBc11: null,
    seri: null,
    subposBc11: null,
    tanggalBc11: null,
    tanggalTiba: recordProvenance(provenance, 'tanggalTiba', transport.eta, 'TRANSPORT'),
    tanggalTtd: null,
    biayaTambahan: null,
    biayaPengurang: null,
    barang: recordProvenance(provenance, 'barang', invoice.items.map(item), 'INVOICE'),
    entitas: recordProvenance(provenance, 'entitas', entities, 'INVOICE'),
    kemasan: recordProvenance(provenance, 'kemasan', packages, 'TRANSPORT'),
    kontainer: recordProvenance(provenance, 'kontainer', containers, 'TRANSPORT'),
    dokumen: recordProvenance(provenance, 'dokumen', [...invoiceDocument, ...transportDocument], 'INVOICE'),
    pengangkut: transport.carrier || transport.vesselOrFlight
      ? recordProvenance(provenance, 'pengangkut', [{
          seriPengangkut: 1,
          kodeBendera: null,
          namaPengangkut: transport.vesselOrFlight ?? transport.carrier,
          nomorPengangkut: transport.voyageOrFlightNumber,
          kodeCaraAngkut: null,
        }], 'TRANSPORT')
      : [],
  })

  const issues: Bc23DraftIssue[] = bc23RequiredPaths
    .filter((path) => isMissing(draft[path]))
    .map(missing)

  for (const comparison of compareInvoiceWithTransport(invoice, transport)) {
    if (comparison.status === 'DIFFERENT') {
      issues.push(sourceConflict(comparison.field, `${comparison.label} berbeda antara Commercial Invoice dan B/L/AWB.`))
    }
  }

  const itemTotal = invoice.items.reduce((total, value) => total + (value.lineTotal ?? 0), 0)
  if (invoice.totalAmount !== null && invoice.items.some((value) => value.lineTotal !== null) && Math.abs(invoice.totalAmount - itemTotal) > 0.001) {
    issues.push({
      severity: 'WARNING',
      code: 'ITEM_TOTAL_MISMATCH',
      path: 'nilaiBarang',
      message: 'Total item Commercial Invoice tidak sama dengan total invoice.',
    })
  }

  return {
    draftStatus: issues.some((issue) => issue.severity === 'ERROR') ? 'DRAFT_INCOMPLETE' : 'LOCALLY_VALID',
    schema: BC23_SCHEMA,
    draft,
    sources: { invoice, transport },
    provenance,
    issues,
    generatedAt,
  }
}

/**
 * Applies operator-supplied values only in memory and recalculates local completeness.
 * CEISA validation and persistence remain outside this demo boundary.
 */
export function completeBc23Draft(
  response: Bc23DraftResponse,
  values: Record<string, unknown>,
): Bc23DraftResponse {
  const draft = bc23DraftSchema.parse({ ...response.draft, ...values })
  const provenance = { ...response.provenance }
  for (const path of bc23RequiredPaths) {
    if (Object.hasOwn(values, path) && !isMissing(values[path])) provenance[path] = 'MANUAL'
  }
  const issues = [
    ...response.issues.filter((issue) => issue.code !== 'REQUIRED_FIELD_MISSING'),
    ...bc23RequiredPaths.filter((path) => isMissing(draft[path])).map(missing),
  ]
  return {
    ...response,
    draftStatus: issues.some((issue) => issue.severity === 'ERROR') ? 'DRAFT_INCOMPLETE' : 'LOCALLY_VALID',
    draft,
    provenance,
    issues,
  }
}
