'use client'

import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight, TriangleAlert } from 'lucide-react'

import { summarizeKoli } from '@/domain/job/manifest'
import type { ManifestPeserta } from '@/lib/manifest-view'

export const numberID = (value: number) =>
  new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 }).format(value)

const optionalNumber = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : numberID(value)

/** Nama exhibitor, status tautan, dan catatan anomali. */
export function ExhibitorIdentity({ peserta }: { peserta: ManifestPeserta }) {
  const anomalyNotes = peserta.logistics.notes.filter((note) => note.kind === 'ANOMALI_BARANG')
  return (
    <>
      <p className="font-medium text-slate-800">{peserta.name}</p>
      {!peserta.linked && (
        <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
          belum ditautkan ke exhibitor
        </span>
      )}
      {peserta.linked && peserta.line.nameOnDocument !== peserta.name && (
        <p className="mt-0.5 text-[11px] text-slate-500">CIPL: {peserta.line.nameOnDocument}</p>
      )}
      {anomalyNotes.map((note, index) => (
        <p key={index} className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-700">
          <TriangleAlert size={12} aria-hidden="true" /> {note.text}
        </p>
      ))}
    </>
  )
}

const th = 'px-3 py-2'
const thNum = `${th} text-right`
const td = 'px-3 py-2.5 align-top'
const tdNum = `${td} text-right tabular-nums`

/**
 * Tampilan ringkas: satu baris per exhibitor; rincian case dibuka lewat klik panah (tidak otomatis
 * saat hover). Tiap case membuka baris barangnya dengan klik panah di baris case.
 */
