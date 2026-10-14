'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, CircleAlert, CheckCircle2, Plane, Ship, Truck } from 'lucide-react'

import {
  getOperationalDetails,
  type Agent,
  type LocalExhibitor,
  type LocalJob,
} from '@/lib/data-client'
import { getJobOperationalPhase, type JobOperationalPhaseId } from '@/lib/job-operational-phase'
import { compareInvoiceWithTransport } from '@/lib/document-comparison'
import { StatusBadge } from '@/components/status-badge'
import { internationalJobJenisLabels } from '@/domain/job/types'

const phaseTones: Record<JobOperationalPhaseId, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  PREPARE: 'bg-sky-50 text-sky-700',
  SUBMIT: 'bg-indigo-50 text-indigo-700',
  PROCESSING: 'bg-amber-50 text-amber-700',
  RELEASE: 'bg-emerald-50 text-emerald-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  ON_HOLD: 'bg-rose-50 text-rose-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
}

const customsStatusLabels: Record<string, string> = {
  NOT_STARTED: 'NOT STARTED',
  PREPARING: 'PREPARING',
  SUBMITTED: 'SUBMITTED',
  REGISTERED: 'REGISTERED',
  RELEASED: 'RELEASED',
  COMPLETED: 'COMPLETED',
  ON_HOLD: 'ON HOLD',
}

const customsTones: Record<string, string> = {
  NOT_STARTED: 'border-slate-200 bg-white text-slate-500',
  PREPARING: 'border-sky-200 bg-sky-50 text-sky-800',
  SUBMITTED: 'border-amber-200 bg-amber-50 text-amber-800',
  REGISTERED: 'border-amber-200 bg-amber-50 text-amber-800',
  RELEASED: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  COMPLETED: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  ON_HOLD: 'border-rose-200 bg-rose-50 text-rose-800',
}

