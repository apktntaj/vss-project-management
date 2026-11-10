'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight } from 'lucide-react'

import { numberID } from '@/components/job-exhibitor-summary'
import { operationalNoteKindLabels } from '@/domain/job/manifest'
import type { HallGroup } from '@/lib/hall-view'

const amount = (value: number) => (value > 0 ? numberID(value) : '—')

export function EventHallView({ groups }: { groups: HallGroup[] }) {
  // Hanya grup yang ditutup yang disimpan; default semua terbuka.
  const [closed, setClosed] = useState<Record<string, boolean>>({})

  if (groups.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-black/15 px-4 py-8 text-center text-sm text-slate-500">
        Belum ada exhibitor dengan kiriman pada event ini.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const isOpen = !closed[group.key]
        const { totals } = group
        return (
          <section key={group.key} className="overflow-hidden rounded-xl border border-black/10">
            <button
              type="button"
              onClick={() => setClosed((value) => ({ ...value, [group.key]: isOpen }))}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-3 bg-slate-50 px-5 py-4 text-left hover:text-orange-700"
            >
              <span className="text-slate-400">
                {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold text-slate-900">
                {group.label === null ? 'Tanpa hall' : `Hall ${group.label}`}
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                {`${group.exhibitorCount} exhibitor · ${numberID(totals.totalCount)} pkg · ${numberID(totals.volumeCbm)} CBM · ${numberID(totals.weightKg)} Kg`}
              </span>
            </button>
            {isOpen && (
              <div className="overflow-x-auto">
                <table className="min-w-[1090px] w-full table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[220px]" />
                    <col className="w-[90px]" />
                    <col className="w-[180px]" />
                    <col className="w-[120px]" />
                    <col className="w-[90px]" />
                    <col className="w-[90px]" />
                    <col className="w-[100px]" />
                    <col className="w-[200px]" />
                  </colgroup>
                  <thead className="whitespace-nowrap border-b bg-white text-slate-900 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-3">Exhibitor</th>
                      <th className="px-3 py-3">Booth</th>
                      <th className="px-3 py-3">Agent</th>
                      <th className="px-3 py-3">Job No</th>
                      <th className="px-3 py-3">Package</th>
                      <th className="px-3 py-3">CBM</th>
                      <th className="px-3 py-3">Berat (Kg)</th>
                      <th className="px-3 py-3">Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr
                        key={row.key}
                        className="border-b border-slate-100 odd:bg-slate-50/70 last:border-0 hover:bg-orange-50/40"
                      >
                        <td className="px-3 py-2.5 align-middle">
                          <div className="truncate font-medium text-slate-800" title={row.exhibitorName}>
                            {row.exhibitorName}
                          </div>
                          {!row.linked && <div className="text-xs text-amber-600">belum tertaut</div>}
                        </td>
                        <td className="px-3 py-2.5 align-middle text-slate-700">{row.booth ?? '—'}</td>
                        <td className="px-3 py-2.5 align-middle">
                          {row.agent ? (
                            <span className="block truncate text-slate-800" title={row.agent}>
                              {row.agent}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 align-middle">
                          <Link
                            href={`/jobs/${row.jobId}`}
                            className="block truncate font-semibold text-slate-900 hover:text-orange-700"
                          >
                            {row.jobNo}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 align-middle tabular-nums text-slate-700">
                          {amount(row.summary.totalCount)}
                        </td>
                        <td className="px-3 py-2.5 align-middle tabular-nums text-slate-700">
                          {amount(row.summary.volumeCbm)}
                        </td>
                        <td className="px-3 py-2.5 align-middle tabular-nums text-slate-700">
                          {amount(row.summary.weightKg)}
                        </td>
                        <td className="whitespace-normal px-3 py-2.5 align-middle text-slate-700">
                          {row.notes.length ? (
                            row.notes.map((note, index) => (
                              <div key={index}>{`${operationalNoteKindLabels[note.kind]}: ${note.text}`}</div>
                            ))
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
