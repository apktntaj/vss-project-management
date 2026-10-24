'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Upload, X } from 'lucide-react'

import {
  createInternationalJobInit,
  createLocalJobInit,
  listAgents,
  saveAgent,
  saveJobDocument,
  type Agent,
  type InternationalJobJenis,
  type LocalEvent,
  type LocalJob,
} from '@/lib/data-client'
import { internationalJobJenisLabels } from '@/domain/job/types'
import {
  isAcceptedJobDocument,
  jobDocumentAccept,
  type DocumentClassification,
  type JobDocumentExtraction,
} from '@/components/job-row'

function toast(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
}

type JobTypeSelection = 'LOCAL' | InternationalJobJenis
type AgentMode = 'existing' | 'new' | 'none'

const jobTypeOptions: Array<{ value: JobTypeSelection; description: string }> = [
  {
    value: 'TEMPORARY',
    description: 'Impor sementara untuk event (BC 2.3); barang wajib keluar kembali.',
  },
  {
    value: 'ATA_CARNET',
    description: 'Impor sementara dengan paspor barang ATA Carnet.',
  },
  {
    value: 'ROAD_SHIPMENT',
    description: 'Pengangkutan darat / pengalihan barang antar tempat (BC 2.7).',
  },
  {
    value: 'PERMANENT_IMPORT',
    description: 'Impor tetap; barang tetap berada di Indonesia (BC 3.0).',
  },
  {
    value: 'LOCAL',
    description: 'Barang pihak lokal tanpa dokumen kepabeanan.',
  },
]

function jobTypeLabel(value: JobTypeSelection) {
  return value === 'LOCAL' ? 'Local' : internationalJobJenisLabels[value]
}

/** Semua jenis boleh dengan atau tanpa agent; Local tidak membutuhkannya. */
function defaultAgentMode(selection: JobTypeSelection): AgentMode {
  return selection === 'LOCAL' ? 'none' : 'existing'
}

