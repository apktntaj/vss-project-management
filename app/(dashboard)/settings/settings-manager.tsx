'use client'

import { useEffect, useState, type FormEvent } from 'react'
import {
  createSettingsRecord,
  getSettingsData,
  updateSettingsRecord,
  type SettingsData,
  type SettingsOrganizer,
  type SettingsUser,
  type SettingsVenue,
} from '@/lib/data-client'
import { CeisaConnectionSettings } from '@/components/ceisa/connection-settings'

type Editor = { resource: 'users' | 'venues' | 'organizers'; id?: string } | null

function notify(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
}

function text(form: FormData, name: string) {
  return String(form.get(name) ?? '').trim()
}

function nullable(form: FormData, name: string) {
  const value = text(form, name)
  return value || null
}

export function SettingsManager() {
  const [data, setData] = useState<SettingsData | null>(null)
  const [editor, setEditor] = useState<Editor>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getSettingsData()
      .then(setData)
      .catch((caught) => {
        const message = caught instanceof Error ? caught.message : 'Pengaturan tidak dapat dimuat.'
        setError(message)
        notify(message, 'error')
      })
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editor) return
    const form = new FormData(event.currentTarget)
    const isUser = editor.resource === 'users'
    const input = isUser
      ? {
          nama: text(form, 'nama'),
          email: text(form, 'email'),
          password: text(form, 'password') || undefined,
          isAdmin: form.get('isAdmin') === 'on',
        }
      : editor.resource === 'venues'
        ? {
            name: text(form, 'name'), contacts: [], address: nullable(form, 'address'), website: nullable(form, 'website'), loadingAccessNotes: nullable(form, 'loadingAccessNotes'),
          }
        : {
            name: text(form, 'name'), npwp: nullable(form, 'npwp'), contacts: [], address: nullable(form, 'address'), website: nullable(form, 'website'),
          }
    if (isUser && !editor.id && !input.password) {
      setError('Password wajib diisi untuk user baru.')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (editor.id) {
        await updateSettingsRecord(editor.resource, editor.id, input)
      } else {
        await createSettingsRecord(editor.resource, input)
      }
      const updated = await getSettingsData()
      setData(updated)
      setEditor(null)
      notify(`${editor.resource === 'users' ? 'User' : editor.resource === 'venues' ? 'Venue' : 'Event organizer'} berhasil ${editor.id ? 'diperbarui' : 'ditambahkan'}.`, 'success')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Pengaturan tidak dapat disimpan.'
      setError(message)
      notify(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!data) return <div className="card p-6 text-sm text-slate-500">Memuat pengaturan…</div>
  const selectedUser = editor?.resource === 'users' && editor.id ? data.users.find((user) => user.id === editor.id) : undefined
  const selectedVenue = editor?.resource === 'venues' && editor.id ? data.venues.find((venue) => venue.id === editor.id) : undefined
  const selectedOrganizer = editor?.resource === 'organizers' && editor.id ? data.organizers.find((organizer) => organizer.id === editor.id) : undefined

  return (
    <div className="space-y-8">
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-black/10 px-5 py-4"><div><h2 className="text-xl font-bold">Manajemen user</h2><p className="mt-1 text-sm text-slate-500">Tambah dan perbarui akses akun.</p></div><button className="btn-primary" onClick={() => setEditor({ resource: 'users' })}>Tambah user</button></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Nama</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">Akses</th><th className="px-5 py-3" /></tr></thead><tbody className="divide-y divide-black/5">{data.users.map((user) => <tr key={user.id}><td className="px-5 py-4 font-medium">{user.nama}</td><td className="px-5 py-4 text-slate-600">{user.email}</td><td className="px-5 py-4">{user.isAdmin ? 'Admin' : 'User'}</td><td className="px-5 py-4 text-right"><button className="text-sm font-semibold text-orange-700" onClick={() => setEditor({ resource: 'users', id: user.id })}>Edit</button></td></tr>)}</tbody></table></div>
      </section>
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-black/10 px-5 py-4"><div><h2 className="text-xl font-bold">Venue</h2><p className="mt-1 text-sm text-slate-500">Kelola venue yang dipilih saat membuat event.</p></div><button className="btn-primary" onClick={() => setEditor({ resource: 'venues' })}>Tambah venue</button></div>
        <div className="divide-y divide-black/5">{data.venues.length ? data.venues.map((venue) => <div key={venue.id} className="flex items-center justify-between gap-4 px-5 py-4"><div><p className="font-medium">{venue.name}</p><p className="text-sm text-slate-500">{venue.address ?? 'Alamat belum diisi'}</p></div><button className="text-sm font-semibold text-orange-700" onClick={() => setEditor({ resource: 'venues', id: venue.id })}>Edit</button></div>) : <p className="px-5 py-6 text-sm text-slate-500">Belum ada venue.</p>}</div>
      </section>
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-black/10 px-5 py-4"><div><h2 className="text-xl font-bold">Event organizer</h2><p className="mt-1 text-sm text-slate-500">Kelola penyelenggara event.</p></div><button className="btn-primary" onClick={() => setEditor({ resource: 'organizers' })}>Tambah organizer</button></div>
        <div className="divide-y divide-black/5">{data.organizers.length ? data.organizers.map((organizer) => <div key={organizer.id} className="flex items-center justify-between gap-4 px-5 py-4"><div><p className="font-medium">{organizer.name}</p><p className="text-sm text-slate-500">{organizer.npwp ?? 'NPWP belum diisi'}</p></div><button className="text-sm font-semibold text-orange-700" onClick={() => setEditor({ resource: 'organizers', id: organizer.id })}>Edit</button></div>) : <p className="px-5 py-6 text-sm text-slate-500">Belum ada event organizer.</p>}</div>
      </section>
      <CeisaConnectionSettings />
      {editor && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><form onSubmit={submit} className="card w-full max-w-xl space-y-4 p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold">{editor.id ? 'Edit' : 'Tambah'} {editor.resource === 'users' ? 'user' : editor.resource === 'venues' ? 'venue' : 'event organizer'}</h2><p className="mt-1 text-sm text-slate-500">Field bertanda wajib harus diisi.</p></div><button type="button" className="btn-secondary" onClick={() => { setEditor(null); setError('') }}>Tutup</button></div>{editor.resource === 'users' ? <><label className="label">Nama<input name="nama" required defaultValue={selectedUser?.nama} className="input" /></label><label className="label">Email<input name="email" type="email" required defaultValue={selectedUser?.email} className="input" /></label><label className="label">Password<input name="password" type="password" required={!editor.id} className="input" /></label><label className="flex items-center gap-3 text-sm font-medium"><input name="isAdmin" type="checkbox" defaultChecked={selectedUser?.isAdmin} />Akses admin</label></> : editor.resource === 'venues' ? <><label className="label">Nama venue<input name="name" required defaultValue={selectedVenue?.name} className="input" /></label><label className="label">Alamat<textarea name="address" defaultValue={selectedVenue?.address ?? ''} className="input min-h-20" /></label><label className="label">Website<input name="website" type="url" defaultValue={selectedVenue?.website ?? ''} className="input" /></label><label className="label">Catatan akses loading<textarea name="loadingAccessNotes" defaultValue={selectedVenue?.loadingAccessNotes ?? ''} className="input min-h-20" /></label></> : <><label className="label">Nama organizer<input name="name" required defaultValue={selectedOrganizer?.name} className="input" /></label><label className="label">NPWP<input name="npwp" defaultValue={selectedOrganizer?.npwp ?? ''} className="input" /></label><label className="label">Alamat<textarea name="address" defaultValue={selectedOrganizer?.address ?? ''} className="input min-h-20" /></label><label className="label">Website<input name="website" type="url" defaultValue={selectedOrganizer?.website ?? ''} className="input" /></label></>}{error && <p className="text-sm font-medium text-rose-700">{error}</p>}<div className="flex justify-end gap-3"><button type="button" className="btn-secondary" onClick={() => { setEditor(null); setError('') }}>Batal</button><button disabled={saving} className="btn-primary">{saving ? 'Menyimpan…' : 'Simpan'}</button></div></form></div>}
    </div>
  )
}
