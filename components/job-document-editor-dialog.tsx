'use client'

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  Bot,
  FileText,
  Loader2,
  PackageSearch,
  Plus,
  Trash2,
  Upload,
  UsersRound,
} from 'lucide-react'
import {
  getOperationalDetails,
  saveJobInvoiceExtraction,
  saveJobDocument,
  saveJobTransportExtraction,
  type Job,
} from '@/lib/data-client'
import type {
  JobDocumentParty,
  JobInvoiceExtraction,
  JobInvoiceItem,
  JobTransportContainer,
  JobTransportExtraction,
} from '@/domain/exhibition/source-documents'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { isAcceptedJobDocument, jobDocumentAccept } from '@/components/job-document-file'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { jobLabel } from '@/domain/job/numbering'
import { transportModeLabels, type TransportMode } from '@/domain/job/types'

export type EditableJobDocument = 'TRANSPORT' | 'INVOICE'

const emptyParty = (): JobDocumentParty => ({
  name: null,
  address: null,
  countryCode: null,
  taxId: null,
})
const emptyItem = (lineNumber: number): JobInvoiceItem => ({
  lineNumber,
  itemCode: null,
  description: '',
  hsCode: null,
  quantity: null,
  unit: null,
  unitPrice: null,
  lineTotal: null,
  currency: null,
  grossWeightKg: null,
  netWeightKg: null,
  countryOfOrigin: null,
  packageCount: null,
  packageType: null,
})
const emptyContainer = (): JobTransportContainer => ({
  containerNumber: null,
  size: null,
  type: null,
  sealNumber: null,
})
const nullableText = (value: string) => value.trim() || null
const nullableNumber = (value: string) => (value === '' ? null : Number(value))
/** Teks form tidak di-trim saat mengetik (spasi di ujung harus bisa diketik); dirapikan oleh trimStrings saat simpan. */
const draftText = (value: string) => (value === '' ? null : value)
function trimStrings<T>(value: T): T {
  if (typeof value === 'string') return (value.trim() || null) as T
  if (Array.isArray(value)) return value.map(trimStrings) as T
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, trimStrings(item)]),
    ) as T
  return value
}

export type TransportDocumentKind = 'BL' | 'AWB'

/** Jalur job (Laut/Udara) sudah menentukan jenis dokumen angkut; darat tidak punya B/L atau AWB. */
export const documentKindForMode = (mode: TransportMode | null): TransportDocumentKind | null =>
  mode === 'SEA' ? 'BL' : mode === 'AIR' ? 'AWB' : null

function invoiceFrom(job: Job): JobInvoiceExtraction {
  const operational = getOperationalDetails(job)
  const current = operational.invoice
  return (
    current ?? {
      invoiceNumber: operational.invoiceNumber ?? null,
      invoiceDate: null,
      seller: emptyParty(),
      buyer: emptyParty(),
      currency: operational.invoiceItems?.find((item) => item.currency)?.currency ?? null,
      incoterm: null,
      incotermLocation: null,
      totalAmount: null,
      freightAmount: null,
      insuranceAmount: null,
      totalGrossWeightKg: null,
      totalNetWeightKg: null,
      totalPackageCount: null,
      packageType: null,
      items: (operational.invoiceItems ?? []).map((item, index) => ({
        ...emptyItem(index + 1),
        ...item,
      })),
    }
  )
}

function transportFrom(job: Job): JobTransportExtraction {
  const operational = getOperationalDetails(job)
  return job.transportDocument
    ? {
        ...job.transportDocument,
        loadType: job.transportDocument.loadType ?? null,
        goodsDescription: job.transportDocument.goodsDescription ?? null,
      }
    : {
        documentNumber: job.transportDocumentNumber,
        documentDate: null,
        carrier: operational.inbound.carrier,
        vesselOrFlight: null,
        voyageOrFlightNumber: null,
        bookingNumber: null,
        shipper: emptyParty(),
        consignee: emptyParty(),
        notifyParty: emptyParty(),
        portOfLoading: null,
        portOfDischarge: null,
        placeOfReceipt: null,
        placeOfDelivery: null,
        etd: null,
        eta: null,
        packageCount: null,
        packageType: null,
        marksAndNumbers: null,
        goodsDescription: null,
        grossWeightKg: null,
        netWeightKg: null,
        volumeM3: null,
        loadType: null,
        containers: [],
      }
}

