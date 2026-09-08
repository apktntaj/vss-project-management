import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { DEMO_USER } from '@/lib/demo-users'
import { LoginForm } from './login-form'

export default async function LoginPage() {
  const session = await auth()
  if (session?.user) redirect('/')

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 p-5">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <p className="text-sm font-bold uppercase tracking-widest text-blue-700">
          VSS Project Management
        </p>
        <h1 className="mt-3 text-2xl font-bold">Masuk ke akun demo</h1>
        <p className="mt-2 text-sm text-black/50">
          Autentikasi menggunakan sesi NextAuth. Akun demo tidak disimpan di IndexedDB atau database
          eksternal.
        </p>
        <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950">
          <p className="font-semibold">Kredensial demo</p>
          <p className="mt-1">
            <span className="text-blue-700">Email:</span> {DEMO_USER.email}
          </p>
          <p>
            <span className="text-blue-700">Password:</span> {DEMO_USER.password}
          </p>
        </div>
        <LoginForm email={DEMO_USER.email} password={DEMO_USER.password} />
      </div>
    </main>
  )
}
