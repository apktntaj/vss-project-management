'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
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
import {
  ciplItemFieldId,
  ciplNameFieldId,
  type CiplItemField,
} from '@/lib/cipl-form-validation'
import { isRowFilled, itemFilled } from '@/lib/cipl-form-draft'
import type { DisposisiBarang } from '@/domain/exhibition/cipl-document'
import { cbmFromDimension } from '@/domain/job/manifest'

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
  id,
  error,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
  type?: 'text' | 'number'
  className?: string
  placeholder?: string
  children?: ReactNode
  /** id input; wajib bila `error` dipakai (target aria-describedby dan fokus). */
  id?: string
  /** Pesan kesalahan inline; tampil tepat di bawah input. */
  error?: string
}) {
  const errorId = id && error ? `${id}-error` : undefined
  return (
    <label className={`label text-xs ${className}`}>
      {label}
      <input
        id={id}
        type={type}
        {...(type === 'number' ? { min: '0', step: 'any' } : {})}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={`input mt-1 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-600 ${
          error ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-100' : ''
        }`}
        disabled={disabled}
      />
      {error ? (
        <span id={errorId} className="mt-1 block text-xs font-normal text-rose-700">
          {error}
        </span>
      ) : null}
      {children}
    </label>
  )
}

function ItemRow({
  item,
  disabled,
  onChange,
  onRemove,
  fieldId,
  errors,
  showDisposition,
}: {
  item: CiplItemDraft
  disabled: boolean
  onChange: (patch: Partial<CiplItemDraft>) => void
  onRemove: () => void
  fieldId: (field: CiplItemField) => string
  errors: Record<string, string>
  showDisposition: boolean
}) {
  const fieldProps = (field: CiplItemField) => ({ id: fieldId(field), error: errors[fieldId(field)] })
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
        {...fieldProps('uraian')}
      />
      <Field label="HS code" value={item.kodeHs} onChange={(kodeHs) => onChange({ kodeHs })} disabled={disabled} className="w-28" />
      <Field label="Qty" type="number" value={item.jumlah} onChange={(jumlah) => onChange({ jumlah })} disabled={disabled} className="w-20" {...fieldProps('jumlah')} />
      <Field label="Satuan" value={item.satuan} onChange={(satuan) => onChange({ satuan })} disabled={disabled} className="w-20" placeholder="PCE" />
      <Field label="Price" type="number" value={item.nilaiSatuan} onChange={(nilaiSatuan) => onChange({ nilaiSatuan })} disabled={disabled} className="w-24" {...fieldProps('nilaiSatuan')} />
      <Field
        label="Total price"
        type="number"
        value={item.nilaiTotal}
        onChange={(nilaiTotal) => onChange({ nilaiTotal })}
        disabled={disabled}
        className="w-28"
        placeholder={autoTotal === null ? '' : String(autoTotal)}
        {...fieldProps('nilaiTotal')}
      />
      {showDisposition && (
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
      )}
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

export function TotalField({
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
      <span className="mt-1 block text-xs font-normal text-slate-500">otomatis</span>
    </Field>
  )
}

function CaseEditor({
  draft,
  caseIndex,
  rowKey,
  disabled,
  errors,
  onChange,
  onRemove,
  showDisposition,
}: {
  draft: CiplCaseDraft
  caseIndex: number
  rowKey: string
  disabled: boolean
  errors: Record<string, string>
  onChange: (patch: Partial<CiplCaseDraft>) => void
  onRemove: () => void
  showDisposition: boolean
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
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Barang di case ini</p>
        {draft.items.map((item, itemIndex) => (
          <ItemRow
            key={itemIndex}
            item={item}
            disabled={disabled}
            onChange={(patch) => setItem(itemIndex, patch)}
            onRemove={() => onChange({ items: draft.items.filter((_, i) => i !== itemIndex) })}
            fieldId={(field) => ciplItemFieldId(rowKey, caseIndex, itemIndex, field)}
            errors={errors}
            showDisposition={showDisposition}
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
  disabled,
  errors,
  onChange,
  onRemove,
  showDisposition = true,
}: {
  row: CiplRowDraft
  disabled: boolean
  /** Kesalahan validasi per id field (lihat `lib/cipl-form-validation`). */
  errors: Record<string, string>
  onChange: (update: (row: CiplRowDraft) => CiplRowDraft) => void
  onRemove: () => void
  /** false = tanpa toggle Remark Disposal/Non-disposal per barang (Road Shipment); data tersimpan tidak berubah. */
  showDisposition?: boolean
}) {
  const sums = rowSums(row)
  const nameId = ciplNameFieldId(row.key)
  const nameError = errors[nameId]
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const cancelRemoveRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (confirmingRemove) cancelRemoveRef.current?.focus()
  }, [confirmingRemove])
  const itemCount = row.cases.reduce(
    (sum, draft) => sum + draft.items.filter((item) => itemFilled(item)).length,
    0,
  )
  // Baris yang belum berisi apa pun dibuang langsung; selebihnya minta konfirmasi dulu.
  const requestRemove = () => (isRowFilled(row) ? setConfirmingRemove(true) : onRemove())
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
          {row.jobNo ? <span className="ml-1 text-xs font-normal text-slate-500">{row.jobNo}</span> : null}
          <input
            id={nameId}
            value={row.name}
            onChange={(event) => setRow({ name: event.target.value.toUpperCase() })}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${nameId}-error` : undefined}
            className={`input mt-1 ${nameError ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-100' : ''}`}
            disabled={disabled}
          />
        </label>
        <button
          type="button"
          aria-label={`Hapus exhibitor ${row.name || ''}`.trim()}
          onClick={requestRemove}
          className={deleteButtonClass}
          disabled={disabled}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
        </div>
        {nameError ? (
          <p id={`${nameId}-error`} className="-mt-1 text-xs text-rose-700">
            {nameError}
          </p>
        ) : null}
        {confirmingRemove ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900"
          >
            <p className="min-w-0">
              Hapus exhibitor <span className="font-semibold">{row.name.trim() || 'ini'}</span>{' '}
              beserta {row.cases.length} case dan {itemCount} barang di dalamnya?
            </p>
            <div className="flex gap-2">
              <button
                ref={cancelRemoveRef}
                type="button"
                className="btn-secondary !px-3 !py-1.5"
                onClick={() => setConfirmingRemove(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn !bg-rose-600 !px-3 !py-1.5 text-white hover:!bg-rose-700"
                onClick={onRemove}
              >
                Ya, hapus
              </button>
            </div>
          </div>
        ) : null}
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
            rowKey={row.key}
            disabled={disabled}
            errors={errors}
            showDisposition={showDisposition}
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
