'use client'

import { useState } from 'react'
import { Calculator, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  CBM_UNITS,
  DEFAULT_CBM_UNIT,
  computeCbm,
  parseDecimal,
  type CbmInput,
  type CbmUnit,
} from '@/lib/cbm'

// Kalkulator CBM: panjang × lebar × tinggi dalam satuan terpilih → volume m³.
// Hitungan di browser; tidak ada yang disimpan.

const EMPTY: CbmInput = { length: '', width: '', height: '' }

const fields: { field: keyof CbmInput; label: string }[] = [
  { field: 'length', label: 'Panjang' },
  { field: 'width', label: 'Lebar' },
  { field: 'height', label: 'Tinggi' },
]

const formatCbm = (value: number) =>
  value.toLocaleString('id-ID', { minimumFractionDigits: 3, maximumFractionDigits: 6 })

function invalid(value: string) {
  const parsed = parseDecimal(value)
  return parsed !== null && (Number.isNaN(parsed) || parsed <= 0)
}

export function ToolsCbmCalculator() {
  const [unit, setUnit] = useState<CbmUnit>(DEFAULT_CBM_UNIT)
  const [input, setInput] = useState<CbmInput>(EMPTY)

  const cbm = computeCbm(input, unit)
  const unitLabel = CBM_UNITS.find((entry) => entry.value === unit)?.label ?? unit

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 gap-3">
          <Calculator className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">Kalkulator CBM</h2>
            <p className="mt-1 text-xs text-slate-500">
              Pilih satuan, lalu isi panjang, lebar, dan tinggi. Desimal boleh memakai koma atau
              titik.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={() => setInput(EMPTY)}>
          <RotateCcw data-icon="inline-start" />
          Reset
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="label">
          Satuan
          <select
            className="input"
            value={unit}
            onChange={(event) => setUnit(event.target.value as CbmUnit)}
          >
            {CBM_UNITS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        {fields.map(({ field, label }) => {
          const bad = invalid(input[field])
          return (
            <label key={field} className="label">
              {label} ({unitLabel})
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                aria-invalid={bad || undefined}
                value={input[field]}
                onChange={(event) => setInput((current) => ({ ...current, [field]: event.target.value }))}
                className={`input tabular-nums ${
                  bad ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''
                }`}
              />
              {bad && <span className="mt-1 block text-xs font-normal text-red-600">Isi angka lebih dari 0.</span>}
            </label>
          )
        })}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Volume</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
          {cbm === null ? '—' : `${formatCbm(cbm)} m³`}
        </p>
      </div>
    </section>
  )
}