export function ExhibitorSummaryTable({ peserta }: { peserta: ReadonlyArray<ManifestPeserta> }) {
  const [openKeys, setOpenKeys] = useState<ReadonlySet<string>>(new Set())
  const toggle = (key: string) =>
    setOpenKeys((current) => {
      const next = new Set(current)
      if (!next.delete(key)) next.add(key)
      return next
    })
  const isOpen = (key: string) => openKeys.has(key)

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">Ringkasan exhibitor pada blok manifest</caption>
        <thead className="bg-slate-50 text-sm font-semibold tracking-wide text-slate-500">
          <tr>
            <th className={`${th} w-10`}>
              <span className="sr-only">Rincian koli</span>
            </th>
            <th className={th}>Exhibitor</th>
            <th className={th}>Hall</th>
            <th className={th}>Booth</th>
            <th className={thNum}>Package</th>
            <th className={thNum}>CBM</th>
            <th className={thNum}>Berat (Kg)</th>
          </tr>
        </thead>
        {peserta.length ? (
          peserta.map((item) => {
            const details = item.logistics.koli.details
            const summary = summarizeKoli(item.logistics.koli)
            const open = isOpen(item.key)
            const panelId = `koli-${item.key}`
            const items = item.line.items
            const looseItems = items.filter((barang) => !barang.refKoliIds.length)
            return (
              <tbody key={item.key} className="divide-y divide-slate-200 text-slate-700">
                <tr className={open ? 'bg-slate-50/60' : undefined}>
                  <td className={td}>
                    {details.length ? (
                      <button
                        type="button"
                        onClick={() => toggle(item.key)}
                        aria-expanded={open}
                        aria-controls={panelId}
                        aria-label={`${open ? 'Tutup' : 'Buka'} rincian koli ${item.name}`}
                        className="rounded p-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      >
                        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    ) : null}
                  </td>
                  <td className={`${td} min-w-[200px]`}>
                    <ExhibitorIdentity peserta={item} />
                  </td>
                  <td className={td}>{item.logistics.hall ?? '—'}</td>
                  <td className={td}>{item.logistics.booth ?? '—'}</td>
                  <td className={tdNum}>{summary.totalCount}</td>
                  <td className={tdNum}>{details.length ? numberID(summary.volumeCbm) : '—'}</td>
                  <td className={tdNum}>{details.length ? numberID(summary.weightKg) : '—'}</td>
                </tr>
                {open && (
                  <tr id={panelId} className="bg-slate-50/60">
                    <td />
                    <td colSpan={6} className="px-3 py-3">
                      <table className="w-full text-sm">
                          {details.map((koli, index) => {
                            const caseKey = `${item.key}-${koli.id ?? index}`
                            const caseOpen = openKeys.has(caseKey)
                            const barang = items.filter((entry) => entry.refKoliIds.includes(koli.id ?? ''))
                            return (
                              <tbody key={caseKey} className="divide-y divide-slate-100">
                                <tr className={caseOpen ? 'font-medium text-slate-800' : 'text-slate-600'}>
                                  <td className="w-8 py-1.5 pl-1">
                                    {barang.length ? (
                                      <button
                                        type="button"
                                        onClick={() => toggle(caseKey)}
                                        aria-expanded={caseOpen}
                                        aria-label={`${caseOpen ? 'Tutup' : 'Buka'} barang ${koli.label ?? index + 1}`}
                                        className="rounded p-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                      >
                                        {caseOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                      </button>
                                    ) : null}
                                  </td>
                                  <td className="py-1.5 pr-3">
                                    Case {koli.label ?? index + 1}
                                    <span className="ml-3 text-slate-400">
                                      {[
                                        koli.dimension?.lengthCm,
                                        koli.dimension?.widthCm,
                                        koli.dimension?.heightCm,
                                      ]
                                        .map(optionalNumber)
                                        .join(' × ')}{' '}
                                      cm
                                    </span>
                                  </td>
                                  <td className="py-1.5 pr-3 text-right tabular-nums">
                                    {optionalNumber(koli.volumeCbm)} CBM
                                  </td>
                                  <td className="py-1.5 text-right tabular-nums">
                                    {optionalNumber(koli.weightKg)} kg
                                  </td>
                                </tr>
                                {caseOpen &&
                                  barang.map((entry, barangIndex) => (
                                    <tr key={entry.refKoliIds[0] ?? barangIndex} className="text-slate-500">
                                      <td />
                                      <td className="py-1 pr-3 pl-4">{entry.uraian}</td>
                                      <td className="py-1 pr-3 text-right tabular-nums">
                                        {entry.jumlah} {entry.satuan} ·{' '}
                                        {optionalNumber(entry.nilaiSatuan)}
                                      </td>
                                      <td className="py-1 text-right tabular-nums">
                                        {optionalNumber(entry.nilaiTotal)}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            )
                          })}
                          {looseItems.length ? (
                            <tbody className="divide-y divide-slate-100">
                              <tr className="text-slate-600">
                                <td className="w-8 py-1.5 pl-1">
                                  <button
                                    type="button"
                                    onClick={() => toggle(`${item.key}-loose`)}
                                    aria-expanded={openKeys.has(`${item.key}-loose`)}
                                    aria-label="Buka barang tanpa nomor case"
                                    className="rounded p-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                  >
                                    {openKeys.has(`${item.key}-loose`) ? (
                                      <ChevronDown size={13} />
                                    ) : (
                                      <ChevronRight size={13} />
                                    )}
                                  </button>
                                </td>
                                <td className="py-1.5 pr-3">Tanpa nomor case</td>
                                <td className="py-1.5 pr-3" />
                                <td className="py-1.5" />
                              </tr>
                              {openKeys.has(`${item.key}-loose`) &&
                                looseItems.map((entry, barangIndex) => (
                                  <tr key={barangIndex} className="text-slate-500">
                                    <td />
                                    <td className="py-1 pr-3 pl-4">{entry.uraian}</td>
                                    <td className="py-1 pr-3 text-right tabular-nums">
                                      {entry.jumlah} {entry.satuan} · {optionalNumber(entry.nilaiSatuan)}
                                    </td>
                                    <td className="py-1 text-right tabular-nums">
                                      {optionalNumber(entry.nilaiTotal)}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          ) : null}
                      </table>
                      {item.logistics.koli.bareCaseCount !== null && (
                        <p className="mt-2 text-xs text-slate-500">
                          Bare case: {item.logistics.koli.bareCaseCount}
                        </p>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            )
          })
        ) : (
          <tbody className="text-slate-700">
            <tr>
              <td className="px-3 py-6 text-center text-sm text-slate-500" colSpan={7}>
                Belum ada baris CIPL. Scan CIPL saat membuat job, atau import dari manifest.
              </td>
            </tr>
          </tbody>
        )}
      </table>
    </div>
  )
}
