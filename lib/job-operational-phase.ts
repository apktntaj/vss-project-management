export type JobOperationalPhaseId =
  | 'DRAFT'
  | 'PREPARE'
  | 'SUBMIT'
  | 'PROCESSING'
  | 'RELEASE'
  | 'COMPLETED'
  | 'ON_HOLD'
  | 'CANCELLED'

type LegacyJobStatus = 'DRAFT' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED'
type CiplStatus = 'MISSING' | 'REQUESTED' | 'RECEIVED' | 'VERIFIED'
type CustomsDocumentStatus = 'NOT_STARTED' | 'PREPARING' | 'SUBMITTED' | 'REGISTERED' | 'RELEASED' | 'COMPLETED' | 'ON_HOLD'

export type JobOperationalPhaseInput = {
  status: LegacyJobStatus
  hasInboundDocument: boolean
  hasInvoice: boolean
  ciplStatus: CiplStatus
  customsDocuments: ReadonlyArray<{ applicable: boolean; status: CustomsDocumentStatus }>
}

export type JobOperationalPhase = {
  id: JobOperationalPhaseId
  label: string
  description: string
  nextAction: string
}

export const jobOperationalPhases: ReadonlyArray<JobOperationalPhase> = [
  { id: 'DRAFT', label: 'Draft', description: 'Menunggu dokumen utama', nextAction: 'Lengkapi dokumen' },
  { id: 'PREPARE', label: 'Prepare', description: 'Dokumen sedang diperiksa', nextAction: 'Periksa dokumen' },
  { id: 'SUBMIT', label: 'Siap submit', description: 'Siap diajukan ke pabean', nextAction: 'Submit pabean' },
  { id: 'PROCESSING', label: 'Proses pabean', description: 'Menunggu proses atau pendaftaran', nextAction: 'Pantau pabean' },
  { id: 'RELEASE', label: 'Release', description: 'Menunggu penyelesaian release', nextAction: 'Konfirmasi release' },
  { id: 'COMPLETED', label: 'Selesai', description: 'Operasi telah selesai', nextAction: 'Buka job' },
]

const phasesById = new Map(jobOperationalPhases.map((phase) => [phase.id, phase]))

function phase(id: Exclude<JobOperationalPhaseId, 'ON_HOLD' | 'CANCELLED'>): JobOperationalPhase {
  return phasesById.get(id)!
}

export function getJobOperationalPhase(job: JobOperationalPhaseInput): JobOperationalPhase {
  if (job.status === 'ON_HOLD' || job.customsDocuments.some((document) => document.applicable && document.status === 'ON_HOLD')) {
    return { id: 'ON_HOLD', label: 'Ditahan', description: 'Memerlukan tindak lanjut', nextAction: 'Buka job' }
  }
  if (job.status === 'CANCELLED') {
    return { id: 'CANCELLED', label: 'Dibatalkan', description: 'Job telah dibatalkan', nextAction: 'Buka job' }
  }
  if (job.status === 'COMPLETED') return phase('COMPLETED')
  if (!job.hasInboundDocument || !job.hasInvoice) {
    const nextAction = !job.hasInboundDocument && !job.hasInvoice
      ? 'Menunggu B/L/AWB dan Invoice'
      : !job.hasInboundDocument ? 'Menunggu B/L/AWB' : 'Menunggu Invoice'
    return { ...phase('DRAFT'), nextAction }
  }
  if (job.ciplStatus !== 'VERIFIED') return phase('PREPARE')

  const applicableDocuments = job.customsDocuments.filter((document) => document.applicable)
  if (applicableDocuments.some((document) => document.status === 'NOT_STARTED' || document.status === 'PREPARING')) return phase('SUBMIT')
  if (applicableDocuments.some((document) => document.status === 'SUBMITTED' || document.status === 'REGISTERED')) return phase('PROCESSING')
  if (applicableDocuments.some((document) => document.status === 'RELEASED')) return phase('RELEASE')
  return phase('COMPLETED')
}
