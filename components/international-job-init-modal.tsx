'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'

import {
  createInternationalJobInit,
  listAgents,
  listEventsWithExhibitors,
  saveAgent,
  type Agent,
  type InternationalJobJenis,
  type LocalEvent,
  type LocalExhibitor,
  type LocalJob,
} from '@/lib/data-client'
import { internationalJobJenisLabels } from '@/domain/job/types'

function toast(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
}

/**
 * Fase inisiasi job international: cukup agent + daftar exhibitor binaan.
 * Dokumen (CIPL/B/L/BC) menyusul di fase berikutnya melalui halaman job.
 */
export function InternationalJobInitModal({
  event,
  jenis,
  onCreated,
  onCancel,
}: {
  event: LocalEvent
  jenis: InternationalJobJenis
  onCreated: (job: LocalJob) => void
  onCancel: () => void
}) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [exhibitors, setExhibitors] = useState<LocalExhibitor[]>([])
  const [loading, setLoading] = useState(true)
  const [agentMode, setAgentMode] = useState<'existing' | 'new'>('existing')
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [newAgentName, setNewAgentName] = useState('')
  const [newAgentContactName, setNewAgentContactName] = useState('')
  const [newAgentEmail, setNewAgentEmail] = useState('')
  const [newAgentPhone, setNewAgentPhone] = useState('')
  const [selectedExhibitorIds, setSelectedExhibitorIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([listAgents(), listEventsWithExhibitors()]).then(
      ([loadedAgents, { exhibitorsByEvent }]) => {
        if (!active) return
        setAgents(loadedAgents)
        setExhibitors(exhibitorsByEvent[event.id] ?? [])
        setLoading(false)
      },
    )
    return () => {
      active = false
    }
  }, [event.id])

  function toggleExhibitor(exhibitorId: string) {
    setSelectedExhibitorIds((current) =>
      current.includes(exhibitorId)
        ? current.filter((id) => id !== exhibitorId)
        : [...current, exhibitorId],
    )
  }

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
    if (selectedExhibitorIds.length === 0) {
      setError('Pilih minimal satu exhibitor binaan.')
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
        internationalJenis: jenis,
        exhibitorIds: selectedExhibitorIds,
      })
      toast(`Job ${job.jobNumber} dibuat untuk agent ${agentName}.`, 'success')
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
        aria-labelledby="international-job-init-title"
        className="card flex max-h-[calc(100vh-2rem)] min-h-0 w-full max-w-2xl flex-col overflow-hidden"
      >
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-5 sm:px-8">
          <div>
            <h2 id="international-job-init-title" className="text-2xl font-bold">
              Inisiasi job international
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {event.officialName} · {event.venue?.officialName || 'Venue belum diinput'}
            </p>
            <p className="mt-2">
              <span className="inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200">
                {internationalJobJenisLabels[jenis]}
              </span>
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
              Satu agent mewakili satu job pada event ini — job berisi satu CIPL dan satu B/L.
            </p>
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Exhibitor binaan
            </h3>
            <p className="mt-1 text-xs text-slate-500">Pilih minimal satu exhibitor yang dibawa agent ini.</p>
            {loading ? (
              <p className="mt-3 text-sm text-slate-500">Memuat exhibitor...</p>
            ) : exhibitors.length ? (
              <ul className="mt-3 divide-y divide-black/10 rounded-xl border border-black/10">
                {exhibitors.map((exhibitor) => (
                  <li key={exhibitor.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={selectedExhibitorIds.includes(exhibitor.id)}
                        onChange={() => toggleExhibitor(exhibitor.id)}
                        className="h-4 w-4 accent-orange-600"
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-800" title={exhibitor.legalName}>
                          {exhibitor.legalName}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {exhibitor.type === 'LOCAL' ? 'Local' : 'International'}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-black/15 px-4 py-6 text-center text-sm text-slate-500">
                Belum ada exhibitor pada event ini. Tambahkan exhibitor lebih dulu dari halaman events.
              </p>
            )}
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
