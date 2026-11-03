'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, Search, X } from 'lucide-react'

import {
  createJob as createJobRecord,
  listAgents,
  saveAgent,
  type Agent,
  type InternationalJobJenis,
  type LocalEvent,
  type Job,
  type TransportMode,
} from '@/lib/data-client'
import { transportModeLabels, transportModes } from '@/domain/job/types'
import { internationalJobJenisLabels } from '@/domain/job/types'

function toast(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
}

type JobTypeSelection = 'LOCAL' | InternationalJobJenis

const jobTypeOptions: Array<{ value: JobTypeSelection; description: string }> = [
  {
    value: 'TPPB_BC_23',
    description:
      'Fasilitas Tempat Penyelenggaraan Pameran Berikat; barang masuk venue berikat via BC 2.3.',
  },
  {
    value: 'ATA_CARNET',
    description: 'Impor sementara dengan paspor barang ATA Carnet.',
  },
  {
    value: 'TEMPORARY_IMPORT',
    description: 'Impor sementara biasa dengan jaminan; barang wajib keluar kembali.',
  },
  {
    value: 'PERMANENT_IMPORT',
    description: 'Impor tetap (Genco); barang tetap berada di Indonesia.',
  },
  {
    value: 'ROAD_SHIPMENT',
    description: 'Pengangkutan darat / pengalihan barang antar tempat (BC 2.7).',
  },
  {
    value: 'LOCAL',
    description: 'Barang pihak lokal tanpa dokumen kepabeanan.',
  },
]

function jobTypeLabel(value: JobTypeSelection) {
  return value === 'LOCAL' ? 'Local' : internationalJobJenisLabels[value]
}

/**
 * Wizard pembuatan job ramping: event via pencarian, jenis job, moda transport, dan agent.
 * CIPL dan B/L/AWB diisi sesudahnya dari halaman detail job.
 */
