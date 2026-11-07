'use client'

import type { ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import {
  autoTotalPrice,
  emptyCase,
  emptyItem,
  numberOrNull,
  rowSums,
  type CiplCaseDraft,
  type CiplItemDraft,
  type CiplRowDraft,
} from '@/lib/cipl-form-draft'
import type { DisposisiBarang } from '@/domain/exhibition/cipl-document'
import { autofillResolutionLabels } from '@/domain/exhibition/cipl-autofill'
import { cbmFromDimension } from '@/domain/job/manifest'

export type ExhibitorLinkStatus = { kind: 'TERTAUT' | 'BARU' | 'AMBIGU'; hint: string } | null

const linkStatusClass: Record<'TERTAUT' | 'BARU' | 'AMBIGU', string> = {
  TERTAUT: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  BARU: 'bg-amber-50 text-amber-700 ring-amber-200',
  AMBIGU: 'bg-rose-50 text-rose-700 ring-rose-200',
}

/**
 * Remark per barang: toggle dua pilihan, bawaan non-disposal (re-ekspor). Model menyimpan tetap
 * empat nilai; GIVE_AWAY hanya datang dari scan dan ditampilkan sebagai pilihan ketiga supaya
 * tidak berubah diam-diam.
 */
const remarkOptions: ReadonlyArray<{ value: DisposisiBarang; label: string }> = [
  { value: 'RE_EXPORT', label: 'Non-disposal' },
  { value: 'DISPOSED', label: 'Disposal' },
]
const giveAwayOption = { value: 'GIVE_AWAY' as const, label: 'Diberikan / dijual' }

/** Tombol tambah (hijau, rata kanan sejajar ikon hapus) dan ikon hapus (merah). */
const addButtonClass =
  'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50'
const deleteButtonClass = 'mb-1 rounded-lg p-2 text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50'

function Field({
  label,
  value,
  onChange,
  disabled,
  type = 'text',
  className = '',
  placeholder,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
  type?: 'text' | 'number'
  className?: string
  placeholder?: string
  children?: ReactNode
}) {
  return (
    <label className={`label text-xs ${className}`}>
      {label}
      <input
        type={type}
        {...(type === 'number' ? { min: '0', step: 'any' } : {})}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="input mt-1 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-600"
        disabled={disabled}
      />
      {children}
    </label>
  )
}

function ItemRow({
  item,
  disabled,
  onChange,
  onRemove,
}: {
  item: CiplItemDraft
  disabled: boolean
  onChange: (patch: Partial<CiplItemDraft>) => void
  onRemove: () => void
}) {
  const options = item.disposisi === 'GIVE_AWAY' ? [...remarkOptions, giveAwayOption] : remarkOptions
  const autoTotal = autoTotalPrice(item)
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field
        label="Deskripsi barang"
        value={item.uraian}
        onChange={(uraian) => onChange({ uraian })}
        disabled={disabled}
        className="w-48 grow"
        placeholder="Nama barang"
      />
      <Field label="HS code" value={item.kodeHs} onChange={(kodeHs) => onChange({ kodeHs })} disabled={disabled} className="w-28" />
      <Field label="Qty" type="number" value={item.jumlah} onChange={(jumlah) => onChange({ jumlah })} disabled={disabled} className="w-20" />
      <Field label="Satuan" value={item.satuan} onChange={(satuan) => onChange({ satuan })} disabled={disabled} className="w-20" placeholder="PCE" />
      <Field label="Price" type="number" value={item.nilaiSatuan} onChange={(nilaiSatuan) => onChange({ nilaiSatuan })} disabled={disabled} className="w-24" />
      <Field
        label="Total price"
        type="number"
        value={item.nilaiTotal}
        onChange={(nilaiTotal) => onChange({ nilaiTotal })}
        disabled={disabled}
        className="w-28"
        placeholder={autoTotal === null ? '' : String(autoTotal)}
      />
      <div className="label flex w-auto flex-col text-xs">
        Remark
        <div role="radiogroup" aria-label="Remark" className="mt-1 inline-flex overflow-hidden rounded-lg border border-slate-200">
          {options.map((option) => {
            const active = item.disposisi === option.value
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                onClick={() => onChange({ disposisi: option.value })}
                className={`px-2.5 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
                  active ? 'bg-orange-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>
      <button
        type="button"
        aria-label="Hapus barang"
        onClick={onRemove}
        className={deleteButtonClass}
        disabled={disabled}
      >
        <Trash2 size={14} aria-hidden="true" />
      </button>
    </div>
  )
}

/** Total exhibitor hasil hitungan otomatis dari rincian case; field mati dan tidak bisa diketik. */
function TotalField({
  label,
  derived,
  className,
}: {
  label: string
  derived: number
  className: string
}) {
  return (
    <Field
      label={label}
      type="number"
      value={derived > 0 ? String(derived) : ''}
      onChange={() => undefined}
      disabled
      className={className}
      placeholder="0"
    >
      <span className="mt-1 block text-[11px] font-normal text-slate-400">otomatis</span>
    </Field>
  )
}

function CaseEditor({
  draft,
  caseIndex,
  disabled,
  onChange,
  onRemove,
}: {
  draft: CiplCaseDraft
  caseIndex: number
  disabled: boolean
  onChange: (patch: Partial<CiplCaseDraft>) => void
  onRemove: () => void
}) {
  const setItem = (itemIndex: number, patch: Partial<CiplItemDraft>) =>
    onChange({
      items: draft.items.map((item, i) => (i === itemIndex ? { ...item, ...patch } : item)),
    })
  // CBM kosong = otomatis dari L × W × H; tampil sebagai nilai bayangan di dalam field.
  const autoCbm = cbmFromDimension(
    numberOrNull(draft.length),
    numberOrNull(draft.width),
    numberOrNull(draft.height),
  )
  return (
    <div className="rounded-lg border border-black/5 bg-slate-50/60 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="No. case" value={draft.label} onChange={(label) => onChange({ label })} disabled={disabled} className="w-28 grow" placeholder="cth. PKG 1" />
        <Field label="L (cm)" type="number" value={draft.length} onChange={(length) => onChange({ length })} disabled={disabled} className="w-20" />
        <Field label="W (cm)" type="number" value={draft.width} onChange={(width) => onChange({ width })} disabled={disabled} className="w-20" />
        <Field label="H (cm)" type="number" value={draft.height} onChange={(height) => onChange({ height })} disabled={disabled} className="w-20" />
        <Field label="CBM" type="number" value={draft.cbm} onChange={(cbm) => onChange({ cbm })} disabled={disabled} className="w-24" placeholder={autoCbm === null ? undefined : String(autoCbm)} />
        <Field label="Gross (kg)" type="number" value={draft.grossWeight} onChange={(grossWeight) => onChange({ grossWeight })} disabled={disabled} className="w-24" />
        <Field label="Net (kg)" type="number" value={draft.netWeight} onChange={(netWeight) => onChange({ netWeight })} disabled={disabled} className="w-24" />
        <Field label="Satuan" value={draft.satuanKemasan} onChange={(satuanKemasan) => onChange({ satuanKemasan })} disabled={disabled} className="w-28" placeholder="cth. CARTON" />
        <button
          type="button"
          aria-label={`Hapus case ${draft.label || caseIndex + 1}`}
          onClick={onRemove}
          className={deleteButtonClass}
          disabled={disabled}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 space-y-2 border-t border-black/5 pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Barang di case ini</p>
        {draft.items.map((item, itemIndex) => (
          <ItemRow
            key={itemIndex}
            item={item}
            disabled={disabled}
            onChange={(patch) => setItem(itemIndex, patch)}
            onRemove={() => onChange({ items: draft.items.filter((_, i) => i !== itemIndex) })}
          />
        ))}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onChange({ items: [...draft.items, emptyItem()] })}
            className={addButtonClass}
            disabled={disabled}
          >
            <Plus size={13} aria-hidden="true" /> Tambah barang
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Satu exhibitor: identitas dan total otomatis (nama, total pkg/CBM/gross/net, booth, hall), lalu
 * case (nomor, dimensi, CBM, gross, net, satuan) dan barang di dalam tiap case. Tombol hapus di
 * sisi nama membuang seluruh exhibitor beserta case dan barangnya.
 */
export function CiplExhibitorForm({
  row,
  link,
  replacing,
  disabled,
  onChange,
  onRemove,
}: {
  row: CiplRowDraft
  link: ExhibitorLinkStatus
  replacing: boolean
  disabled: boolean
  onChange: (update: (row: CiplRowDraft) => CiplRowDraft) => void
  onRemove: () => void
}) {
  const sums = rowSums(row)
  const setRow = (patch: Partial<CiplRowDraft>) => onChange((current) => ({ ...current, ...patch }))
  const setCase = (caseIndex: number, patch: Partial<CiplCaseDraft>) =>
    onChange((current) => ({
      ...current,
      cases: current.cases.map((entry, i) => (i === caseIndex ? { ...entry, ...patch } : entry)),
    }))
  return (
    <li className="rounded-xl border border-black/10 p-4">
      <div className="space-y-3">
        <div className="flex items-end gap-2">
        <label className="label flex-1">
          Exhibitor
          {row.jobNo ? <span className="ml-1 text-xs font-normal text-slate-400">{row.jobNo}</span> : null}
          {link ? (
            <span
              className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${linkStatusClass[link.kind]}`}
              title={link.hint}
            >
              {autofillResolutionLabels[link.kind]}
            </span>
          ) : null}
          {replacing ? (
            <span
              className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200"
              title="Exhibitor ini sudah punya baris di job — lihat panel penggantian"
            >
              mengganti baris
            </span>
          ) : null}
          <input
            value={row.name}
            onChange={(event) => setRow({ name: event.target.value.toUpperCase() })}
            className="input mt-1"
            disabled={disabled}
          />
        </label>
        <button
          type="button"
          aria-label={`Hapus exhibitor ${row.name || ''}`.trim()}
          onClick={onRemove}
          className={deleteButtonClass}
          disabled={disabled}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <TotalField label="Total pkg" derived={sums.packages} className="w-24" />
          <TotalField label="Total CBM" derived={sums.cbm} className="w-28" />
          <TotalField label="Total gross (kg)" derived={sums.gross} className="w-32" />
          <TotalField label="Total net (kg)" derived={sums.net} className="w-32" />
          <Field label="Booth no" value={row.booth} onChange={(booth) => setRow({ booth })} disabled={disabled} className="w-28" />
          <Field label="Hall" value={row.hall} onChange={(hall) => setRow({ hall })} disabled={disabled} className="w-28" />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {row.cases.map((draft, caseIndex) => (
          <CaseEditor
            key={caseIndex}
            draft={draft}
            caseIndex={caseIndex}
            disabled={disabled}
            onChange={(patch) => setCase(caseIndex, patch)}
            onRemove={() =>
              onChange((current) => ({
                ...current,
                cases: current.cases.filter((_, i) => i !== caseIndex),
              }))
            }
          />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Σ {sums.cbm.toLocaleString('id-ID')} CBM · {sums.gross.toLocaleString('id-ID')} kg gross ·{' '}
          {sums.net.toLocaleString('id-ID')} kg net
        </p>
        <button
          type="button"
          onClick={() => onChange((current) => ({ ...current, cases: [...current.cases, emptyCase()] }))}
          className={`${addButtonClass} mr-3`}
          disabled={disabled}
        >
          <Plus size={13} aria-hidden="true" /> Tambah case
        </button>
      </div>
    </li>
  )
}
