'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

import { summarizeKoli, type Koli } from '@/domain/job/manifest'
import { stageCiplLines } from '@/domain/job/stages'
import type { ManifestPeserta } from '@/lib/manifest-view'
import { ExhibitorIdentity, numberID } from '@/components/job-exhibitor-summary'

// Daftar package datar: satu baris per package (case). Dengan satu exhibitor tabelnya tidak
// dikelompokkan (nama exhibitor cukup tampil sekali di atas tabel); dengan beberapa exhibitor
// baris dikelompokkan per exhibitor dengan subtotal, dan grup terlipat bila package-nya banyak.

/** Di atas jumlah package ini (lintas exhibitor) grup mulai terlipat. */
const AUTO_COLLAPSE_ABOVE = 12

const optionalNumber = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : numberID(value)

const dimensionText = (koli: Koli) =>
  koli.dimension
    ? [koli.dimension.lengthCm, koli.dimension.widthCm, koli.dimension.heightCm]
        .map(optionalNumber)
        .join(' × ')
    : '—'

type Disposition = 'DISPOSAL' | 'RE_EXPORT' | null

/**
 * Disposisi tiap package mengikuti aturan pembagian job turunan (domain/job/stages): package yang
 * seluruh isinya disposal = Disposal, selebihnya Re-export. Baris CIPL tanpa item belum menyebut
 * disposisi sama sekali, jadi tidak diberi label.
 */
function dispositionOf(peserta: ManifestPeserta): (koli: Koli) => Disposition {
  if (peserta.line.items.length === 0) return () => null
  const disposal = new Set<Koli>(
    stageCiplLines([peserta.line], 'DISPOSAL').flatMap((line) => line.koli.details),
  )
  return (koli) => (disposal.has(koli) ? 'DISPOSAL' : 'RE_EXPORT')
}

function DispositionBadge({ value }: { value: Disposition }) {
  if (!value) return <span className="text-slate-500">—</span>
  return value === 'DISPOSAL' ? (
    <span className="inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
      Disposed
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
      Re-export
    </span>
  )
}

/** Label di atas, nilai di bawah. Nilai kosong tampil sebagai badge merah agar terbaca sebagai alert. */
function LocationField({ label, value }: { label: string; value: string | null | undefined }) {
  const text = value?.trim()
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      {text ? (
        <p className="font-medium text-slate-800">{text}</p>
      ) : (
        <span className="mt-0.5 inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
          Belum terisi
        </span>
      )}
    </div>
  )
}

const th = 'px-3 py-2'
const thNum = `${th} text-right`
const td = 'px-3 py-2 align-top'
const tdNum = `${td} text-right tabular-nums`
const COLUMNS = 5

export function PackagesTable({ peserta }: { peserta: ReadonlyArray<ManifestPeserta> }) {
  const totalPackages = peserta.reduce((sum, item) => sum + item.logistics.koli.details.length, 0)
  const grouped = peserta.length > 1
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        grouped && totalPackages > AUTO_COLLAPSE_ABOVE ? peserta.map((item) => item.key) : [],
      ),
  )
  const toggle = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current)
      if (!next.delete(key)) next.add(key)
      return next
    })

  if (peserta.length === 0) {
    return (
      <p className="mt-3 rounded-xl border border-slate-200 px-3 py-6 text-center text-sm text-slate-500">
        Belum ada baris CIPL. Scan CIPL saat membuat job, atau import dari manifest.
      </p>
    )
  }

  return (
    <div className="mt-3">
      {!grouped && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-1">
          <div className="min-w-0">
            <p className="text-xs text-slate-500">Exhibitor</p>
            <ExhibitorIdentity peserta={peserta[0]} />
          </div>
          <div className="flex gap-8">
            <LocationField label="Hall" value={peserta[0].logistics.hall} />
            <LocationField label="Booth" value={peserta[0].logistics.booth} />
          </div>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">Daftar package per case</caption>
          <thead className="bg-slate-50 text-sm font-semibold tracking-wide text-slate-500">
            <tr>
              <th className={th}>Case</th>
              <th className={th}>Dimensi (cm)</th>
              <th className={thNum}>CBM</th>
              <th className={thNum}>Berat (Kg)</th>
              <th className={th}>Disposisi</th>
            </tr>
          </thead>
          {peserta.map((item) => {
            const details = item.logistics.koli.details
            const summary = summarizeKoli(item.logistics.koli)
            const disposition = dispositionOf(item)
            const open = !collapsed.has(item.key)
            const undetailed = Math.max(summary.totalCount - details.length, 0)
            return (
              <tbody
                key={item.key}
                className="divide-y divide-slate-100 border-t border-slate-200 text-slate-700"
              >
                {grouped && (
                  <tr className="bg-slate-50/60">
                    <td colSpan={COLUMNS} className="px-3 py-2.5">
                      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1">
                        <div className="flex min-w-0 items-start gap-2">
                          <button
                            type="button"
                            onClick={() => toggle(item.key)}
                            aria-expanded={open}
                            aria-label={`${open ? 'Tutup' : 'Buka'} package ${item.name}`}
                            className="mt-0.5 rounded p-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          >
                            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                          <div className="min-w-0">
                            <p className="text-xs text-slate-500">Exhibitor</p>
                            <ExhibitorIdentity peserta={item} />
                          </div>
                        </div>
                        <div className="flex gap-8">
                          <LocationField label="Hall" value={item.logistics.hall} />
                          <LocationField label="Booth" value={item.logistics.booth} />
                        </div>
                        <p className="text-sm tabular-nums text-slate-600">
                          {summary.totalCount} package
                          {details.length > 0 &&
                            ` · ${numberID(summary.volumeCbm)} CBM · ${numberID(summary.weightKg)} kg`}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
                {open && details.length === 0 && (
                  <tr>
                    <td colSpan={COLUMNS} className="px-3 py-3 text-slate-500">
                      {summary.totalCount > 0
                        ? `${summary.totalCount} package, rincian belum diinput.`
                        : 'Belum ada package.'}
                    </td>
                  </tr>
                )}
                {open &&
                  details.map((koli, index) => (
                    <tr key={koli.id ?? index}>
                      <td
                        className={`${td} whitespace-nowrap font-medium text-slate-800 ${grouped ? 'pl-10' : ''}`}
                      >
                        {koli.label ?? `Case ${index + 1}`}
                      </td>
                      <td className={`${td} whitespace-nowrap tabular-nums`}>
                        {dimensionText(koli)}
                      </td>
                      <td className={tdNum}>{optionalNumber(koli.volumeCbm)}</td>
                      <td className={tdNum}>{optionalNumber(koli.weightKg)}</td>
                      <td className={td}>
                        <DispositionBadge value={disposition(koli)} />
                      </td>
                    </tr>
                  ))}
                {open && details.length > 0 && undetailed > 0 && (
                  <tr>
                    <td
                      colSpan={COLUMNS}
                      className={`px-3 py-2 text-xs text-slate-500 ${grouped ? 'pl-10' : ''}`}
                    >
                      {undetailed} package lain belum dirinci.
                    </td>
                  </tr>
                )}
                {open && item.logistics.koli.bareCaseCount !== null && (
                  <tr>
                    <td
                      colSpan={COLUMNS}
                      className={`px-3 py-2 text-xs text-slate-500 ${grouped ? 'pl-10' : ''}`}
                    >
                      Bare case: {item.logistics.koli.bareCaseCount}
                    </td>
                  </tr>
                )}
              </tbody>
            )
          })}
        </table>
      </div>
    </div>
  )
}
