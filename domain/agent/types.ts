import type { ExhibitorContact } from '@/domain/event/types'

/** Master data agent (forwarder) — global, dapat diikutsertakan ke banyak event. */
export type Agent = {
  id: string
  name: string
  contact: ExhibitorContact
  address: string | null
  countryCode: string | null
  status: 'ACTIVE' | 'INACTIVE'
  createdAt: string
  updatedAt: string
}

/** Partisipasi satu agent pada satu event. */
export type EventAgent = {
  id: string
  eventId: string
  agentId: string
  createdAt: string
  createdById: string | null
}
