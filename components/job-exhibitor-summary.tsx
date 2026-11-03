'use client'

import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight, Pencil, TriangleAlert } from 'lucide-react'

import { summarizeKoli } from '@/domain/job/manifest'
import type { ManifestPeserta } from '@/lib/manifest-view'

export const numberID = (value: number) =>
  new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 }).format(value)

const optionalNumber = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : numberID(value)

/** Nama exhibitor, status tautan, catatan anomali, dan tombol edit baris CIPL. */
export function ExhibitorIdentity({
  peserta,
  onEdit,
  location,
}: {
  peserta: ManifestPeserta
  onEdit: (peserta: ManifestPeserta) => void
  /** Teks lokasi (hall/booth) yang tampil tepat di bawah nama; null bila tidak ada. */
  location?: string | null
}) {
  const anomalyNotes = peserta.logistics.notes.filter((note) => note.kind === 'ANOMALI_BARANG')
  return (
    <>
      <p className="font-medium text-slate-800">{peserta.name}</p>
      {location && <p className="mt-0.5 text-xs text-slate-500">{location}</p>}
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
      <button
        type="button"
        onClick={() => onEdit(peserta)}
        className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-orange-700 hover:text-orange-800"
      >
        <Pencil size={12} aria-hidden="true" /> {peserta.linked ? 'Edit koli' : 'Tautkan & edit'}
      </button>
    </>
  )
}

const th = 'px-3 py-2'
const thNum = `${th} text-right`
const td = 'px-3 py-2.5 align-top'
const tdNum = `${td} text-right tabular-nums`

/** Tampilan ringkas: satu baris per exhibitor; rincian koli dibuka lewat panah di barisnya. */
export function ExhibitorSummaryTable({
  peserta,
  onEdit,
}: {
  peserta: ReadonlyArray<ManifestPeserta>
  onEdit: (peserta: ManifestPeserta) => void
}) {
  const [openKeys, setOpenKeys] = useState<ReadonlySet<string>>(new Set())
  const toggle = (key: string) =>
    setOpenKeys((current) => {
      const next = new Set(current)
      if (!next.delete(key)) next.add(key)
      return next
    })

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">Ringkasan exhibitor pada blok manifest</caption>
        <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className={`${th} w-10`}>
              <span className="sr-only">Rincian koli</span>
            </th>
            <th className={th}>Exhibitor</th>
            <th className={thNum}>Package</th>
            <th className={thNum}>CBM</th>
            <th className={thNum}>Berat (Kg)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-slate-700">
          {peserta.length ? (
            peserta.map((item) => {
              const details = item.logistics.koli.details
              const summary = summarizeKoli(item.logistics.koli)
              const open = openKeys.has(item.key)
              const panelId = `koli-${item.key}`
              const location = [
                item.logistics.hall ? `Hall ${item.logistics.hall}` : null,
                item.logistics.booth ? `Booth ${item.logistics.booth}` : null,
              ]
                .filter(Boolean)
                .join(' · ')
              return (
                <Fragment key={item.key}>
                  <tr>
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
                      <ExhibitorIdentity peserta={item} onEdit={onEdit} location={location} />
                    </td>
                    <td className={tdNum}>{summary.totalCount}</td>
                    <td className={tdNum}>{details.length ? numberID(summary.volumeCbm) : '—'}</td>
                    <td className={tdNum}>{details.length ? numberID(summary.weightKg) : '—'}</td>
                  </tr>
                  {open && (
                    <tr id={panelId} className="bg-slate-50/60">
                      <td />
                      <td colSpan={4} className="px-3 py-3">
                        <table className="w-full text-xs">
                          <thead className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="py-1 pr-3 text-left">Koli</th>
                              <th className="py-1 pr-3 text-right">L × W × H (cm)</th>
                              <th className="py-1 pr-3 text-right">CBM</th>
                              <th className="py-1 text-right">Berat (Kg)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {details.map((koli, index) => (
                              <tr key={koli.id ?? index} className="border-t border-slate-200">
                                <td className="py-1.5 pr-3 font-medium text-slate-600">
                                  {koli.label ?? `Koli ${index + 1}`}
                                </td>
                                <td className="py-1.5 pr-3 text-right tabular-nums">
                                  {[
                                    koli.dimension?.lengthCm,
                                    koli.dimension?.widthCm,
                                    koli.dimension?.heightCm,
                                  ]
                                    .map(optionalNumber)
                                    .join(' × ')}
                                </td>
                                <td className="py-1.5 pr-3 text-right tabular-nums">
                                  {optionalNumber(koli.volumeCbm)}
                                </td>
                                <td className="py-1.5 text-right tabular-nums">
                                  {optionalNumber(koli.weightKg)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {item.logistics.koli.bareCaseCount !== null && (
                          <p className="mt-2 text-xs text-slate-500">
                            Bare case: {item.logistics.koli.bareCaseCount}
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })
          ) : (
            <tr>
              <td className="px-3 py-6 text-center text-sm text-slate-500" colSpan={5}>
                Belum ada baris CIPL. Scan CIPL saat membuat job, atau import dari manifest.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
