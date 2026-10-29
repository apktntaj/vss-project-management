import { redirect } from 'next/navigation'

import { requireCurrentUser } from '@/features/auth'
import { listEventInsights } from '@/features/events'
import type { EventInsights } from '@/domain/event/types'
import { ApiError } from '@/lib/server/errors'

import { DashboardOverview } from '@/app/(dashboard)/dashboard-overview'
import { EventInsightsPanel } from '@/features/events/components/event-insights-panel'
import { EventStatistics } from '@/features/events/components/event-statistics'

export const dynamic = 'force-dynamic'

/**
 * Dashboard = overview client (metrik, agenda, timeline via data-client) + laporan insight
 * server-side. Susunan mengikuti prioritas urgensi: metrik ringkas → "Perlu tindakan" (mendesak,
 * disisipkan lewat insightsSlot agar posisinya tepat di bawah metrik) → agenda & timeline →
 * statistik perencanaan (informatif, paling bawah). Gagal memuat insight TIDAK mematikan
 * overview — seksi insight dilewati saja.
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
        insightsSlot={insights ? <EventInsightsPanel insights={insights} /> : null}
      />
      {insights ? <EventStatistics insights={insights} /> : null}
    </div>
  )
}
