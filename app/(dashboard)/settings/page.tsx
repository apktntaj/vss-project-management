import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { SettingsManager } from './settings-manager'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (!session.user.isAdmin) redirect('/')

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Administration</p>
        <h1 className="mt-2 text-4xl font-bold">Settings</h1>
        <p className="mt-2 text-sm text-slate-500">
          Kelola user, venue, dan event organizer.
        </p>
      </div>
      <SettingsManager />
    </div>
  )
}
