'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Plus, Search, Trash2, Upload, X } from 'lucide-react'

import {
  createInternationalJobInit,
  createLocalJobInit,
  listAgents,
  saveAgent,
  saveJobDocument,
  saveJobManifestExhibitors,
  saveJobTransportExtraction,
  type Agent,
  type InternationalJobJenis,
  type LocalEvent,
  type LocalJob,
} from '@/lib/data-client'
import { exhibitorLogisticsSchema, type ExhibitorLogistics } from '@/domain/job/manifest'
import { internationalJobJenisLabels } from '@/domain/job/types'
import type { JobTransportExtraction } from '@/domain/exhibition/source-documents'
import { TransportEditor } from '@/components/job-document-editor-dialog'
import { isAcceptedJobDocument, jobDocumentAccept } from '@/components/job-document-file'

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

const slideLabels = ['Job', 'CIPL', 'B/L atau AWB']

type KoliDraft = { label: string; length: string; width: string; height: string; cbm: string; weight: string }
type CiplRowDraft = {
  key: string
  jobNo: string
  name: string
  totalPackage: string
  bareCase: string
  hall: string
  booth: string
  kolis: KoliDraft[]
}

const emptyKoli = (): KoliDraft => ({ label: '', length: '', width: '', height: '', cbm: '', weight: '' })

const emptyTransport = (): JobTransportExtraction => ({
  documentNumber: null,
  documentDate: null,
  carrier: null,
  vesselOrFlight: null,
  voyageOrFlightNumber: null,
  bookingNumber: null,
  shipper: null,
  consignee: null,
  notifyParty: null,
  portOfLoading: null,
  portOfDischarge: null,
  placeOfReceipt: null,
  placeOfDelivery: null,
  etd: null,
  eta: null,
  packageCount: null,
  packageType: null,
  marksAndNumbers: null,
  grossWeightKg: null,
  netWeightKg: null,
  volumeM3: null,
  containers: [],
})

