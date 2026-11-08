'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Save } from 'lucide-react'
import {
  getOperationalDetails,
  listAgents,
  saveJobOperationalDetails,
  type Agent,
  type Job,
  type JobDetailsInput,
} from '@/lib/data-client'
import {
  jobStatusLabels,
  jobStatuses,
  transportModeLabels,
  transportModes,
  type JobStatus,
  type TransportMode,
} from '@/domain/job/types'
import { parseJobNumber } from '@/domain/job/numbering'

// Editor header job di halaman detail. Simpan selalu patch SEMPIT lewat `saveJobOperationalDetails`
// lalu mengangkat job terbaru ke pemanggil (`onSaved` → `setJob`).

function notify(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
}

function FormActions({ saving, onCancel }: { saving: boolean; onCancel: () => void }) {
  return (
    <div className="mt-4 flex justify-end gap-2">
      <button type="button" onClick={onCancel} className="btn-secondary" disabled={saving}>
        Batal
      </button>
      <button className="btn-primary" disabled={saving}>
        <Save size={16} /> {saving ? 'Menyimpan…' : 'Simpan'}
      </button>
    </div>
  )
}

// --------------------------------------------------------------------------------------------
// Header job: No Job (diketik pengguna, diurai jadi urutan + akhiran invoice), moda, agent, ETA,
// dan status dalam satu form; dibuka sebagai dialog dari header halaman detail (bukan tab).
// --------------------------------------------------------------------------------------------

function HeaderForm({ job, onSaved, onCancel }: { job: Job; onSaved: (job: Job) => void; onCancel: () => void }) {
  const operational = getOperationalDetails(job)
  const currentAgentId = job.party?.kind === 'AGENT' ? job.party.id : ''
  // Agent dan exhibitor berbagi satu slot pihak: job berpihak exhibitor (atau Local) tidak diubah dari sini.
  const agentLocked = job.kind === 'LOCAL' || job.party?.kind === 'EXHIBITOR'
  const [jobNumberText, setJobNumberText] = useState(job.jobNumber ?? '')
  const [transportMode, setTransportMode] = useState<TransportMode | ''>(job.transportMode ?? '')
  const [agentId, setAgentId] = useState(currentAgentId)
  const [eta, setEta] = useState(operational.inbound.scheduleAt?.slice(0, 10) ?? '')
  const [status, setStatus] = useState<JobStatus>(job.status)
  const [agents, setAgents] = useState<Agent[]>([])
  const [saving, setSaving] = useState(false)
  const modeChanged = (transportMode || null) !== job.transportMode

  useEffect(() => {
    if (agentLocked) return
    listAgents()
      .then(setAgents)
      .catch(() => notify('Daftar agent tidak dapat dimuat.', 'error'))
  }, [agentLocked])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = parseJobNumber(jobNumberText)
    if (!parsed) {
      notify('No Job tidak dikenali. Gunakan bentuk S.01/NOMOR-INVOICE.', 'error')
      return
    }
    setSaving(true)
    let current = job
    try {
      // Awalan No Job diturunkan database dari moda + jenis job, jadi moda disimpan lebih dulu
      // agar awalan yang diketik bisa diperiksa terhadap awalan yang berlaku.
      if (modeChanged) {
        current = await saveJobOperationalDetails(current, { transportMode: transportMode || null })
        onSaved(current)
      }
      const patch: JobDetailsInput = {}
      if (status !== current.status) patch.status = status

      if (jobNumberText.trim() !== (job.jobNumber ?? '')) {
        const savedHint = modeChanged ? ' Moda sudah tersimpan.' : ''
        if (parsed.prefix && parsed.prefix !== current.manifestPrefix) {
          notify(
            current.manifestPrefix
              ? `Awalan ${parsed.prefix} tidak sesuai; awalan job ini ${current.manifestPrefix}.${savedHint}`
              : `Isi moda dulu untuk mendapatkan awalan No Job.${savedHint}`,
            'error',
          )
          return
        }
        if (parsed.seq !== current.manifestSeq) patch.manifestSeq = parsed.seq
        if (parsed.invoice !== null && parsed.invoice !== current.commercialInvoiceNumber) {
          patch.commercialInvoiceNumber = parsed.invoice
        }
      }
      if (!agentLocked && agentId !== currentAgentId) {
        patch.party = { agentId: agentId || null, exhibitorId: null }
      }
      if ((eta || null) !== (operational.inbound.scheduleAt?.slice(0, 10) ?? null)) {
        const base = getOperationalDetails(current)
        patch.operational = { ...base, inbound: { ...base.inbound, scheduleAt: eta || null } }
      }

      if (Object.keys(patch).length) current = await saveJobOperationalDetails(current, patch)
      if (current !== job) {
        notify('Job diperbarui.', 'success')
        onSaved(current)
      }
      onCancel()
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Job tidak dapat disimpan.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="label">
          No Job
          <input
            className="input mt-1"
            value={jobNumberText}
            placeholder={`${job.manifestPrefix ?? 'S'}.01/NOMOR-INVOICE`}
            onChange={(event) => setJobNumberText(event.target.value)}
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Urutan mengikuti barang yang datang lebih dulu, diisi manual.
            {job.manifestPrefix ? ` Awalan job ini: ${job.manifestPrefix}.` : ' Isi moda untuk mendapatkan awalan.'}
          </span>
        </label>
        <label className="label">
          Moda
          <select
            className="input mt-1"
            value={transportMode}
            disabled={job.internationalJenis === 'ROAD_SHIPMENT'}
            onChange={(event) => setTransportMode(event.target.value as TransportMode | '')}
          >
            <option value="">Belum diisi</option>
            {transportModes.map((mode) => (
              <option key={mode} value={mode}>
                {transportModeLabels[mode]}
              </option>
            ))}
          </select>
        </label>
        <label className="label">
          Agent
          <select
            className="input mt-1"
            value={agentId}
            disabled={agentLocked}
            onChange={(event) => setAgentId(event.target.value)}
          >
            <option value="">Tanpa agent</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
          {agentLocked ? (
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Pihak tagih job ini adalah exhibitor, jadi agent tidak dapat dipilih.
            </span>
          ) : null}
        </label>
        <label className="label">
          ETA
          <input
            type="date"
            className="input mt-1"
            value={eta}
            onChange={(event) => setEta(event.target.value)}
          />
        </label>
        <label className="label">
          Status Job
          <select
            className="input mt-1"
            value={status}
            onChange={(event) => setStatus(event.target.value as JobStatus)}
          >
            {jobStatuses.filter((value) => value !== 'CANCELLED').map((value) => (
              <option key={value} value={value}>
                {jobStatusLabels[value]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  )
}

export function JobHeaderDialog({
  job,
  open,
  onClose,
  onSaved,
}: {
  job: Job
  open: boolean
  onClose: () => void
  onSaved: (job: Job) => void
}) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-header-title"
        className="max-h-full w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
      >
        <h2 id="job-header-title" className="text-lg font-bold">
          Ubah header job
        </h2>
        <HeaderForm job={job} onSaved={onSaved} onCancel={onClose} />
      </div>
    </div>
  )
}
