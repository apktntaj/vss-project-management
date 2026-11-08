'use client'

import type { ReactNode } from 'react'
import { PackageSearch } from 'lucide-react'
import type { Job } from '@/lib/data-client'
import type { JobDocumentParty } from '@/domain/exhibition/source-documents'
import { DocumentSection, documentKindForMode } from '@/components/job-document-editor-dialog'
import { date } from '@/components/job-row'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 })

/** Nilai baca-saja; susunan dan label sama dengan field pada form B/L atau AWB. */
function ReadField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm break-words whitespace-pre-line text-slate-900">
        {children === null || children === undefined || children === '' ? (
          <span className="text-slate-400">—</span>
        ) : (
          children
        )}
      </dd>
    </div>
  )
}

function PartyView({ legend, party, withTaxId }: { legend: string; party: JobDocumentParty | null; withTaxId: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <p className="text-sm font-medium">{legend}</p>
      <dl className={withTaxId ? 'grid gap-4 sm:grid-cols-[1fr_14rem]' : 'grid gap-4'}>
        <ReadField label={`Nama ${legend.toLowerCase()}`}>{party?.name}</ReadField>
        {withTaxId ? <ReadField label="NPWP">{party?.taxId}</ReadField> : null}
      </dl>
      <dl>
        <ReadField label={`Alamat ${legend.toLowerCase()}`}>{party?.address}</ReadField>
      </dl>
    </div>
  )
}

/** Tampilan baca B/L atau AWB job — meniru form pembuatan supaya tidak berpindah konteks. */
export function JobTransportDocumentCard({ job }: { job: Job }) {
  const transport = job.transportDocument
  const kind = documentKindForMode(job.transportMode) ?? job.transportDocumentType ?? 'BL'
  const sea = kind === 'BL'
  const fcl = sea && transport?.loadType === 'FCL'
  const docName = sea ? 'B/L' : 'AWB'
  const documentNumber = transport?.documentNumber ?? job.transportDocumentNumber
  const exists = Boolean(transport || job.transportDocumentNumber)

  return (
    <section className="card p-5">
      <div>
        <h2 className="font-semibold">{sea ? 'Bill of Lading' : 'Air Waybill'}</h2>
        <p className="mt-0.5 text-xs text-slate-500">PIC: {job.assignedTo?.name ?? '—'}</p>
      </div>

      {!exists ? (
        <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
          <PackageSearch className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium">Belum ada B/L atau AWB</p>
          <p className="mt-1 max-w-sm text-xs text-slate-500">Unggah dokumen atau isi manual lewat tombol Buat Transport.</p>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-6">
          <DocumentSection title="Dokumen">
            <dl className="grid gap-4 sm:grid-cols-2">
              <ReadField label={sea ? 'Shipping line' : 'Airline'}>{transport?.carrier}</ReadField>
              <ReadField label={`Nomor ${docName}`}>{documentNumber}</ReadField>
              <ReadField label={`Tanggal ${docName}`}>{transport?.documentDate ? date(transport.documentDate) : null}</ReadField>
            </dl>
          </DocumentSection>

          <DocumentSection title="Para pihak">
            <div className="flex flex-col gap-4">
              <PartyView legend="Shipper" party={transport?.shipper ?? null} withTaxId={false} />
              <PartyView legend="Consignee" party={transport?.consignee ?? null} withTaxId />
              <PartyView legend="Notify party" party={transport?.notifyParty ?? null} withTaxId />
            </div>
          </DocumentSection>

          <DocumentSection title={sea ? 'Pelayaran' : 'Penerbangan'}>
            <dl className="grid gap-4 sm:grid-cols-3">
              <ReadField label={sea ? 'Vessel' : 'Flight'}>{transport?.vesselOrFlight}</ReadField>
              <ReadField label={sea ? 'Voyage' : 'Nomor flight'}>{transport?.voyageOrFlightNumber}</ReadField>
              <ReadField label="ETD">{transport?.etd ? date(transport.etd) : null}</ReadField>
            </dl>
            <dl className="grid gap-4 sm:grid-cols-2">
              <ReadField label="Port of loading">{transport?.portOfLoading}</ReadField>
              <ReadField label="Port of destination">{transport?.portOfDischarge}</ReadField>
            </dl>
          </DocumentSection>

          <DocumentSection title="Muatan">
            {sea ? (
              <dl className="grid gap-4 sm:grid-cols-2">
                <ReadField label="LCL / FCL">{transport?.loadType}</ReadField>
                {fcl ? <ReadField label="Jumlah container">{number.format(transport?.containers.length ?? 0)}</ReadField> : null}
              </dl>
            ) : null}
            {fcl ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium">Detail container</p>
                {transport && transport.containers.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nomor container</TableHead>
                        <TableHead>Ukuran</TableHead>
                        <TableHead>Tipe</TableHead>
                        <TableHead>Nomor seal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transport.containers.map((container, index) => (
                        <TableRow key={index}>
                          <TableCell>{container.containerNumber ?? '—'}</TableCell>
                          <TableCell>{container.size ?? '—'}</TableCell>
                          <TableCell>{container.type ?? '—'}</TableCell>
                          <TableCell>{container.sealNumber ?? '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="rounded-lg border border-dashed p-4 text-center text-xs text-slate-500">Belum ada container</p>
                )}
              </div>
            ) : null}
            <dl className="grid gap-4 sm:grid-cols-2">
              <ReadField label="Jumlah package">{transport?.packageCount != null ? number.format(transport.packageCount) : null}</ReadField>
              <ReadField label="Jenis kemasan">{transport?.packageType}</ReadField>
            </dl>
            <dl className="flex flex-col gap-4">
              <ReadField label="Remark">{transport?.marksAndNumbers}</ReadField>
              <ReadField label="Detail barang">{transport?.goodsDescription}</ReadField>
            </dl>
            <dl className="grid gap-4 sm:grid-cols-3">
              <ReadField label="Bruto (kg)">{transport?.grossWeightKg != null ? number.format(transport.grossWeightKg) : null}</ReadField>
              <ReadField label="Netto (kg)">{transport?.netWeightKg != null ? number.format(transport.netWeightKg) : null}</ReadField>
              <ReadField label="Volume (m³)">{transport?.volumeM3 != null ? number.format(transport.volumeM3) : null}</ReadField>
            </dl>
          </DocumentSection>
        </div>
      )}
    </section>
  )
}
