export type AccessLevel = 'ADMIN' | 'MEMBER'
export type JobRole = 'STAFF' | 'SUPERVISOR' | 'CUSTOMER_SERVICE' | 'DOCUMENT_ASSISTANT'

export type UserProfile = {
  id: string
  name: string
  email: string
  jobRole: JobRole
  accessLevel: AccessLevel
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type Contact = {
  name: string | null
  role: string | null
  email: string | null
  phone: string | null
  isPrimary: boolean
}

export type EventOrganizer = {
  id: string
  name: string
  npwp: string | null
  contacts: Contact[]
  address: string | null
  website: string | null
  createdAt: string
  updatedAt: string
}

export type Venue = {
  id: string
  name: string
  contacts: Contact[]
  address: string | null
  website: string | null
  loadingAccessNotes: string | null
  createdAt: string
  updatedAt: string
}

export type EventCancellation = {
  eventId: string
  reason: string
  cancelledAt: string
  cancelledById: string
}

export type Event = {
  id: string
  name: string
  venueId: string
  eventOrganizerId: string
  startsOn: string
  endsOn: string
  createdAt: string
  createdById: string
  cancellation: EventCancellation | null
  venue?: Venue
  eventOrganizer?: EventOrganizer
}

export type ExhibitorContact = Pick<Contact, 'name' | 'role' | 'email' | 'phone'>

type ExhibitorBase = {
  id: string
  eventId: string
  name: string
  contact: ExhibitorContact
  agentId: string | null
  createdAt: string
  createdById: string
  updatedAt: string
}

export type LocalExhibitor = ExhibitorBase & {
  kind: 'LOCAL'
  npwp: string | null
}

export type InternationalExhibitor = ExhibitorBase & {
  kind: 'INTERNATIONAL'
}

export type Exhibitor = LocalExhibitor | InternationalExhibitor
