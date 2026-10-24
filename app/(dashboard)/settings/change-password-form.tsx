'use client'

import { useState, type FormEvent } from 'react'
import { changePassword } from '@/lib/data-client'

function notify(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
}

export function ChangePasswordForm() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const currentPassword = String(data.get('currentPassword') ?? '')
    const newPassword = String(data.get('newPassword') ?? '')
    if (newPassword !== String(data.get('confirmPassword') ?? '')) {
      setError('Konfirmasi kata sandi baru tidak cocok.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await changePassword({ currentPassword, newPassword })
      form.reset()
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
    <form onSubmit={submit} className="max-w-md space-y-4">
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
      <div className="flex justify-end">
        <button disabled={saving} className="btn-primary">
          {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </form>
  )
}
