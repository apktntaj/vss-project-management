// Exhibitor = pihak bisnis per event (keputusan 2026-11-02). Ia punya identitas sendiri karena
// bisa membayar (job local) dan memegang road shipment; barang-barangnya tercatat lewat baris
// CIPL di job-job yang membawanya. Agent TIDAK disimpan di exhibitor — hubungan agent ↔ exhibitor
// terbaca dari job.

export const exhibitorKinds = ['LOCAL', 'INTERNATIONAL'] as const
export type ExhibitorKind = (typeof exhibitorKinds)[number]

export const exhibitorKindLabels: Record<ExhibitorKind, string> = {
  LOCAL: 'Lokal',
  INTERNATIONAL: 'Internasional',
}

export type ExhibitorContact = {
  name: string | null
  role: string | null
  email: string | null
  phone: string | null
}

export type Exhibitor = {
  id: string
  eventId: string
  kind: ExhibitorKind
  name: string
  /** Hanya exhibitor lokal yang punya NPWP. */
  npwp: string | null
  contact: ExhibitorContact
  hall: string | null
  booth: string | null
  createdAt: string
  updatedAt: string
}
