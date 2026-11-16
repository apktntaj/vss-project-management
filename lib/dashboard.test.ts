import { describe, expect, test } from 'bun:test'

import type { EventScheduleRef } from '@/domain/event/types'
import { emptyOperationalDetails } from '@/domain/job/operational'
import type { Job, JobOperationalDetails } from '@/domain/job/types'
import { buildOperationsDashboard } from '@/lib/dashboard'
import { wibDateOf } from '@/lib/wib-date'
// Fixture parsial dilempar ke `as unknown as Job` (pola `lib/job-readiness.test.ts`).
const TODAY = '2026-11-15'

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    version: 1,
    eventId: 'event-1',
    kind: 'INTERNATIONAL',
    internationalJenis: 'TEMPORARY_IMPORT',
    transportMode: 'SEA',
    status: 'IN_PROGRESS',
    cancellation: null,
    agentId: 'agent-1',
    exhibitorId: null,
    party: { kind: 'AGENT', id: 'agent-1', name: 'PT Sandar Jaya' },
    manifestPrefix: 'S',
    manifestSeq: null,
    commercialInvoiceNumber: null,
    jobNumber: null,
    transportDocumentType: null,
    transportDocumentNumber: null,
    transportDocument: null,
    ciplDocument: null,
    ciplLines: [],
    ciplSources: [],
    invoice: {
      number: null,
      amount: null,
      currency: null,
      status: 'NOT_READY',
      sentAt: null,
      paidAt: null,
    },
    assignedToId: null,
    createdById: null,
    assignedTo: null,
    operational: emptyOperationalDetails(),
    inward: null,
    kepulangan: null,
    emptyStorage: null,
    reExport: null,
    notes: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  } as unknown as Job
}

function makeEvent(overrides: Partial<EventScheduleRef> = {}): EventScheduleRef {
  return {
    id: 'event-1',
    name: 'Pameran Satu',
    venueName: 'Jakarta International Expo',
    startsOn: '2026-11-10',
    endsOn: '2026-11-20',
    ...overrides,
  }
}

function withEta(date: string, operational: JobOperationalDetails = emptyOperationalDetails()) {
  return {
    operational: {
      ...operational,
      inbound: { ...operational.inbound, scheduleAt: `${date}T08:00:00.000Z` },
    },
  }
}

// CIPL lengkap: invoice (kind CIPL) + packing list (baris CIPL) tanpa koli.
const ciplReceived = {
  ciplSources: [{ kind: 'CIPL', receivedAt: '2026-11-02T00:00:00.000Z' }],
  ciplLines: [ciplLine(0)],
} as unknown as Partial<Job>

function ciplLine(totalCount: number) {
  return {
    id: `line-${totalCount}`,
    exhibitorId: null,
    exhibitor: null,
    nameOnDocument: 'X',
    koli: { totalCount, bareCaseCount: null, details: [] },
    items: [],
    notes: [],
  }
}

function dashboard(jobs: readonly Job[], events: readonly EventScheduleRef[] = [makeEvent()]) {
  return buildOperationsDashboard({ jobs, events, today: TODAY })
}

