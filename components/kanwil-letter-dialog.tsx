'use client'

// Dialog isian per-surat untuk surat permohonan Kanwil: nomor, tanggal, dan salam pembuka opsional.
// Data pengusaha TPPB/penandatangan datang dari master Venue di server, bukan dari dialog ini.

import { useState, type FormEvent } from 'react'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Job } from '@/lib/data-client'
import { jobLabel } from '@/domain/job/numbering'

export type KanwilLetterFormInput = { letterNumber: string; letterDate: string; greeting: string | null }

// Hari ini menurut zona waktu lokal, bukan UTC.
function localToday(): string {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export function KanwilLetterDialog({
  job,
  onClose,
  onSubmit,
}: {
  job: Job
  onClose: () => void
  onSubmit: (input: KanwilLetterFormInput) => Promise<boolean>
}) {
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const greeting = String(form.get('greeting') ?? '').trim()
    setSaving(true)
    try {
      const ok = await onSubmit({
        letterNumber: String(form.get('letterNumber') ?? '').trim(),
        letterDate: String(form.get('letterDate') ?? ''),
        greeting: greeting || null,
      })
      if (ok) onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !saving) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Surat permohonan Kanwil</DialogTitle>
          <DialogDescription>
            {jobLabel(job)} · {job.party?.name ?? 'Pihak belum ditetapkan'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <label className="label">
            Nomor surat
            <input name="letterNumber" required maxLength={100} className="input" />
          </label>
          <label className="label">
            Tanggal surat
            <input name="letterDate" type="date" required defaultValue={localToday()} className="input" />
          </label>
          <label className="label">
            Salam pembuka <span className="font-normal text-slate-400">(opsional)</span>
            <textarea
              name="greeting"
              rows={3}
              maxLength={1000}
              placeholder="Mis. ucapan hari raya; kosongkan bila tidak perlu"
              className="input"
            />
          </label>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" disabled={saving} onClick={onClose}>
              Batal
            </button>
            <button className="btn-primary" disabled={saving}>
              {saving ? 'Membuat…' : 'Unduh PDF'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
