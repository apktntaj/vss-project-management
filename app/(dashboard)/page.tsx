import { redirect } from 'next/navigation'

import { requireCurrentUser } from '@/features/auth'
import { getDashboard, type DashboardData } from '@/features/dashboard'
import { ApiError } from '@/lib/server/errors'

import { DashboardOverview } from '@/app/(dashboard)/dashboard-overview'
import { DashboardVenueActivity } from '@/app/(dashboard)/dashboard-venue-activity'
import { EventStatistics } from '@/features/events/components/event-statistics'

export const dynamic = 'force-dynamic'

/**
 * Dashboard operasional — sepenuhnya Server Component dari SATU bacaan data (`getDashboard`:
 * satu kali `jobs`, satu kali event ACTIVE): judul → statistik event → venue activity → event
 * belum ada job → ETA dekat dokumen kurang → ETA belum diisi → bobot event (`DashboardOverview`).
 * Gagal memuat → satu kartu peringatan, bukan data parsial.
 */
export default async function DashboardPage() {
  let data: DashboardData | null = null
  try {
    const currentUser = await requireCurrentUser()
    data = await getDashboard(currentUser)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/login')
  }

  if (data === null) {
    return (
      <section className="card p-8" role="alert">
        <h1 className="text-xl font-semibold">Dashboard belum dapat dimuat</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Muat ulang halaman untuk mencoba lagi.
        </p>
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-7">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <EventStatistics insights={data.insights} />
      <DashboardVenueActivity today={data.today} events={data.insights.venueEvents} />
      <DashboardOverview today={data.today} operations={data.operations} />
    </div>
  )
}
