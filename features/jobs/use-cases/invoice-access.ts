import 'server-only'

// Mengapa: tagihan job (`Job.invoice`) hanya boleh dibaca FINANCE (dan admin). `toJob()` di
// repository tidak mengenal pengguna, jadi redaksi dilakukan di use-case pada SEMUA jalur yang
// mengembalikan `Job` utuh (baca + hasil tulis). Placeholder netral `NOT_READY` dipakai alih-alih
// membuat `Job.invoice` nullable agar tipe tidak merembet ke seluruh konsumen job.

import { can } from '@/features/auth'
import type { CurrentUser } from '@/domain/auth/types'
import type { Job, JobInvoice } from '@/domain/job/types'

const REDACTED_INVOICE: JobInvoice = {
  number: null,
  amount: null,
  currency: null,
  status: 'NOT_READY',
  sentAt: null,
  paidAt: null,
}

export function canReadInvoice(currentUser: CurrentUser): boolean {
  return currentUser.isAdmin || can(currentUser.role, 'job:invoice:read')
}

/** Kembalikan `job` apa adanya untuk pembaca tagihan; selain itu dengan tagihan dinetralkan. */
export function redactJobInvoice(currentUser: CurrentUser, job: Job): Job {
  return canReadInvoice(currentUser) ? job : { ...job, invoice: REDACTED_INVOICE }
}