/** Job sudah punya dokumen angkut bila nomor atau hasil ekstraksinya tersimpan. */
const hasTransportDocument = (job: Job) =>
  Boolean(job.transportDocument || job.transportDocumentNumber)

/** Invoice dianggap ada bila header invoice atau baris barangnya sudah tersimpan. */
const hasInvoiceDocument = (job: Job) => {
  const operational = getOperationalDetails(job)
  return Boolean(
    operational.invoice || operational.invoiceNumber || operational.invoiceItems?.length,
  )
}

function TextField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  step,
  disabled,
}: {
  id: string
  label: string
  value: string | number | null
  onChange: (value: string) => void
  type?: string
  step?: string
  disabled?: boolean
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type={type}
        step={step}
        disabled={disabled}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  )
}

function PartyFields({
  prefix,
  legend,
  party,
  onChange,
}: {
  prefix: string
  legend: string
  party: JobDocumentParty | null
  onChange: (party: JobDocumentParty) => void
}) {
  const value = party ?? emptyParty()
  const update = (patch: Partial<JobDocumentParty>) => onChange({ ...value, ...patch })
  return (
    <FieldSet className="rounded-lg border bg-background p-4">
      <FieldLegend className="text-primary">{legend}</FieldLegend>
      <FieldGroup className="grid gap-4 md:grid-cols-2">
        <TextField
          id={`${prefix}-name`}
          label="Nama"
          value={value.name}
          onChange={(next) => update({ name: nullableText(next) })}
        />
        <TextField
          id={`${prefix}-tax`}
          label="Nomor identitas / pajak"
          value={value.taxId}
          onChange={(next) => update({ taxId: nullableText(next) })}
        />
        <TextField
          id={`${prefix}-country`}
          label="Kode negara"
          value={value.countryCode}
          onChange={(next) => update({ countryCode: nullableText(next)?.toUpperCase() ?? null })}
        />
        <Field>
          <FieldLabel htmlFor={`${prefix}-address`}>Alamat</FieldLabel>
          <Textarea
            id={`${prefix}-address`}
            value={value.address ?? ''}
            onChange={(event) => update({ address: nullableText(event.target.value) })}
          />
        </Field>
      </FieldGroup>
    </FieldSet>
  )
}

