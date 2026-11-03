import { redirect } from 'next/navigation'
import { auth } from '@/features/auth'
import { AppShell } from '@/components/layout'
import { Providers } from '@/components/providers'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return (
    <Providers session={session}>
      <AppShell user={session.user}>{children}</AppShell>
    </Providers>
  )
}
