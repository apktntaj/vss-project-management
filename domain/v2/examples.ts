import type {
  AdministrativeTask,
  CargoItem,
  CustomsTask,
  HandlingTask,
  Id,
  MovementTask,
  Project,
  SourceReference,
} from './types'
import { known, notApplicable, unknown } from './types'

export const id = <T extends string>(value: string) => value as Id<T>

export const requestSource: SourceReference = {
  sourceType: 'whatsapp-export',
  sourceId: 'docs/whatsapp-operational-vss.txt:8604-8611',
  occurredAt: '2026-02-18T15:41:00+07:00',
}

export const customsSource: SourceReference = {
  sourceType: 'whatsapp-export',
  sourceId: 'docs/whatsapp-operational-vss.txt:13116-13138',
  occurredAt: '2026-05-13T16:12:00+07:00',
}

export const requester = { id: id<'party'>('party-nunu'), name: 'Nunu XL' }
export const vss = { id: id<'party'>('party-vss'), name: 'VSS Operations' }
export const customerServiceActor = { kind: 'participant', partyId: requester.id, role: 'customer-service' } as const
export const operationsActor = { kind: 'participant', partyId: vss.id, role: 'field-operations' } as const
export const supervisorActor = { kind: 'participant', partyId: vss.id, role: 'supervisor' } as const
export const customsActor = { kind: 'participant', partyId: vss.id, role: 'document-customs' } as const
export const origin = {
  id: id<'location'>('location-vss'),
  name: 'Gudang VSS',
  contact: known('Koordinator gudang', [requestSource]),
}
export const destination = {
  id: id<'location'>('location-ferring'),
  name: 'Ferring Pharmaceuticals Industry, Taman Tekno BSD',
  contact: known('Ellena', [requestSource]),
}

const initialGaps = [
  { path: 'requestedTime', code: 'RELATIVE_TIME', impact: '“besok” belum menjadi jadwal absolut.', owner: customerServiceActor },
  { path: 'plannedTime', code: 'UNKNOWN_PLANNED_TIME', impact: 'Jadwal belum ditetapkan.', owner: operationsActor },
  { path: 'resourceRequirements.0.vehicleType', code: 'UNKNOWN_VEHICLE_TYPE', impact: 'Kendaraan belum dipilih.', owner: operationsActor },
] as const

const base = {
  mandatory: true,
  requestedBy: known(requester, [requestSource]),
  requestedTime: known({ kind: 'relative', expression: 'besok', anchoredAt: requestSource.occurredAt, timeZone: 'Asia/Jakarta' } as const, [requestSource]),
  plannedTime: unknown<import('./types').AbsoluteWindow>('Belum dijadwalkan', operationsActor),
  deadline: unknown<string>('Jam tiba belum disebutkan', customerServiceActor),
  priority: 'normal' as const,
  readiness: { kind: 'needs-information', gaps: initialGaps } as const,
  execution: { kind: 'not-started' } as const,
  blockers: [{
    kind: 'open',
    id: id<'blocker'>('blocker-fo'),
    blockerType: 'document',
    description: 'FO menyusul.',
    openedAt: requestSource.occurredAt,
    owner: customerServiceActor,
  }] as const,
  dependencies: [],
  evidenceRequirements: [{ evidenceType: 'delivery-receipt', minimum: 1 }] as const,
  evidence: [],
  sources: [requestSource] as const,
}

export const deliveryTask: MovementTask = {
  ...base,
  id: id<'task'>('task-delivery-ferring'),
  title: 'Delivery barang Ferrings',
  kind: 'movement',
  action: 'delivery',
  origin: unknown('Lokasi asal tidak disebut pada permintaan awal.', customerServiceActor),
  destination: known(destination, [requestSource]),
  cargoItemIds: [id<'cargo-item'>('cargo-returnable')],
  resourceRequirements: [{
    kind: 'vehicle',
    vehicleType: unknown('Jenis kendaraan belum ditentukan.', operationsActor),
    quantity: 1,
    minimumCapacityKg: unknown('Berat barang belum tersedia.', customerServiceActor),
  }],
}

export const handlingTask: HandlingTask = {
  ...base,
  id: id<'task'>('task-repacking'),
  title: 'Repacking setelah pameran',
  kind: 'handling',
  action: 'repacking',
  location: known(origin, [customsSource]),
  cargoItemIds: [id<'cargo-item'>('cargo-returnable')],
  resourceRequirements: [{ kind: 'person', role: 'field-operator', quantity: 2, skill: notApplicable('Tidak ada skill khusus yang dinyatakan.') }],
}

