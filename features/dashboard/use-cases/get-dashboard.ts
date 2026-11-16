import 'server-only'

// Use-case dashboard: tabel `jobs` dibaca sekali (`listJobs({})`) untuk `buildOperationsDashboard`;
// event ACTIVE dibaca sekali oleh `queryEventInsights` (insight + jadwal). Keduanya paralel.
// Otorisasi DULU (semua peran punya `event:read` + `job:read`); error apa pun merambat agar
// halaman menampilkan kegagalan, bukan data parsial.

import { authorize } from '@/features/auth'
import { queryEventInsights, serverToday } from '@/features/events/repository'
import { listJobs } from '@/features/jobs/repository'
import { buildOperationsDashboard, type OperationsDashboard } from '@/lib/dashboard'
import type { EventInsights } from '@/domain/event/types'
import type { CurrentUser } from '@/domain/auth/types'

export type DashboardData = {
  today: string
  operations: OperationsDashboard
  insights: EventInsights
}

export async function getDashboard(currentUser: CurrentUser): Promise<DashboardData> {
  await authorize(currentUser, 'event:read')
  await authorize(currentUser, 'job:read')

  const today = serverToday()
  const [jobs, { insights, events }] = await Promise.all([listJobs({}), queryEventInsights()])
  return {
    today,
    insights,
    operations: buildOperationsDashboard({ jobs, events, today }),
  }
}
