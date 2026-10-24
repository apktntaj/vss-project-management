'use client'

import { useState, type FormEvent } from 'react'
import { KeyRound } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { changePassword } from '@/lib/data-client'

function notify(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
}

export function ChangePasswordDialog() {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const currentPassword = String(form.get('currentPassword') ?? '')
    const newPassword = String(form.get('newPassword') ?? '')
    if (newPassword !== String(form.get('confirmPassword') ?? '')) {
      setError('Konfirmasi kata sandi baru tidak cocok.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await changePassword({ currentPassword, newPassword })
      setOpen(false)
      notify('Kata sandi berhasil diganti.', 'success')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Kata sandi tidak dapat diganti.'
      setError(message)
      notify(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setError('')
      }}
    >
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label="Ganti kata sandi"
            title="Ganti kata sandi"
            className="flex size-8 items-center justify-center rounded-full border border-black/10 text-slate-600 hover:bg-slate-100"
          />
        }
      >
        <KeyRound size={14} />
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ganti kata sandi</DialogTitle>
          <DialogDescription>
            Masukkan kata sandi saat ini, lalu kata sandi baru minimal 8 karakter.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <label className="label">
            Kata sandi saat ini
            <input name="currentPassword" type="password" required className="input" autoComplete="current-password" />
          </label>
          <label className="label">
            Kata sandi baru
            <input name="newPassword" type="password" required minLength={8} className="input" autoComplete="new-password" />
          </label>
          <label className="label">
            Ulangi kata sandi baru
            <input name="confirmPassword" type="password" required className="input" autoComplete="new-password" />
          </label>
          {error && <p className="text-sm font-medium text-rose-700">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Batal
            </button>
            <button disabled={saving} className="btn-primary">
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
