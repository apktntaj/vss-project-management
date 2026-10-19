'use client'

import { useEffect, useRef, useState } from 'react'
import { ClipboardList, FileSpreadsheet, Loader2, Upload } from 'lucide-react'

import { toast } from '@/components/toast'
import {
  entriesFromBupDocument,
  itemKeyOf,
  validateEntryBalance,
} from '@/domain/it-inventory/ledger'
import {
  adjustmentReasonLabels,
  bupDocumentLabels,
  type AdjustmentReason,
  type BupDocument,
  type JournalEntry,
  type MovementDirection,
} from '@/domain/it-inventory/types'

type AddEntryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Jurnal saat ini — untuk daftar barang yang sudah ada dan invariant saldo tidak minus. */
  entries: JournalEntry[]
  onAdd: (entries: JournalEntry[]) => void
}

// Alur dua langkah: layar pilihan (klik = fix, tanpa tab/tombol konfirmasi) → form pilihan itu.
// Unggah BUP = satu-satunya sumber entry dokumen pabean; Penyesuaian = pencatatan manual di luar
// dokumen pabean (Pasal 39 huruf e). Jurnal immutable: tidak ada ubah/hapus.
type DialogStep = 'select' | 'bulk' | 'penyesuaian'

type PenyesuaianForm = {
  direction: MovementDirection
  reason: AdjustmentReason
  beritaAcara: string
  entryDate: string
  itemMode: 'EXISTING' | 'NEW'
  itemKey: string
  name: string
  satuan: string
  hs: string
  quantity: string
  unitPrice: string
}

const todayIsoDate = () => new Date().toISOString().slice(0, 10)

function emptyForm(): PenyesuaianForm {
  return {
    direction: 'OUT',
    reason: 'STOCK_OPNAME',
    beritaAcara: '',
    entryDate: todayIsoDate(),
    itemMode: 'EXISTING',
    itemKey: '',
    name: '',
    satuan: '',
    hs: '',
    quantity: '',
    unitPrice: '',
  }
}

type BulkFileResult = { name: string; ok: boolean; message: string }

