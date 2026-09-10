'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { FileText, PackageSearch, Plus, Trash2, UsersRound } from 'lucide-react'
import {
  getOperationalDetails,
  saveJobInvoiceExtraction,
  saveJobTransportExtraction,
  type JobDocumentParty,
  type JobInvoiceExtraction,
  type JobInvoiceItem,
  type JobTransportContainer,
  type JobTransportExtraction,
  type LocalJob,
} from '@/lib/data-client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type EditableJobDocument = 'TRANSPORT' | 'INVOICE'

const emptyParty = (): JobDocumentParty => ({ name: null, address: null, countryCode: null, taxId: null })
const emptyItem = (lineNumber: number): JobInvoiceItem => ({
  lineNumber, itemCode: null, description: '', hsCode: null, quantity: null, unit: null,
  unitPrice: null, lineTotal: null, currency: null, grossWeightKg: null, netWeightKg: null,
  countryOfOrigin: null, packageCount: null, packageType: null,
})
const emptyContainer = (): JobTransportContainer => ({ containerNumber: null, size: null, type: null, sealNumber: null })
const nullableText = (value: string) => value.trim() || null
const nullableNumber = (value: string) => value === '' ? null : Number(value)

function invoiceFrom(job: LocalJob): JobInvoiceExtraction {
  const operational = getOperationalDetails(job)
  const current = operational.invoice
  return current ?? {
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
    items: (operational.invoiceItems ?? []).map((item, index) => ({ ...emptyItem(index + 1), ...item })),
  }
}

function transportFrom(job: LocalJob): JobTransportExtraction {
  const operational = getOperationalDetails(job)
  return operational.inboundDocument ?? {
    documentNumber: operational.inbound.documentNumber,
    documentDate: null,
    carrier: operational.inbound.carrier,
    vesselOrFlight: null,
    voyageOrFlightNumber: null,
    bookingNumber: null,
    shipper: { ...emptyParty(), name: job.shipper },
    consignee: { ...emptyParty(), name: job.consignee },
    notifyParty: { ...emptyParty(), name: job.notifyParty },
    portOfLoading: null,
    portOfDischarge: null,
    placeOfReceipt: null,
    placeOfDelivery: null,
    etd: null,
    eta: operational.inbound.scheduleAt,
    packageCount: null,
    packageType: null,
    marksAndNumbers: null,
    grossWeightKg: null,
    netWeightKg: null,
    volumeM3: null,
    containers: [],
  }
}

function TextField({ id, label, value, onChange, type = 'text' }: { id: string; label: string; value: string | number | null; onChange: (value: string) => void; type?: string }) {
  return <Field><FieldLabel htmlFor={id}>{label}</FieldLabel><Input id={id} type={type} value={value ?? ''} onChange={(event) => onChange(event.target.value)} /></Field>
}

function PartyFields({ prefix, legend, party, onChange }: { prefix: string; legend: string; party: JobDocumentParty | null; onChange: (party: JobDocumentParty) => void }) {
  const value = party ?? emptyParty()
  const update = (patch: Partial<JobDocumentParty>) => onChange({ ...value, ...patch })
  return <FieldSet className="rounded-lg border bg-background p-4"><FieldLegend className="text-primary">{legend}</FieldLegend><FieldGroup className="grid gap-4 md:grid-cols-2">
    <TextField id={`${prefix}-name`} label="Nama" value={value.name} onChange={(next) => update({ name: nullableText(next) })} />
    <TextField id={`${prefix}-tax`} label="Nomor identitas / pajak" value={value.taxId} onChange={(next) => update({ taxId: nullableText(next) })} />
    <TextField id={`${prefix}-country`} label="Kode negara" value={value.countryCode} onChange={(next) => update({ countryCode: nullableText(next)?.toUpperCase() ?? null })} />
    <Field><FieldLabel htmlFor={`${prefix}-address`}>Alamat</FieldLabel><Textarea id={`${prefix}-address`} value={value.address ?? ''} onChange={(event) => update({ address: nullableText(event.target.value) })} /></Field>
  </FieldGroup></FieldSet>
}