export function InvoiceEditor({
  value,
  onChange,
}: {
  value: JobInvoiceExtraction
  onChange: (value: JobInvoiceExtraction) => void
}) {
  const [activeView, setActiveView] = useState<'header' | 'items'>('header')
  const update = (patch: Partial<JobInvoiceExtraction>) => onChange({ ...value, ...patch })
  const updateItem = (index: number, patch: Partial<JobInvoiceItem>) =>
    update({
      items: value.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    })
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Tabs
        value={activeView}
        onValueChange={(next) => setActiveView(next as 'header' | 'items')}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-primary/5 px-4 pt-3 sm:px-6">
          <TabsList
            variant="line"
            className="w-fit gap-1 rounded-t-lg border border-primary/15 bg-background p-1"
          >
            <TabsTrigger
              value="header"
              className="flex-none px-3 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-sm after:bg-primary"
            >
              <FileText data-icon="inline-start" />
              Header
            </TabsTrigger>
            <TabsTrigger
              value="items"
              className="flex-none px-3 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-sm after:bg-primary"
            >
              <PackageSearch data-icon="inline-start" />
              Items ({value.items.length})
            </TabsTrigger>
          </TabsList>
          <p aria-live="polite" className="hidden text-xs font-medium text-primary sm:block">
            Tampilan aktif: {activeView === 'header' ? 'Header' : 'Items'}
          </p>
        </div>
        <TabsContent value="header" className="min-h-0 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-5">
            <FieldSet className="rounded-xl border border-primary/15 bg-primary/5 p-4 sm:p-5">
              <FieldLegend className="flex items-center gap-2 text-primary">
                <FileText aria-hidden="true" />
                Informasi dokumen
              </FieldLegend>
              <FieldDescription>
                Data utama yang tercantum pada commercial invoice.
              </FieldDescription>
              <FieldGroup className="grid gap-4 pt-2 sm:grid-cols-2 xl:grid-cols-4">
                <TextField
                  id="invoice-number"
                  label="Nomor invoice"
                  value={value.invoiceNumber}
                  onChange={(next) => update({ invoiceNumber: nullableText(next) })}
                />
                <TextField
                  id="invoice-date"
                  label="Tanggal invoice"
                  type="date"
                  value={value.invoiceDate}
                  onChange={(next) => update({ invoiceDate: nullableText(next) })}
                />
                <TextField
                  id="invoice-currency"
                  label="Valuta"
                  value={value.currency}
                  onChange={(next) =>
                    update({ currency: nullableText(next)?.toUpperCase() ?? null })
                  }
                />
                <TextField
                  id="invoice-total"
                  label="Total invoice"
                  type="number"
                  value={value.totalAmount}
                  onChange={(next) => update({ totalAmount: nullableNumber(next) })}
                />
                <TextField
                  id="invoice-incoterm"
                  label="Incoterm"
                  value={value.incoterm}
                  onChange={(next) =>
                    update({ incoterm: nullableText(next)?.toUpperCase() ?? null })
                  }
                />
                <TextField
                  id="invoice-incoterm-location"
                  label="Lokasi incoterm"
                  value={value.incotermLocation}
                  onChange={(next) => update({ incotermLocation: nullableText(next) })}
                />
                <TextField
                  id="invoice-freight"
                  label="Freight"
                  type="number"
                  value={value.freightAmount}
                  onChange={(next) => update({ freightAmount: nullableNumber(next) })}
                />
                <TextField
                  id="invoice-insurance"
                  label="Asuransi"
                  type="number"
                  value={value.insuranceAmount}
                  onChange={(next) => update({ insuranceAmount: nullableNumber(next) })}
                />
              </FieldGroup>
            </FieldSet>
            <FieldSet className="rounded-xl border bg-accent/50 p-4 sm:p-5">
              <FieldLegend className="flex items-center gap-2 text-primary">
                <PackageSearch aria-hidden="true" />
                Ringkasan kemasan dan berat
              </FieldLegend>
              <FieldGroup className="grid gap-4 pt-2 sm:grid-cols-2 xl:grid-cols-4">
                <TextField
                  id="invoice-gross"
                  label="Total bruto (kg)"
                  type="number"
                  value={value.totalGrossWeightKg}
                  onChange={(next) => update({ totalGrossWeightKg: nullableNumber(next) })}
                />
                <TextField
                  id="invoice-net"
                  label="Total netto (kg)"
                  type="number"
                  value={value.totalNetWeightKg}
                  onChange={(next) => update({ totalNetWeightKg: nullableNumber(next) })}
                />
                <TextField
                  id="invoice-packages"
                  label="Jumlah kemasan"
                  type="number"
                  value={value.totalPackageCount}
                  onChange={(next) => update({ totalPackageCount: nullableNumber(next) })}
                />
                <TextField
                  id="invoice-package-type"
                  label="Jenis kemasan"
                  value={value.packageType}
                  onChange={(next) =>
                    update({ packageType: nullableText(next)?.toUpperCase() ?? null })
                  }
                />
              </FieldGroup>
            </FieldSet>
            <div className="rounded-xl border border-primary/10 bg-muted/40 p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2 text-base font-medium text-primary">
                <UsersRound aria-hidden="true" />
                Pihak pada invoice
              </div>
              <div className="grid gap-5 lg:grid-cols-2">
                <PartyFields
                  prefix="seller"
                  legend="Penjual"
                  party={value.seller}
                  onChange={(seller) => update({ seller })}
                />
                <PartyFields
                  prefix="buyer"
                  legend="Pembeli"
                  party={value.buyer}
                  onChange={(buyer) => update({ buyer })}
                />
              </div>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="items" className="min-h-0 overflow-auto px-4 py-5 sm:px-6">
          <FieldSet className="min-h-full">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-primary/15 bg-primary/5 p-4">
              <div>
                <FieldLegend className="text-primary">Item invoice</FieldLegend>
                <FieldDescription>
                  Tambahkan atau koreksi barang yang tercantum pada invoice.
                </FieldDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  update({ items: [...value.items, emptyItem(value.items.length + 1)] })
                }
              >
                <Plus data-icon="inline-start" />
                Tambah item
              </Button>
            </div>
            {value.items.length === 0 ? (
              <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 p-6 text-center">
                <PackageSearch className="size-8 text-muted-foreground" aria-hidden="true" />
                <p className="mt-3 font-medium">Belum ada item invoice</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Tambahkan baris barang untuk melengkapi nilai, HS code, dan asal barang.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => update({ items: [emptyItem(1)] })}
                >
                  <Plus data-icon="inline-start" />
                  Tambah item pertama
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Baris</TableHead>
                    <TableHead>Kode</TableHead>
                    <TableHead>Uraian</TableHead>
                    <TableHead>HS</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Satuan</TableHead>
                    <TableHead>Harga</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Valuta</TableHead>
                    <TableHead>Negara</TableHead>
                    <TableHead>Netto</TableHead>
                    <TableHead>Bruto</TableHead>
                    <TableHead>
                      <span className="sr-only">Aksi</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {value.items.map((item, index) => (
                    <TableRow key={index}>
                      {[
                        [
                          'Baris',
                          item.lineNumber,
                          'number',
                          (next: string) => updateItem(index, { lineNumber: nullableNumber(next) }),
                        ],
                        [
                          'Kode barang',
                          item.itemCode,
                          'text',
                          (next: string) => updateItem(index, { itemCode: nullableText(next) }),
                        ],
                        [
                          'Uraian',
                          item.description,
                          'text',
                          (next: string) => updateItem(index, { description: next }),
                        ],
                        [
                          'HS',
                          item.hsCode,
                          'text',
                          (next: string) => updateItem(index, { hsCode: nullableText(next) }),
                        ],
                        [
                          'Quantity',
                          item.quantity,
                          'number',
                          (next: string) => updateItem(index, { quantity: nullableNumber(next) }),
                        ],
                        [
                          'Satuan',
                          item.unit,
                          'text',
                          (next: string) =>
                            updateItem(index, { unit: nullableText(next)?.toUpperCase() ?? null }),
                        ],
                        [
                          'Harga satuan',
                          item.unitPrice,
                          'number',
                          (next: string) => updateItem(index, { unitPrice: nullableNumber(next) }),
                        ],
                        [
                          'Total baris',
                          item.lineTotal,
                          'number',
                          (next: string) => updateItem(index, { lineTotal: nullableNumber(next) }),
                        ],
                        [
                          'Valuta',
                          item.currency,
                          'text',
                          (next: string) =>
                            updateItem(index, {
                              currency: nullableText(next)?.toUpperCase() ?? null,
                            }),
                        ],
                        [
                          'Negara asal',
                          item.countryOfOrigin,
                          'text',
                          (next: string) =>
                            updateItem(index, {
                              countryOfOrigin: nullableText(next)?.toUpperCase() ?? null,
                            }),
                        ],
                        [
                          'Netto kg',
                          item.netWeightKg,
                          'number',
                          (next: string) =>
                            updateItem(index, { netWeightKg: nullableNumber(next) }),
                        ],
                        [
                          'Bruto kg',
                          item.grossWeightKg,
                          'number',
                          (next: string) =>
                            updateItem(index, { grossWeightKg: nullableNumber(next) }),
                        ],
                      ].map(([label, current, type, change]) => (
                        <TableCell key={String(label)}>
                          <Field>
                            <FieldLabel className="sr-only">{String(label)}</FieldLabel>
                            <Input
                              aria-label={String(label)}
                              type={String(type)}
                              value={(current as string | number | null) ?? ''}
                              onChange={(event) =>
                                (change as (value: string) => void)(event.target.value)
                              }
                              className={label === 'Uraian' ? 'min-w-52' : 'min-w-24'}
                            />
                          </Field>
                        </TableCell>
                      ))}
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Hapus item"
                          onClick={() =>
                            update({
                              items: value.items.filter((_, itemIndex) => itemIndex !== index),
                            })
                          }
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </FieldSet>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export function DocumentSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-black/10 p-4">
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</p>
      <div className="mt-3 flex flex-col gap-4">{children}</div>
    </section>
  )
}

const hasParty = (party: JobDocumentParty | null) =>
  Boolean(party && (party.name || party.address || party.taxId || party.countryCode))
const sameParty = (a: JobDocumentParty | null, b: JobDocumentParty | null) => {
  const left = a ?? emptyParty()
  const right = b ?? emptyParty()
  return (
    left.name === right.name &&
    left.address === right.address &&
    left.taxId === right.taxId &&
    left.countryCode === right.countryCode
  )
}

function PartyBlock({
  prefix,
  legend,
  party,
  withTaxId,
  disabled = false,
  action,
  onChange,
}: {
  prefix: string
  legend: string
  party: JobDocumentParty | null
  withTaxId: boolean
  disabled?: boolean
  action?: ReactNode
  onChange: (party: JobDocumentParty) => void
}) {
  const value = party ?? emptyParty()
  const update = (patch: Partial<JobDocumentParty>) => onChange({ ...value, ...patch })
  return (
    <FieldSet className="flex flex-col gap-3 rounded-lg border p-4">
      <FieldLegend variant="label" className="mb-0 font-medium">
        {legend}
      </FieldLegend>
      {action}
      <FieldGroup className={withTaxId ? 'grid gap-4 sm:grid-cols-[1fr_14rem]' : 'grid gap-4'}>
        <TextField
          id={`${prefix}-name`}
          label={`Nama ${legend.toLowerCase()}`}
          disabled={disabled}
          value={value.name}
          onChange={(next) => update({ name: draftText(next) })}
        />
        {withTaxId ? (
          <TextField
            id={`${prefix}-tax`}
            label="NPWP"
            disabled={disabled}
            value={value.taxId}
            onChange={(next) => update({ taxId: draftText(next) })}
          />
        ) : null}
      </FieldGroup>
      <Field>
        <FieldLabel htmlFor={`${prefix}-address`}>Alamat {legend.toLowerCase()}</FieldLabel>
        <Textarea
          id={`${prefix}-address`}
          rows={3}
          disabled={disabled}
          value={value.address ?? ''}
          onChange={(event) => update({ address: draftText(event.target.value) })}
        />
      </Field>
    </FieldSet>
  )
}

/** Urutan baca mengikuti lembar B/L/AWB: dokumen → pihak → pengangkutan → muatan. ETA bukan bagian form: milik job. */
export function TransportEditor({
  value,
  onChange,
  kind,
}: {
  value: JobTransportExtraction
  onChange: (value: JobTransportExtraction) => void
  kind: TransportDocumentKind
}) {
  const sea = kind === 'BL'
  const fcl = sea && value.loadType === 'FCL'
  const docName = sea ? 'B/L' : 'AWB'
  // Awal: tercentang bila notify party sudah identik dengan consignee. Editor di-remount (key) saat hasil scan masuk.
  const [notifySameAsConsignee, setNotifySameAsConsignee] = useState(
    () => hasParty(value.consignee) && sameParty(value.notifyParty, value.consignee),
  )
  const update = (patch: Partial<JobTransportExtraction>) => onChange({ ...value, ...patch })
  const updateConsignee = (consignee: JobDocumentParty) =>
    update(notifySameAsConsignee ? { consignee, notifyParty: { ...consignee } } : { consignee })
  const toggleNotifySame = (checked: boolean) => {
    setNotifySameAsConsignee(checked)
    if (checked) update({ notifyParty: value.consignee ? { ...value.consignee } : null })
  }
  const updateContainer = (index: number, patch: Partial<JobTransportContainer>) =>
    update({
      containers: value.containers.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    })
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
      <div className="flex flex-col gap-6">
        <DocumentSection title="Dokumen">
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="transport-carrier"
              label={sea ? 'Shipping line' : 'Airline'}
              value={value.carrier}
              onChange={(next) => update({ carrier: draftText(next) })}
            />
            <TextField
              id="transport-number"
              label={`Nomor ${docName}`}
              value={value.documentNumber}
              onChange={(next) => update({ documentNumber: draftText(next) })}
            />
            <TextField
              id="transport-date"
              label={`Tanggal ${docName}`}
              type="date"
              value={value.documentDate}
              onChange={(next) => update({ documentDate: draftText(next) })}
            />
          </FieldGroup>
        </DocumentSection>

        <DocumentSection title="Para pihak">
          <div className="flex flex-col gap-4">
            <PartyBlock
              prefix="shipper"
              legend="Shipper"
              withTaxId={false}
              party={value.shipper}
              onChange={(shipper) => update({ shipper })}
            />
            <PartyBlock
              prefix="consignee"
              legend="Consignee"
              withTaxId
              party={value.consignee}
              onChange={updateConsignee}
            />
            <PartyBlock
              prefix="notify"
              legend="Notify party"
              withTaxId
              disabled={notifySameAsConsignee}
              party={value.notifyParty}
              onChange={(notifyParty) => update({ notifyParty })}
              action={
                <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={notifySameAsConsignee}
                    onChange={(event) => toggleNotifySame(event.target.checked)}
                  />
                  Sama dengan consignee
                </label>
              }
            />
          </div>
        </DocumentSection>

        <DocumentSection title={sea ? 'Pelayaran' : 'Penerbangan'}>
          <FieldGroup className="grid gap-4 sm:grid-cols-3">
            <TextField
              id="transport-vessel"
              label={sea ? 'Vessel' : 'Flight'}
              value={value.vesselOrFlight}
              onChange={(next) => update({ vesselOrFlight: draftText(next) })}
            />
            <TextField
              id="transport-voyage"
              label={sea ? 'Voyage' : 'Nomor flight'}
              value={value.voyageOrFlightNumber}
              onChange={(next) => update({ voyageOrFlightNumber: draftText(next) })}
            />
            <TextField
              id="transport-etd"
              label="ETD"
              type="date"
              value={value.etd}
              onChange={(next) => update({ etd: draftText(next) })}
            />
          </FieldGroup>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="transport-loading"
              label="Port of loading"
              value={value.portOfLoading}
              onChange={(next) => update({ portOfLoading: draftText(next) })}
            />
            <TextField
              id="transport-discharge"
              label="Port of destination"
              value={value.portOfDischarge}
              onChange={(next) => update({ portOfDischarge: draftText(next) })}
            />
          </FieldGroup>
        </DocumentSection>

        <DocumentSection title="Muatan">
          {sea ? (
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="transport-load-type">LCL / FCL</FieldLabel>
                <select
                  id="transport-load-type"
                  value={value.loadType ?? ''}
                  onChange={(event) =>
                    update({
                      loadType:
                        event.target.value === 'LCL' || event.target.value === 'FCL'
                          ? event.target.value
                          : null,
                    })
                  }
                  className="block h-9 w-full rounded-md border bg-background px-2 text-sm"
                >
                  <option value="">Belum diketahui</option>
                  <option value="LCL">LCL (kontainer gabungan)</option>
                  <option value="FCL">FCL (kontainer penuh)</option>
                </select>
              </Field>
              {fcl ? (
                <Field>
                  <FieldLabel htmlFor="transport-container-count">Jumlah container</FieldLabel>
                  <Input
                    id="transport-container-count"
                    readOnly
                    tabIndex={-1}
                    value={value.containers.length}
                    className="bg-muted/40"
                  />
                  <FieldDescription>Dihitung dari detail container.</FieldDescription>
                </Field>
              ) : null}
            </FieldGroup>
          ) : null}
          {fcl ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Detail container</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => update({ containers: [...value.containers, emptyContainer()] })}
                >
                  <Plus data-icon="inline-start" />
                  Tambah container
                </Button>
              </div>
              {value.containers.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
                  <PackageSearch className="size-7 text-muted-foreground" aria-hidden="true" />
                  <p className="mt-2 text-sm font-medium">Belum ada container</p>
                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                    Tambahkan nomor, ukuran, tipe, dan seal container bila tercantum pada dokumen.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nomor container</TableHead>
                      <TableHead>Ukuran</TableHead>
                      <TableHead>Tipe</TableHead>
                      <TableHead>Nomor seal</TableHead>
                      <TableHead>
                        <span className="sr-only">Aksi</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {value.containers.map((container, index) => (
                      <TableRow key={index}>
                        {(
                          [
                            [
                              'Nomor container',
                              container.containerNumber,
                              (next: string) =>
                                updateContainer(index, { containerNumber: draftText(next) }),
                            ],
                            [
                              'Ukuran',
                              container.size,
                              (next: string) => updateContainer(index, { size: draftText(next) }),
                            ],
                            [
                              'Tipe',
                              container.type,
                              (next: string) => updateContainer(index, { type: draftText(next) }),
                            ],
                            [
                              'Nomor seal',
                              container.sealNumber,
                              (next: string) =>
                                updateContainer(index, { sealNumber: draftText(next) }),
                            ],
                          ] as const
                        ).map(([label, current, change]) => (
                          <TableCell key={label}>
                            <Input
                              aria-label={`${label} ${index + 1}`}
                              value={current ?? ''}
                              onChange={(event) => change(event.target.value)}
                            />
                          </TableCell>
                        ))}
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Hapus container ${index + 1}`}
                            onClick={() =>
                              update({
                                containers: value.containers.filter(
                                  (_, itemIndex) => itemIndex !== index,
                                ),
                              })
                            }
                          >
                            <Trash2 />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          ) : null}
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="transport-packages"
              label="Jumlah package"
              type="number"
              value={value.packageCount}
              onChange={(next) => update({ packageCount: nullableNumber(next) })}
            />
            <TextField
              id="transport-package-type"
              label="Jenis kemasan"
              value={value.packageType}
              onChange={(next) => update({ packageType: draftText(next)?.toUpperCase() ?? null })}
            />
          </FieldGroup>
          <Field>
            <FieldLabel htmlFor="transport-marks">Remark</FieldLabel>
            <Textarea
              id="transport-marks"
              rows={3}
              value={value.marksAndNumbers ?? ''}
              onChange={(event) => update({ marksAndNumbers: draftText(event.target.value) })}
            />
            <FieldDescription>Marks and numbers sesuai dokumen.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="transport-goods">Detail barang</FieldLabel>
            <Textarea
              id="transport-goods"
              rows={4}
              value={value.goodsDescription ?? ''}
              onChange={(event) => update({ goodsDescription: draftText(event.target.value) })}
            />
            <FieldDescription>Deskripsi barang sesuai dokumen.</FieldDescription>
          </Field>
          <FieldGroup className="grid gap-4 sm:grid-cols-3">
            <TextField
              id="transport-gross"
              label="Bruto (kg)"
              type="number"
              step="any"
              value={value.grossWeightKg}
              onChange={(next) => update({ grossWeightKg: nullableNumber(next) })}
            />
            <TextField
              id="transport-net"
              label="Netto (kg)"
              type="number"
              step="any"
              value={value.netWeightKg}
              onChange={(next) => update({ netWeightKg: nullableNumber(next) })}
            />
            <TextField
              id="transport-volume"
              label="Volume (m³)"
              type="number"
              step="any"
              value={value.volumeM3}
              onChange={(next) => update({ volumeM3: nullableNumber(next) })}
            />
          </FieldGroup>
        </DocumentSection>
      </div>
    </div>
  )
}

export function JobDocumentEditorDialog({
  job,
  kind,
  open,
  onOpenChange,
  onSaved,
  onToast,
}: {
  job: Job | null
  kind: EditableJobDocument
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (job: Job) => void
  onToast: (message: string, tone?: 'info' | 'error') => void
}) {
  const [invoice, setInvoice] = useState<JobInvoiceExtraction | null>(null)
  const [transport, setTransport] = useState<JobTransportExtraction | null>(null)
  const [saving, setSaving] = useState(false)
  const [scanFile, setScanFile] = useState<File | null>(null)
  const [scannedKind, setScannedKind] = useState<TransportDocumentKind | null>(null)
  const [scanning, setScanning] = useState(false)
  useEffect(() => {
    if (!job || !open) return
    setInvoice(invoiceFrom(job))
    setTransport(transportFrom(job))
    setScanFile(null)
    setScannedKind(null)
  }, [job, open])
  // Jalur job menentukan jenis; bila belum diisi, ikut hasil klasifikasi unggahan, lalu dokumen tersimpan.
  const docKind: TransportDocumentKind =
    documentKindForMode(job?.transportMode ?? null) ??
    scannedKind ??
    job?.transportDocumentType ??
    'BL'
  // Tombol tab memakai label "Buat …" selama datanya belum ada; dialog harus menyebut hal sama.
  const creating = job
    ? kind === 'TRANSPORT'
      ? !hasTransportDocument(job)
      : !hasInvoiceDocument(job)
    : true
  const docNoun = kind === 'INVOICE' ? 'Invoice' : 'B/L atau AWB'

  async function scanTransport(file: File) {
    if (!isAcceptedJobDocument(file)) {
      onToast('File harus berupa PDF atau Excel.', 'error')
      return
    }
    setScanning(true)
    try {
      const body = new FormData()
      body.set('file', file)
      const response = await fetch('/api/classify-job-document', { method: 'POST', body })
      const data = (await response.json().catch(() => null)) as {
        classification?: { documentType?: string }
        transport?: JobTransportExtraction | null
        detail?: { documentType?: string } | null
        error?: string
      } | null
      if (!response.ok || !data) throw new Error(data?.error || 'Dokumen tidak dapat dipindai.')
      if (!data.transport) {
        const detected =
          data.detail?.documentType ?? data.classification?.documentType ?? 'tidak dikenali'
        throw new Error(
          `Dokumen terdeteksi sebagai ${detected.replace(/_/g, ' ').toLowerCase()} — bukan B/L atau AWB.`,
        )
      }
      const detectedType = data.detail?.documentType ?? data.classification?.documentType
      const detectedKind: TransportDocumentKind | null =
        detectedType === 'AIR_WAYBILL' ? 'AWB' : detectedType === 'BILL_OF_LADING' ? 'BL' : null
      const expectedKind = documentKindForMode(job?.transportMode ?? null)
      if (expectedKind && detectedKind && expectedKind !== detectedKind) {
        throw new Error(
          `Job ini jalur ${transportModeLabels[job!.transportMode!].toLowerCase()} (${expectedKind === 'BL' ? 'B/L' : 'AWB'}), tetapi dokumen terdeteksi ${detectedKind === 'BL' ? 'B/L' : 'AWB'}.`,
        )
      }
      setTransport(data.transport)
      setScanFile(file)
      setScannedKind(detectedKind)
      onToast('Data B/L atau AWB terisi dari dokumen — periksa lalu simpan.')
    } catch (caught) {
      onToast(caught instanceof Error ? caught.message : 'Dokumen tidak dapat dipindai.', 'error')
    } finally {
      setScanning(false)
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!job) return
    setSaving(true)
    try {
      let updated: Job | null = null
      if (kind === 'INVOICE' && invoice) {
        updated = await saveJobInvoiceExtraction(job, invoice)
      } else if (kind === 'TRANSPORT' && transport) {
        const payload: JobTransportExtraction = trimStrings({
          ...transport,
          loadType: docKind === 'BL' ? transport.loadType : null,
        })
        if (scanFile) {
          const result = await saveJobDocument(
            job,
            scanFile,
            docKind === 'AWB' ? 'AIR_WAYBILL' : 'BILL_OF_LADING',
            null,
            payload,
          )
          updated = result.job ?? job
        } else {
          updated = await saveJobTransportExtraction(job, payload, docKind)
        }
      }
      if (!updated) throw new Error('Data dokumen belum tersedia.')
      onSaved(updated)
      onOpenChange(false)
      onToast(`${docNoun} berhasil ${creating ? 'disimpan' : 'diperbarui'}.`)
    } catch (caught) {
      onToast(caught instanceof Error ? caught.message : 'Dokumen tidak dapat diperbarui.', 'error')
    } finally {
      setSaving(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(90vh,900px)] max-h-[90vh] w-[calc(100%-1rem)] max-w-none flex-col overflow-hidden p-0 sm:w-[calc(100%-2rem)] sm:max-w-[min(92vw,860px)]">
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="border-b border-primary/20 bg-primary/10 px-5 py-5 pr-12 sm:px-6">
            <DialogTitle className="text-foreground">
              {creating ? 'Buat' : 'Edit'} {docNoun}
            </DialogTitle>
            <DialogDescription>
              {creating ? (
                <>
                  No Job{' '}
                  <span className="font-medium text-foreground">{job ? jobLabel(job) : ''}</span>;
                </>
              ) : (
                <>
                  Periksa dan koreksi data hasil ekstraksi dokumen untuk Job{' '}
                  <span className="font-medium text-foreground">{job ? jobLabel(job) : ''}</span>.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {kind === 'TRANSPORT' ? (
            <div className="shrink-0 border-b px-4 py-3 sm:px-6">
              <label className="flex w-full cursor-pointer items-center gap-2 rounded-xl border border-dashed border-sky-300 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:border-sky-400 hover:bg-sky-100 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-70">
                {scanning ? (
                  <Loader2 size={18} className="shrink-0 animate-spin" aria-hidden="true" />
                ) : (
                  <Bot size={18} className="shrink-0" aria-hidden="true" />
                )}
                <span className="min-w-0 truncate">
                  {scanning
                    ? 'Memeriksa dokumen dengan AI...'
                    : scanFile
                      ? `Terbaca AI: ${scanFile.name}`
                      : 'Upload your B/L or AWB and let AI do the rest'}
                </span>
                <Upload size={15} className="ml-auto shrink-0" aria-hidden="true" />
                <input
                  type="file"
                  accept={jobDocumentAccept}
                  className="sr-only"
                  disabled={scanning || saving}
                  onChange={(inputEvent) => {
                    const file = inputEvent.target.files?.[0]
                    if (file) void scanTransport(file)
                    inputEvent.target.value = ''
                  }}
                />
              </label>
            </div>
          ) : null}
          {kind === 'INVOICE' && invoice ? (
            <InvoiceEditor value={invoice} onChange={setInvoice} />
          ) : transport ? (
            <TransportEditor
              key={
                scanFile ? `${scanFile.name}:${scanFile.size}:${scanFile.lastModified}` : 'manual'
              }
              value={transport}
              onChange={setTransport}
              kind={docKind}
            />
          ) : null}
          <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none border-primary/15 bg-primary/5 px-5 py-4 sm:px-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={saving || scanning}>
              {saving ? 'Menyimpan…' : creating ? 'Simpan' : 'Simpan perubahan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
