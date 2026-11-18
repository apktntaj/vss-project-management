'use client'

// Bagian pabean yang UI-nya sudah disiapkan tetapi datanya BELUM ada di kontrak backend: BC 1.1,
// jalur & pemeriksaan fisik, SPPB, NOTUL/SPTNP, status jaminan, dan lampiran BC. Semua isian
// NONAKTIF dan tidak menyimpan apa pun — tidak berpura-pura tersimpan. Kontrak yang dibutuhkan
// dicatat di docs/ui/job-detail-ui-backlog.md; saat backend siap cukup mengaktifkan field dan
// menyambungkannya ke penyimpanan, tata letaknya sudah final.

import { useId, type ReactNode } from 'react'
import { Clock3 } from 'lucide-react'

import type { CustomsDocumentKind, InternationalJobJenis, JobStage } from '@/domain/job/types'

const pendingInput =
  'input mt-1 cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500'

function PendingField({
  label,
  type = 'text',
  options,
  className = '',
}: {
  label: string
  type?: 'text' | 'date' | 'file'
  options?: readonly string[]
  className?: string
}) {
  const id = useId()
  return (
    <div className={`label ${className}`}>
      <label htmlFor={id}>{label}</label>
      {options ? (
        <select id={id} disabled className={pendingInput}>
          <option>Belum tersedia</option>
        </select>
      ) : (
        <input id={id} type={type} disabled className={pendingInput} placeholder="Belum tersedia" />
      )}
      {options ? <span className="sr-only">Pilihan: {options.join(', ')}</span> : null}
    </div>
  )
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset disabled className="min-w-0 border-0 p-0">
      <legend className="text-sm font-semibold text-slate-700">{title}</legend>
      {hint ? <p className="mt-0.5 text-xs text-slate-600">{hint}</p> : null}
      <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </fieldset>
  )
}

export function JobCustomsPendingCard({
  kind,
  stage,
  jenis,
}: {
  kind: CustomsDocumentKind
  stage: JobStage
  jenis: InternationalJobJenis | null
}) {
  // Carnet tidak memakai BC: endorsemen dan identitas carnet sudah ada di kartu dokumen.
  if (kind === 'CARNET') return null
  const inbound = stage === 'INBOUND'
  const guaranteeStatus = jenis === 'TEMPORARY_IMPORT' && inbound
  return (
    <section className="card p-5" aria-labelledby="job-customs-pending-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="job-customs-pending-heading" className="font-semibold">
          Data pabean lanjutan
        </h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
          <Clock3 size={13} aria-hidden="true" /> Belum tersedia — menunggu backend
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-600">
        Isian di bawah belum bisa diisi dan tidak disimpan: kontrak datanya belum ada di backend.
        Ditampilkan agar alur pabean terlihat utuh.
      </p>
      <div className="mt-4 space-y-5">
        {inbound ? (
          <Group title="BC 1.1 (manifest kedatangan)">
            <PendingField label="Nomor BC 1.1" />
            <PendingField label="Tanggal BC 1.1" type="date" />
            <PendingField label="Pos" />
            <PendingField label="Sub pos" />
          </Group>
        ) : null}
        <Group title="Jalur dan pemeriksaan fisik">
          <PendingField label="Jalur" options={['Hijau', 'Kuning', 'Merah']} />
          <PendingField label="Pemeriksaan fisik" options={['Tidak diperiksa', 'Diperiksa']} />
          <PendingField label="Tanggal pemeriksaan" type="date" />
        </Group>
        <Group title="SPPB">
          <PendingField label="No SPPB" />
          <PendingField label="Tanggal SPPB" type="date" />
        </Group>
        <Group title="Penetapan (NOTUL / SPTNP)">
          <PendingField label="No NOTUL / SPTNP" />
          <PendingField label="Tanggal NOTUL / SPTNP" type="date" />
        </Group>
        {guaranteeStatus ? (
          <Group title="Status jaminan">
            <PendingField label="Status jaminan" options={['Aktif', 'Dicairkan', 'Dikembalikan']} />
            <PendingField label="Tanggal pencairan / pengembalian" type="date" />
          </Group>
        ) : null}
        <Group title="Lampiran dokumen BC" hint="Unggah dan unduh berkas BC_* belum tersedia.">
          <PendingField label="Berkas BC" type="file" className="sm:col-span-2" />
        </Group>
      </div>
    </section>
  )
}
