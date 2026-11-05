'use client'

import { useEffect, useState } from 'react'
import { Pencil, Receipt, UserRound } from 'lucide-react'

import {
  listAgents,
  saveJobInvoice,
  saveJobOperationalDetails,
  type Agent,
  type Exhibitor,
  type InvoiceStatus,
  type Job,
} from '@/lib/data-client'
import { useCanEditBilling } from '@/lib/use-billing-access'
import { invoiceStatusLabels, invoiceStatuses } from '@/domain/job/types'

function toast(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
}

/** Job Local selalu dipegang exhibitor (cermin aturan server/DB). */
function exhibitorOnly(job: Job) {
  return job.kind === 'LOCAL'
}

const toDateInput = (value: string | null) => (value ? value.slice(0, 10) : '')
const fromDateInput = (value: string) => (value ? new Date(`${value}T00:00:00`).toISOString() : null)
const money = (amount: number | null, currency: string | null) =>
  amount === null ? '—' : `${currency ?? ''} ${new Intl.NumberFormat('id-ID').format(amount)}`.trim()

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-800">{value || '—'}</dd>
    </div>
  )
}

/** Pihak yang ditagih: agent, atau exhibitor bila job berkonteks event (`exhibitors` null = tanpa exhibitor). */
function PartyEditor({
  job,
  exhibitors,
  onSaved,
  onCancel,
}: {
  job: Job
  exhibitors: Exhibitor[] | null
  onSaved: (job: Job) => void
  onCancel: () => void
}) {
  const onlyExhibitor = exhibitorOnly(job)
  const [agents, setAgents] = useState<Agent[]>([])
  const [choice, setChoice] = useState(
    job.party ? `${job.party.kind === 'AGENT' ? 'agent' : 'exhibitor'}:${job.party.id}` : '',
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (onlyExhibitor) return
    listAgents()
      .then(setAgents)
      .catch(() => toast('Daftar agent tidak dapat dimuat.', 'error'))
  }, [onlyExhibitor])

  async function submit() {
    setSaving(true)
    try {
      const [kind, id] = choice ? choice.split(':') : ['', '']
      const saved = await saveJobOperationalDetails(job, {
        party: {
          agentId: kind === 'agent' ? id : null,
          exhibitorId: kind === 'exhibitor' ? id : null,
        },
      })
      toast('Pihak job diperbarui.', 'success')
      onSaved(saved)
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Pihak job tidak dapat disimpan.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3 space-y-3">
      <label className="label">
        Pihak yang ditagih
        <select className="input mt-1" value={choice} onChange={(event) => setChoice(event.target.value)}>
          <option value="">Belum ditetapkan</option>
          {!onlyExhibitor && (
            <optgroup label="Agent">
              {agents.map((agent) => (
                <option key={agent.id} value={`agent:${agent.id}`}>
                  {agent.name}
                </option>
              ))}
            </optgroup>
          )}
          {exhibitors && (
            <optgroup label="Exhibitor event ini">
              {exhibitors.map((exhibitor) => (
                <option key={exhibitor.id} value={`exhibitor:${exhibitor.id}`}>
                  {exhibitor.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        {onlyExhibitor && (
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Job Local selalu dipegang exhibitor.
          </span>
        )}
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Batal
        </button>
        <button type="button" className="btn-primary" disabled={saving} onClick={submit}>
          {saving ? 'Menyimpan…' : 'Simpan pihak'}
        </button>
      </div>
    </div>
  )
}

/** Tagihan job ke pihaknya: satu job = satu tagihan. */
function InvoiceEditor({
  job,
  onSaved,
  onCancel,
}: {
  job: Job
  onSaved: (job: Job) => void
  onCancel: () => void
}) {
  const [number, setNumber] = useState(job.invoice.number ?? '')
  const [amount, setAmount] = useState(job.invoice.amount !== null ? String(job.invoice.amount) : '')
  const [currency, setCurrency] = useState(job.invoice.currency ?? 'IDR')
  const [status, setStatus] = useState<InvoiceStatus>(job.invoice.status)
  const [sentAt, setSentAt] = useState(toDateInput(job.invoice.sentAt))
  const [paidAt, setPaidAt] = useState(toDateInput(job.invoice.paidAt))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setError('')
    const parsedAmount = amount.trim() ? Number(amount.trim()) : null
    if (parsedAmount !== null && (!Number.isFinite(parsedAmount) || parsedAmount < 0)) {
      setError('Nilai tagihan harus angka ≥ 0.')
      return
    }
    setSaving(true)
    try {
      const saved = await saveJobInvoice(job, {
        number: number.trim() || null,
        amount: parsedAmount,
        currency: currency.trim().toUpperCase() || null,
        status,
        sentAt: fromDateInput(sentAt),
        paidAt: fromDateInput(paidAt),
      })
      toast('Tagihan job diperbarui.', 'success')
      onSaved(saved)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Tagihan tidak dapat disimpan.'
      setError(message)
      toast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="label">
          Nomor tagihan
          <input className="input mt-1" value={number} onChange={(event) => setNumber(event.target.value)} />
        </label>
        <label className="label">
          Nilai
          <input
            type="number"
            min="0"
            step="any"
            className="input mt-1"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <label className="label">
          Mata uang
          <input
            className="input mt-1 uppercase"
            maxLength={3}
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
          />
        </label>
        <label className="label">
          Status
          <select
            className="input mt-1"
            value={status}
            onChange={(event) => setStatus(event.target.value as InvoiceStatus)}
          >
            {invoiceStatuses.map((value) => (
              <option key={value} value={value}>
                {invoiceStatusLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="label">
          Tanggal kirim
          <input type="date" className="input mt-1" value={sentAt} onChange={(event) => setSentAt(event.target.value)} />
        </label>
        <label className="label">
          Tanggal lunas
          <input type="date" className="input mt-1" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
        </label>
      </div>
      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Batal
        </button>
        <button type="button" className="btn-primary" disabled={saving} onClick={submit}>
          {saving ? 'Menyimpan…' : 'Simpan tagihan'}
        </button>
      </div>
    </div>
  )
}

type Editing = 'party' | 'invoice' | null

/** Kartu Pihak · Tagihan di detail job. No Job diatur lewat `JobNumberEditor` di header. */
export function JobPartyInvoiceCard({
  job,
  exhibitors,
  onSaved,
}: {
  job: Job
  exhibitors: Exhibitor[] | null
  onSaved: (job: Job) => void
}) {
  const canEditBilling = useCanEditBilling()
  const [editing, setEditing] = useState<Editing>(null)
  const saved = (next: Job) => {
    setEditing(null)
    onSaved(next)
  }
  const editButton = (target: Exclude<Editing, null>, label: string) =>
    editing === target ? null : (
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 hover:text-orange-800"
        onClick={() => setEditing(target)}
      >
        <Pencil size={12} aria-hidden="true" /> {label}
      </button>
    )

  return (
    <section className="card p-5">
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold">
              <UserRound size={18} className="text-orange-600" aria-hidden="true" /> Pihak
            </h2>
            {editButton('party', 'Ubah')}
          </div>
          {editing === 'party' ? (
            <PartyEditor job={job} exhibitors={exhibitors} onSaved={saved} onCancel={() => setEditing(null)} />
          ) : (
            <dl className="mt-3 space-y-3">
              <Info label="Yang ditagih" value={job.party?.name || 'Belum ditetapkan'} />
              <Info
                label="Jenis pihak"
                value={job.party ? (job.party.kind === 'AGENT' ? 'Agent' : 'Exhibitor') : null}
              />
            </dl>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold">
              <Receipt size={18} className="text-orange-600" aria-hidden="true" /> Tagihan
            </h2>
            {canEditBilling && editButton('invoice', 'Ubah')}
          </div>
          {editing === 'invoice' ? (
            <InvoiceEditor job={job} onSaved={saved} onCancel={() => setEditing(null)} />
          ) : (
            <dl className="mt-3 space-y-3">
              <Info label="Nomor" value={job.invoice.number} />
              <Info label="Nilai" value={money(job.invoice.amount, job.invoice.currency)} />
              <Info label="Status" value={invoiceStatusLabels[job.invoice.status]} />
            </dl>
          )}
        </div>
      </div>
    </section>
  )
}
