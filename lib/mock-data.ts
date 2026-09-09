import type {
  JobCustomsDocument,
  JobOperationalDetails,
  LocalEo,
  LocalEvent,
  LocalExhibitor,
  LocalJob,
  LocalStage,
  LocalUser,
  LocalVenue,
} from '@/lib/file'

export const MOCK_DATA_VERSION = 4

// Identity references (event dates below are intentionally simulated):
// https://indobuildtech.com/organisers/
// https://www.manufacturingindonesia.com/
// https://www.fhtbali.com/press-release/
export const MOCK_EVENT_IDS = [
  'demo-event-retail-summit',
  'demo-event-tech-expo',
  'demo-event-mice-forum',
] as const

type MockData = {
  users: LocalUser[]
  venues: LocalVenue[]
  eventOrganizers: LocalEo[]
  events: LocalEvent[]
  exhibitors: LocalExhibitor[]
  jobs: LocalJob[]
  stages: LocalStage[]
}

function shiftedDate(baseDate: Date, days: number) {
  return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + days, 9)
}

function dateOnly(baseDate: Date, days: number) {
  const value = shiftedDate(baseDate, days)
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function dateTime(baseDate: Date, days: number) {
  return shiftedDate(baseDate, days).toISOString()
}

function event(
  baseDate: Date,
  input: Omit<
    LocalEvent,
    | 'startsAt' | 'endsAt' | 'startsOn' | 'endsOn' | 'createdAt' | 'updatedAt'
    | 'status' | 'cancellationReason' | 'cancelledAt'
  > & {
    startsIn: number
    endsIn: number
    createdIn: number
  },
): LocalEvent {
  const startsOn = dateOnly(baseDate, input.startsIn)
  const endsOn = dateOnly(baseDate, input.endsIn)
  return {
    id: input.id,
    officialName: input.officialName,
    alias: input.alias,
    venueId: input.venueId,
    eoId: input.eoId,
    startsOn,
    endsOn,
    startsAt: `${startsOn}T00:00:00`,
    endsAt: `${endsOn}T00:00:00`,
    createdAt: dateTime(baseDate, input.createdIn),
    updatedAt: dateTime(baseDate, 0),
    status: 'ACTIVE',
    cancellationReason: null,
    cancelledAt: null,
  }
}

function customsDocument(
  status: JobCustomsDocument['status'],
  input: Partial<Omit<JobCustomsDocument, 'status'>> = {},
): JobCustomsDocument {
  const applicable = input.applicable ?? true
  return {
    applicable,
    status,
    ajuNumber: input.ajuNumber ?? null,
    registrationNumber: input.registrationNumber ?? null,
    registrationDate: input.registrationDate ?? null,
    warehouseName: input.warehouseName ?? null,
    billing: input.billing ?? (applicable ? { kind: 'NOT_READY' } : { kind: 'NOT_APPLICABLE' }),
  }
}

function operational(
  baseDate: Date,
  input: {
    inbound: Partial<JobOperationalDetails['inbound']>
    outbound?: Partial<JobOperationalDetails['outbound']>
    cipl: JobOperationalDetails['cipl']
    customs: JobOperationalDetails['customs']
  },
): JobOperationalDetails {
  const leg = (
    value: Partial<JobOperationalDetails['inbound']>,
  ): JobOperationalDetails['inbound'] => ({
    mode: null,
    documentType: null,
    documentNumber: null,
    carrier: null,
    scheduleAt: null,
    actualAt: null,
    ...value,
  })
  const normalizeDate = (value: string | null) => {
    if (!value?.startsWith('day:')) return value
    return dateTime(baseDate, Number(value.slice(4)))
  }
  const inbound = leg(input.inbound)
  const outbound = leg(input.outbound ?? {})
  return {
    inbound: {
      ...inbound,
      scheduleAt: normalizeDate(inbound.scheduleAt),
      actualAt: normalizeDate(inbound.actualAt),
    },
    outbound: {
      ...outbound,
      scheduleAt: normalizeDate(outbound.scheduleAt),
      actualAt: normalizeDate(outbound.actualAt),
    },
    cipl: input.cipl,
    customs: input.customs,
  }
}

type JobInput = Pick<
  LocalJob,
  'id' | 'jobNumber' | 'clientName' | 'status' | 'type' | 'eventId' | 'exhibitorId'
> &
  Partial<
    Pick<
      LocalJob,
      | 'agent'
      | 'consignee'
      | 'notifyParty'
      | 'shippingLine'
      | 'cargoDescription'
      | 'shipmentMode'
      | 'cargoDetails'
      | 'journeyDetails'
      | 'notes'
      | 'assignedToId'
      | 'sourceDocumentName'
    >
  > & {
    createdIn: number
    updatedIn: number
    operational: JobOperationalDetails
  }

function job(baseDate: Date, input: JobInput): LocalJob {
  const inbound = input.operational.inbound
  return {
    id: input.id,
    jobNumber: input.jobNumber,
    awbNumber: inbound.documentType === 'AWB' ? inbound.documentNumber : null,
    blNumber: inbound.documentType === 'BL' ? inbound.documentNumber : null,
    shipper: input.clientName,
    consignee: input.consignee ?? 'PT VENUE LOGISTIK INDONESIA',
    notifyParty: input.notifyParty ?? 'VSS INDONESIA',
    agent: input.agent ?? null,
    shippingLine: input.shippingLine ?? inbound.carrier,
    cargoDescription: input.cargoDescription ?? 'Exhibition goods and booth equipment',
    shipmentMode: input.shipmentMode ?? (inbound.mode === 'SEA' ? 'LCL' : null),
    cargoDetails: input.cargoDetails ?? null,
    journeyDetails: input.journeyDetails ?? null,
    type: input.type,
    clientName: input.clientName,
    clientInfo: null,
    status: input.status,
    notes: input.notes ?? null,
    trackingToken: `tracking-${input.id}`,
    assignedToId: input.assignedToId ?? null,
    eventId: input.eventId,
    exhibitorId: input.exhibitorId,
    sourceDocumentName: input.sourceDocumentName ?? null,
    createdAt: dateTime(baseDate, input.createdIn),
    updatedAt: dateTime(baseDate, input.updatedIn),
    stages: [],
    documents: [],
    operational: input.operational,
  }
}

function stages(
  baseDate: Date,
  jobId: string,
  values: Array<[string, LocalStage['status']]>,
  createdIn: number,
) {
  return values.map(([name, status], index): LocalStage => ({
    id: `${jobId}-stage-${index + 1}`,
    jobId,
    name,
    status,
    order: index + 1,
    notes: null,
    createdAt: dateTime(baseDate, createdIn),
    updatedAt: dateTime(baseDate, status === 'DONE' ? -1 : 0),
  }))
}

/**
 * Demo operasional relatif terhadap hari pertama data diinisialisasi, sehingga pada
 * saat demo dibuat tersedia contoh event selesai, berlangsung, dan akan datang.
 */
export function createMockData(baseDate = new Date()): MockData {
  const timestamp = dateTime(baseDate, 0)
  const users: LocalUser[] = [
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
  ]
  const venues: LocalVenue[] = [
    {
      id: 'demo-venue-jakarta',
      officialName: 'JAKARTA INTERNATIONAL EXPO',
      aliasName: 'JIEXPO',
      address: 'Kemayoran, Jakarta Pusat',
      latitude: -6.1467,
      longitude: 106.8456,
      contactInfo: '+62 21 26645 000',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: 'demo-venue-ice',
      officialName: 'INDONESIA CONVENTION EXHIBITION',
      aliasName: 'ICE BSD',
      address: 'BSD City, Tangerang',
      latitude: -6.3019,
      longitude: 106.6361,
      contactInfo: '+62 21 2971 4600',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: 'demo-venue-bali',
      officialName: 'BALI NUSA DUA CONVENTION CENTER',
      aliasName: 'BNDCC',
      address: 'Kawasan Pariwisata Nusa Dua, Bali',
      latitude: -8.7954,
      longitude: 115.2302,
      contactInfo: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ]
  const eventOrganizers: LocalEo[] = [
    {
      id: 'demo-eo-jakarta',
      legalName: 'PT PAMERINDO INDONESIA',
      aliasName: 'Pamerindo Indonesia',
      contactInfo: 'info@pamerindo.com · +62 21 2525 320',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: 'demo-eo-debindo',
      legalName: 'PT DEBINDO INTERNATIONAL TRADE AND EXHIBITIONS',
      aliasName: 'Debindo',
      contactInfo: 'info@debindo-group.com · +62 21 8379 7401',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ]
  const events: LocalEvent[] = [
    event(baseDate, {
      id: MOCK_EVENT_IDS[0],
      officialName: 'INDOBUILDTECH EXPO',
      alias: 'IndoBuildTech',
      startsIn: -42,
      endsIn: -38,
      createdIn: -105,
      venueId: 'demo-venue-ice',
      eoId: 'demo-eo-debindo',
    }),
    event(baseDate, {
      id: MOCK_EVENT_IDS[1],
      officialName: 'MANUFACTURING INDONESIA SERIES',
      alias: 'Manufacturing Indonesia',
      startsIn: -2,
      endsIn: 3,
      createdIn: -70,
      venueId: 'demo-venue-jakarta',
      eoId: 'demo-eo-jakarta',
    }),
    event(baseDate, {
      id: MOCK_EVENT_IDS[2],
      officialName: 'FOOD, HOTEL & TOURISM BALI',
      alias: 'FHTB',
      startsIn: 24,
      endsIn: 27,
      createdIn: -35,
      venueId: 'demo-venue-bali',
      eoId: 'demo-eo-jakarta',
    }),
  ]
  const exhibitors: LocalExhibitor[] = [
    {
      id: 'demo-exhibitor-sakura-industrial',
      eventId: MOCK_EVENT_IDS[0],
      legalName: 'SAKURA INDUSTRIAL DEMO CO., LTD.',
      aliasName: 'Sakura Industrial Demo',
      type: 'INTERNATIONAL',
      email: 'export@sakura-industrial.example',
      phone: '+81 3 5550 2200',
      address: 'Tokyo, Japan',
      countryCode: 'JP',
      createdAt: dateTime(baseDate, -90),
      updatedAt: timestamp,
    },
    {
      id: 'demo-exhibitor-sinar-mesin',
      eventId: MOCK_EVENT_IDS[0],
      legalName: 'PT SINAR MESIN DEMO INDONESIA',
      aliasName: 'Sinar Mesin Demo',
      type: 'LOCAL',
      email: 'logistik@sinarmesin.example',
      phone: '+62 21 555 0188',
      address: 'Bekasi, Jawa Barat',
      countryCode: 'ID',
      createdAt: dateTime(baseDate, -87),
      updatedAt: timestamp,
    },
    {
      id: 'demo-exhibitor-nexa-robotics',
      eventId: MOCK_EVENT_IDS[1],
      legalName: 'NEXA ROBOTICS DEMO PTE. LTD.',
      aliasName: 'Nexa Robotics Demo',
      type: 'INTERNATIONAL',
      email: 'shipping@nexa-robotics.example',
      phone: '+65 6123 9090',
      address: 'Singapore',
      countryCode: 'SG',
      createdAt: dateTime(baseDate, -55),
      updatedAt: timestamp,
    },
    {
      id: 'demo-exhibitor-digital-nusantara',
      eventId: MOCK_EVENT_IDS[1],
      legalName: 'PT DIGITAL NUSANTARA DEMO',
      aliasName: 'DND',
      type: 'LOCAL',
      email: 'event@digital-nusantara.example',
      phone: '+62 21 555 0221',
      address: 'Jakarta Selatan',
      countryCode: 'ID',
      createdAt: dateTime(baseDate, -51),
      updatedAt: timestamp,
    },
    {
      id: 'demo-exhibitor-vision-ai',
      eventId: MOCK_EVENT_IDS[1],
      legalName: 'VISION AI DEMO GMBH',
      aliasName: 'Vision AI Demo',
      type: 'INTERNATIONAL',
      email: 'tradefair@visionai.example',
      phone: '+49 30 555 7788',
      address: 'Berlin, Germany',
      countryCode: 'DE',
      createdAt: dateTime(baseDate, -48),
      updatedAt: timestamp,
    },
    {
      id: 'demo-exhibitor-lumina',
      eventId: MOCK_EVENT_IDS[2],
      legalName: 'LUMINA HOSPITALITY DEMO S.R.L.',
      aliasName: 'Lumina Demo',
      type: 'INTERNATIONAL',
      email: 'expo@lumina.example',
      phone: '+39 02 555 1188',
      address: 'Milan, Italy',
      countryCode: 'IT',
      createdAt: dateTime(baseDate, -28),
      updatedAt: timestamp,
    },
    {
      id: 'demo-exhibitor-kayu-rupa',
      eventId: MOCK_EVENT_IDS[2],
      legalName: 'PT KAYU RUPA DEMO BALI',
      aliasName: 'Kayu Rupa Demo',
      type: 'LOCAL',
      email: 'sales@kayurupa.example',
      phone: '+62 361 555 0199',
      address: 'Gianyar, Bali',
      countryCode: 'ID',
      createdAt: dateTime(baseDate, -25),
      updatedAt: timestamp,
    },
  ]

  const notApplicable = customsDocument('NOT_STARTED', { applicable: false })
  const jobs: LocalJob[] = [
    job(baseDate, {
      id: 'demo-job-retail-1',
      jobNumber: 'VSS-DEMO-001',
      clientName: exhibitors[0].legalName,
      eventId: MOCK_EVENT_IDS[0],
      exhibitorId: exhibitors[0].id,
      status: 'COMPLETED',
      type: 'IMPORT',
      agent: 'Yamato Expo Logistics',
      assignedToId: 'demo-user-andy',
      createdIn: -88,
      updatedIn: -35,
      sourceDocumentName: 'CIPL-SAKURA-DEMO-001.pdf',
      operational: operational(baseDate, {
        inbound: {
          mode: 'SEA',
          documentType: 'BL',
          documentNumber: 'ONEYTYOD78214500',
          carrier: 'Ocean Network Express',
          scheduleAt: 'day:-50',
          actualAt: 'day:-48',
        },
        outbound: {
          mode: 'SEA',
          documentType: 'BL',
          documentNumber: 'ONEYJKTG91028400',
          carrier: 'Ocean Network Express',
          scheduleAt: 'day:-34',
          actualAt: 'day:-33',
        },
        cipl: {
          status: 'VERIFIED',
          referenceNumber: 'CIPL/DEMO/SKR/014',
          receivedAt: dateTime(baseDate, -70),
        },
        customs: {
          BC_2_3: customsDocument('COMPLETED', {
            ajuNumber: '000023-001234-2026',
            registrationNumber: '001245',
            registrationDate: dateOnly(baseDate, -46),
            warehouseName: 'TPS Graha Segara',
            billing: { kind: 'PAID', reference: 'INV-VSS-2401' },
          }),
          BC_2_5: notApplicable,
          BC_3_0: customsDocument('COMPLETED', {
            ajuNumber: '000030-004321-2026',
            registrationNumber: '003820',
            registrationDate: dateOnly(baseDate, -36),
            warehouseName: 'ICE BSD',
            billing: { kind: 'NOT_READY' },
          }),
        },
      }),
    }),
    job(baseDate, {
      id: 'demo-job-bali-1',
      jobNumber: 'VSS-DEMO-002',
      clientName: exhibitors[1].legalName,
      eventId: MOCK_EVENT_IDS[0],
      exhibitorId: exhibitors[1].id,
      status: 'COMPLETED',
      type: 'IMPORT',
      agent: 'Internal / local movement',
      assignedToId: 'demo-user-kevin',
      createdIn: -82,
      updatedIn: -37,
      notes: 'Barang lokal, tidak memerlukan dokumen impor sementara.',
      operational: operational(baseDate, {
        inbound: {
          mode: 'LOCAL',
          scheduleAt: 'day:-44',
          actualAt: 'day:-44',
          carrier: 'Sinar Mesin Fleet',
        },
        outbound: {
          mode: 'LOCAL',
          scheduleAt: 'day:-37',
          actualAt: 'day:-37',
          carrier: 'Sinar Mesin Fleet',
        },
        cipl: {
          status: 'VERIFIED',
          referenceNumber: 'SMI-PL-0826-07',
          receivedAt: dateTime(baseDate, -60),
        },
        customs: { BC_2_3: notApplicable, BC_2_5: notApplicable, BC_3_0: notApplicable },
      }),
    }),
    job(baseDate, {
      id: 'demo-job-tech-1',
      jobNumber: 'VSS-DEMO-003',
      clientName: exhibitors[2].legalName,
      eventId: MOCK_EVENT_IDS[1],
      exhibitorId: exhibitors[2].id,
      status: 'IN_PROGRESS',
      type: 'IMPORT',
      agent: 'Schenker Singapore',
      assignedToId: 'demo-user-andy',
      createdIn: -52,
      updatedIn: 0,
      sourceDocumentName: 'CIPL-NEOTECH-ID.pdf',
      operational: operational(baseDate, {
        inbound: {
          mode: 'AIR',
          documentType: 'AWB',
          documentNumber: '618-58290174',
          carrier: 'Singapore Airlines Cargo',
          scheduleAt: 'day:-9',
          actualAt: 'day:-9',
        },
        outbound: {
          mode: 'AIR',
          documentType: 'AWB',
          documentNumber: null,
          carrier: 'Singapore Airlines Cargo',
          scheduleAt: 'day:6',
        },
        cipl: {
          status: 'VERIFIED',
          referenceNumber: 'NT-ID-EXPO-026',
          receivedAt: dateTime(baseDate, -30),
        },
        customs: {
          BC_2_3: customsDocument('RELEASED', {
            ajuNumber: '000023-008721-2026',
            registrationNumber: '007180',
            registrationDate: dateOnly(baseDate, -7),
            warehouseName: 'Gudang 530 Bandara Soekarno-Hatta',
            billing: { kind: 'PAID', reference: 'BILL-NT-7781' },
          }),
          BC_2_5: notApplicable,
          BC_3_0: customsDocument('PREPARING', { warehouseName: 'JIEXPO Hall D' }),
        },
      }),
    }),
    job(baseDate, {
      id: 'demo-job-tech-2',
      jobNumber: 'VSS-DEMO-004',
      clientName: exhibitors[3].legalName,
      eventId: MOCK_EVENT_IDS[1],
      exhibitorId: exhibitors[3].id,
      status: 'IN_PROGRESS',
      type: 'IMPORT',
      agent: 'VSS Jakarta',
      assignedToId: 'demo-user-kevin',
      createdIn: -47,
      updatedIn: -1,
      operational: operational(baseDate, {
        inbound: {
          mode: 'LOCAL',
          carrier: 'Trans Nusantara',
          scheduleAt: 'day:-3',
          actualAt: 'day:-3',
        },
        outbound: { mode: 'LOCAL', carrier: 'Trans Nusantara', scheduleAt: 'day:4' },
        cipl: {
          status: 'RECEIVED',
          referenceNumber: 'DNS/ITE/009',
          receivedAt: dateTime(baseDate, -12),
        },
        customs: { BC_2_3: notApplicable, BC_2_5: notApplicable, BC_3_0: notApplicable },
      }),
    }),
    job(baseDate, {
      id: 'demo-job-bali-2',
      jobNumber: 'VSS-DEMO-005',
      clientName: exhibitors[4].legalName,
      eventId: MOCK_EVENT_IDS[1],
      exhibitorId: exhibitors[4].id,
      status: 'ON_HOLD',
      type: 'IMPORT',
      agent: 'Kuehne + Nagel Germany',
      assignedToId: 'demo-user-nurul',
      createdIn: -43,
      updatedIn: 0,
      notes: 'Menunggu revisi nilai barang pada CIPL dari exhibitor.',
      operational: operational(baseDate, {
        inbound: {
          mode: 'AIR',
          documentType: 'AWB',
          documentNumber: '020-77192835',
          carrier: 'Lufthansa Cargo',
          scheduleAt: 'day:-4',
          actualAt: 'day:-4',
        },
        outbound: { mode: 'AIR', carrier: 'Lufthansa Cargo', scheduleAt: 'day:5' },
        cipl: {
          status: 'RECEIVED',
          referenceNumber: 'VAI-EXH-118-R1',
          receivedAt: dateTime(baseDate, -10),
        },
        customs: {
          BC_2_3: customsDocument('ON_HOLD', {
            ajuNumber: '000023-009015-2026',
            warehouseName: 'Gudang Gapura Angkasa',
          }),
          BC_2_5: notApplicable,
          BC_3_0: customsDocument('NOT_STARTED'),
        },
      }),
    }),
    job(baseDate, {
      id: 'demo-job-bali-3',
      jobNumber: 'VSS-DEMO-006',
      clientName: exhibitors[5].legalName,
      eventId: MOCK_EVENT_IDS[2],
      exhibitorId: exhibitors[5].id,
      status: 'IN_PROGRESS',
      type: 'IMPORT',
      agent: 'Fiera Milano Logistics',
      assignedToId: 'demo-user-andy',
      createdIn: -24,
      updatedIn: -2,
      sourceDocumentName: 'Packing-List-Lumina-Bali.pdf',
      operational: operational(baseDate, {
        inbound: {
          mode: 'SEA',
          documentType: 'BL',
          documentNumber: 'MAEU265901774',
          carrier: 'Maersk',
          scheduleAt: 'day:14',
        },
        outbound: { mode: 'SEA', carrier: 'Maersk', scheduleAt: 'day:31' },
        cipl: {
          status: 'VERIFIED',
          referenceNumber: 'LUM-BHDS-2026-01',
          receivedAt: dateTime(baseDate, -18),
        },
        customs: {
          BC_2_3: customsDocument('PREPARING', { warehouseName: 'TPS Pelindo Benoa' }),
          BC_2_5: notApplicable,
          BC_3_0: customsDocument('NOT_STARTED'),
        },
      }),
    }),
    job(baseDate, {
      id: 'demo-job-fhtb-2',
      jobNumber: 'VSS-DEMO-007',
      clientName: exhibitors[6].legalName,
      eventId: MOCK_EVENT_IDS[2],
      exhibitorId: exhibitors[6].id,
      status: 'DRAFT',
      type: 'IMPORT',
      assignedToId: 'demo-user-kevin',
      createdIn: -20,
      updatedIn: -5,
      notes: 'Menunggu packing list final dari exhibitor.',
      operational: operational(baseDate, {
        inbound: { mode: 'LOCAL', carrier: 'Bali Kargo Express', scheduleAt: 'day:22' },
        outbound: { mode: 'LOCAL', carrier: 'Bali Kargo Express', scheduleAt: 'day:28' },
        cipl: { status: 'REQUESTED', referenceNumber: null, receivedAt: null },
        customs: { BC_2_3: notApplicable, BC_2_5: notApplicable, BC_3_0: notApplicable },
      }),
    }),
  ]

  const stagesByJob = [
    stages(
      baseDate,
      jobs[0].id,
      [
        ['CIPL verified', 'DONE'],
        ['Inbound clearance', 'DONE'],
        ['Delivery to venue', 'DONE'],
        ['Re-export', 'DONE'],
      ],
      -88,
    ),
    stages(
      baseDate,
      jobs[1].id,
      [
        ['Packing list received', 'DONE'],
        ['Delivery to venue', 'DONE'],
        ['Return to exhibitor', 'DONE'],
      ],
      -82,
    ),
    stages(
      baseDate,
      jobs[2].id,
      [
        ['CIPL verified', 'DONE'],
        ['BC 2.3 released', 'DONE'],
        ['On-site handling', 'IN_PROGRESS'],
        ['Re-export BC 3.0', 'PENDING'],
      ],
      -52,
    ),
    stages(
      baseDate,
      jobs[3].id,
      [
        ['Packing list received', 'DONE'],
        ['Delivery to venue', 'DONE'],
        ['Return delivery', 'PENDING'],
      ],
      -47,
    ),
    stages(
      baseDate,
      jobs[4].id,
      [
        ['CIPL review', 'IN_PROGRESS'],
        ['BC 2.3 registration', 'PENDING'],
        ['Delivery to venue', 'PENDING'],
        ['Re-export', 'PENDING'],
      ],
      -43,
    ),
    stages(
      baseDate,
      jobs[5].id,
      [
        ['CIPL verified', 'DONE'],
        ['Vessel arrival', 'PENDING'],
        ['BC 2.3 clearance', 'PENDING'],
        ['Delivery to venue', 'PENDING'],
      ],
      -24,
    ),
    stages(
      baseDate,
      jobs[6].id,
      [
        ['Request packing list', 'IN_PROGRESS'],
        ['Schedule pickup', 'PENDING'],
        ['Delivery to venue', 'PENDING'],
      ],
      -20,
    ),
  ]

  return { users, venues, eventOrganizers, events, exhibitors, jobs, stages: stagesByJob.flat() }
}