function InvoiceEditor({ value, onChange }: { value: JobInvoiceExtraction; onChange: (value: JobInvoiceExtraction) => void }) {
  const [activeView, setActiveView] = useState<'header' | 'items'>('header')
  const update = (patch: Partial<JobInvoiceExtraction>) => onChange({ ...value, ...patch })
  const updateItem = (index: number, patch: Partial<JobInvoiceItem>) => update({ items: value.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) })
  return <div className="flex min-h-0 flex-1 flex-col"><Tabs value={activeView} onValueChange={(next) => setActiveView(next as 'header' | 'items')} className="flex min-h-0 flex-1 flex-col gap-0"><div className="flex shrink-0 items-center justify-between gap-3 border-b bg-primary/5 px-4 pt-3 sm:px-6"><TabsList variant="line" className="w-fit gap-1 rounded-t-lg border border-primary/15 bg-background p-1"><TabsTrigger value="header" className="flex-none px-3 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-sm after:bg-primary"><FileText data-icon="inline-start" />Header</TabsTrigger><TabsTrigger value="items" className="flex-none px-3 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-sm after:bg-primary"><PackageSearch data-icon="inline-start" />Items ({value.items.length})</TabsTrigger></TabsList><p aria-live="polite" className="hidden text-xs font-medium text-primary sm:block">Tampilan aktif: {activeView === 'header' ? 'Header' : 'Items'}</p></div><TabsContent value="header" className="min-h-0 overflow-y-auto px-4 py-5 sm:px-6"><div className="flex flex-col gap-5">
    <FieldSet className="rounded-xl border border-primary/15 bg-primary/5 p-4 sm:p-5"><FieldLegend className="flex items-center gap-2 text-primary"><FileText aria-hidden="true" />Informasi dokumen</FieldLegend><FieldDescription>Data utama yang tercantum pada commercial invoice.</FieldDescription><FieldGroup className="grid gap-4 pt-2 sm:grid-cols-2 xl:grid-cols-4">
      <TextField id="invoice-number" label="Nomor invoice" value={value.invoiceNumber} onChange={(next) => update({ invoiceNumber: nullableText(next) })} />
      <TextField id="invoice-date" label="Tanggal invoice" type="date" value={value.invoiceDate} onChange={(next) => update({ invoiceDate: nullableText(next) })} />
      <TextField id="invoice-currency" label="Valuta" value={value.currency} onChange={(next) => update({ currency: nullableText(next)?.toUpperCase() ?? null })} />
      <TextField id="invoice-total" label="Total invoice" type="number" value={value.totalAmount} onChange={(next) => update({ totalAmount: nullableNumber(next) })} />
      <TextField id="invoice-incoterm" label="Incoterm" value={value.incoterm} onChange={(next) => update({ incoterm: nullableText(next)?.toUpperCase() ?? null })} />
      <TextField id="invoice-incoterm-location" label="Lokasi incoterm" value={value.incotermLocation} onChange={(next) => update({ incotermLocation: nullableText(next) })} />
      <TextField id="invoice-freight" label="Freight" type="number" value={value.freightAmount} onChange={(next) => update({ freightAmount: nullableNumber(next) })} />
      <TextField id="invoice-insurance" label="Asuransi" type="number" value={value.insuranceAmount} onChange={(next) => update({ insuranceAmount: nullableNumber(next) })} />
    </FieldGroup></FieldSet>
    <FieldSet className="rounded-xl border bg-accent/50 p-4 sm:p-5"><FieldLegend className="flex items-center gap-2 text-primary"><PackageSearch aria-hidden="true" />Ringkasan kemasan dan berat</FieldLegend><FieldGroup className="grid gap-4 pt-2 sm:grid-cols-2 xl:grid-cols-4">
      <TextField id="invoice-gross" label="Total bruto (kg)" type="number" value={value.totalGrossWeightKg} onChange={(next) => update({ totalGrossWeightKg: nullableNumber(next) })} />
      <TextField id="invoice-net" label="Total netto (kg)" type="number" value={value.totalNetWeightKg} onChange={(next) => update({ totalNetWeightKg: nullableNumber(next) })} />
      <TextField id="invoice-packages" label="Jumlah kemasan" type="number" value={value.totalPackageCount} onChange={(next) => update({ totalPackageCount: nullableNumber(next) })} />
      <TextField id="invoice-package-type" label="Jenis kemasan" value={value.packageType} onChange={(next) => update({ packageType: nullableText(next)?.toUpperCase() ?? null })} />
    </FieldGroup></FieldSet>
    <div className="rounded-xl border border-primary/10 bg-muted/40 p-4 sm:p-5"><div className="mb-4 flex items-center gap-2 text-base font-medium text-primary"><UsersRound aria-hidden="true" />Pihak pada invoice</div><div className="grid gap-5 lg:grid-cols-2">
      <PartyFields prefix="seller" legend="Penjual" party={value.seller} onChange={(seller) => update({ seller })} />
      <PartyFields prefix="buyer" legend="Pembeli" party={value.buyer} onChange={(buyer) => update({ buyer })} />
    </div></div></div>
    </TabsContent><TabsContent value="items" className="min-h-0 overflow-auto px-4 py-5 sm:px-6">
    <FieldSet className="min-h-full"><div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-primary/15 bg-primary/5 p-4"><div><FieldLegend className="text-primary">Item invoice</FieldLegend><FieldDescription>Tambahkan atau koreksi barang yang tercantum pada invoice.</FieldDescription></div><Button type="button" variant="outline" size="sm" onClick={() => update({ items: [...value.items, emptyItem(value.items.length + 1)] })}><Plus data-icon="inline-start" />Tambah item</Button></div>
      {value.items.length === 0 ? <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 p-6 text-center"><PackageSearch className="size-8 text-muted-foreground" aria-hidden="true" /><p className="mt-3 font-medium">Belum ada item invoice</p><p className="mt-1 max-w-sm text-sm text-muted-foreground">Tambahkan baris barang untuk melengkapi nilai, HS code, dan asal barang.</p><Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => update({ items: [emptyItem(1)] })}><Plus data-icon="inline-start" />Tambah item pertama</Button></div> : <Table><TableHeader className="sticky top-0 bg-background"><TableRow><TableHead>Baris</TableHead><TableHead>Kode</TableHead><TableHead>Uraian</TableHead><TableHead>HS</TableHead><TableHead>Qty</TableHead><TableHead>Satuan</TableHead><TableHead>Harga</TableHead><TableHead>Total</TableHead><TableHead>Valuta</TableHead><TableHead>Negara</TableHead><TableHead>Netto</TableHead><TableHead>Bruto</TableHead><TableHead><span className="sr-only">Aksi</span></TableHead></TableRow></TableHeader>
        <TableBody>{value.items.map((item, index) => <TableRow key={index}>
          {[
            ['Baris', item.lineNumber, 'number', (next: string) => updateItem(index, { lineNumber: nullableNumber(next) })],
            ['Kode barang', item.itemCode, 'text', (next: string) => updateItem(index, { itemCode: nullableText(next) })],
            ['Uraian', item.description, 'text', (next: string) => updateItem(index, { description: next })],
            ['HS', item.hsCode, 'text', (next: string) => updateItem(index, { hsCode: nullableText(next) })],
            ['Quantity', item.quantity, 'number', (next: string) => updateItem(index, { quantity: nullableNumber(next) })],
            ['Satuan', item.unit, 'text', (next: string) => updateItem(index, { unit: nullableText(next)?.toUpperCase() ?? null })],
            ['Harga satuan', item.unitPrice, 'number', (next: string) => updateItem(index, { unitPrice: nullableNumber(next) })],
            ['Total baris', item.lineTotal, 'number', (next: string) => updateItem(index, { lineTotal: nullableNumber(next) })],
            ['Valuta', item.currency, 'text', (next: string) => updateItem(index, { currency: nullableText(next)?.toUpperCase() ?? null })],
            ['Negara asal', item.countryOfOrigin, 'text', (next: string) => updateItem(index, { countryOfOrigin: nullableText(next)?.toUpperCase() ?? null })],
            ['Netto kg', item.netWeightKg, 'number', (next: string) => updateItem(index, { netWeightKg: nullableNumber(next) })],
            ['Bruto kg', item.grossWeightKg, 'number', (next: string) => updateItem(index, { grossWeightKg: nullableNumber(next) })],
          ].map(([label, current, type, change]) => <TableCell key={String(label)}><Field><FieldLabel className="sr-only">{String(label)}</FieldLabel><Input aria-label={String(label)} type={String(type)} value={(current as string | number | null) ?? ''} onChange={(event) => (change as (value: string) => void)(event.target.value)} className={label === 'Uraian' ? 'min-w-52' : 'min-w-24'} /></Field></TableCell>)}
          <TableCell><Button type="button" variant="ghost" size="icon-sm" aria-label="Hapus item" onClick={() => update({ items: value.items.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 /></Button></TableCell>
        </TableRow>)}</TableBody>
      </Table>}
    </FieldSet>
    </TabsContent></Tabs></div>
}

function TransportEditor({ value, onChange }: { value: JobTransportExtraction; onChange: (value: JobTransportExtraction) => void }) {
  const [activeView, setActiveView] = useState<'header' | 'items'>('header')
  const update = (patch: Partial<JobTransportExtraction>) => onChange({ ...value, ...patch })
  const updateContainer = (index: number, patch: Partial<JobTransportContainer>) => update({ containers: value.containers.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) })
  return <div className="flex min-h-0 flex-1 flex-col"><Tabs value={activeView} onValueChange={(next) => setActiveView(next as 'header' | 'items')} className="flex min-h-0 flex-1 flex-col gap-0"><div className="flex shrink-0 items-center justify-between gap-3 border-b bg-primary/5 px-4 pt-3 sm:px-6"><TabsList variant="line" className="w-fit gap-1 rounded-t-lg border border-primary/15 bg-background p-1"><TabsTrigger value="header" className="flex-none px-3 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-sm after:bg-primary"><FileText data-icon="inline-start" />Shipment Info</TabsTrigger><TabsTrigger value="items" className="flex-none px-3 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-sm after:bg-primary"><PackageSearch data-icon="inline-start" />Cargo ({value.containers.length})</TabsTrigger></TabsList><p aria-live="polite" className="hidden text-xs font-medium text-primary sm:block">Tampilan aktif: {activeView === 'header' ? 'Shipment Info' : 'Cargo'}</p></div><TabsContent value="header" className="min-h-0 overflow-y-auto px-4 py-5 sm:px-6"><div className="flex flex-col gap-5">
    <FieldSet className="rounded-xl border border-primary/15 bg-primary/5 p-4 sm:p-5"><FieldLegend className="flex items-center gap-2 text-primary"><FileText aria-hidden="true" />Dokumen B/L atau AWB</FieldLegend><FieldDescription>Identitas utama dokumen pengangkutan.</FieldDescription><FieldGroup className="grid gap-4 pt-2 sm:grid-cols-2">
      <TextField id="transport-number" label="Nomor B/L atau AWB" value={value.documentNumber} onChange={(next) => update({ documentNumber: nullableText(next) })} />
      <TextField id="transport-date" label="Tanggal dokumen" type="date" value={value.documentDate} onChange={(next) => update({ documentDate: nullableText(next) })} />
    </FieldGroup></FieldSet>
    <div className="rounded-xl border border-primary/10 bg-muted/40 p-4 sm:p-5"><div className="mb-4 flex items-center gap-2 text-base font-medium text-primary"><UsersRound aria-hidden="true" />Pihak pada dokumen</div><div className="grid gap-5 lg:grid-cols-3">
      <PartyFields prefix="shipper" legend="Shipper" party={value.shipper} onChange={(shipper) => update({ shipper })} />
      <PartyFields prefix="consignee" legend="Consignee" party={value.consignee} onChange={(consignee) => update({ consignee })} />
      <PartyFields prefix="notify" legend="Notify party" party={value.notifyParty} onChange={(notifyParty) => update({ notifyParty })} />
    </div></div>
    <FieldSet className="rounded-xl border bg-accent/50 p-4 sm:p-5"><FieldLegend className="flex items-center gap-2 text-primary"><PackageSearch aria-hidden="true" />Info lainnya</FieldLegend><FieldDescription>Rincian jadwal, rute, kemasan, dan berat shipment.</FieldDescription><FieldGroup className="grid gap-4 pt-2 sm:grid-cols-2 xl:grid-cols-3">
      <TextField id="transport-booking" label="Nomor booking" value={value.bookingNumber} onChange={(next) => update({ bookingNumber: nullableText(next) })} />
      <TextField id="transport-carrier" label="Carrier" value={value.carrier} onChange={(next) => update({ carrier: nullableText(next) })} />
      <TextField id="transport-vessel" label="Vessel / flight" value={value.vesselOrFlight} onChange={(next) => update({ vesselOrFlight: nullableText(next) })} />
      <TextField id="transport-voyage" label="Voyage / flight number" value={value.voyageOrFlightNumber} onChange={(next) => update({ voyageOrFlightNumber: nullableText(next) })} />
      <TextField id="transport-loading" label="Port of loading" value={value.portOfLoading} onChange={(next) => update({ portOfLoading: nullableText(next) })} />
      <TextField id="transport-discharge" label="Port of discharge" value={value.portOfDischarge} onChange={(next) => update({ portOfDischarge: nullableText(next) })} />
      <TextField id="transport-receipt" label="Place of receipt" value={value.placeOfReceipt} onChange={(next) => update({ placeOfReceipt: nullableText(next) })} />
      <TextField id="transport-delivery" label="Place of delivery" value={value.placeOfDelivery} onChange={(next) => update({ placeOfDelivery: nullableText(next) })} />
      <TextField id="transport-etd" label="ETD" type="date" value={value.etd} onChange={(next) => update({ etd: nullableText(next) })} />
      <TextField id="transport-eta" label="ETA" type="date" value={value.eta} onChange={(next) => update({ eta: nullableText(next) })} />
      <TextField id="transport-packages" label="Jumlah kemasan" type="number" value={value.packageCount} onChange={(next) => update({ packageCount: nullableNumber(next) })} />
      <TextField id="transport-package-type" label="Jenis kemasan" value={value.packageType} onChange={(next) => update({ packageType: nullableText(next)?.toUpperCase() ?? null })} />
      <TextField id="transport-gross" label="Bruto (kg)" type="number" value={value.grossWeightKg} onChange={(next) => update({ grossWeightKg: nullableNumber(next) })} />
      <TextField id="transport-net" label="Netto (kg)" type="number" value={value.netWeightKg} onChange={(next) => update({ netWeightKg: nullableNumber(next) })} />
      <TextField id="transport-volume" label="Volume (m³)" type="number" value={value.volumeM3} onChange={(next) => update({ volumeM3: nullableNumber(next) })} />
      <Field><FieldLabel htmlFor="transport-marks">Marks and numbers</FieldLabel><Textarea id="transport-marks" value={value.marksAndNumbers ?? ''} onChange={(event) => update({ marksAndNumbers: nullableText(event.target.value) })} /></Field>
    </FieldGroup></FieldSet>
    </div>
    </TabsContent><TabsContent value="items" className="min-h-0 overflow-auto px-4 py-5 sm:px-6">
    <FieldSet className="min-h-full"><div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-primary/15 bg-primary/5 p-4"><div><FieldLegend className="text-primary">Cargo</FieldLegend><FieldDescription>Tambahkan atau koreksi data kontainer dan muatan dari B/L atau AWB.</FieldDescription></div><Button type="button" variant="outline" size="sm" onClick={() => update({ containers: [...value.containers, emptyContainer()] })}><Plus data-icon="inline-start" />Tambah kontainer</Button></div>
      {value.containers.length === 0 ? <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 p-6 text-center"><PackageSearch className="size-8 text-muted-foreground" aria-hidden="true" /><p className="mt-3 font-medium">Belum ada kontainer</p><p className="mt-1 max-w-sm text-sm text-muted-foreground">Tambahkan nomor, ukuran, tipe, dan seal kontainer bila tersedia pada dokumen.</p><Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => update({ containers: [emptyContainer()] })}><Plus data-icon="inline-start" />Tambah kontainer pertama</Button></div> : <Table><TableHeader className="sticky top-0 bg-background"><TableRow><TableHead>Nomor</TableHead><TableHead>Ukuran</TableHead><TableHead>Tipe</TableHead><TableHead>Seal</TableHead><TableHead><span className="sr-only">Aksi</span></TableHead></TableRow></TableHeader>
        <TableBody>{value.containers.map((container, index) => <TableRow key={index}>{([
          ['Nomor kontainer', container.containerNumber, (next: string) => updateContainer(index, { containerNumber: nullableText(next) })],
          ['Ukuran', container.size, (next: string) => updateContainer(index, { size: nullableText(next) })],
          ['Tipe', container.type, (next: string) => updateContainer(index, { type: nullableText(next) })],
          ['Nomor seal', container.sealNumber, (next: string) => updateContainer(index, { sealNumber: nullableText(next) })],
        ] as const).map(([label, current, change]) => <TableCell key={label}><Field><FieldLabel className="sr-only">{label}</FieldLabel><Input aria-label={label} value={current ?? ''} onChange={(event) => change(event.target.value)} /></Field></TableCell>)}<TableCell><Button type="button" variant="ghost" size="icon-sm" aria-label="Hapus kontainer" onClick={() => update({ containers: value.containers.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 /></Button></TableCell></TableRow>)}</TableBody>
      </Table>}
    </FieldSet>
    </TabsContent></Tabs></div>
}

export function JobDocumentEditorDialog({ job, kind, open, onOpenChange, onSaved, onToast }: { job: LocalJob | null; kind: EditableJobDocument; open: boolean; onOpenChange: (open: boolean) => void; onSaved: (job: LocalJob) => void; onToast: (message: string, tone?: 'info' | 'error') => void }) {
  const [invoice, setInvoice] = useState<JobInvoiceExtraction | null>(null)
  const [transport, setTransport] = useState<JobTransportExtraction | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!job || !open) return
    setInvoice(invoiceFrom(job))
    setTransport(transportFrom(job))
  }, [job, open])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!job) return
    setSaving(true)
    try {
      const updated = kind === 'INVOICE' && invoice
        ? await saveJobInvoiceExtraction(job.id, invoice)
        : kind === 'TRANSPORT' && transport
          ? await saveJobTransportExtraction(job.id, transport)
          : null
      if (!updated) throw new Error('Data dokumen belum tersedia.')
      onSaved(updated)
      onOpenChange(false)
      onToast(`${kind === 'INVOICE' ? 'Invoice' : 'B/L atau AWB'} berhasil diperbarui.`)
    } catch (caught) {
      onToast(caught instanceof Error ? caught.message : 'Dokumen tidak dapat diperbarui.', 'error')
    } finally {
      setSaving(false)
    }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="flex h-[min(90vh,900px)] max-h-[90vh] w-[calc(100%-1rem)] max-w-none flex-col overflow-hidden p-0 sm:w-[calc(100%-2rem)] sm:max-w-[min(92vw,860px)]"><form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
    <DialogHeader className="border-b border-primary/20 bg-primary/10 px-5 py-5 pr-12 sm:px-6"><DialogTitle className="text-primary">Edit {kind === 'INVOICE' ? 'Invoice' : 'B/L atau AWB'}</DialogTitle><DialogDescription>Periksa dan koreksi data hasil ekstraksi dokumen untuk Job <span className="font-medium text-foreground">{job?.jobNumber ?? ''}</span>.</DialogDescription></DialogHeader>
    {kind === 'INVOICE' && invoice ? <InvoiceEditor value={invoice} onChange={setInvoice} /> : transport ? <TransportEditor value={transport} onChange={setTransport} /> : null}
    <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none border-primary/15 bg-primary/5 px-5 py-4 sm:px-6"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button><Button type="submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan perubahan'}</Button></DialogFooter>
  </form></DialogContent></Dialog>
}