/**
 * Inisiasi job dalam satu form: jenis job (dropdown, default Temporary) + agent opsional.
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
  const [selection, setSelection] = useState<JobTypeSelection>('TEMPORARY')
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [agentMode, setAgentMode] = useState<AgentMode>('existing')
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [newAgentName, setNewAgentName] = useState('')
  const [newAgentContactName, setNewAgentContactName] = useState('')
  const [newAgentEmail, setNewAgentEmail] = useState('')
  const [newAgentPhone, setNewAgentPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [files, setFiles] = useState<File[]>([])

  function addFiles(fileList: FileList | null) {
    const incoming = Array.from(fileList ?? [])
    if (!incoming.length) return
    const accepted = incoming.filter(isAcceptedJobDocument)
    if (accepted.length !== incoming.length) {
      toast('File harus berupa PDF atau Excel.', 'error')
    }
    if (accepted.length) setFiles((current) => [...current, ...accepted])
  }

  // Job sudah tersimpan dulu; kegagalan per-dokumen tidak membatalkan job.
  async function uploadDocuments(jobId: string) {
    let uploaded = 0
    for (const file of files) {
      try {
        const formData = new FormData()
        formData.set('file', file)
        const response = await fetch('/api/classify-job-document', {
          method: 'POST',
          body: formData,
        })
        const payload = (await response.json().catch(() => null)) as
          | ({ classification?: DocumentClassification; error?: string } & JobDocumentExtraction)
          | null
        if (!response.ok || !payload || !payload.classification) {
          throw new Error(payload?.error || 'Dokumen tidak dapat diperiksa.')
        }
        const kind =
          payload.classification.documentType === 'UNREADABLE'
            ? 'OTHER'
            : payload.classification.documentType
        await saveJobDocument(jobId, file, kind, payload.invoice, payload.transport)
        uploaded += 1
      } catch {
        await saveJobDocument(jobId, file, 'OTHER').catch(() => undefined)
        uploaded += 1
      }
    }
    if (files.length) {
      toast(
        uploaded === files.length
          ? `${uploaded} dokumen terunggah dan diperiksa AI.`
          : `${uploaded}/${files.length} dokumen terunggah — sisanya gagal dan bisa diunggah ulang di detail job.`,
        uploaded === files.length ? 'success' : 'error',
      )
    }
  }

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

  function changeSelection(next: JobTypeSelection) {
    setSelection(next)
    setAgentMode(defaultAgentMode(next))
  }

  async function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    setSaving(true)
    setError('')
    try {
      // Agent opsional penuh: satu-satunya syarat submit adalah jenis job terpilih.
      // Pilihan kosong / nama agent baru kosong → job dibuat tanpa agent.
      let agentId: string | null = null
      let agentName = ''
      if (agentMode === 'existing' && selectedAgentId) {
        agentId = selectedAgentId
        agentName = agents.find((agent) => agent.id === agentId)?.name ?? ''
      } else if (agentMode === 'new' && newAgentName.trim()) {
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
      const job =
        selection === 'LOCAL'
          ? await createLocalJobInit(event.id, agentId)
          : await createInternationalJobInit({
              eventId: event.id,
              agentId,
              internationalJenis: selection,
            })
      await uploadDocuments(job.id)
      toast(
        agentName
          ? `Job (${jobTypeLabel(selection)}) dibuat untuk agent ${agentName}.`
          : `Job (${jobTypeLabel(selection)}) dibuat.`,
        'success',
      )
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
              Form Job Baru
            </h2>
            <p className="mt-1 text-sm text-slate-500">{event.officialName}</p>
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

          <section>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Agent <span className="font-normal normal-case tracking-normal">(opsional)</span>
              </h3>
            </div>
            <div className="mt-3 inline-flex rounded-lg bg-slate-100 p-1 text-sm font-medium" role="group" aria-label="Mode agent">
              {(
                [
                  ['existing', 'Agent tersimpan'],
                  ['new', 'Agent baru'],
                  ['none', 'Tanpa agent'],
                ] as Array<[AgentMode, string]>
              ).map(([mode, modeLabel]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAgentMode(mode)}
                  aria-pressed={agentMode === mode}
                  className={`rounded-md px-3 py-1.5 ${agentMode === mode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                >
                  {modeLabel}
                </button>
              ))}
            </div>
            {agentMode === 'existing' ? (
              <label className="label mt-3">
                <select
                  value={selectedAgentId}
                  onChange={(selectEvent) => setSelectedAgentId(selectEvent.target.value)}
                  className="input mt-1"
                  disabled={loading}
                >
                  <option value="">{loading ? 'Memuat agent...' : 'Pilih agent (opsional)...'}</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : agentMode === 'new' ? (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <label className="label sm:col-span-2">
                  Nama agent
                  <input
                    value={newAgentName}
                    onChange={(inputEvent) =>
                      setNewAgentName(inputEvent.target.value.toLocaleUpperCase('id-ID'))
                    }
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
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-black/15 px-4 py-3 text-sm text-slate-500">
                Job dibuat tanpa agent — exhibitor bertindak untuk dirinya sendiri. Exhibitor
                dilekatkan belakangan di detail job.
              </p>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Dokumen <span className="font-normal normal-case tracking-normal">(opsional)</span>
            </h3>
            <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-black/20 px-4 py-3 text-sm text-slate-500 hover:border-orange-300 hover:bg-orange-50">
              <span className="min-w-0 truncate">Unggah B/L, AWB, atau Invoice (PDF/Excel)</span>
              <Upload size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
              <input
                type="file"
                multiple
                accept={jobDocumentAccept}
                className="sr-only"
                onChange={(inputEvent) => {
                  addFiles(inputEvent.target.files)
                  inputEvent.target.value = ''
                }}
              />
            </label>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm text-slate-700"
                  >
                    <span className="min-w-0 truncate">
                      {file.name}
                      <span className="ml-2 text-xs text-slate-400">
                        {Math.max(1, Math.round(file.size / 1024))} KB
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                      aria-label={`Hapus ${file.name} dari daftar`}
                      className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 hover:text-black"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-slate-500">
              Dokumen diperiksa AI saat job dibuat — klasifikasi dan isinya (nomor, shipper,
              consignee, ETA) mengisi field job otomatis.
            </p>
          </section>
        </div>

        <div className="shrink-0 border-t px-6 py-4 sm:px-8">
          {error && <p className="mb-4 text-sm text-rose-700">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onCancel} className="btn-secondary">
              Batal
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Menyimpan...' : 'Buat job'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