export const customsTask: CustomsTask = {
  ...base,
  id: id<'task'>('task-customs-close-out'),
  title: 'Customs close-out per item',
  kind: 'customs',
  action: 'close-out',
  location: known(origin, [customsSource]),
  cargoItemIds: [id<'cargo-item'>('cargo-returnable')],
  documentRequirements: [{
    documentType: 'Dokumen close-out yang dikonfirmasi PIC customs',
    criticality: 'planning',
    status: unknown('Dokumen dan kewajiban final belum dikonfirmasi.', customsActor),
  }],
}

export const administrativeTask: AdministrativeTask = {
  ...base,
  mandatory: false,
  id: id<'task'>('task-reporting'),
  title: 'Laporan operasional',
  kind: 'administrative',
  action: 'reporting',
  subject: known('Laporan delivery dan customs', [requestSource]),
  documentRequirements: [],
}

export const returnableCargo: CargoItem = {
  id: id<'cargo-item'>('cargo-returnable'),
  description: known('Barang ATA yang perlu dicocokkan saat export kembali', [customsSource]),
  owner: known(requester, [customsSource]),
  identifiers: ['case-return-01'],
  quantities: [{ value: 1, unit: 'case' }],
  weightKg: unknown('Tidak dinyatakan di chat.', customerServiceActor),
  dimensionsCm: unknown('Tidak dinyatakan di chat.', customerServiceActor),
  intendedUse: known('Pameran', [customsSource]),
  intendedDisposal: known('return-abroad', [customsSource]),
  sources: [customsSource],
}

export const localCargo: CargoItem = {
  id: id<'cargo-item'>('cargo-local'),
  description: known('Barang yang berubah dari temporary menjadi permanent/lokal', [customsSource]),
  owner: known(requester, [customsSource]),
  identifiers: ['case-local-01'],
  quantities: [{ value: 3, unit: 'package' }],
  weightKg: notApplicable('Tidak diperlukan untuk demonstrasi keputusan per item.'),
  dimensionsCm: notApplicable('Tidak diperlukan untuk demonstrasi keputusan per item.'),
  intendedUse: known('Dikirim ke pembeli lokal', [customsSource]),
  intendedDisposal: known('sold-or-transferred', [customsSource]),
  sources: [customsSource],
}

export const initialProject: Project = {
  id: id<'project'>('project-mice-demo'),
  name: 'Demo Delivery dan Customs MICE',
  period: known({ kind: 'window', startsAt: '2026-02-18T00:00:00+07:00', endsAt: '2026-08-18T23:59:59+07:00' }, [requestSource]),
  participants: [
    { party: vss, roles: ['field-operations', 'document-customs', 'supervisor'], period: notApplicable('Berlaku selama project.'), sources: [requestSource] },
    { party: requester, roles: ['customer-service'], period: notApplicable('Berlaku selama project.'), sources: [requestSource] },
  ],
  cargoItems: [returnableCargo, localCargo],
  tasks: [deliveryTask, handlingTask, customsTask, administrativeTask],
  assignments: [],
  milestones: [],
  blockers: [],
  customs: {
    kind: 'case',
    movementContext: 'Barang pameran dengan disposal berbeda per item.',
    closeOutOwner: customsActor,
    decisions: [
      {
        cargoItemId: returnableCargo.id,
        intendedUse: returnableCargo.intendedUse,
        intendedDisposal: returnableCargo.intendedDisposal,
        technicalDescriptionReady: true,
        treatment: {
          kind: 'provisional',
          route: 'ATA return (label operasional dari chat)',
          basis: 'Barang disebut ATA dan harus dicocokkan ketika export.',
          confirmationNeeded: 'Konfirmasi PIC/otoritas atas route dan kewajiban.',
        },
        closeOut: { kind: 'due', dueAt: '2026-08-18T17:00:00+07:00', remainingObligations: ['Rekonsiliasi dan evidence return per item'] },
        openIssues: [],
      },
      {
        cargoItemId: localCargo.id,
        intendedUse: localCargo.intendedUse,
        intendedDisposal: localCargo.intendedDisposal,
        technicalDescriptionReady: true,
        treatment: {
          kind: 'provisional',
          route: 'Perubahan temporary menjadi permanent/lokal',
          basis: 'Instruksi pengiriman lokal pada chat.',
          confirmationNeeded: 'Konfirmasi treatment oleh PIC/otoritas.',
        },
        closeOut: {
          kind: 'exception-open',
          exceptionType: 'change-of-intended-disposal',
          affectedQuantity: { value: 3, unit: 'package' },
          owner: customsActor,
          authorityQuestion: 'Treatment dan kewajiban apa yang disetujui untuk barang lokal?',
        },
        openIssues: [],
      },
    ],
    documents: [],
    recommendationStatus: 'requires-authority-confirmation',
  },
  changes: [],
  sources: [requestSource, customsSource],
}