export function AddEntryDialog({ open, onOpenChange, entries, onAdd }: AddEntryDialogProps) {
  const [step, setStep] = useState<DialogStep>('select')
  const [form, setForm] = useState<PenyesuaianForm>(emptyForm())
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [busyBulk, setBusyBulk] = useState(false)
  const [bulkResults, setBulkResults] = useState<BulkFileResult[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    // Setiap dibuka dari awal: layar pilihan, riwayat bersih.
    setStep('select')
    setBulkResults([])
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  if (!open) return null

  const existingItems = (() => {
    const seen = new Map<string, { key: string; description: string; unitCode: string | null }>()
    for (const entry of entries) {
      if (!seen.has(entry.itemKey)) {
        seen.set(entry.itemKey, {
          key: entry.itemKey,
          description: entry.description,
          unitCode: entry.unitCode,
        })
      }
    }
    return [...seen.values()].sort((a, b) => a.description.localeCompare(b.description, 'id'))
  })()

  function update<K extends keyof PenyesuaianForm>(key: K, value: PenyesuaianForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key as string]: undefined }))
  }

  function setError(key: string, message: string) {
    setErrors((current) => ({ ...current, [key]: message }))
  }

  function buildPenyesuaianEntry(): JournalEntry | null {
    if (!form.entryDate) {
      setError('entryDate', 'Tanggal entry wajib diisi.')
      return null
    }

    let itemKey: string
    let hsCode: string | null
    let description: string
    let unitCode: string | null
    if (form.itemMode === 'EXISTING') {
      const picked = existingItems.find((item) => item.key === form.itemKey)
      if (!picked) {
        setError('itemKey', 'Pilih barang yang sudah ada atau tambah barang baru.')
        return null
      }
      itemKey = picked.key
      hsCode = null
      description = picked.description
      unitCode = picked.unitCode
    } else {
      description = form.name.trim()
      unitCode = form.satuan.trim() || null
      hsCode = form.hs.trim() || null
      if (!description) {
        setError('name', 'Nama barang wajib diisi.')
        return null
      }
      if (!unitCode) {
        setError('satuan', 'Satuan wajib diisi (menempel pada jumlah, mis. 9 PCE).')
        return null
      }
      itemKey = itemKeyOf(hsCode, description, unitCode)
    }

    const quantity = Number(form.quantity)
    if (!form.quantity.trim() || !Number.isFinite(quantity) || quantity <= 0) {
      setError('quantity', 'Jumlah harus berupa angka lebih dari 0.')
      return null
    }

    const unitPrice = form.unitPrice.trim() ? Number(form.unitPrice) : null
    if (unitPrice != null && !Number.isFinite(unitPrice)) {
      setError('unitPrice', 'Harga satuan harus berupa angka.')
      return null
    }

    const id = crypto.randomUUID()
    return {
      id,
      entryDate: form.entryDate,
      uploadedAt: new Date().toISOString(),
      source: 'ADJUSTMENT',
      direction: form.direction,
      documentKey: `adjustment:${id}`,
      documentCode: null,
      nomorDaftar: null,
      tanggalDaftar: null,
      nomorAju: null,
      invoiceNumber: null,
      invoiceSeri: null,
      adjustmentReason: form.reason,
      beritaAcaraNumber: form.beritaAcara.trim() || null,
      itemKey,
      hsCode,
      description,
      unitCode,
      quantity,
      unitPrice,
      value: unitPrice != null ? unitPrice * quantity : null,
      currency: null,
      ownerName: null,
      sourceRef: null,
    }
  }

  function submitPenyesuaian() {
    setErrors({})
    const entry = buildPenyesuaianEntry()
    if (!entry) return
    const validation = validateEntryBalance(entries, entry)
    if (!validation.ok) {
      setError('quantity', validation.issues[0].message)
      return
    }
    onAdd([entry])
    toast(
      `Penyesuaian (${adjustmentReasonLabels[form.reason]}) tercatat di jurnal.`,
      'success',
    )
    setForm(emptyForm())
    onOpenChange(false)
  }

  async function handleBulkFiles(files: FileList | null) {
    if (!files?.length) return
    setBusyBulk(true)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        const response = await fetch('/api/it-inventory/import', { method: 'POST', body: formData })
        const body = (await response.json().catch(() => null)) as BupDocument | { error?: string } | null
        if (!response.ok || !body || !('documentCode' in body)) {
          const message = (body && 'error' in body && body.error) || `File ${file.name} gagal dibaca.`
          setBulkResults((current) => [{ name: file.name, ok: false, message }, ...current])
          toast(message, 'error')
          continue
        }
        const added = entriesFromBupDocument(body)
        onAdd(added)
        setBulkResults((current) => [
          {
            name: file.name,
            ok: true,
            message: `${bupDocumentLabels[body.documentCode]}${body.nomorDaftar ? ` no. daftar ${body.nomorDaftar}` : ''} — ${added.length} entry.`,
          },
          ...current,
        ])
        toast(
          `${bupDocumentLabels[body.documentCode]}${body.nomorDaftar ? ` no. daftar ${body.nomorDaftar}` : ''} tercatat: ${added.length} entry.`,
          'success',
        )
      }
    } finally {
      setBusyBulk(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false)
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-entry-title"
    >
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="border-b px-6 py-4">
          <h2 id="add-entry-title" className="text-lg font-semibold">
            Tambah Entry
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {step === 'select' && 'Pilih sumber entry — dokumen pabean atau penyesuaian.'}
            {step === 'bulk' && 'Pilih file export BUP — setiap baris barang otomatis menjadi entry.'}
            {step === 'penyesuaian' && 'Catatan di luar dokumen pabean — wajib alasan.'}
          </p>
        </div>

        {step === 'select' && (
          <div className="grid gap-4 px-6 py-8 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setStep('bulk')}
              className="flex flex-col items-start gap-3 rounded-xl border border-slate-200 p-5 text-left transition-colors hover:border-orange-400 hover:bg-orange-50 focus-visible:border-orange-500"
            >
              <FileSpreadsheet className="text-emerald-700" size={26} aria-hidden="true" />
              <span className="font-semibold text-slate-900">Unggah BUP</span>
              <span className="text-sm leading-5 text-slate-500">
                Export dokumen pabean BC 2.3 / 2.5 / 3.0 (.xlsx). Arus masuk-keluar dikenali
                otomatis dari jenis dokumen.
              </span>
            </button>
            <button
              type="button"
              onClick={() => setStep('penyesuaian')}
              className="flex flex-col items-start gap-3 rounded-xl border border-slate-200 p-5 text-left transition-colors hover:border-orange-400 hover:bg-orange-50 focus-visible:border-orange-500"
            >
              <ClipboardList className="text-amber-700" size={26} aria-hidden="true" />
              <span className="font-semibold text-slate-900">Penyesuaian</span>
              <span className="text-sm leading-5 text-slate-500">
                Pencatatan di luar kondisi ideal: stock opname, rusak, hilang, atau koreksi
                catatan. Wajib disertai alasan.
              </span>
            </button>
          </div>
        )}

        {step === 'bulk' && (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                multiple
                className="hidden"
                onChange={(event) => void handleBulkFiles(event.target.files)}
              />
              <button
                type="button"
                className="btn-primary inline-flex items-center gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={busyBulk}
              >
                {busyBulk ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                {busyBulk ? 'Membaca file…' : 'Pilih file BUP'}
              </button>
              {bulkResults.length > 0 && (
                <ul className="space-y-2" aria-label="Hasil unggahan">
                  {bulkResults.map((result, index) => (
                    <li
                      key={`${result.name}-${index}`}
                      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${result.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-800'}`}
                    >
                      <FileSpreadsheet size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span>
                        <span className="font-semibold">{result.name}</span>
                        {' — '}
                        {result.message}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {step === 'penyesuaian' && (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault()
                submitPenyesuaian()
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <fieldset className="space-y-2">
                  <legend className="label">Arus</legend>
                  <div className="flex gap-x-5">
                    {([['IN', 'Masuk'], ['OUT', 'Keluar']] as [MovementDirection, string][]).map(
                      ([value, label]) => (
                        <label key={value} className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="radio"
                            name="adjustment-direction"
                            checked={form.direction === value}
                            onChange={() => update('direction', value)}
                            className="h-4 w-4 accent-orange-600"
                          />
                          {label}
                        </label>
                      ),
                    )}
                  </div>
                </fieldset>
                <label className="space-y-1">
                  <span className="label">Alasan</span>
                  <select
                    value={form.reason}
                    onChange={(event) => update('reason', event.target.value as AdjustmentReason)}
                    className="input"
                  >
                    {(Object.keys(adjustmentReasonLabels) as AdjustmentReason[]).map((reason) => (
                      <option key={reason} value={reason}>
                        {adjustmentReasonLabels[reason]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="label">Tanggal entry</span>
                  <input
                    type="date"
                    value={form.entryDate}
                    onChange={(event) => update('entryDate', event.target.value)}
                    className="input"
                    aria-invalid={Boolean(errors.entryDate)}
                  />
                  {errors.entryDate && <p className="text-sm text-rose-600">{errors.entryDate}</p>}
                </label>
                <label className="space-y-1">
                  <span className="label">Nomor berita acara (opsional)</span>
                  <input
                    value={form.beritaAcara}
                    onChange={(event) => update('beritaAcara', event.target.value)}
                    className="input"
                    placeholder="mis. BA-01/OPNAME/2026"
                  />
                </label>
              </div>

              <fieldset className="space-y-2">
                <legend className="label">Barang</legend>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {([['EXISTING', 'Pilih dari buku'], ['NEW', 'Barang baru']] as ['EXISTING' | 'NEW', string][]).map(
                    ([value, label]) => (
                      <label key={value} className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="radio"
                          name="item-mode"
                          checked={form.itemMode === value}
                          onChange={() => update('itemMode', value)}
                          className="h-4 w-4 accent-orange-600"
                          disabled={value === 'EXISTING' && existingItems.length === 0}
                        />
                        {label}
                      </label>
                    ),
                  )}
                </div>
              </fieldset>

              {form.itemMode === 'EXISTING' ? (
                <label className="block space-y-1">
                  <span className="label">Nama barang</span>
                  <select
                    value={form.itemKey}
                    onChange={(event) => update('itemKey', event.target.value)}
                    className="input"
                    aria-invalid={Boolean(errors.itemKey)}
                  >
                    <option value="">— pilih barang —</option>
                    {existingItems.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.description}
                        {item.unitCode ? ` (${item.unitCode})` : ''}
                      </option>
                    ))}
                  </select>
                  {errors.itemKey && <p className="text-sm text-rose-600">{errors.itemKey}</p>}
                </label>
              ) : (
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="space-y-1 sm:col-span-2">
                    <span className="label">Nama barang</span>
                    <input
                      value={form.name}
                      onChange={(event) => update('name', event.target.value)}
                      className="input"
                      placeholder="mis. Lampu meja LED"
                      aria-invalid={Boolean(errors.name)}
                    />
                    {errors.name && <p className="text-sm text-rose-600">{errors.name}</p>}
                  </label>
                  <label className="space-y-1">
                    <span className="label">Satuan</span>
                    <input
                      value={form.satuan}
                      onChange={(event) => update('satuan', event.target.value.toUpperCase())}
                      className="input"
                      placeholder="mis. PCE"
                      aria-invalid={Boolean(errors.satuan)}
                    />
                    {errors.satuan && <p className="text-sm text-rose-600">{errors.satuan}</p>}
                  </label>
                  <label className="space-y-1 sm:col-span-3">
                    <span className="label">HS (opsional)</span>
                    <input
                      value={form.hs}
                      onChange={(event) => update('hs', event.target.value)}
                      className="input"
                      placeholder="mis. 9405.11.00"
                    />
                  </label>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="space-y-1">
                  <span className="label">Jumlah</span>
                  <input
                    inputMode="decimal"
                    value={form.quantity}
                    onChange={(event) => update('quantity', event.target.value)}
                    className="input"
                    placeholder="mis. 9"
                    aria-invalid={Boolean(errors.quantity)}
                  />
                  {errors.quantity && <p className="text-sm text-rose-600">{errors.quantity}</p>}
                </label>
                <label className="space-y-1">
                  <span className="label">Harga satuan (opsional)</span>
                  <input
                    inputMode="decimal"
                    value={form.unitPrice}
                    onChange={(event) => update('unitPrice', event.target.value)}
                    className="input"
                    placeholder="mis. 7"
                    aria-invalid={Boolean(errors.unitPrice)}
                  />
                  {errors.unitPrice && <p className="text-sm text-rose-600">{errors.unitPrice}</p>}
                </label>
                <div className="space-y-1">
                  <span className="label">Total</span>
                  <p className="input flex items-center bg-slate-50 text-slate-600" aria-live="polite">
                    {form.quantity && form.unitPrice &&
                    Number.isFinite(Number(form.quantity)) &&
                    Number.isFinite(Number(form.unitPrice))
                      ? Number(form.quantity) * Number(form.unitPrice)
                      : '—'}
                  </p>
                </div>
              </div>

              <button type="submit" className="btn-primary hidden">
                Simpan penyesuaian
              </button>
            </form>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 border-t bg-slate-50 px-6 py-4">
          <button type="button" className="btn-secondary" onClick={() => onOpenChange(false)}>
            Tutup
          </button>
          {step === 'penyesuaian' && (
            <button type="button" className="btn-primary" onClick={submitPenyesuaian}>
              Simpan penyesuaian
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
