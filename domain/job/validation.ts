import { z } from 'zod'

import { barisBarangSchema, ciplDocumentSchema } from '@/domain/exhibition/cipl-document'
import { jobTransportLoadTypes } from '@/domain/exhibition/source-documents'
import {
  inwardManifestSchema,
  jobReturnSchema,
  koliCollectionSchema,
  operationalNoteSchema,
} from '@/domain/job/manifest'
import {
  bcDocumentKinds,
  internationalJobJenisValues,
  invoiceStatuses,
  jobCustomsStatuses,
  jobKinds,
  jobStatuses,
  transportDocumentTypes,
  transportModes,
} from '@/domain/job/types'

// Mengapa: satu set skema untuk SEMUA tulis aggregate Job di batas server. Bagian dalam aggregate
// (operational, inward, kepulangan, manifest exhibitors) disimpan sebagai jsonb, jadi skema inilah
// satu-satunya penjaga bentuknya — database hanya menjaga kolom luar (FK/CHECK). Teks pengguna
// bahasa Indonesia; identifier bahasa Inggris.

/** Teks opsional: di-trim, kosong → null. */
const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter.`)
    .nullable()
    .transform((value) => (value ? value : null))

const nullableString = z.string().nullable()
const nullableNumber = z.number().finite().nullable()

/** Versi aggregate yang terakhir dibaca klien (optimistic concurrency). */
export const jobVersionSchema = z
  .number({ required_error: 'Versi job wajib dikirim.' })
  .int()
  .positive('Versi job tidak valid.')

// --- Hasil ekstraksi dokumen (invoice, B/L/AWB) ---------------------------------------------

const partySchema = z.object({
  name: nullableString,
  address: nullableString,
  countryCode: nullableString,
  taxId: nullableString,
})

const invoiceItemSchema = z.object({
  lineNumber: nullableNumber,
  itemCode: nullableString,
  description: z.string(),
  hsCode: nullableString,
  quantity: nullableNumber,
  unit: nullableString,
  unitPrice: nullableNumber,
  lineTotal: nullableNumber,
  currency: nullableString,
  grossWeightKg: nullableNumber,
  netWeightKg: nullableNumber,
  countryOfOrigin: nullableString,
  packageCount: nullableNumber,
  packageType: nullableString,
})

export const invoiceExtractionSchema = z.object({
  invoiceNumber: nullableString,
  invoiceDate: nullableString,
  seller: partySchema.nullable(),
  buyer: partySchema.nullable(),
  currency: nullableString,
  incoterm: nullableString,
  incotermLocation: nullableString,
  totalAmount: nullableNumber,
  freightAmount: nullableNumber,
  insuranceAmount: nullableNumber,
  totalGrossWeightKg: nullableNumber,
  totalNetWeightKg: nullableNumber,
  totalPackageCount: nullableNumber,
  packageType: nullableString,
  items: z.array(invoiceItemSchema),
})

export const transportExtractionSchema = z.object({
  documentNumber: nullableString,
  documentDate: nullableString,
  carrier: nullableString,
  vesselOrFlight: nullableString,
  voyageOrFlightNumber: nullableString,
  bookingNumber: nullableString,
  shipper: partySchema.nullable(),
  consignee: partySchema.nullable(),
  notifyParty: partySchema.nullable(),
  portOfLoading: nullableString,
  portOfDischarge: nullableString,
  placeOfReceipt: nullableString,
  placeOfDelivery: nullableString,
  etd: nullableString,
  eta: nullableString,
  packageCount: nullableNumber,
  packageType: nullableString,
  marksAndNumbers: nullableString,
  goodsDescription: z.string().nullable().default(null),
  grossWeightKg: nullableNumber,
  netWeightKg: nullableNumber,
  volumeM3: nullableNumber,
  // Dokumen tersimpan sebelum field ini ada tidak memuat kuncinya → dianggap belum diketahui.
  loadType: z.enum(jobTransportLoadTypes).nullable().default(null),
  containers: z.array(
    z.object({
      containerNumber: nullableString,
      size: nullableString,
      type: nullableString,
      sealNumber: nullableString,
    }),
  ),
})

// --- Bagian operational ------------------------------------------------------------------------

const transportLegSchema = z.object({
  mode: z.enum(['SEA', 'AIR', 'LOCAL']).nullable(),
  carrier: optionalText(200),
  scheduleAt: optionalText(40),
  actualAt: optionalText(40),
})

const customsDocumentSchema = z.object({
  applicable: z.boolean(),
  status: z.enum(jobCustomsStatuses),
  ajuNumber: optionalText(100),
  registrationNumber: optionalText(100),
  registrationDate: optionalText(40),
  warehouseName: optionalText(200),
})

const customsSchema = z.object(
  Object.fromEntries(bcDocumentKinds.map((kind) => [kind, customsDocumentSchema])) as Record<
    (typeof bcDocumentKinds)[number],
    typeof customsDocumentSchema
  >,
)

export const operationalDetailsSchema = z.object({
  inbound: transportLegSchema,
  outbound: transportLegSchema,
  invoiceNumber: optionalText(100).optional(),
  invoiceItems: z.array(invoiceItemSchema).optional(),
  invoice: invoiceExtractionSchema.nullable().optional(),
  customs: customsSchema,
})

// --- Baris CIPL --------------------------------------------------------------------------------

export const ciplLineSchema = z.object({
  exhibitorId: z.string().uuid('Exhibitor tidak valid.').nullable(),
  nameOnDocument: z
    .string()
    .trim()
    .min(1, 'Nama exhibitor pada baris CIPL wajib diisi.')
    .max(300, 'Nama exhibitor terlalu panjang.'),
  koli: koliCollectionSchema,
  items: z.array(barisBarangSchema).default([]),
  notes: z.array(operationalNoteSchema).default([]),
})

export const ciplLinesSchema = z
  .array(ciplLineSchema)
  .max(500, 'Terlalu banyak baris CIPL.')
  .superRefine((lines, context) => {
    const seen = new Set<string>()
    lines.forEach((line, index) => {
      if (!line.exhibitorId) return
      if (seen.has(line.exhibitorId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'exhibitorId'],
          message: 'Satu exhibitor hanya boleh muncul sekali dalam satu job.',
        })
      }
      seen.add(line.exhibitorId)
    })
  })

// --- Aturan pihak (cermin constraint DB, agar pesannya jelas sebelum menyentuh database) -------

type PartyShape = {
  kind?: (typeof jobKinds)[number]
  internationalJenis?: (typeof internationalJobJenisValues)[number] | null
  transportMode?: (typeof transportModes)[number] | null
  agentId?: string | null
  exhibitorId?: string | null
}

/** Job Local selalu dipegang exhibitor (Road Shipment boleh agent — koreksi 2026-11-02). */
export function exhibitorOnlyJob(input: Pick<PartyShape, 'kind'>): boolean {
  return input.kind === 'LOCAL'
}

function checkJobRules(input: PartyShape, context: z.RefinementCtx) {
  if (input.kind === 'INTERNATIONAL' && !input.internationalJenis) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['internationalJenis'],
      message: 'Jenis job international wajib dipilih.',
    })
  }
  if (input.kind === 'LOCAL' && input.internationalJenis) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['internationalJenis'],
      message: 'Job Local tidak memiliki jenis international.',
    })
  }
  if (input.agentId && input.exhibitorId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['agentId'],
      message: 'Pihak job hanya satu: agent atau exhibitor.',
    })
  }
  if (input.agentId && exhibitorOnlyJob(input)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['agentId'],
      message: 'Job Local selalu dipegang exhibitor, bukan agent.',
    })
  }
  if (
    input.internationalJenis === 'ROAD_SHIPMENT' &&
    input.transportMode &&
    input.transportMode !== 'ROAD'
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['transportMode'],
      message: 'Road Shipment hanya lewat jalur darat.',
    })
  }
}

// --- Input tulis (satu skema per perintah aggregate) ------------------------------------------

const optionalId = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.string().min(1).nullable(),
)
const optionalUuid = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.string().uuid('Exhibitor tidak valid.').nullable(),
)

export const jobCreateSchema = z
  .object({
    eventId: z.string().uuid('Event tidak valid.'),
    kind: z.enum(jobKinds),
    internationalJenis: z.enum(internationalJobJenisValues).nullable().default(null),
    transportMode: z.enum(transportModes).nullable().default(null),
    agentId: optionalId,
    exhibitorId: optionalUuid,
  })
  .strict()
  .superRefine(checkJobRules)
export type JobCreateInput = z.output<typeof jobCreateSchema>

/** Edit detail job: semua field opsional, hanya yang dikirim yang ditulis. */
export const jobDetailsPatchSchema = z
  .object({
    version: jobVersionSchema,
    // CANCELLED hanya lewat `jobCancelSchema` (alasan wajib); tidak bisa dipasang lewat patch.
    status: z
      .enum(jobStatuses)
      .refine((status) => status !== 'CANCELLED', { message: 'Gunakan fitur Batalkan job.' })
      .optional(),
    transportMode: z.enum(transportModes).nullable().optional(),
    /** Ganti pihak: kirim keduanya (salah satu null). */
    party: z
      .object({ agentId: optionalId, exhibitorId: optionalUuid })
      .strict()
      .refine((party) => !(party.agentId && party.exhibitorId), {
        message: 'Pihak job hanya satu: agent atau exhibitor.',
      })
      .optional(),
    manifestSeq: z
      .number()
      .int('Urutan No Job harus bilangan bulat.')
      .positive('Urutan No Job minimal 1.')
      .max(9999)
      .nullable()
      .optional(),
    commercialInvoiceNumber: optionalText(100).optional(),
    transportDocumentType: z.enum(transportDocumentTypes).nullable().optional(),
    transportDocumentNumber: optionalText(100).optional(),
    notes: optionalText(5000).optional(),
    emptyStorage: optionalText(1000).optional(),
    reExport: optionalText(1000).optional(),
    operational: operationalDetailsSchema.optional(),
  })
  .strict()
export type JobDetailsPatch = z.output<typeof jobDetailsPatchSchema>

/** Batalkan job: alasan wajib; job yang sudah batal tidak dapat diubah lagi. */
export const jobCancelSchema = z
  .object({
    version: jobVersionSchema,
    reason: z
      .string({ required_error: 'Alasan pembatalan wajib diisi.' })
      .trim()
      .min(1, 'Alasan pembatalan wajib diisi.')
      .max(1000, 'Alasan pembatalan maksimal 1000 karakter.'),
  })
  .strict()
export type JobCancelInput = z.output<typeof jobCancelSchema>

const dateTime = z.string().datetime({ offset: true, message: 'Tanggal tidak valid.' })

/** Tagihan job ke pihaknya. Aturan status mencerminkan constraint DB. */
export const jobInvoiceSchema = z
  .object({
    number: optionalText(100),
    amount: z.number().finite().min(0, 'Nilai tagihan tidak boleh negatif.').nullable(),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, 'Mata uang harus kode 3 huruf (mis. IDR, USD).')
      .nullable(),
    status: z.enum(invoiceStatuses),
    sentAt: dateTime.nullable(),
    paidAt: dateTime.nullable(),
  })
  .strict()
  .superRefine((invoice, context) => {
    if ((invoice.status === 'SENT' || invoice.status === 'PAID') && !invoice.number) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['number'],
        message: 'Nomor tagihan wajib diisi sebelum tagihan dikirim.',
      })
    }
    if (invoice.status === 'PAID' && !invoice.paidAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['paidAt'],
        message: 'Tanggal lunas wajib diisi.',
      })
    }
  })
export type JobInvoiceInput = z.output<typeof jobInvoiceSchema>

export const jobInvoicePutSchema = z
  .object({ version: jobVersionSchema, invoice: jobInvoiceSchema })
  .strict()

/** Terapkan hasil ekstraksi dokumen (upload atau koreksi manual di dialog editor dokumen). */
export const jobExtractionSchema = z
  .object({
    version: jobVersionSchema,
    invoice: invoiceExtractionSchema.nullable().optional(),
    transport: transportExtractionSchema.nullable().optional(),
    transportDocumentType: z.enum(transportDocumentTypes).nullable().optional(),
  })
  .strict()
  .refine((input) => Boolean(input.invoice || input.transport), {
    message: 'Data dokumen belum tersedia.',
  })
export type JobExtractionInput = z.output<typeof jobExtractionSchema>

export const jobInwardPutSchema = z
  .object({ version: jobVersionSchema, inward: inwardManifestSchema })
  .strict()

export const jobKepulanganPutSchema = z
  .object({ version: jobVersionSchema, kepulangan: jobReturnSchema.nullable() })
  .strict()

/** Simpan CIPL: dokumen mentah + seluruh baris (diganti utuh), satu perintah atomik. */
export const jobCiplPutSchema = z
  .object({
    version: jobVersionSchema,
    ciplDocument: ciplDocumentSchema.nullable(),
    lines: ciplLinesSchema,
  })
  .strict()
export type JobCiplPut = z.output<typeof jobCiplPutSchema>

/** Filter daftar job (query string `GET /api/jobs`). */
export const jobListQuerySchema = z.object({
  eventId: z.string().uuid('Event tidak valid.').optional(),
  status: z.enum(jobStatuses).optional(),
  search: z.string().trim().max(100).optional(),
  view: z.enum(['full', 'summary']).default('full'),
})
export type JobListQuery = z.output<typeof jobListQuerySchema>
