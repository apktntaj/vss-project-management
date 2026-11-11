import { redirect } from 'next/navigation'

import { requireCurrentUser } from '@/features/auth'
import { listEventInsights } from '@/features/events'
import type { EventInsights } from '@/domain/event/types'
import { ApiError } from '@/lib/server/errors'

import { DashboardOverview } from '@/app/(dashboard)/dashboard-overview'
import {
  EventArchiveCandidates,
  EventInsightsPanel,
} from '@/features/events/components/event-insights-panel'
import { EventStatistics } from '@/features/events/components/event-statistics'

export const dynamic = 'force-dynamic'

/**
 * Dashboard = overview client (metrik via data-client) + laporan insight server-side.
 * Susunan mengikuti prioritas urgensi: metrik ringkas → "Perlu tindakan" (disisipkan lewat
 * insightsSlot agar posisinya tepat di bawah metrik) → statistik perencanaan dan
 * kandidat arsip (informatif, paling bawah). Gagal memuat insight TIDAK mematikan overview —
 * seksi insight diganti pemberitahuan agar tidak terbaca sebagai "tidak ada masalah".
 */
export default async function DashboardPage() {
  let insights: EventInsights | null = null
  try {
    const currentUser = await requireCurrentUser()
    insights = await listEventInsights(currentUser)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/login')
  }

  return (
    <div className="flex flex-col gap-7">
      <DashboardOverview
        insightsSlot={
          insights ? (
            <EventInsightsPanel insights={insights} />
          ) : (
            <section className="card p-5 sm:p-6" role="alert" aria-label="Perlu tindakan">
              <h2 className="text-lg font-semibold tracking-tight">Perlu tindakan</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Daftar tindakan belum dapat dimuat. Muat ulang halaman untuk mencoba lagi.
              </p>
            </section>
          )
        }
      />
      {insights ? (
        <>
          <EventStatistics insights={insights} />
          <EventArchiveCandidates insights={insights} />
        </>
      ) : null}
    </div>
  )
}
