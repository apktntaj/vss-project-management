'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { loginAction, type LoginState } from './actions'

const initialState: LoginState = { error: null }

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button type="submit" disabled={pending} className="btn-primary mt-6 w-full">
      {pending ? 'Memeriksa akun…' : 'Masuk ke aplikasi'}
    </button>
  )
}

export function LoginForm({ email, password }: { email: string; password: string }) {
  const [state, formAction] = useFormState(loginAction, initialState)

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={email}
          autoComplete="username"
          required
          className="input"
        />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          defaultValue={password}
          autoComplete="current-password"
          required
          className="input"
        />
      </div>
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}
      <SubmitButton />
    </form>
  )
}
