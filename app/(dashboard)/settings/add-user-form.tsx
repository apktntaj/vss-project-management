'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { addUserAction, type AddUserState } from './actions'

const initialState: AddUserState = { error: null, success: null }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? 'Menyimpan…' : 'Tambah user'}
    </button>
  )
}

export function AddUserForm() {
  const [state, formAction] = useFormState(addUserAction, initialState)

  return (
    <form action={formAction} className="card space-y-4 p-5">
      <div>
        <h2 className="text-lg font-bold">Tambah user</h2>
        <p className="mt-1 text-sm text-slate-500">
          Data hanya hidup selama proses server berjalan.
        </p>
      </div>
      <div>
        <label htmlFor="nama" className="label">
          Nama
        </label>
        <input id="nama" name="nama" required className="input" />
      </div>
      <div>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input id="email" name="email" type="email" required className="input" />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input id="password" name="password" type="password" required className="input" />
      </div>
      <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
        <input
          name="isAdmin"
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-orange-600"
        />
        Berikan akses admin
      </label>
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}
      {state.success && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700"
        >
          {state.success}
        </p>
      )}
      <SubmitButton />
    </form>
  )
}
