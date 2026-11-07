'use client'

import { useState, type ReactNode } from 'react'
import { DollarSign, Ship, TriangleAlert } from 'lucide-react'

import {
  containerLabel,
  findMilestone,
  milestoneKindLabels,
  operationalNoteKindLabels,
  summarizeKoli,
  summarizeKoliCollections,
  type Koli,
  type KoliSummary,
  type MilestoneKind,
} from '@/domain/job/manifest'
import type { ManifestBlockView, ManifestPeserta } from '@/lib/manifest-view'
import { ExhibitorIdentity, ExhibitorSummaryTable, numberID } from '@/components/job-exhibitor-summary'

const milestoneOrder: MilestoneKind[] = [
  'ETA',
  'SKEP',
  'SPPB',
  'STRIPPING_SELESAI',
  'MASUK_BONDED',
  'BAHANDLE_SELESAI',
  'PERIKSA_SELESAI',
  'DO_READY',
]

const dateID = (value: string) =>
  new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
/** Nilai sel numerik manifest: tampilkan '—' bila belum dirinci agar grid tidak kosong tak bermakna. */
const cell = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : numberID(value)

function chip(tone: 'slate' | 'orange' | 'emerald' | 'amber' | 'violet', extra = '') {
  const tones = {
    slate: 'bg-slate-100 text-slate-600 ring-slate-200',
    orange: 'bg-orange-50 text-orange-700 ring-orange-200',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-800 ring-amber-200',
    violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  } as const
  return `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]} ${extra}`
}

function loadConfigurationLabel(view: ManifestBlockView) {
  const configuration = view.inward?.loadConfiguration
  if (!configuration) return null
  return configuration.kind === 'LCL' ? 'LCL' : configuration.containers.map(containerLabel).join(' + ')
}

/** Baris ringkas satu consignment: AGENT / No. B/L / konfigurasi / total PKG · KGM · CBM — meniru baris abu-abu manifest ALLPACK. */
function consignmentLine(view: ManifestBlockView): string {
  const parts = [view.partyName]
  if (view.transportDocument) {
    parts.push(
      `${view.transportDocument.type === 'BL' ? 'B/L' : 'AWB'} ${view.transportDocument.number}`,
    )
  }
  const configuration = loadConfigurationLabel(view)
  if (configuration) parts.push(configuration)
  parts.push(
    `${view.totals.totalCount} PKG · ${numberID(view.totals.weightKg)} KGM · ${numberID(view.totals.volumeCbm)} CBM`,
  )
  return parts.join('  /  ')
}

const COLUMN_COUNT = 15
const thGroup = 'border border-slate-200 px-2 py-1.5 text-center align-middle'
const td = 'border border-slate-200 px-2 py-1.5 align-top'
const tdNum = 'border border-slate-200 px-2 py-1.5 text-right align-top tabular-nums'

/** Sel "Exhibitor" — nama, status tautan, catatan anomali, dan afordans edit baris CIPL. */
function ExhibitorCell({
  peserta,
  rowSpan,
  onEdit,
}: {
  peserta: ManifestPeserta
  rowSpan: number
  onEdit: (peserta: ManifestPeserta) => void
}) {
  return (
    <td className={`${td} min-w-[180px]`} rowSpan={rowSpan}>
      <ExhibitorIdentity peserta={peserta} onEdit={onEdit} />
    </td>
  )
}

