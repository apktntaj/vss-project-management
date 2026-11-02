'use client'

import {
  findMilestone,
  milestoneKindLabels,
  milestoneKinds,
  operationalNoteKindLabels,
  summarizeKoli,
  type Koli,
} from '@/domain/job/manifest'
import type { ManifestBlockView } from '@/lib/manifest-view'

const dateID = (value: string) =>
  new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
const numberID = (value: number) =>
  new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 }).format(value)
/** Sel numerik gaya spreadsheet: kosong (bukan "—") bila belum diisi. */
const num = (value: number | null | undefined) =>
  value === null || value === undefined ? '' : numberID(value)

const cell = 'border border-slate-400 px-1.5 text-xs leading-[18px] text-slate-900'
const cellNum = `${cell} text-right tabular-nums`
const head = 'border border-slate-400 bg-slate-100 px-1.5 text-center text-[11px] font-semibold leading-[18px] text-slate-800'

type SheetRow = {
  key: string
  exhibitor?: string
  anomaly?: string
  total?: string
  bareCase?: string
  label: string
  koli: Koli | null
  hall?: string
  booth?: string
}

/** Satu baris remark per milestone/catatan blok, ditempel berurutan ke baris-baris tabel seperti di Excel. */
function remarkLines(view: ManifestBlockView): string[] {
  const inward = view.inward
  if (!inward) return []
  const milestones = milestoneKinds.flatMap((kind) => {
    const milestone = findMilestone(inward.milestones, kind)
    return milestone
      ? [
          `${milestoneKindLabels[kind]} : ${dateID(milestone.date)}${
            milestone.documentNumber ? ` · ${milestone.documentNumber}` : ''
          }`,
        ]
      : []
  })
  const notes = inward.notes.map((note) => `${operationalNoteKindLabels[note.kind]}: ${note.text}`)
  return [...milestones, ...notes]
}

function sheetRows(view: ManifestBlockView): SheetRow[] {
  return view.peserta.flatMap((peserta) => {
    const logistics = peserta.logistics
    const details = logistics?.koli.details ?? []
    const summary = logistics ? summarizeKoli(logistics.koli) : null
    const anomaly = logistics?.notes.find((note) => note.kind === 'ANOMALI_BARANG')?.text
    const koliRows: Array<Koli | null> = details.length ? details : [null]
    return koliRows.map((koli, index): SheetRow => ({
      key: `${peserta.key}-${index}`,
      ...(index === 0 && {
        exhibitor: peserta.name,
        anomaly,
        total: summary ? `${summary.totalCount} PKG` : '',
        bareCase: logistics?.koli.bareCaseCount != null ? String(logistics.koli.bareCaseCount) : '',
        hall: logistics?.hall ?? '',
        booth: logistics?.booth ?? '',
      }),
      label: koli?.label ?? (koli ? `Koli ${index + 1}` : ''),
      koli,
    }))
  })
}

/**
 * Detail job gaya spreadsheet Excel: tabel polos berbingkai tipis, tanpa kartu/chip. Satu baris per
 * koli, remark (milestone) berjajar ke bawah di kolom Remark, dan baris total tebal di bawah.
 * Nomor job pada baris pertama menjadi tautan ke halaman detail job (tempat editor manifest berada).
 */
export function JobManifestSheet({
  view,
  onOpenJob,
}: {
  view: ManifestBlockView
  onOpenJob: () => void
}) {
  const rows = sheetRows(view)
  const remarks = remarkLines(view)
  // Remark lebih panjang dari jumlah baris data → tambah baris kosong agar semua baris remark tampil.
  const padding = Math.max(remarks.length - rows.length, 0)

  return (
    <div className="overflow-x-auto bg-white">
      <table className="w-full min-w-[980px] border-collapse">
        <caption className="sr-only">Detail manifest job {view.jobNumber}</caption>
        <thead>
          <tr>
            <th className={head} rowSpan={2}>No</th>
            <th className={head} rowSpan={2}>Exhibitor Name</th>
            <th className={head} rowSpan={2}>Total Package</th>
            <th className={head} rowSpan={2}>Bare Case</th>
            <th className={head} rowSpan={2}>Case</th>
            <th className={head} colSpan={3}>Dimension (cm)</th>
            <th className={head} rowSpan={2}>CBM</th>
            <th className={head} rowSpan={2}>Weight Kgs</th>
            <th className={head} rowSpan={2}>Empty Storage</th>
            <th className={head} rowSpan={2}>Re-export</th>
            <th className={head} rowSpan={2}>Remark</th>
            <th className={head} rowSpan={2}>Hall</th>
            <th className={head} rowSpan={2}>Booth No</th>
          </tr>
          <tr>
            <th className={head}>L</th>
            <th className={head}>W</th>
            <th className={head}>H</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.key}>
              <td className={cell}>
                {index === 0 && (
                  <button type="button" onClick={onOpenJob} className="hover:text-orange-700 hover:underline" title="Buka detail job">
                    {view.jobNumber}
                  </button>
                )}
              </td>
              <td className={`${cell} min-w-[260px]`}>
                {row.exhibitor}
                {row.anomaly && <span className="ml-2 font-medium text-amber-700">⚠ {row.anomaly}</span>}
              </td>
              <td className={`${cell} text-right`}>{row.total}</td>
              <td className={`${cell} text-right`}>{row.bareCase}</td>
              <td className={`${cell} whitespace-nowrap`}>{row.label}</td>
              <td className={cellNum}>{row.koli?.dimension?.lengthCm}</td>
              <td className={cellNum}>{row.koli?.dimension?.widthCm}</td>
              <td className={cellNum}>{row.koli?.dimension?.heightCm}</td>
              <td className={cellNum}>{num(row.koli?.volumeCbm)}</td>
              <td className={cellNum}>{num(row.koli?.weightKg)}</td>
              <td className={cell} />
              <td className={cell} />
              <td className={`${cell} whitespace-nowrap`}>{remarks[index]}</td>
              <td className={`${cell} whitespace-nowrap`}>{row.hall}</td>
              <td className={`${cell} whitespace-nowrap`}>{row.booth}</td>
            </tr>
          ))}
          {Array.from({ length: padding }, (_, offset) => (
            <tr key={`pad-${offset}`}>
              {Array.from({ length: 12 }, (_, column) => (
                <td key={column} className={cell} />
              ))}
              <td className={`${cell} whitespace-nowrap`}>{remarks[rows.length + offset]}</td>
              <td className={cell} />
              <td className={cell} />
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td className={cell}>
                <button type="button" onClick={onOpenJob} className="hover:text-orange-700 hover:underline" title="Buka detail job">
                  {view.jobNumber}
                </button>
              </td>
              <td className={`${cell} py-2 text-slate-500`} colSpan={14}>
                Belum ada baris CIPL.{' '}
                <button type="button" onClick={onOpenJob} className="font-semibold text-orange-700 hover:underline">
                  Buka detail job
                </button>{' '}
                untuk melengkapi CIPL, No Job, dan tagihan.
              </td>
            </tr>
          )}
          <tr className="font-bold">
            <td className={cell} colSpan={8} />
            <td className={cellNum}>{numberID(view.totals.volumeCbm)}</td>
            <td className={cellNum}>{numberID(view.totals.weightKg)}</td>
            <td className={cell} colSpan={5} />
          </tr>
        </tbody>
      </table>
    </div>
  )
}
