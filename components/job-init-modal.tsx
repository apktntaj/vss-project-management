'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'

import {
  createInternationalJobInit,
  listAgents,
  saveAgent,
  type Agent,
  type InternationalJobJenis,
  type LocalEvent,
  type LocalJob,
} from '@/lib/data-client'
import { internationalJobJenisLabels } from '@/domain/job/types'

function toast(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
}

const internationalJenisDescriptions: Record<InternationalJobJenis, string> = {
  VENUE: 'Pengiriman barang terkait kebutuhan venue event.',
  ROAD_SHIPMENT: 'Pengiriman darat antar wilayah, seperti grup ROAD SHIPMENT pada inward manifest.',
  PERMANENT_IMPORT: 'Impor tetap; barang menjadi milik impor dan tidak wajib diekspor kembali.',
  ATA_CARNET: 'Impor sementara dengan dokumen ATA Carnet.',
  TEMPORARY_EXPORT: 'Ekspor sementara; barang wajib dipulangkan kembali.',
}

const internationalJenisOrder: InternationalJobJenis[] = [
  'VENUE',
  'ROAD_SHIPMENT',
  'PERMANENT_IMPORT',
  'ATA_CARNET',
  'TEMPORARY_EXPORT',
]

/**
 * Inisiasi job dalam satu form: jenis job (dropdown, default Venue) + agent.
 * Exhibitor binaan tidak diisi di sini — menyusul di detail job.
 */
export function JobInitModal({
  event,
  onCreated,
  onCancel,
}: {
  event: LocalEvent
  onCreated: (job: LocalJob) => void
  onCancel: () => void
}) {
  const [selection, setSelection] = useState<InternationalJobJenis>('VENUE')
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [agentMode, setAgentMode] = useState<'existing' | 'new'>('existing')
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [newAgentName, setNewAgentName] = useState('')
  const [newAgentContactName, setNewAgentContactName] = useState('')
  const [newAgentEmail, setNewAgentEmail] = useState('')
  const [newAgentPhone, setNewAgentPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    listAgents().then((loadedAgents) => {
      if (!active) return
      setAgents(loadedAgents)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  async function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    if (agentMode === 'new' && !newAgentName.trim()) {
      setError('Nama agent wajib diisi.')
      return
    }
    if (agentMode === 'existing' && !selectedAgentId) {
      setError('Pilih agent atau buat agent baru.')
      return
    }
    setSaving(true)
    setError('')
    try {
      let agentId = selectedAgentId
      let agentName = agents.find((agent) => agent.id === agentId)?.name ?? ''
      if (agentMode === 'new') {
        const created = await saveAgent({
          name: newAgentName,
          contact: {
            name: newAgentContactName || null,
            role: null,
            email: newAgentEmail || null,
            phone: newAgentPhone || null,
          },
          address: null,
          countryCode: null,
        })
        agentId = created.id
        agentName = created.name
      }
      const job = await createInternationalJobInit({
        eventId: event.id,
        agentId,
        internationalJenis: selection,
      })
      toast(`Job ${job.jobNumber} (${internationalJobJenisLabels[selection]}) dibuat untuk agent ${agentName}.`, 'success')
      onCreated(job)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Job tidak dapat dibuat.'
      setError(message)
      toast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      role="presentation"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) onCancel()
      }}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-init-title"
        className="card flex max-h-[calc(100vh-2rem)] min-h-0 w-full max-w-2xl flex-col overflow-hidden"
      >
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-5 sm:px-8">
          <div>
            <h2 id="job-init-title" className="text-2xl font-bold">
              Inisiasi job baru
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {event.officialName} · {event.venue?.officialName || 'Venue belum diinput'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Tutup form inisiasi job"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-black"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6 sm:p-8">
          <label className="label">
            Jenis job
            <select
              value={selection}
              onChange={(selectEvent) => setSelection(selectEvent.target.value as InternationalJobJenis)}
              className="input mt-1"
            >
              {internationalJenisOrder.map((jenis) => (
                <option key={jenis} value={jenis}>
                  {internationalJobJenisLabels[jenis]}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs font-normal text-slate-500">
              {internationalJenisDescriptions[selection]}
            </span>
          </label>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Agent</h3>
            <fieldset className="mt-3 flex gap-4 text-sm font-medium">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="agent-mode"
                  checked={agentMode === 'existing'}
                  onChange={() => setAgentMode('existing')}
                />
                Agent tersimpan
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="agent-mode"
                  checked={agentMode === 'new'}
                  onChange={() => setAgentMode('new')}
                />
                Agent baru
              </label>
            </fieldset>
            {agentMode === 'existing' ? (
              <label className="label mt-3">
                Pilih agent
                <select
                  value={selectedAgentId}
                  onChange={(selectEvent) => setSelectedAgentId(selectEvent.target.value)}
                  className="input mt-1"
                  disabled={loading}
                >
                  <option value="">{loading ? 'Memuat agent...' : 'Pilih agent...'}</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <label className="label sm:col-span-2">
                  Nama agent
                  <input
                    value={newAgentName}
                    onChange={(inputEvent) => setNewAgentName(inputEvent.target.value)}
                    className="input mt-1"
                    placeholder="cth. JS LOGISTICS"
                  />
                </label>
                <label className="label">
                  Nama PIC
                  <input
                    value={newAgentContactName}
                    onChange={(inputEvent) => setNewAgentContactName(inputEvent.target.value)}
                    className="input mt-1"
                  />
                </label>
                <label className="label">
                  Telepon PIC
                  <input
                    value={newAgentPhone}
                    onChange={(inputEvent) => setNewAgentPhone(inputEvent.target.value)}
                    className="input mt-1"
                  />
                </label>
                <label className="label sm:col-span-2">
                  Email PIC
                  <input
                    type="email"
                    value={newAgentEmail}
                    onChange={(inputEvent) => setNewAgentEmail(inputEvent.target.value)}
                    className="input mt-1"
                  />
                </label>
              </div>
            )}
            <p className="mt-2 text-xs text-slate-500">
              Satu agent mewakili satu job pada event ini. Exhibitor binaan diisi belakangan di detail job.
            </p>
          </section>
        </div>

        <div className="shrink-0 border-t px-6 py-4 sm:px-8">
          {error && <p className="mb-4 text-sm text-rose-700">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onCancel} className="btn-secondary">
              Batal
            </button>
            <button type="submit" disabled={saving || loading} className="btn-primary">
              {saving ? 'Menyimpan...' : 'Buat job'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