export function JobManifestSection({
  view,
  invoiceNumber,
  totalAmount,
  onEditPeserta,
}: {
  view: ManifestBlockView
  /** No. invoice komersial dokumen (header job / CIPL); null bila belum ada. */
  invoiceNumber: string | null
  /** Total nilai seluruh barang di dokumen; null bila belum ada datanya. */
  totalAmount: number | null
  onEditPeserta: (peserta: ManifestPeserta) => void
}) {
  const [mode, setMode] = useState<'ringkas' | 'manifest'>('ringkas')
  const inward = view.inward
  const milestones = inward?.milestones ?? []
  const kepulangan = view.kepulangan
  const penahanan = inward?.notes.filter((note) => note.kind === 'PENAHANAN') ?? []
  const remarkNotes = inward?.notes.filter((note) => note.kind !== 'PENAHANAN') ?? []

  // rowSpan kolom tingkat-consignment (No & Remark): seluruh baris rincian + subtotal tiap peserta.
  const totalBodyRows = view.peserta.reduce((sum, peserta) => {
    const detailCount = Math.max(peserta.logistics.koli.details.length, 1)
    return sum + detailCount + 1
  }, 0)

  const remarkCell = (
    <td className="border border-slate-200 px-2 py-1.5 align-top text-xs text-slate-600" rowSpan={totalBodyRows}>
      {milestoneOrder.map((kind) => {
        const milestone = findMilestone(milestones, kind)
        if (!milestone) return null
        return (
          <p key={kind} className="whitespace-nowrap">
            <span className="font-medium text-slate-700">{milestoneKindLabels[kind]}</span> : {dateID(milestone.date)}
            {milestone.documentNumber ? ` · ${milestone.documentNumber}` : ''}
          </p>
        )
      })}
      {remarkNotes.map((note, index) => (
        <p key={index} className="mt-1">
          <span className="font-medium text-slate-700">{operationalNoteKindLabels[note.kind]}:</span> {note.text}
        </p>
      ))}
      {!milestones.length && !remarkNotes.length && <span className="text-slate-400">—</span>}
    </td>
  )

  const bodyRows: ReactNode[] = []
  let firstBlockRow = true
  view.peserta.forEach((peserta) => {
    const logistics = peserta.logistics
    const summary: KoliSummary = logistics
      ? summarizeKoli(logistics.koli)
      : { totalCount: 0, detailedCount: 0, weightKg: 0, volumeCbm: 0 }
    const details = (logistics?.koli.details ?? []) as ReadonlyArray<Koli>
    const koliRows = details.length ? details : [null]
    const pesertaRowSpan = koliRows.length + 1

    koliRows.forEach((koli, koliIndex) => {
      const firstPesertaRow = koliIndex === 0
      bodyRows.push(
        <tr key={`${peserta.key}-${koliIndex}`} className="odd:bg-white even:bg-slate-50/60">
          {firstBlockRow && (
            <td className={`${td} text-center font-semibold text-slate-900`} rowSpan={totalBodyRows}>
              {view.jobNumber}
            </td>
          )}
          {firstPesertaRow && (
            <ExhibitorCell peserta={peserta} rowSpan={pesertaRowSpan} onEdit={onEditPeserta} />
          )}
          {firstPesertaRow && (
            <td className={`${tdNum}`} rowSpan={pesertaRowSpan}>
              {logistics ? `${summary.totalCount} PKG` : '—'}
            </td>
          )}
          {firstPesertaRow && (
            <td className={`${tdNum}`} rowSpan={pesertaRowSpan}>
              {cell(logistics?.koli.bareCaseCount)}
            </td>
          )}
          <td className={`${td} whitespace-nowrap font-medium text-slate-600`}>
            {koli?.label ?? (logistics ? `Koli ${koliIndex + 1}` : 'Belum diinput')}
          </td>
          <td className={tdNum}>{cell(koli?.dimension?.lengthCm)}</td>
          <td className={tdNum}>{cell(koli?.dimension?.widthCm)}</td>
          <td className={tdNum}>{cell(koli?.dimension?.heightCm)}</td>
          <td className={tdNum}>{cell(koli?.volumeCbm)}</td>
          <td className={tdNum}>{cell(koli?.weightKg)}</td>
          {firstPesertaRow && (
            <td className={`${td} text-center text-slate-400`} rowSpan={pesertaRowSpan}>
              —
            </td>
          )}
          {firstPesertaRow && (
            <td className={`${td} text-center text-slate-400`} rowSpan={pesertaRowSpan}>
              —
            </td>
          )}
          {firstBlockRow && remarkCell}
          {firstPesertaRow && (
            <td className={`${td} whitespace-nowrap text-slate-600`} rowSpan={pesertaRowSpan}>
              {logistics?.hall ?? '—'}
            </td>
          )}
          {firstPesertaRow && (
            <td className={`${td} whitespace-nowrap text-slate-600`} rowSpan={pesertaRowSpan}>
              {logistics?.booth ?? '—'}
            </td>
          )}
        </tr>,
      )
      firstBlockRow = false
    })

    bodyRows.push(
      <tr key={`${peserta.key}-subtotal`} className="bg-slate-100/70 font-semibold text-slate-700">
        <td className={`${td} text-right`} colSpan={4}>
          Subtotal
        </td>
        <td className={tdNum}>{numberID(summary.volumeCbm)}</td>
        <td className={tdNum}>{numberID(summary.weightKg)}</td>
      </tr>,
    )
  })

  return (
    <section className="card border-orange-200 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            No. Invoice{' '}
            <span className="font-semibold text-slate-900 normal-case tracking-normal">
              {invoiceNumber ?? '—'}
            </span>
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-5">
            {(
              [
                ['Exhibitor', numberID(view.peserta.length), false],
                ['Total package', numberID(view.totals.totalCount), false],
                ['Total CBM', numberID(view.totals.volumeCbm), false],
                ['Total berat (Kg)', numberID(view.totals.weightKg), false],
                ['Total amount', totalAmount === null ? '—' : numberID(totalAmount), true],
              ] as const
            ).map(([title, value, isAmount]) => (
              <div key={title}>
                <dt className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                  {isAmount ? <DollarSign size={13} aria-hidden="true" /> : null}
                  {title}
                </dt>
                <dd className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {penahanan.map((note, index) => (
        <p
          key={index}
          className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            <strong className="font-semibold">{operationalNoteKindLabels[note.kind]}:</strong> {note.text}
          </span>
        </p>
      ))}

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-800">Exhibitor</p>
        <div
          role="group"
          aria-label="Tampilan manifest"
          className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-medium"
        >
          {(
            [
              ['ringkas', 'Ringkas'],
              ['manifest', 'Tabel manifest'],
            ] as const
          ).map(([value, text]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              aria-pressed={mode === value}
              className={`rounded-md px-3 py-1 transition-colors ${mode === value ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-500 hover:bg-orange-50 hover:text-orange-700'}`}
            >
              {text}
            </button>
          ))}
        </div>
      </div>
      {mode === 'ringkas' ? (
        <div className="mt-3">
          <ExhibitorSummaryTable peserta={view.peserta} onEdit={onEditPeserta} />
        </div>
      ) : (
      <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full border-collapse text-left text-xs">
          <caption className="sr-only">Rincian manifest exhibitor pada blok {view.jobNumber}</caption>
          <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <td className="border border-slate-200 bg-white px-2 py-2 text-sm font-semibold normal-case text-slate-700" colSpan={COLUMN_COUNT}>
                {consignmentLine(view)}
              </td>
            </tr>
            <tr>
              <th className={thGroup} rowSpan={2}>No</th>
              <th className={thGroup} rowSpan={2}>Exhibitor</th>
              <th className={thGroup} rowSpan={2}>Total Package</th>
              <th className={thGroup} rowSpan={2}>Bare Case</th>
              <th className={thGroup} rowSpan={2}>Case</th>
              <th className={thGroup} colSpan={3}>Dimensi (cm)</th>
              <th className={thGroup} rowSpan={2}>CBM</th>
              <th className={thGroup} rowSpan={2}>Berat (Kg)</th>
              <th className={thGroup} rowSpan={2}>Empty Storage</th>
              <th className={thGroup} rowSpan={2}>Re-export</th>
              <th className={thGroup} rowSpan={2}>Remark</th>
              <th className={thGroup} rowSpan={2}>Hall</th>
              <th className={thGroup} rowSpan={2}>Booth No</th>
            </tr>
            <tr>
              <th className={thGroup}>L</th>
              <th className={thGroup}>W</th>
              <th className={thGroup}>H</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {view.peserta.length ? (
              bodyRows
            ) : (
              <tr>
                <td className="border border-slate-200 px-3 py-6 text-center text-sm text-slate-500" colSpan={COLUMN_COUNT}>
                  Belum ada baris CIPL. Scan CIPL saat membuat job, atau import dari manifest.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}
      {view.peserta.some((peserta) => !peserta.linked) && (
        <p className="mt-2 text-xs text-slate-500">
          Baris yang belum ditautkan tidak terhitung sebagai barang exhibitor mana pun. Tautkan lewat
          tombol “Tautkan &amp; edit”.
        </p>
      )}

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Ship size={18} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-slate-800">Kepulangan (return list)</p>
              {kepulangan ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={chip('slate')}>
                    {kepulangan.mode.kind === 'LCL'
                      ? `LCL · ${kepulangan.mode.koliCount} koli`
                      : kepulangan.mode.containers.map(containerLabel).join(' + ')}
                  </span>
                  {kepulangan.destination && <span className={chip('slate')}>{kepulangan.destination}</span>}
                  {kepulangan.shippingLine && <span className={chip('slate')}>{kepulangan.shippingLine}</span>}
                  {kepulangan.bookingNumber && <span className={chip('slate')}>Booking {kepulangan.bookingNumber}</span>}
                  {kepulangan.vessel && <span className={chip('slate')}>{kepulangan.vessel}</span>}
                  {kepulangan.etd && <span className={chip('slate')}>ETD {dateID(kepulangan.etd)}</span>}
                  {kepulangan.eta && <span className={chip('slate')}>ETA {dateID(kepulangan.eta)}</span>}
                  {kepulangan.notes.map((note, index) => (
                    <span key={index} className={chip('amber')}>
                      {operationalNoteKindLabels[note.kind]}: {note.text}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-sm text-slate-500">
                  Rencana pengembalian kontainer/LCL belum diisi. Total koli peserta:{' '}
                  {view.totals.totalCount}.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
