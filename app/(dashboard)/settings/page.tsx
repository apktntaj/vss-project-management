import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { listDemoUsers } from '@/lib/demo-users'
import { AddUserForm } from './add-user-form'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (!session.user.isAdmin) redirect('/')

  const users = listDemoUsers()

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Administration</p>
        <h1 className="mt-2 text-4xl font-bold">Settings</h1>
        <p className="mt-2 text-sm text-slate-500">Pengaturan aplikasi dan akses akun demo.</p>
      </div>
      <section>
        <div className="mb-4">
          <h2 className="text-2xl font-bold">Manajemen user</h2>
          <p className="mt-1 text-sm text-slate-500">Kelola akun demo dan hak akses admin.</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="card overflow-hidden">
            <div className="border-b border-black/10 px-5 py-4">
              <h3 className="font-bold">Daftar user ({users.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Nama</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Akses</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {users.map((user) => (
                    <tr key={user.email}>
                      <td className="px-5 py-4 font-medium">{user.nama}</td>
                      <td className="px-5 py-4 text-slate-600">{user.email}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.isAdmin ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-700'}`}
                        >
                          {user.isAdmin ? 'Admin' : 'User'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <AddUserForm />
        </div>
      </section>
    </div>
  )
}
