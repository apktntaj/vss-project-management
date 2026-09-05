import { AppShell } from '@/components/layout'
import { Providers } from '@/components/providers'
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <AppShell>{children}</AppShell>
    </Providers>
  )
}
