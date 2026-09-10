import type {
  LocalEo,
  LocalEvent,
  LocalExhibitor,
  LocalJob,
  LocalStage,
  LocalUser,
  LocalVenue,
} from '@/lib/file'
import type { Cipl, CiplItem, CiplVersion } from '@/domain/exhibition/types'

export type DemoDataMode = 'EMPTY' | 'MOCK'

export type MockData = {
  users: LocalUser[]
  venues: LocalVenue[]
  eventOrganizers: LocalEo[]
  events: LocalEvent[]
  exhibitors: LocalExhibitor[]
  jobs: LocalJob[]
  stages: LocalStage[]
  cipls: Cipl[]
  ciplVersions: CiplVersion[]
}

function timestamp() {
  return new Date().toISOString()
}

/**
 * Minimal data needed to sign in and create real operational data.
 * Events, exhibitors, Jobs, and their stages intentionally start empty.
 */
function dateAt(daysFromToday: number) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + daysFromToday)
  return date.toISOString().slice(0, 10)
}

function eventDate(date: string) {
  return `${date}T00:00:00`
}

function ciplItems(prefix: string, count: number): CiplItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-item-${index + 1}`,
    lineNumber: index + 1,
    description: `Exhibition equipment ${index + 1}`,
    quantity: index + 1,
    unit: 'PCS',
    unitValue: null,
    currency: null,
    grossWeightKg: null,
    netWeightKg: null,
    countryOfOrigin: 'DE',
    identifiers: [],
    intendedUse: 'Display pameran',
    intendedDisposal: null,
  }))
}

export function createMockData(mode: DemoDataMode = 'EMPTY'): MockData {
  const now = timestamp()
  const today = dateAt(0)
  const twoDaysFromNow = dateAt(2)
  const threeDaysFromNow = dateAt(3)
  const nextWeek = dateAt(7)
  const followingWeek = dateAt(11)
  const exhibitors: LocalExhibitor[] = [
    ['mock-exhibitor-a', 'PT Nusantara Display', 'LOCAL', 'mock-event-current-a'],
    ['mock-exhibitor-b', 'Messe Berlin GmbH', 'INTERNATIONAL', 'mock-event-current-a'],
    ['mock-exhibitor-c', 'Kansai Fixtures Co.', 'INTERNATIONAL', 'mock-event-current-b'],
    ['mock-exhibitor-d', 'PT Garuda Expo', 'LOCAL', 'mock-event-upcoming'],
  ].map(([id, legalName, type, eventId]) => ({
    id,
    legalName,
    aliasName: null,
    type: type as LocalExhibitor['type'],
    eventId,
    email: null,
    phone: null,
    agent: type === 'INTERNATIONAL' ? 'VSS Coordination' : null,
    address: null,
    countryCode: type === 'INTERNATIONAL' ? 'DE' : 'ID',
    createdAt: now,
    updatedAt: now,
  }))
  const ciplVersions: CiplVersion[] = [
    {
      id: 'mock-cipl-ready-v1', ciplId: 'mock-cipl-ready', versionNumber: 1,
      receivedAt: now, receivedBy: 'Nurul Handayani', sourceDocumentName: 'CIPL-NUS-001.pdf',
      sourceDocument: null, items: ciplItems('mock-cipl-ready', 3), revisionNote: null, createdAt: now,
    },
    {
      id: 'mock-cipl-review-v1', ciplId: 'mock-cipl-review', versionNumber: 1,
      receivedAt: now, receivedBy: 'Andy', sourceDocumentName: 'CIPL-MES-002.pdf',
      sourceDocument: null, items: ciplItems('mock-cipl-review', 2), revisionNote: null, createdAt: now,
    },
  ]
  const cipls: Cipl[] = [
    { id: 'mock-cipl-ready', eventExhibitorId: 'mock-exhibitor-a', referenceNumber: 'CIPL-001', status: 'READY', activeVersionId: 'mock-cipl-ready-v1', sourceDocumentUnavailable: false, createdAt: now, updatedAt: now },
    { id: 'mock-cipl-review', eventExhibitorId: 'mock-exhibitor-b', referenceNumber: 'CIPL-002', status: 'UNDER_REVIEW', activeVersionId: 'mock-cipl-review-v1', sourceDocumentUnavailable: false, createdAt: now, updatedAt: now },
    { id: 'mock-cipl-awaiting', eventExhibitorId: 'mock-exhibitor-c', referenceNumber: null, status: 'AWAITING_DOCUMENT', activeVersionId: null, sourceDocumentUnavailable: true, createdAt: now, updatedAt: now },
    { id: 'mock-cipl-held', eventExhibitorId: 'mock-exhibitor-d', referenceNumber: 'CIPL-004', status: 'ON_HOLD', activeVersionId: null, sourceDocumentUnavailable: false, createdAt: now, updatedAt: now },
  ]
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
    events: mode === 'MOCK' ? [
      { id: 'mock-event-current-a', officialName: 'Indonesia International Trade Show', alias: 'IITS', startsAt: eventDate(dateAt(-1)), endsAt: eventDate(twoDaysFromNow), startsOn: dateAt(-1), endsOn: twoDaysFromNow, createdAt: now, updatedAt: now, status: 'ACTIVE', cancellationReason: null, cancelledAt: null, venueId: 'demo-venue-jakarta', eoId: 'demo-eo-jakarta' },
      { id: 'mock-event-current-b', officialName: 'Jakarta Design Week', alias: 'JDW', startsAt: eventDate(today), endsAt: eventDate(threeDaysFromNow), startsOn: today, endsOn: threeDaysFromNow, createdAt: now, updatedAt: now, status: 'ACTIVE', cancellationReason: null, cancelledAt: null, venueId: 'demo-venue-jakarta', eoId: 'demo-eo-debindo' },
      { id: 'mock-event-upcoming', officialName: 'Food and Hospitality Expo', alias: 'FHI', startsAt: eventDate(nextWeek), endsAt: eventDate(dateAt(9)), startsOn: nextWeek, endsOn: dateAt(9), createdAt: now, updatedAt: now, status: 'ACTIVE', cancellationReason: null, cancelledAt: null, venueId: 'demo-venue-ice', eoId: 'demo-eo-jakarta' },
      { id: 'mock-event-without-exhibitor', officialName: 'Sustainable Packaging Fair', alias: 'SPF', startsAt: eventDate(followingWeek), endsAt: eventDate(dateAt(13)), startsOn: followingWeek, endsOn: dateAt(13), createdAt: now, updatedAt: now, status: 'ACTIVE', cancellationReason: null, cancelledAt: null, venueId: 'demo-venue-bali', eoId: 'demo-eo-debindo' },
      { id: 'mock-event-cancelled', officialName: 'Asia Retail Forum', alias: 'ARF', startsAt: eventDate(dateAt(15)), endsAt: eventDate(dateAt(16)), startsOn: dateAt(15), endsOn: dateAt(16), createdAt: now, updatedAt: now, status: 'CANCELLED', cancellationReason: 'Penyelenggara membatalkan event.', cancelledAt: now, venueId: 'demo-venue-ice', eoId: 'demo-eo-jakarta' },
    ] : [],
    exhibitors: mode === 'MOCK' ? exhibitors : [],
    jobs: [],
    stages: [],
    cipls: mode === 'MOCK' ? cipls : [],
    ciplVersions: mode === 'MOCK' ? ciplVersions : [],
  }
}
