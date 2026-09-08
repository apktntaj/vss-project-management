import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { MOCK_USERS } from '@/lib/demo-users'
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
          <p className="font-semibold">Kredensial mock</p>
          <div className="mt-2 space-y-2">
            {MOCK_USERS.map((user) => (
              <div key={user.email}>
                <p className="font-medium">
                  {user.nama} {user.isAdmin ? '(Admin)' : ''}
                </p>
                <p className="text-xs text-blue-800">
                  {user.email} / {user.password}
                </p>
              </div>
            ))}
          </div>
        </div>
        <LoginForm email={MOCK_USERS[0].email} password={MOCK_USERS[0].password} />
      </div>
    </main>
  )
}
