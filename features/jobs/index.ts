// Batas publik slice job untuk konsumen SISI SERVER (route handler). Efektif server-only karena
// mere-export use-case `import 'server-only'` — jangan diimpor dari file `'use client'`.

export { listJobsForUser, getJob } from '@/features/jobs/use-cases/read-jobs'
export { createJob } from '@/features/jobs/use-cases/create-job'
export {
  applyJobExtraction,
  saveJobCipl,
  saveJobInvoice,
  saveJobInward,
  saveJobKepulangan,
  updateJobDetails,
} from '@/features/jobs/use-cases/update-job'
export { cancelJob } from '@/features/jobs/use-cases/cancel-job'
export { assertJobAcceptsAttachments } from '@/features/jobs/use-cases/job-guards'
export { loadKanwilDocumentContext } from '@/features/jobs/use-cases/kanwil-documents'