function date(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

function EventJobRow({
  job,
  agentsById,
  exhibitors,
}: {
  job: LocalJob
  agentsById: Map<string, Agent>
  exhibitors: LocalExhibitor[]
}) {
  const [expanded, setExpanded] = useState(false)
  const operational = getOperationalDetails(job)
  const inbound = operational.inbound
  const phase = getJobOperationalPhase({
    status: job.status,
    hasInboundDocument: Boolean(inbound.documentNumber),
    hasInvoice: Boolean(operational.invoiceNumber),
    ciplStatus: operational.cipl.status,
    customsDocuments: Object.values(operational.customs),
  })
  const documentComparison =
    operational.invoice && operational.inboundDocument
      ? compareInvoiceWithTransport(operational.invoice, operational.inboundDocument)
      : null
  const comparisonDifferences = documentComparison?.filter((item) => item.status === 'DIFFERENT') ?? []

  const agent = job.agentId ? agentsById.get(job.agentId) ?? null : null
  const binaan = job.agentId
    ? exhibitors.filter((exhibitor) => exhibitor.agentId === job.agentId)
    : []
  const partyName = agent?.name ?? job.exhibitor?.legalName ?? job.clientName
  const TransportIcon = inbound.mode === 'AIR' ? Plane : inbound.mode === 'SEA' ? Ship : Truck

  return (
    <tr className="border-b border-slate-100 odd:bg-slate-50/70 last:border-0 hover:bg-orange-50/40">
      <td className="px-3 py-3 align-top">
        <Link href={`/jobs/${job.id}`} className="font-semibold text-slate-900 hover:text-orange-700">
          {job.jobNumber}
        </Link>
        <p className="mt-1">
          <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-inset ring-sky-200">
            {date(job.createdAt)}
          </span>
        </p>
        <p className="mt-1">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${phaseTones[phase.id]}`}>
            {phase.label}
          </span>
        </p>
      </td>
      <td className="px-3 py-3 align-top">
        {job.internationalJenis ? (
          <span className="inline-flex max-w-full truncate rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200" title={internationalJobJenisLabels[job.internationalJenis]}>
            {internationalJobJenisLabels[job.internationalJenis]}
          </span>
        ) : job.kind === 'LOCAL' ? (
          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Local</span>
        ) : (
          <span className="text-xs text-slate-400" title="Job lama sebelum model agent">Job lama</span>
        )}
      </td>
      <td className="max-w-[220px] px-3 py-3 align-top">
        <p className="truncate font-medium text-slate-800" title={partyName}>
          {partyName}
        </p>
        {!agent && (
          <p className="mt-1 text-xs text-slate-400">Job lama per exhibitor</p>
        )}
        {job.agentId && (
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
            className="mt-1 flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-orange-700"
          >
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            {binaan.length} exhibitor binaan
          </button>
        )}
        {job.agentId && expanded && (
          <ul className="mt-1 space-y-0.5 pl-4 text-xs text-slate-600">
            {binaan.length ? (
              binaan.map((exhibitor) => (
                <li key={exhibitor.id} className="truncate" title={exhibitor.legalName}>
                  • {exhibitor.legalName}
                </li>
              ))
            ) : (
              <li className="text-slate-400">Belum ada exhibitor binaan</li>
            )}
          </ul>
        )}
      </td>
      <td className="px-3 py-3 align-top">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-700">
            {inbound.documentType || 'Masuk'} · {inbound.documentNumber || 'Belum ada dokumen'}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">
            Invoice: {operational.invoiceNumber || 'Belum ada dokumen'}
          </p>
          {documentComparison &&
            (comparisonDifferences.length ? (
              <p
                className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-700"
                title={`Field yang berbeda: ${comparisonDifferences.map((item) => item.label).join(', ')}.`}
              >
                <CircleAlert size={13} aria-hidden="true" /> {comparisonDifferences.length} data berbeda
              </p>
            ) : (
              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-700">
                <CheckCircle2 size={13} aria-hidden="true" /> Dokumen sesuai
              </p>
            ))}
        </div>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex items-start gap-2">
          <TransportIcon size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-slate-700">{date(inbound.scheduleAt)}</p>
            <p className="mt-1">
              <span className="inline-flex max-w-full truncate rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                {inbound.carrier || '-'}
              </span>
            </p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex gap-1.5">
          {(['BC_2_3', 'BC_2_5', 'BC_3_0'] as const).map((key) => {
            const document = operational.customs[key]
            const label = key.replace('_', ' ')
            const tone = document.applicable ? customsTones[document.status] : 'border-slate-100 bg-slate-50 text-slate-400'
            const value = !document.applicable
              ? 'N/A'
              : document.registrationNumber || document.ajuNumber || customsStatusLabels[document.status]
            return (
              <div
                key={key}
                className={`min-w-0 flex-1 rounded-lg border px-1.5 py-1 text-center text-[10px] font-semibold ${tone}`}
                title={document.applicable ? `${label} · ${customsStatusLabels[document.status]}` : `${label} · Tidak diperlukan`}
              >
                <span className="block">{label}</span>
                <span className="mt-0.5 block truncate font-normal">{value}</span>
              </div>
            )
          })}
        </div>
      </td>
      <td className="px-3 py-3 align-top">
        <p className="text-sm font-medium text-slate-700">
          {job.createdBy?.name || job.assignedTo?.name || 'Belum ada inisiator'}
        </p>
        <div className="mt-2">
          <StatusBadge status={job.status} />
        </div>
      </td>
    </tr>
  )
}

export function EventJobsTable({
  jobs,
  agents,
  exhibitors,
}: {
  jobs: LocalJob[]
  agents: Agent[]
  exhibitors: LocalExhibitor[]
}) {
  const agentsById = new Map(agents.map((agent) => [agent.id, agent]))

  if (!jobs.length) {
    return (
      <p className="mt-5 rounded-xl border border-dashed border-black/15 px-4 py-8 text-center text-sm text-slate-500">
        Belum ada job untuk event ini.
      </p>
    )
  }

  return (
    <div className="mt-5 overflow-x-auto rounded-xl border border-black/10">
      <table className="min-w-[900px] w-full table-fixed text-left text-sm">
        <caption className="sr-only">Daftar job pada event ini</caption>
        <thead className="border-b bg-white text-slate-900 font-semibold uppercase tracking-wider">
          <tr>
            <th className="px-3 py-3">No Job</th>
            <th className="px-3 py-3">Jenis</th>
            <th className="px-3 py-3">Agent / Exhibitor</th>
            <th className="px-3 py-3">Dokumen shipment</th>
            <th className="px-3 py-3">ETA</th>
            <th className="px-3 py-3">Dokumen BC</th>
            <th className="px-3 py-3">PIC (Inisiator)</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <EventJobRow key={job.id} job={job} agentsById={agentsById} exhibitors={exhibitors} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