describe('buildOperationsDashboard', () => {
  test('job dibatalkan dan job pada event di luar cakupan tidak muncul dan tidak menambah jobCount', () => {
    const operations = dashboard(
      [
        makeJob({ id: 'job-keep', ...withEta('2026-11-18') }),
        makeJob({ id: 'job-orphan', eventId: 'event-x', ...withEta('2026-11-18') }),
        makeJob({ id: 'job-cancelled', status: 'CANCELLED', ...withEta('2026-11-18') }),
        makeJob({ id: 'job-orphan-noeta', eventId: 'event-x' }),
        makeJob({ id: 'job-cancelled-noeta', status: 'CANCELLED' }),
      ],
      [makeEvent()],
    )

    expect(operations.etaDocsMissing.map((row) => row.jobId)).toEqual(['job-keep'])
    expect(operations.etaMissing).toEqual([])
    expect(operations.eventWeights[0].jobCount).toBe(1)
  })

  test('eventsWithoutJob: hanya event mendatang dalam 30 hari tanpa job, job selesai dihitung ada', () => {
    const operations = dashboard(
      [makeJob({ id: 'job-done', eventId: 'event-selesai-job', status: 'COMPLETED' })],
      [
        makeEvent({ id: 'event-kosong', name: 'Kosong', startsOn: '2026-11-25', endsOn: '2026-11-28' }),
        makeEvent({
          id: 'event-selesai-job',
          name: 'Ada job selesai',
          startsOn: '2026-11-28',
          endsOn: '2026-11-30',
        }),
        makeEvent({ id: 'event-hari-ini', name: 'Hari ini', startsOn: '2026-11-15' }),
        makeEvent({ id: 'event-jauh', name: 'Jauh', startsOn: '2026-12-20', endsOn: '2026-12-22' }),
      ],
    )

    expect(operations.eventsWithoutJob).toEqual([
      {
        eventId: 'event-kosong',
        eventName: 'Kosong',
        venueName: 'Jakarta International Expo',
        startsOn: '2026-11-25',
        arrivalDeadline: '2026-11-11',
        daysToDeadline: -4,
      },
    ])
  })

  test('job turunan (BC 2.5/3.0) tanpa ETA tidak masuk etaMissing; job masuk tetap', () => {
    const operations = dashboard([
      makeJob({ id: 'job-inbound', stage: 'INBOUND', sourceJobId: null }),
      makeJob({ id: 'job-derived', stage: 'RE_EXPORT', sourceJobId: 'job-inbound' }),
    ])

    expect(operations.etaMissing.map((row) => row.jobId)).toEqual(['job-inbound'])
  })

  test('etaDocsMissing: kekurangan CIPL dan nomor angkut, urut menurut ETA', () => {
    const operations = dashboard([
      makeJob({ id: 'job-sea', ...withEta('2026-11-18') }),
      makeJob({
        id: 'job-air',
        transportMode: 'AIR',
        ...ciplReceived,
        ...withEta('2026-11-16'),
      }),
    ])

    expect(operations.etaDocsMissing.map((row) => [row.jobId, row.eta, row.missing])).toEqual([
      ['job-air', '2026-11-16', ['AWB belum ada']],
      ['job-sea', '2026-11-18', ['Menunggu CIPL', 'B/L belum ada']],
    ])
  })

  test('etaDocsMissing: ETA jauh, moda ROAD lengkap, dan job selesai tidak masuk', () => {
    const operations = dashboard([
      makeJob({ id: 'job-jauh', ...withEta('2026-11-23') }),
      makeJob({ id: 'job-road', transportMode: 'ROAD', ...ciplReceived, ...withEta('2026-11-17') }),
      makeJob({ id: 'job-done', status: 'COMPLETED', ...withEta('2026-11-17') }),
    ])

    expect(operations.etaDocsMissing).toEqual([])
  })

  test('etaDocsMissing: ETA yang sudah lewat ikut selama pameran belum selesai', () => {
    const operations = dashboard(
      [
        makeJob({ id: 'job-lewat', ...withEta('2026-11-13') }),
        makeJob({ id: 'job-event-selesai', eventId: 'event-2', ...withEta('2026-11-13') }),
      ],
      [makeEvent(), makeEvent({ id: 'event-2', startsOn: '2026-11-01', endsOn: '2026-11-14' })],
    )

    expect(operations.etaDocsMissing.map((row) => row.jobId)).toEqual(['job-lewat'])
  })

  test('etaDocsMissing: ETA dari milestone manifest dibaca bila scheduleAt kosong', () => {
    const operations = dashboard([
      makeJob({
        id: 'job-milestone',
        inward: { milestones: [{ kind: 'ETA', date: '2026-11-17' }] },
      } as unknown as Partial<Job>),
    ])

    expect(operations.etaDocsMissing.map((row) => [row.jobId, row.eta])).toEqual([
      ['job-milestone', '2026-11-17'],
    ])
    expect(operations.etaMissing).toEqual([])
  })

  test('etaMissing: job aktif tanpa ETA pada pameran belum selesai, tenggat = mulai − 14', () => {
    const operations = dashboard(
      [
        makeJob({ id: 'job-tanpa-eta' }),
        makeJob({ id: 'job-event-selesai', eventId: 'event-2' }),
        makeJob({ id: 'job-ber-eta', ...withEta('2026-11-30') }),
      ],
      [makeEvent(), makeEvent({ id: 'event-2', startsOn: '2026-11-01', endsOn: '2026-11-14' })],
    )

    expect(operations.etaMissing).toHaveLength(1)
    expect(operations.etaMissing[0]).toMatchObject({
      jobId: 'job-tanpa-eta',
      eventStartsOn: '2026-11-10',
      arrivalDeadline: '2026-10-27',
    })
  })

  test('eventWeights: skor = jumlah job + total koli, event kosong skor 0, event selesai tidak ada', () => {
    const operations = dashboard(
      [
        makeJob({ id: 'job-a1', eventId: 'event-a', ciplLines: [ciplLine(3)] } as unknown as Partial<Job>),
        makeJob({ id: 'job-a2', eventId: 'event-a', ciplLines: [ciplLine(5)] } as unknown as Partial<Job>),
      ],
      [
        makeEvent({ id: 'event-b', name: 'B', startsOn: '2026-11-22', endsOn: '2026-11-24' }),
        makeEvent({ id: 'event-a', name: 'A', startsOn: '2026-11-20', endsOn: '2026-11-22' }),
        makeEvent({ id: 'event-lama', name: 'Lama', startsOn: '2026-11-01', endsOn: '2026-11-14' }),
      ],
    )

    expect(operations.eventWeights.map((row) => [row.eventId, row.jobCount, row.koliCount, row.score])).toEqual([
      ['event-a', 2, 8, 10],
      ['event-b', 0, 0, 0],
    ])
  })

  test('specialInstructions: dikelompokkan per event, termasuk event selesai; job selesai/batal/kosong tidak', () => {
    const operations = dashboard(
      [
        makeJob({ id: 'job-b', eventId: 'event-a', jobNumber: 'S.02', specialInstructions: 'Urgent re-export' }),
        makeJob({ id: 'job-a', eventId: 'event-a', jobNumber: 'S.01', specialInstructions: ' Butuh vacuum pack ' }),
        makeJob({ id: 'job-lama', eventId: 'event-lama', specialInstructions: 'Forklift 5 ton' }),
        makeJob({ id: 'job-done', eventId: 'event-a', status: 'COMPLETED', specialInstructions: 'x' }),
        makeJob({ id: 'job-batal', eventId: 'event-a', status: 'CANCELLED', specialInstructions: 'x' }),
        makeJob({ id: 'job-kosong', eventId: 'event-a', specialInstructions: '   ' }),
      ],
      [
        makeEvent({ id: 'event-a', name: 'A', startsOn: '2026-11-20', endsOn: '2026-11-22' }),
        makeEvent({ id: 'event-lama', name: 'Lama', startsOn: '2026-11-01', endsOn: '2026-11-14' }),
      ],
    )

    expect(
      operations.specialInstructions.map((group) => [group.eventId, group.jobs.map((job) => [job.jobId, job.text])]),
    ).toEqual([
      ['event-lama', [['job-lama', 'Forklift 5 ton']]],
      ['event-a', [['job-a', 'Butuh vacuum pack'], ['job-b', 'Urgent re-export']]],
    ])
  })

  test('wibDateOf: instan UTC menjelang tengah malam WIB tetap tanggal berikutnya', () => {
    expect(wibDateOf(new Date('2026-11-14T17:00:00.000Z'))).toBe('2026-11-15')
  })
})