const numberOrNull = (value: string): number | null => {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function scanFileAcceptable(file: File): boolean {
  if (isAcceptedJobDocument(file)) return true
  toast('File harus berupa PDF atau Excel.', 'error')
  return false
}

/**
 * Wizard pembuatan job tiga slide: (1) job — event via pencarian, jenis, No Job,
 * agent, bill to; (2) informasi CIPL — daftar exhibitor + rincian koli dengan smart
 * scan LLM; (3) data B/L atau AWB dengan smart scan. Seluruh isian ditahan di
 * memori; job dibuat di database sekali saat "Selesai" bersama lampiran dan baris
 * CIPL, sehingga membatalkan kapan pun tidak meninggalkan data.
 */
export function JobCreateWizard({
  events,
  presetEvent,
  onCreated,
  onCancel,
}: {
  events: LocalEvent[]
  presetEvent?: LocalEvent | null
  onCreated: (job: LocalJob) => void
  onCancel: () => void
}) {
  const [slide, setSlide] = useState(0)
  const [selection, setSelection] = useState<JobTypeSelection>('TPPB_BC_23')
  const [eventQuery, setEventQuery] = useState(presetEvent?.officialName ?? '')
  const [selectedEventId, setSelectedEventId] = useState<string | null>(presetEvent?.id ?? null)
  const [jobNumberInput, setJobNumberInput] = useState('')
  const [billToInput, setBillToInput] = useState('')
  /** Benar setelah user mengetik bill to sendiri — bill to berhenti mengikuti agent. */
  const [billToTouched, setBillToTouched] = useState(false)
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
  const [ciplRows, setCiplRows] = useState<CiplRowDraft[]>([])
  const [ciplFile, setCiplFile] = useState<File | null>(null)
  const [scanningCipl, setScanningCipl] = useState(false)
  const [docKind, setDocKind] = useState<'BL' | 'AWB'>('BL')
  const [transport, setTransport] = useState<JobTransportExtraction | null>(null)
  const [transportFile, setTransportFile] = useState<File | null>(null)
  const [scanningTransport, setScanningTransport] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const rowKeyRef = useRef(0)
  const nextRowKey = () => `cipl-row-${++rowKeyRef.current}`

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
        [event.officialName, event.alias]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(search),
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
    // Local tidak membutuhkan agent — centang "Tanpa agent" dan bersihkan pilihan agent.
    const local = next === 'LOCAL'
    setTanpaAgent(local)
    if (local) {
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
    if (!billToTouched) setBillToInput(agent.name)
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

  async function createJob(): Promise<LocalJob> {
    if (!selectedEvent) throw new Error('Pilih event untuk job ini terlebih dahulu.')
    const { agentId } = await resolveAgentId()
    return selection === 'LOCAL'
      ? await createLocalJobInit(selectedEvent.id, agentId, null, {
          jobNumber: jobNumberInput,
          billTo: billToInput,
        })
      : await createInternationalJobInit({
          eventId: selectedEvent.id,
          agentId,
          internationalJenis: selection,
          jobNumber: jobNumberInput,
          billTo: billToInput,
        })
  }

  function submitSlideJob(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    setError('')
    if (!selectedEvent) {
      const message = 'Pilih event untuk job ini terlebih dahulu.'
      setError(message)
      toast(message, 'error')
      return
    }
    if (selection === 'LOCAL') {
      void finish()
      return
    }
    setSlide(1)
  }

  async function scanCipl(file: File) {
    if (!scanFileAcceptable(file)) return
    setScanningCipl(true)
    try {
      const body = new FormData()
      body.set('file', file)
      const response = await fetch('/api/scan-cipl', { method: 'POST', body })
      const data = (await response.json().catch(() => null)) as
        | { exhibitors?: Array<{ name: string; jobNo: string | null; logistics: ExhibitorLogistics }>; warnings?: string[] }
        | { error?: string }
        | null
      if (!response.ok || !data || !('exhibitors' in data) || !Array.isArray(data.exhibitors)) {
        throw new Error(
          data && 'error' in data && typeof data.error === 'string' ? data.error : 'Dokumen tidak dapat dipindai.',
        )
      }
      const rows: CiplRowDraft[] = data.exhibitors.map((exhibitor) => ({
        key: nextRowKey(),
        jobNo: exhibitor.jobNo ?? '',
        name: exhibitor.name,
        totalPackage: String(exhibitor.logistics.koli.totalCount),
        bareCase:
          exhibitor.logistics.koli.bareCaseCount == null ? '' : String(exhibitor.logistics.koli.bareCaseCount),
        hall: exhibitor.logistics.hall ?? '',
        booth: exhibitor.logistics.booth ?? '',
        kolis: exhibitor.logistics.koli.details.map((koli) => ({
          label: koli.label ?? '',
          length: koli.dimension?.lengthCm == null ? '' : String(koli.dimension.lengthCm),
          width: koli.dimension?.widthCm == null ? '' : String(koli.dimension.widthCm),
          height: koli.dimension?.heightCm == null ? '' : String(koli.dimension.heightCm),
          cbm: koli.volumeCbm == null ? '' : String(koli.volumeCbm),
          weight: koli.weightKg == null ? '' : String(koli.weightKg),
        })),
      }))
      setCiplRows(rows)
      setCiplFile(file)
      if (rows.length) {
        toast(
          `${rows.length} exhibitor terbaca dari dokumen — periksa lalu lanjutkan.${data.warnings?.length ? ` (${data.warnings.length} baris dilewati)` : ''}`,
          'success',
        )
      } else {
        toast('Tidak ada baris exhibitor yang terbaca dari dokumen.', 'error')
      }
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Dokumen tidak dapat dipindai.', 'error')
    } finally {
      setScanningCipl(false)
    }
  }

  async function scanTransport(file: File) {
    if (!scanFileAcceptable(file)) return
    setScanningTransport(true)
    try {
      const body = new FormData()
      body.set('file', file)
      const response = await fetch('/api/classify-job-document', { method: 'POST', body })
      const data = (await response.json().catch(() => null)) as
        | {
            classification?: { documentType?: string }
            transport?: JobTransportExtraction | null
            detail?: { documentType?: string } | null
            error?: string
          }
        | null
      if (!response.ok || !data) {
        throw new Error(data?.error || 'Dokumen tidak dapat dipindai.')
      }
      if (!data.transport) {
        const detected = data.detail?.documentType ?? data.classification?.documentType ?? 'tidak dikenali'
        throw new Error(`Dokumen terdeteksi sebagai ${detected.replace(/_/g, ' ').toLowerCase()} — bukan B/L atau AWB.`)
      }
      setTransport(data.transport)
      setTransportFile(file)
      if (data.detail?.documentType === 'AIR_WAYBILL' || data.classification?.documentType === 'AIR_WAYBILL') {
        setDocKind('AWB')
      } else if (
        data.detail?.documentType === 'BILL_OF_LADING' ||
        data.classification?.documentType === 'BILL_OF_LADING'
      ) {
        setDocKind('BL')
      }
      toast('Data B/L atau AWB terisi dari dokumen — periksa lalu selesaikan.', 'success')
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Dokumen tidak dapat dipindai.', 'error')
    } finally {
      setScanningTransport(false)
    }
  }

  function buildManifestRows(): Array<{ name: string; logistics: ExhibitorLogistics }> {
    const rows: Array<{ name: string; logistics: ExhibitorLogistics }> = []
    for (const row of ciplRows) {
      const name = row.name.trim()
      if (!name) continue
      const details = row.kolis.map((koli) => {
        const lengthCm = numberOrNull(koli.length)
        const widthCm = numberOrNull(koli.width)
        const heightCm = numberOrNull(koli.height)
        return {
          label: koli.label.trim() || null,
          dimension:
            lengthCm !== null && widthCm !== null && heightCm !== null ? { lengthCm, widthCm, heightCm } : null,
          volumeCbm: numberOrNull(koli.cbm),
          weightKg: numberOrNull(koli.weight),
        }
      })
      const totalCount = Math.max(Math.round(numberOrNull(row.totalPackage) ?? 0), details.length)
      const parsed = exhibitorLogisticsSchema.safeParse({
        hall: row.hall.trim() || null,
        booth: row.booth.trim() || null,
        koli: {
          totalCount,
          bareCaseCount: numberOrNull(row.bareCase) == null ? null : Math.round(numberOrNull(row.bareCase)!),
          details,
        },
        notes: [],
      })
      if (parsed.success) rows.push({ name, logistics: parsed.data })
    }
    return rows
  }

  async function finish() {
    setFinishing(true)
    let job: LocalJob
    try {
      job = await createJob()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Job tidak dapat dibuat.'
      toast(message, 'error')
      setError(message)
      setSlide(0)
      setFinishing(false)
      return
    }
    let failures = 0
    const manifestRows = buildManifestRows()
    const skippedNames = ciplRows.length - manifestRows.length
    if (manifestRows.length) {
      try {
        await saveJobManifestExhibitors(job.id, manifestRows)
      } catch {
        failures += 1
        toast('Baris CIPL tidak dapat disimpan — bisa dilengkapi di detail job.', 'error')
      }
    }
    if (ciplFile) {
      try {
        await saveJobDocument(job.id, ciplFile, 'CIPL')
      } catch {
        failures += 1
        toast('Dokumen CIPL tidak dapat diunggah.', 'error')
      }
    }
    if (transportFile && transport) {
      try {
        await saveJobDocument(
          job.id,
          transportFile,
          docKind === 'AWB' ? 'AIR_WAYBILL' : 'BILL_OF_LADING',
          null,
          transport,
        )
      } catch {
        failures += 1
        toast('Dokumen B/L atau AWB tidak dapat diunggah.', 'error')
      }
    } else if (transport) {
      try {
        await saveJobTransportExtraction(job.id, transport)
      } catch {
        failures += 1
        toast('Data B/L atau AWB tidak dapat disimpan.', 'error')
      }
    }
    const parts = [`Job (${jobTypeLabel(selection)}) dibuat`]
    if (manifestRows.length) parts.push(`${manifestRows.length} exhibitor CIPL`)
    if (transportFile) parts.push(docKind === 'AWB' ? 'AWB' : 'B/L')
    toast(`${parts.join(' · ')}.${failures ? ' Sebagian data gagal — periksa detail job.' : ''}`, failures ? 'error' : 'success')
    if (skippedNames > 0) toast(`${skippedNames} baris CIPL dilewati karena belum ada nama exhibitor.`, 'error')
    onCreated(job)
  }

  const busy = scanningCipl || scanningTransport || finishing

  const koliSums = (row: CiplRowDraft) =>
    row.kolis.reduce(
      (sum, koli) => ({
        cbm: sum.cbm + (numberOrNull(koli.cbm) ?? 0),
        kg: sum.kg + (numberOrNull(koli.weight) ?? 0),
      }),
      { cbm: 0, kg: 0 },
    )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      role="presentation"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-create-title"
        className="card flex max-h-[calc(100vh-2rem)] min-h-0 w-full max-w-3xl flex-col overflow-hidden"
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b px-6 py-5 sm:px-8">
          <div className="min-w-0">
            <h2 id="job-create-title" className="text-2xl font-bold">
              Job Baru
            </h2>
            <ol className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs" aria-label="Langkah pembuatan job">
              {slideLabels.map((label, index) => (
                <li key={label} className="flex items-center gap-1.5">
                  {index > 0 ? <span className="text-slate-300">›</span> : null}
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium ${
                      index === slide
                        ? 'bg-orange-100 text-orange-800'
                        : index < slide
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'text-slate-400'
                    }`}
                  >
                    {index + 1}. {label}
                  </span>
                </li>
              ))}
            </ol>
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

        {slide === 0 ? (
          <form onSubmit={submitSlideJob} className="flex min-h-0 flex-1 flex-col">
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
                            {[event.venue?.name, event.eventOrganizer?.legalName].filter(Boolean).join(' · ')}
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
                    onChange={(selectEvent) => changeSelection(selectEvent.target.value as JobTypeSelection)}
                    className="input mt-1"
                                     >
                    {jobTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {jobTypeLabel(option.value)}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs font-normal text-slate-500">
                    {jobTypeOptions.find((option) => option.value === selection)?.description}
                  </span>
                </label>

                <label className="label">
                  No Job <span className="font-normal text-slate-400">(opsional)</span>
                  <input
                    value={jobNumberInput}
                    onChange={(inputEvent) =>
                      setJobNumberInput(inputEvent.target.value.toLocaleUpperCase('id-ID'))
                    }
                    className="input mt-1"
                    placeholder="cth. S.01/ISFEX-VPN/2026"
                                     />
                </label>
              </div>

              <section>
                <div className="flex items-center justify-between gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={tanpaAgent}
                      onChange={(checkEvent) => changeTanpaAgent(checkEvent.target.checked)}
                      className="h-4 w-4 accent-orange-600"
                                         />
                    Tanpa agent
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
                            if (!billToTouched) setBillToInput(name)
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

              <label className="label">
                Bill to <span className="font-normal text-slate-400">(opsional)</span>
                <input
                  value={billToInput}
                  onChange={(inputEvent) => {
                    setBillToInput(inputEvent.target.value)
                    setBillToTouched(true)
                  }}
                  className="input mt-1"
                  placeholder="Pihak yang ditagih (mis. agent atau exhibitor)"
                                 />
              </label>
            </div>

            <div className="shrink-0 border-t px-6 py-4 sm:px-8">
              {error && <p className="mb-4 text-sm text-rose-700">{error}</p>}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={onCancel} className="btn-secondary" disabled={busy}>
                  Batal
                </button>
                <button type="submit" disabled={busy} className="btn-primary">
                  {selection === 'LOCAL' ? (finishing ? 'Menyimpan...' : 'Buat job') : 'Lanjut'}
                </button>
              </div>
            </div>
          </form>
        ) : null}

        {slide === 1 ? (
          <>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6 sm:p-8">
              <fieldset className="rounded-xl border border-dashed border-orange-300 bg-orange-50/50 p-4">
                <legend className="px-1 text-sm font-semibold text-slate-800">Smart scan (otomatis)</legend>
                <p className="text-sm text-slate-600">
                  Unggah inward manifest, packing list, atau CIPL (PDF/Excel) — AI mengisi daftar exhibitor
                  dan rincian koli di bawah untuk diperiksa.
                </p>
                <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-black/20 bg-white px-4 py-3 text-sm text-slate-500 hover:border-orange-300 hover:bg-orange-50">
                  <span className="min-w-0 truncate">
                    {ciplFile ? `Terpindai: ${ciplFile.name}` : 'Pilih dokumen untuk dipindai'}
                  </span>
                  <Upload size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
                  <input
                    type="file"
                    accept={jobDocumentAccept}
                    className="sr-only"
                    disabled={scanningCipl || finishing}
                    onChange={(inputEvent) => {
                      const file = inputEvent.target.files?.[0]
                      if (file) void scanCipl(file)
                      inputEvent.target.value = ''
                    }}
                  />
                </label>
                {scanningCipl ? (
                  <p className="mt-2 text-sm font-medium text-orange-700" aria-live="polite">
                    Memeriksa dokumen dengan AI...
                  </p>
                ) : null}
              </fieldset>

              {ciplRows.length === 0 ? (
                <p className="rounded-xl border border-dashed border-black/15 px-4 py-3 text-sm text-slate-500">
                  Belum ada baris CIPL — pindai dokumen atau tambah exhibitor manual.
                </p>
              ) : (
                <ul className="space-y-4">
                  {ciplRows.map((row, rowIndex) => {
                    const sums = koliSums(row)
                    return (
                      <li key={row.key} className="rounded-xl border border-black/10 p-4">
                        <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_90px_90px_90px_110px_auto]">
                          <label className="label">
                            Exhibitor
                            {row.jobNo ? (
                              <span className="ml-1 text-xs font-normal text-slate-400">{row.jobNo}</span>
                            ) : null}
                            <input
                              value={row.name}
                              onChange={(inputEvent) =>
                                setCiplRows((current) =>
                                  current.map((item, i) =>
                                    i === rowIndex ? { ...item, name: inputEvent.target.value } : item,
                                  ),
                                )
                              }
                              className="input mt-1"
                              disabled={finishing}
                            />
                          </label>
                          <label className="label">
                            Total pkg
                            <input
                              type="number"
                              min="0"
                              value={row.totalPackage}
                              onChange={(inputEvent) =>
                                setCiplRows((current) =>
                                  current.map((item, i) =>
                                    i === rowIndex ? { ...item, totalPackage: inputEvent.target.value } : item,
                                  ),
                                )
                              }
                              className="input mt-1"
                              disabled={finishing}
                            />
                          </label>
                          <label className="label">
                            Bare case
                            <input
                              type="number"
                              min="0"
                              value={row.bareCase}
                              onChange={(inputEvent) =>
                                setCiplRows((current) =>
                                  current.map((item, i) =>
                                    i === rowIndex ? { ...item, bareCase: inputEvent.target.value } : item,
                                  ),
                                )
                              }
                              className="input mt-1"
                              disabled={finishing}
                            />
                          </label>
                          <label className="label">
                            Hall
                            <input
                              value={row.hall}
                              onChange={(inputEvent) =>
                                setCiplRows((current) =>
                                  current.map((item, i) =>
                                    i === rowIndex ? { ...item, hall: inputEvent.target.value } : item,
                                  ),
                                )
                              }
                              className="input mt-1"
                              disabled={finishing}
                            />
                          </label>
                          <label className="label">
                            Booth no
                            <input
                              value={row.booth}
                              onChange={(inputEvent) =>
                                setCiplRows((current) =>
                                  current.map((item, i) =>
                                    i === rowIndex ? { ...item, booth: inputEvent.target.value } : item,
                                  ),
                                )
                              }
                              className="input mt-1"
                              disabled={finishing}
                            />
                          </label>
                          <button
                            type="button"
                            aria-label={`Hapus exhibitor ${row.name || rowIndex + 1}`}
                            onClick={() =>
                              setCiplRows((current) => current.filter((_, i) => i !== rowIndex))
                            }
                            className="mb-1 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                            disabled={finishing}
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </div>

                        <div className="mt-4">
                          <div className="grid gap-2 px-1 text-xs font-medium text-slate-500 [grid-template-columns:minmax(0,1fr)_repeat(5,84px)_32px]">
                            <span>Case</span>
                            <span>L (cm)</span>
                            <span>W (cm)</span>
                            <span>H (cm)</span>
                            <span>CBM</span>
                            <span>Kg</span>
                            <span className="sr-only">Aksi</span>
                          </div>
                          <div className="mt-1.5 space-y-2">
                            {row.kolis.map((koli, koliIndex) => (
                              <div
                                key={koliIndex}
                                className="grid items-center gap-2 [grid-template-columns:minmax(0,1fr)_repeat(5,84px)_32px]"
                              >
                                <input
                                  value={koli.label}
                                  onChange={(inputEvent) =>
                                    setCiplRows((current) =>
                                      current.map((item, i) =>
                                        i === rowIndex
                                          ? {
                                              ...item,
                                              kolis: item.kolis.map((entry, j) =>
                                                j === koliIndex
                                                  ? { ...entry, label: inputEvent.target.value }
                                                  : entry,
                                              ),
                                            }
                                          : item,
                                      ),
                                    )
                                  }
                                  placeholder="cth. PKG 1"
                                  className="input py-1.5 text-sm"
                                  aria-label={`Case ${koliIndex + 1}`}
                                  disabled={finishing}
                                />
                                {(
                                  [
                                    ['length', `Panjang case ${koliIndex + 1}`],
                                    ['width', `Lebar case ${koliIndex + 1}`],
                                    ['height', `Tinggi case ${koliIndex + 1}`],
                                    ['cbm', `CBM case ${koliIndex + 1}`],
                                    ['weight', `Berat case ${koliIndex + 1}`],
                                  ] as const
                                ).map(([field, aria]) => (
                                  <input
                                    key={field}
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={koli[field]}
                                    onChange={(inputEvent) =>
                                      setCiplRows((current) =>
                                        current.map((item, i) =>
                                          i === rowIndex
                                            ? {
                                                ...item,
                                                kolis: item.kolis.map((entry, j) =>
                                                  j === koliIndex
                                                    ? { ...entry, [field]: inputEvent.target.value }
                                                    : entry,
                                                ),
                                              }
                                            : item,
                                        ),
                                      )
                                    }
                                    className="input py-1.5 text-sm"
                                    aria-label={aria}
                                    disabled={finishing}
                                  />
                                ))}
                                <button
                                  type="button"
                                  aria-label={`Hapus case ${koliIndex + 1}`}
                                  onClick={() =>
                                    setCiplRows((current) =>
                                      current.map((item, i) =>
                                        i === rowIndex
                                          ? { ...item, kolis: item.kolis.filter((_, j) => j !== koliIndex) }
                                          : item,
                                      ),
                                    )
                                  }
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                                  disabled={finishing}
                                >
                                  <Trash2 size={14} aria-hidden="true" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                setCiplRows((current) =>
                                  current.map((item, i) =>
                                    i === rowIndex ? { ...item, kolis: [...item.kolis, emptyKoli()] } : item,
                                  ),
                                )
                              }
                              className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 hover:text-orange-800"
                              disabled={finishing}
                            >
                              <Plus size={13} aria-hidden="true" />
                              Tambah case
                            </button>
                            <p className="text-xs text-slate-500">
                              Σ {sums.cbm.toLocaleString('id-ID')} CBM · {sums.kg.toLocaleString('id-ID')} kg
                            </p>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}

              <button
                type="button"
                onClick={() =>
                  setCiplRows((current) => [
                    ...current,
                    {
                      key: nextRowKey(),
                      jobNo: '',
                      name: '',
                      totalPackage: '',
                      bareCase: '',
                      hall: '',
                      booth: '',
                      kolis: [emptyKoli()],
                    },
                  ])
                }
                className="btn-secondary"
                disabled={finishing}
              >
                <Plus size={16} aria-hidden="true" />
                Tambah exhibitor
              </button>
            </div>

            <div className="shrink-0 border-t px-6 py-4 sm:px-8">
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setSlide(0)} className="btn-secondary" disabled={busy}>
                  Kembali
                </button>
                <button type="button" onClick={() => setSlide(2)} className="btn-primary" disabled={busy}>
                  Lanjut
                </button>
              </div>
            </div>
          </>
        ) : null}

        {slide === 2 ? (
          <>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6 sm:p-8">
              <div className="grid shrink-0 gap-4 sm:grid-cols-[220px_1fr]">
                <label className="label">
                  Jenis dokumen
                  <select
                    value={docKind}
                    onChange={(selectEvent) => setDocKind(selectEvent.target.value as 'BL' | 'AWB')}
                    className="input mt-1"
                    disabled={finishing}
                  >
                    <option value="BL">B/L (laut)</option>
                    <option value="AWB">AWB (udara)</option>
                  </select>
                </label>
                <fieldset className="rounded-xl border border-dashed border-orange-300 bg-orange-50/50 p-4">
                  <legend className="px-1 text-sm font-semibold text-slate-800">Smart scan (otomatis)</legend>
                  <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-black/20 bg-white px-4 py-2.5 text-sm text-slate-500 hover:border-orange-300 hover:bg-orange-50">
                    <span className="min-w-0 truncate">
                      {transportFile ? `Terpindai: ${transportFile.name}` : 'Unggah B/L atau AWB untuk dipindai'}
                    </span>
                    <Upload size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
                    <input
                      type="file"
                      accept={jobDocumentAccept}
                      className="sr-only"
                      disabled={scanningTransport || finishing}
                      onChange={(inputEvent) => {
                        const file = inputEvent.target.files?.[0]
                        if (file) void scanTransport(file)
                        inputEvent.target.value = ''
                      }}
                    />
                  </label>
                  {scanningTransport ? (
                    <p className="mt-2 text-sm font-medium text-orange-700" aria-live="polite">
                      Memeriksa dokumen dengan AI...
                    </p>
                  ) : null}
                </fieldset>
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-black/10">
                <TransportEditor value={transport ?? emptyTransport()} onChange={setTransport} />
              </div>
              <p className="shrink-0 text-xs text-slate-500">
                Dokumen yang dipindai tersimpan sebagai lampiran job saat Anda menekan Selesai.
              </p>
            </div>

            <div className="shrink-0 border-t px-6 py-4 sm:px-8">
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setSlide(1)} className="btn-secondary" disabled={busy}>
                  Kembali
                </button>
                <button type="button" onClick={finish} disabled={busy} className="btn-primary">
                  {finishing ? 'Menyimpan...' : 'Selesai'}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
