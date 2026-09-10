import type {
  LocalEo,
  LocalEvent,
  LocalExhibitor,
  LocalJob,
  LocalStage,
  LocalUser,
  LocalVenue,
} from '@/lib/file'

type MockData = {
  users: LocalUser[]
  venues: LocalVenue[]
  eventOrganizers: LocalEo[]
  events: LocalEvent[]
  exhibitors: LocalExhibitor[]
  jobs: LocalJob[]
  stages: LocalStage[]
}

function timestamp() {
  return new Date().toISOString()
}

/**
 * Minimal data needed to sign in and create real operational data.
 * Events, exhibitors, Jobs, and their stages intentionally start empty.
 */
export function createMockData(): MockData {
  const now = timestamp()
  return {
    users: [
      {
        id: 'demo-user-nurul',
        name: 'Nurul Handayani',
        email: 'admin@vss.demo',
        role: 'SUPERVISOR',
        isActive: true,
      },
      {
        id: 'demo-user-andy',
        name: 'Andy',
        email: 'operasional@vss.demo',
        role: 'STAFF',
        isActive: true,
      },
      {
        id: 'demo-user-kevin',
        name: 'Kevin',
        email: 'viewer@vss.demo',
        role: 'CUSTOMER_SERVICE',
        isActive: true,
      },
    ],
    venues: [
      {
        id: 'demo-venue-jakarta',
        officialName: 'JAKARTA INTERNATIONAL EXPO',
        aliasName: 'JIEXPO',
        address: 'Kemayoran, Jakarta Pusat',
        latitude: -6.1467,
        longitude: 106.8456,
        contactInfo: '+62 21 26645 000',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'demo-venue-ice',
        officialName: 'INDONESIA CONVENTION EXHIBITION',
        aliasName: 'ICE BSD',
        address: 'BSD City, Tangerang',
        latitude: -6.3019,
        longitude: 106.6361,
        contactInfo: '+62 21 2971 4600',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'demo-venue-bali',
        officialName: 'BALI NUSA DUA CONVENTION CENTER',
        aliasName: 'BNDCC',
        address: 'Kawasan Pariwisata Nusa Dua, Bali',
        latitude: -8.7954,
        longitude: 115.2302,
        contactInfo: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    eventOrganizers: [
      {
        id: 'demo-eo-jakarta',
        legalName: 'PT PAMERINDO INDONESIA',
        aliasName: 'Pamerindo Indonesia',
        contactInfo: 'info@pamerindo.com · +62 21 2525 320',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'demo-eo-debindo',
        legalName: 'PT DEBINDO INTERNATIONAL TRADE AND EXHIBITIONS',
        aliasName: 'Debindo',
        contactInfo: 'info@debindo-group.com · +62 21 8379 7401',
        createdAt: now,
        updatedAt: now,
      },
    ],
    events: [],
    exhibitors: [],
    jobs: [],
    stages: [],
  }
}