export function JobCreateWizard({
  events,
  presetEvent,
  onCreated,
  onCancel,
}: {
  events: LocalEvent[]
  presetEvent?: LocalEvent | null
  onCreated: (job: Job) => void
  onCancel: () => void
}) {
  const [selection, setSelection] = useState<JobTypeSelection>('TPPB_BC_23')
  const [eventQuery, setEventQuery] = useState(presetEvent?.officialName ?? '')
  const [selectedEventId, setSelectedEventId] = useState<string | null>(presetEvent?.id ?? null)
  /** Jalur kiriman — bersama jenis job menentukan awalan No Job (S/A/ATA/…). */
  const [transportMode, setTransportMode] = useState<TransportMode | ''>('SEA')
  const [agents, setAgents] = useState<Agent[]>([])
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [tanpaAgent, setTanpaAgent] = useState(false)
  const [creatingNew, setCreatingNew] = useState(false)
  const [agentQuery, setAgentQuery] = useState('')
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [newAgentName, setNewAgentName] = useState('')
  const [newAgentContactName, setNewAgentContactName] = useState('')
  const [newAgentEmail, setNewAgentEmail] = useState('')
  const [newAgentPhone, setNewAgentPhone] = useState('')
  const [error, setError] = useState('')
  const [finishing, setFinishing] = useState(false)

  useEffect(() => {
    let active = true
    listAgents().then((loadedAgents) => {
      if (!active) return
      setAgents(loadedAgents)
      setLoadingAgents(false)
    })
    return () => {
      active = false
    }
  }, [])

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? presetEvent ?? null,
    [events, selectedEventId, presetEvent],
  )

  const eventSuggestions = useMemo(() => {
    const search = eventQuery.trim().toLowerCase()
    if (!search || selectedEventId) return []
    return events
      .filter((event) =>
        [event.officialName, event.alias].filter(Boolean).join(' ').toLowerCase().includes(search),
      )
      .slice(0, 6)
  }, [eventQuery, events, selectedEventId])

  const agentSuggestions = useMemo(() => {
    const query = agentQuery.trim().toLowerCase()
    if (!query) return []
    return agents.filter((agent) => agent.name.toLowerCase().includes(query)).slice(0, 6)
  }, [agentQuery, agents])

  function changeSelection(next: JobTypeSelection) {
    setSelection(next)
    if (next === 'ROAD_SHIPMENT') setTransportMode('ROAD')
    else if (transportMode === 'ROAD') setTransportMode('SEA')
    // Job Local selalu dipegang exhibitor — tanpa agent.
    const tanpaAgentDefault = next === 'LOCAL'
    setTanpaAgent(tanpaAgentDefault)
    if (tanpaAgentDefault) {
      setSelectedAgentId(null)
      setAgentQuery('')
    }
  }

  function changeTanpaAgent(checked: boolean) {
    setTanpaAgent(checked)
    if (checked) {
      setSelectedAgentId(null)
      setAgentQuery('')
    }
  }

  function selectAgent(agent: Agent) {
    setSelectedAgentId(agent.id)
    setAgentQuery(agent.name)
  }

  async function resolveAgentId(): Promise<{ agentId: string | null; agentName: string }> {
    if (tanpaAgent) return { agentId: null, agentName: '' }
    if (creatingNew && newAgentName.trim()) {
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
      return { agentId: created.id, agentName: created.name }
    }
    if (selectedAgentId) {
      return {
        agentId: selectedAgentId,
        agentName: agents.find((agent) => agent.id === selectedAgentId)?.name ?? '',
      }
    }
    return { agentId: null, agentName: '' }
  }

  /** Job Local selalu dipegang exhibitor (aturan server/DB). */
  const exhibitorOnlySelection = selection === 'LOCAL'

  async function createJob(): Promise<Job> {
    if (!selectedEvent) throw new Error('Pilih event untuk job ini terlebih dahulu.')
    const { agentId } = exhibitorOnlySelection ? { agentId: null } : await resolveAgentId()
    return createJobRecord({
      eventId: selectedEvent.id,
      kind: selection === 'LOCAL' ? 'LOCAL' : 'INTERNATIONAL',
      internationalJenis: selection === 'LOCAL' ? null : selection,
      transportMode: transportMode || null,
      agentId,
      // Pihak exhibitor ditetapkan sesudah CIPL tersimpan (exhibitor-nya bisa baru dibuat di sana).
      exhibitorId: null,
    })
  }

  async function createAndClose(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    setError('')
    if (!selectedEvent) {
      const message = 'Pilih event untuk job ini terlebih dahulu.'
      setError(message)
      toast(message, 'error')
      return
    }
    setFinishing(true)
    try {
      const job = await createJob()
      toast(`Job (${jobTypeLabel(selection)}) dibuat.`, 'success')
      // Tetap sibuk sampai halaman tujuan menggantikan wizard ini: tanpa itu, selama navigasi
      // berjalan form tampak siap dan tombol Selesai bisa ditekan lagi (job ganda).
      onCreated(job)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Job tidak dapat dibuat.'
      toast(message, 'error')
      setError(message)
      setFinishing(false)
    }
  }

  const busy = finishing

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-create-title"
        className="card relative flex h-[min(720px,calc(100vh-2rem))] min-h-0 w-full max-w-3xl flex-col overflow-hidden"
      >
        <div className="relative z-20 flex shrink-0 items-center justify-between gap-4 border-b bg-white px-6 py-5 sm:px-8">
          <div className="min-w-0">
            <h2 id="job-create-title" className="text-2xl font-bold">
              Job Baru
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Tutup form job baru"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-black"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={createAndClose} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6 sm:p-8">
            <div className="relative">
              <label className="label">
                Event
                <div className="relative mt-1">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3 top-2.5 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    value={eventQuery}
                    onChange={(inputEvent) => {
                      setEventQuery(inputEvent.target.value)
                      setSelectedEventId(null)
                    }}
                    onKeyDown={(keyboardEvent) => {
                      if (keyboardEvent.key === 'Enter' && eventSuggestions.length > 0) {
                        keyboardEvent.preventDefault()
                        setSelectedEventId(eventSuggestions[0].id)
                        setEventQuery(eventSuggestions[0].officialName)
                      }
                    }}
                    className="input py-2 pl-9"
                    placeholder="Cari nama event, venue, atau EO…"
                    aria-label="Cari event"
                    autoComplete="off"
                    disabled={Boolean(presetEvent)}
                  />
                </div>
              </label>
              {eventSuggestions.length > 0 && !selectedEventId ? (
                <ul
                  className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-black/10 bg-white py-1 shadow-lg"
                  aria-label="Saran event"
                >
                  {eventSuggestions.map((event) => (
                    <li key={event.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEventId(event.id)
                          setEventQuery(event.officialName)
                        }}
                        className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-orange-50"
                      >
                        {event.officialName}
                        <span className="ml-2 text-xs text-slate-400">
                          {[event.venue?.name, event.eventOrganizer?.legalName]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {selectedEventId && selectedEvent ? (
                <p className="mt-1.5 text-xs font-medium text-emerald-700">
                  Event terpilih: {selectedEvent.officialName}
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="label">
                Jenis job
                <select
                  value={selection}
                  onChange={(selectEvent) =>
                    changeSelection(selectEvent.target.value as JobTypeSelection)
                  }
                  className="input mt-1"
                >
                  {jobTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {jobTypeLabel(option.value)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="label">
                Jalur
                <select
                  value={transportMode}
                  disabled={selection === 'ROAD_SHIPMENT'}
                  onChange={(selectEvent) =>
                    setTransportMode(selectEvent.target.value as TransportMode | '')
                  }
                  className="input mt-1"
                >
                  <option value="">Belum diketahui</option>
                  {transportModes.map((mode) => (
                    <option
                      key={mode}
                      value={mode}
                      disabled={mode !== 'ROAD' && selection === 'ROAD_SHIPMENT'}
                    >
                      {transportModeLabels[mode]}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  No Job (S.01, A.01, …) ditetapkan di detail job sesuai urutan barang datang.
                </span>
              </label>
            </div>

            <section>
              <div className="flex items-center justify-between gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={tanpaAgent}
                    disabled={exhibitorOnlySelection}
                    onChange={(checkEvent) => changeTanpaAgent(checkEvent.target.checked)}
                    className="h-4 w-4 accent-orange-600"
                  />
                  Tanpa agent
                  {exhibitorOnlySelection ? ' (job Local selalu dipegang exhibitor)' : ''}
                </label>
                {!creatingNew ? (
                  <button
                    type="button"
                    onClick={() => setCreatingNew(true)}
                    disabled={tanpaAgent}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 hover:text-orange-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus size={13} aria-hidden="true" />
                    Tambah agent
                  </button>
                ) : null}
              </div>

              {!tanpaAgent && creatingNew ? (
                <div className="mt-3">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="label sm:col-span-2">
                      Nama agent
                      <input
                        value={newAgentName}
                        onChange={(inputEvent) => {
                          const name = inputEvent.target.value.toLocaleUpperCase('id-ID')
                          setNewAgentName(name)
                        }}
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
                  <button
                    type="button"
                    onClick={() => setCreatingNew(false)}
                    className="mt-3 text-xs font-semibold text-orange-700 hover:text-orange-800"
                  >
                    Pilih agent tersimpan
                  </button>
                </div>
              ) : (
                <div className="mt-3">
                  <div className="relative">
                    <input
                      value={agentQuery}
                      onChange={(inputEvent) => {
                        setAgentQuery(inputEvent.target.value)
                        setSelectedAgentId(null)
                      }}
                      className="input"
                      placeholder={loadingAgents ? 'Memuat agent...' : 'Ketik nama agent...'}
                      disabled={tanpaAgent}
                      aria-label="Cari agent"
                      autoComplete="off"
                    />
                    {agentSuggestions.length > 0 && !selectedAgentId ? (
                      <ul
                        className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-black/10 bg-white py-1 shadow-lg"
                        aria-label="Saran agent"
                      >
                        {agentSuggestions.map((agent) => (
                          <li key={agent.id}>
                            <button
                              type="button"
                              onClick={() => selectAgent(agent)}
                              className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-orange-50"
                            >
                              {agent.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  {selectedAgentId ? (
                    <p className="mt-1.5 text-xs font-medium text-emerald-700">
                      Agent terpilih: {agents.find((agent) => agent.id === selectedAgentId)?.name}
                    </p>
                  ) : null}
                </div>
              )}
            </section>

            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Tagihan job dikirim ke agent; tanpa agent, ke exhibitor pemilik barang (ditetapkan
              dari CIPL atau di detail job).
            </p>
          </div>

          <div className="shrink-0 border-t px-6 py-4 sm:px-8">
            {error && <p className="mb-4 text-sm text-rose-700">{error}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={onCancel} className="btn-secondary" disabled={busy}>
                Batal
              </button>
              <button type="submit" disabled={busy} className="btn-primary">
                {finishing ? 'Menyimpan...' : 'Selesai'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
