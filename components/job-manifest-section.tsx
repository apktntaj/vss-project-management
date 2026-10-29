'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Pencil, Ship, TriangleAlert } from 'lucide-react'

import {
  containerLabel,
  findMilestone,
  milestoneKindLabels,
  operationalNoteKindLabels,
  summarizeKoli,
  summarizeKoliCollections,
  type MilestoneKind,
} from '@/domain/job/manifest'
import { internationalJobJenisLabels } from '@/domain/job/types'
import type { LocalExhibitor } from '@/lib/data-client'
import type { ManifestBlockView } from '@/lib/manifest-view'

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
const numberID = (value: number) =>
  new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 }).format(value)

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

function PesertaRow({
  peserta,
  onEdit,
}: {
  peserta: ManifestBlockView['peserta'][number]
  onEdit: (exhibitor: LocalExhibitor) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const logistics = peserta.logistics
  const summary = logistics ? summarizeKoli(logistics.koli) : null
  const anomalyNotes = logistics?.notes.filter((note) => note.kind === 'ANOMALI_BARANG') ?? []

  return (
    <>
      <tr className="border-b border-slate-100 odd:bg-slate-50/70 last:border-0">
        <td className="px-3 py-3 align-top">
          <p className="font-medium text-slate-800" title={peserta.exhibitor.name}>
            {peserta.exhibitor.name}
          </p>
          {anomalyNotes.map((note, index) => (
            <p key={index} className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-700">
              <TriangleAlert size={12} aria-hidden="true" /> {note.text}
            </p>
          ))}
        </td>
        <td className="px-3 py-3 align-top text-slate-600">{logistics?.hall ?? '—'}</td>
        <td className="px-3 py-3 align-top text-slate-600">{logistics?.booth ?? '—'}</td>
        <td className="px-3 py-3 align-top">
          {logistics ? (
            logistics.koli.details.length ? (
              <button
                type="button"
                onClick={() => setExpanded((current) => !current)}
                aria-expanded={expanded}
                className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-orange-700"
              >
                {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                {summary?.totalCount} koli
              </button>
            ) : (
              <span className="text-sm text-slate-600">{summary?.totalCount} koli</span>
            )
          ) : (
            <span className="text-xs text-slate-400">Belum diinput</span>
          )}
        </td>
        <td className="px-3 py-3 align-top text-slate-600">
          {summary ? `${numberID(summary.weightKg)} kg · ${numberID(summary.volumeCbm)} m³` : '—'}
        </td>
        <td className="px-3 py-3 align-top">
          <div className="flex flex-wrap gap-1">
            {logistics?.notes
              .filter((note) => note.kind !== 'ANOMALI_BARANG')
              .map((note, index) => (
                <span key={index} className={chip(note.kind === 'PENAHANAN' ? 'amber' : 'slate')}>
                  {operationalNoteKindLabels[note.kind]}: {note.text}
                </span>
              ))}
          </div>
        </td>
        <td className="px-3 py-3 align-top text-right">
          <button
            type="button"
            onClick={() => onEdit(peserta.exhibitor)}
            className="text-xs font-semibold text-orange-700 hover:text-orange-800"
          >
            Edit koli
          </button>
        </td>
      </tr>
      {expanded &&
        logistics?.koli.details.map((koli, index) => (
          <tr key={index} className="border-b border-slate-100 bg-slate-50/80 text-xs last:border-0">
            <td className="px-3 py-2 pl-10 font-medium text-slate-600">{koli.label ?? `Koli ${index + 1}`}</td>
            <td colSpan={2} />
            <td className="px-3 py-2 text-slate-500">
              {koli.dimension
                ? `${koli.dimension.lengthCm}×${koli.dimension.widthCm}×${koli.dimension.heightCm} cm`
                : 'Dimensi belum dirinci'}
            </td>
            <td className="px-3 py-2 text-slate-500">
              {koli.weightKg !== null ? `${numberID(koli.weightKg)} kg` : '—'} ·{' '}
              {koli.volumeCbm !== null ? `${numberID(koli.volumeCbm)} m³` : '—'}
            </td>
            <td colSpan={2} />
          </tr>
        ))}
    </>
  )
}

export function JobManifestSection({
  view,
  onEditManifest,
  onEditPeserta,
}: {
  view: ManifestBlockView
  onEditManifest: () => void
  onEditPeserta: (exhibitor: LocalExhibitor) => void
}) {
  const inward = view.inward
  const konfigurasi = loadConfigurationLabel(view)
  const milestones = inward?.milestones ?? []
  const kepulangan = view.kepulangan

  return (
    <section className="card border-orange-200 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">Blok manifest · {view.jobNumber}</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">{view.agentName}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {inward ? (
              <span className={chip('orange')}>
                {inward.transportDocument.kind === 'BL' ? 'B/L' : 'AWB'} · {inward.transportDocument.number}
              </span>
            ) : (
              <span className="text-sm text-slate-500">Dokumen angkut & konfigurasi muatan belum diisi.</span>
            )}
            {konfigurasi && <span className={chip('slate')}>{konfigurasi}</span>}
            <span className={chip('emerald')}>
              {view.totals.totalCount} koli · {numberID(view.totals.weightKg)} kg · {numberID(view.totals.volumeCbm)} m³
            </span>
            {view.internationalJenis && (
              <span className={chip('violet')}>
                {internationalJobJenisLabels[view.internationalJenis] ?? 'Job lama'}
              </span>
            )}
          </div>
        </div>
        <button type="button" onClick={onEditManifest} className="btn-secondary shrink-0">
          <Pencil size={16} /> Edit manifest
        </button>
      </div>

      {milestones.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {milestoneOrder.map((kind) => {
            const milestone = findMilestone(milestones, kind)
            if (!milestone) return null
            return (
              <span key={kind} className={chip(kind === 'DO_READY' ? 'amber' : 'emerald')}>
                {milestoneKindLabels[kind]} · {dateID(milestone.date)}
                {milestone.documentNumber ? ` · ${milestone.documentNumber}` : ''}
              </span>
            )
          })}
        </div>
      )}

      {inward?.notes
        .filter((note) => note.kind === 'PENAHANAN')
        .map((note, index) => (
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
      {inward?.notes
        .filter((note) => note.kind !== 'PENAHANAN')
        .map((note, index) => (
          <p key={index} className="mt-3 text-sm text-slate-600">
            <strong className="font-semibold text-slate-700">{operationalNoteKindLabels[note.kind]}:</strong> {note.text}
          </p>
        ))}

      <div className="mt-5 overflow-x-auto rounded-xl border border-black/10">
        <table className="min-w-[760px] w-full text-left text-sm">
          <caption className="sr-only">Exhibitor binaan pada blok manifest ini</caption>
          <thead className="border-b bg-white text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2.5">Exhibitor</th>
              <th className="px-3 py-2.5">Hall</th>
              <th className="px-3 py-2.5">Booth</th>
              <th className="px-3 py-2.5">Koli</th>
              <th className="px-3 py-2.5">Berat / Volume</th>
              <th className="px-3 py-2.5">Catatan</th>
              <th className="px-3 py-2.5" aria-label="Aksi" />
            </tr>
          </thead>
          <tbody>
            {view.peserta.map((peserta) => (
              <PesertaRow key={peserta.exhibitor.id} peserta={peserta} onEdit={onEditPeserta} />
            ))}
            {!view.peserta.length && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-500">
                  Belum ada exhibitor binaan pada agent ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {view.peserta.length > 0 && !view.peserta.some((peserta) => peserta.logistics) && (
        <p className="mt-2 text-xs text-slate-500">
          Koli, hall, dan booth tiap exhibitor diinput lewat tombol “Edit koli”.
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
                  {summarizeKoliCollections(view.peserta.map((item) => item.logistics?.koli ?? null)).totalCount}.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
