import { redirect } from 'next/navigation'
import { auth } from '@/features/auth'
import { SettingsManager } from './settings-manager'
import { ChangePasswordForm } from './change-password-form'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const isAdmin = Boolean(session.user.isAdmin)

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">{isAdmin ? 'Administration' : 'Akun'}</p>
        <h1 className="mt-2 text-4xl font-bold">Settings</h1>
        <p className="mt-2 text-sm text-slate-500">
          {isAdmin ? 'Kelola user, venue, dan event organizer.' : 'Kelola akun Anda.'}
        </p>
      </div>
      <section className="card overflow-hidden">
        <div className="border-b border-black/10 px-5 py-4">
          <h2 className="text-xl font-bold">Akun</h2>
          <p className="mt-1 text-sm text-slate-500">Ganti kata sandi akun Anda.</p>
        </div>
        <div className="px-5 py-5">
          <ChangePasswordForm />
        </div>
      </section>
      {isAdmin && <SettingsManager currentUserId={session.user.id} />}
    </div>
  )
}
