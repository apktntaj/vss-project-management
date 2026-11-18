'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
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
import { notify } from '@/lib/notify'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// Editor header job di halaman detail. Simpan selalu patch SEMPIT lewat `saveJobOperationalDetails`
// lalu mengangkat job terbaru ke pemanggil (`onSaved` → `setJob`).

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

function HeaderForm({
  job,
  onSaved,
  onCancel,
}: {
  job: Job
  onSaved: (job: Job) => void
  onCancel: () => void
}) {
  const operational = getOperationalDetails(job)
  const currentAgentId = job.party?.kind === 'AGENT' ? job.party.id : ''
  // Hanya job Local yang terkunci (aturan server/DB). Job tanpa agent yang pihaknya sudah terisi
  // exhibitor (otomatis dari CIPL) tetap boleh diberi agent; agent menggantikan exhibitor itu.
  const agentLocked = job.kind === 'LOCAL'
  const [jobNumberText, setJobNumberText] = useState(job.jobNumber ?? '')
  const [transportMode, setTransportMode] = useState<TransportMode | ''>(job.transportMode ?? '')
  const [agentId, setAgentId] = useState(currentAgentId)
  const [eta, setEta] = useState(operational.inbound.scheduleAt?.slice(0, 10) ?? '')
  const [status, setStatus] = useState<JobStatus>(job.status)
  const [agents, setAgents] = useState<Agent[]>([])
  const [saving, setSaving] = useState(false)
  // Kesalahan No Job tampil tepat di bawah field-nya (bukan toast): toast hanya untuk hasil simpan.
  const [jobNumberError, setJobNumberError] = useState('')
  const jobNumberRef = useRef<HTMLInputElement>(null)
  const failJobNumber = (message: string) => {
    setJobNumberError(message)
    jobNumberRef.current?.focus()
  }
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
      failJobNumber('No Job tidak dikenali. Gunakan bentuk S.01/NOMOR-INVOICE.')
      return
    }
    setJobNumberError('')
    setSaving(true)
    let current = job
    try {
      // Awalan No Job diturunkan database dari moda + jenis job, jadi moda disimpan lebih dulu
      // agar awalan yang diketik bisa diperiksa terhadap awalan yang berlaku.
      if (modeChanged) {
        current = await saveJobOperationalDetails(current, { transportMode: transportMode || null })
        onSaved(current)
        notify('Moda job disimpan.', 'success')
      }
      const patch: JobDetailsInput = {}
      if (status !== current.status) patch.status = status

      if (jobNumberText.trim() !== (job.jobNumber ?? '')) {
        if (parsed.prefix && parsed.prefix !== current.manifestPrefix) {
          failJobNumber(
            current.manifestPrefix
              ? `Awalan ${parsed.prefix} tidak sesuai; awalan job ini ${current.manifestPrefix}.`
              : 'Isi moda dulu untuk mendapatkan awalan No Job.',
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
            ref={jobNumberRef}
            id="job-number-input"
            className={`input mt-1 ${jobNumberError ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-100' : ''}`}
            value={jobNumberText}
            placeholder={`${job.manifestPrefix ?? 'S'}.01/NOMOR-INVOICE`}
            disabled={job.sourceJobId != null}
            aria-invalid={jobNumberError ? true : undefined}
            aria-describedby={jobNumberError ? 'job-number-error' : undefined}
            onChange={(event) => {
              setJobNumberText(event.target.value)
              if (jobNumberError) setJobNumberError('')
            }}
          />
          {jobNumberError ? (
            <span id="job-number-error" className="mt-1 block text-xs font-normal text-rose-700">
              {jobNumberError}
            </span>
          ) : null}
          {job.sourceJobId != null && (
            <span className="mt-1 block text-xs font-normal text-slate-600">
              Mengikuti job masuk (BC 2.3).
            </span>
          )}
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
            <span className="mt-1 block text-xs font-normal text-slate-600">
              Job Local selalu dipegang exhibitor.
            </span>
          ) : null}
        </label>
        {!job.sourceJobId && (
          <label className="label">
            ETA
            <input
              type="date"
              className="input mt-1"
              value={eta}
              onChange={(event) => setEta(event.target.value)}
            />
          </label>
        )}
        <label className="label">
          Status Job
          <select
            className="input mt-1"
            value={status}
            onChange={(event) => setStatus(event.target.value as JobStatus)}
          >
            {jobStatuses
              .filter((value) => value !== 'CANCELLED')
              .map((value) => (
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
  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-1rem)] overflow-y-auto sm:max-w-2xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Ubah header job</DialogTitle>
          <DialogDescription>No Job, moda, agent, ETA, dan status job.</DialogDescription>
        </DialogHeader>
        <HeaderForm job={job} onSaved={onSaved} onCancel={onClose} />
      </DialogContent>
    </Dialog>
  )
}
