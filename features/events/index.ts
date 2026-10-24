// Mengapa: barrel tipis yang mengekspos batas publik slice event ke konsumen SISI SERVER (route
// handler + Server Component). Karena ia mere-export use-case dan repository yang `import 'server-only'`,
// index.ts ini sendiri EFEKTIF server-only — JANGAN mengimpornya dari file `'use client'` mana pun
// (leaf klien melakukan mutasi lewat `fetch('/api/events')`, bukan memanggil use-case langsung).
// Satu pintu masuk agar konsumen tidak menjangkau file use-case/repository internal satu per satu.

// Use-case tulis (orkestrasi + AuthZ + invariant server).
export { createEvent } from '@/features/events/use-cases/create-event'
export { updateEvent } from '@/features/events/use-cases/update-event'
export { cancelEvent } from '@/features/events/use-cases/cancel-event'
export { deleteEvent } from '@/features/events/use-cases/delete-event'
export { archiveEvent } from '@/features/events/use-cases/archive-event'

// Use-case baca (dipakai Server Component dashboard + EventCard).
export { listEventsForDashboard } from '@/features/events/use-cases/list-events-for-dashboard'
export { getEventSummary } from '@/features/events/use-cases/get-event-summary'

// Use-case master data venue/EO (create-inline + select existing, Req 12). Tulis menegakkan
// `reference:create`; baca menegakkan `event:read`.
export { createVenue } from '@/features/events/use-cases/create-venue'
export { createEventOrganizer } from '@/features/events/use-cases/create-event-organizer'
export {
  listVenueReferences,
  listEventOrganizerReferences,
  listUserReferences,
} from '@/features/events/use-cases/list-references'

// Tipe hasil yang relevan bagi konsumen (bentuk baris mentah + ringkasan kartu). Tipe daftar/input
// domain (EventListPage, EventListQuery, EventInput) diimpor konsumen langsung dari `@/domain/event/types`.
export type { EventRow, EventSummary } from '@/features/events/repository'
export { listLegacyEventRows } from '@/features/events/repository'
export type {
  VenueRecord,
  EventOrganizerRecord,
  VenueInput,
  EventOrganizerInput,
} from '@/domain/event/types'
