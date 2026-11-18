'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Ban } from 'lucide-react'

import { cancelJob, type Job } from '@/lib/data-client'
import { notify } from '@/lib/notify'
import { jobLabel } from '@/domain/job/numbering'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

// Dialog pembatalan job — dipakai halaman detail job dan halaman event (menu baris job). Job tidak
// pernah dihapus: dibatalkan dengan alasan wajib, lalu tidak dapat diubah lagi. Pemanggil memegang
// state `open`; pembaruan tampilan lewat `onCancelled` (job hasil batal dari server). Memakai
// `ui/dialog` (fokus terjebak, Esc, pengembalian fokus); formulirnya dipasang hanya saat terbuka
// sehingga isian alasan selalu mulai kosong.

const MAX_REASON = 1000

function CancelForm({
  job,
  saving,
  setSaving,
  onClose,
  onCancelled,
}: {
  job: Job
  saving: boolean
  setSaving: (saving: boolean) => void
  onClose: () => void
  onCancelled: (job: Job) => void
}) {
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = reason.trim()
    if (!trimmed) {
      setReasonError('Alasan pembatalan wajib diisi.')
      return
    }
    setSaving(true)
    try {
      onCancelled(await cancelJob(job, trimmed))
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Job tidak dapat dibatalkan.', 'error')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
          <Ban size={22} aria-hidden="true" />
        </div>
        <div>
          <DialogTitle className="text-lg leading-tight font-bold">Batalkan job?</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-6 text-slate-600">
            <span className="font-semibold">{jobLabel(job)}</span> akan dibatalkan. Job tidak
            dihapus, tetapi setelah dibatalkan tidak dapat diubah lagi dan tidak dapat diaktifkan
            kembali.
          </DialogDescription>
        </div>
      </div>
      <label className="label mt-5 block">
        Alasan pembatalan
        <textarea
          autoFocus
          rows={4}
          maxLength={MAX_REASON}
          value={reason}
          disabled={saving}
          onChange={(event) => {
            setReason(event.target.value)
            if (reasonError) setReasonError('')
          }}
          aria-invalid={reasonError ? true : undefined}
          aria-describedby={reasonError ? 'cancel-job-reason-error' : undefined}
          placeholder="Mis. klien membatalkan pengiriman"
          className="input mt-1 min-h-24 w-full"
        />
      </label>
      {reasonError ? (
        <p id="cancel-job-reason-error" role="alert" className="mt-1 text-xs text-rose-700">
          {reasonError}
        </p>
      ) : null}
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onClose} disabled={saving} className="btn-secondary">
          Kembali
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
        >
          {saving ? 'Membatalkan...' : 'Batalkan job'}
        </button>
      </div>
    </form>
  )
}

export function CancelJobDialog({
  job,
  open,
  onClose,
  onCancelled,
}: {
  job: Job
  open: boolean
  onClose: () => void
  onCancelled: (job: Job) => void
}) {
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!open) setSaving(false)
  }, [open])
  return (
    <Dialog open={open} onOpenChange={(next) => (!next && !saving ? onClose() : undefined)}>
      <DialogContent
        role="alertdialog"
        showCloseButton={false}
        className="w-[calc(100%-1rem)] border-rose-200 p-6 sm:max-w-md"
      >
        <CancelForm
          job={job}
          saving={saving}
          setSaving={setSaving}
          onClose={onClose}
          onCancelled={onCancelled}
        />
      </DialogContent>
    </Dialog>
  )
}
