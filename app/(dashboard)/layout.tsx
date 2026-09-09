import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { AppShell } from '@/components/layout'
import { Providers } from '@/components/providers'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return (
    <Providers>
      <AppShell user={session.user}>{children}</AppShell>
    </Providers>
  )
}
