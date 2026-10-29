import { describe, expect, test } from 'bun:test'

import {
  eventTuntas,
  hitungJobBelumTuntas,
  jobTuntas,
  type TuntasJobShape,
} from '@/domain/event/tuntas'

function customsDoc(overrides: Partial<{ applicable: boolean; status: string; registrationNumber: string | null }> = {}) {
  return { applicable: true, status: 'NOT_STARTED', registrationNumber: null, ...overrides }
}

function internationalJob(overrides: Partial<TuntasJobShape> = {}): TuntasJobShape {
  return {
    kind: 'INTERNATIONAL',
    internationalJenis: 'TEMPORARY_IMPORT',
    kepulangan: null,
    operational: {
      customs: {
        BC_2_3: customsDoc({ status: 'COMPLETED' }),
        BC_2_5: customsDoc({ applicable: false }),
        BC_3_0: customsDoc({ status: 'COMPLETED' }),
        BC_2_7: customsDoc({ applicable: false }),
      },
    },
    ...overrides,
  }
}

describe('jobTuntas', () => {
  test('dokumen applicable masih NOT_STARTED → belum tuntas', () => {
    const job = internationalJob({
      operational: {
        customs: {
          BC_2_3: customsDoc({ status: 'NOT_STARTED' }),
          BC_2_5: customsDoc({ applicable: false }),
          BC_3_0: customsDoc({ status: 'COMPLETED' }),
          BC_2_7: customsDoc({ applicable: false }),
        },
      },
    })
    expect(jobTuntas(job)).toBe(false)
  })

  test('dokumen selesai tapi jenis wajib kepulangan tanpa kepulangan → belum tuntas', () => {
    expect(jobTuntas(internationalJob({ kepulangan: null }))).toBe(false)
  })

  test('dokumen selesai + kepulangan terisi → tuntas', () => {
    expect(jobTuntas(internationalJob({ kepulangan: { mode: { kind: 'LCL', koliCount: 5 } } }))).toBe(true)
  })

  test('semua jenis wajib kepulangan dinilai wajib', () => {
    for (const jenis of ['TPPB_BC_23', 'ATA_CARNET', 'TEMPORARY_IMPORT', 'ROAD_SHIPMENT']) {
      expect(jobTuntas(internationalJob({ internationalJenis: jenis }))).toBe(false)
    }
  })

  test('PERMANENT_IMPORT tanpa kepulangan tetap bisa tuntas', () => {
    expect(jobTuntas(internationalJob({ internationalJenis: 'PERMANENT_IMPORT' }))).toBe(true)
  })

  test('job LOCAL tanpa dokumen BC → tuntas', () => {
    expect(jobTuntas({ kind: 'LOCAL', operational: { customs: {} } })).toBe(true)
  })

  test('nomor registrasi terisi dianggap selesai walau status belum COMPLETED', () => {
    const job = internationalJob({
      kepulangan: { mode: { kind: 'FCL', containers: [] } },
      operational: {
        customs: {
          BC_2_3: customsDoc({ registrationNumber: '0012345678' }),
          BC_2_5: customsDoc({ status: 'COMPLETED' }),
          BC_3_0: customsDoc({ applicable: false }),
        },
      },
    })
    expect(jobTuntas(job)).toBe(true)
  })

  test('job lama tanpa kind/operational → tuntas (kepulangan bukan bagian model lama)', () => {
    expect(jobTuntas({ kind: null, internationalJenis: null })).toBe(true)
  })
})

describe('eventTuntas', () => {
  const tuntas = internationalJob({ kepulangan: { mode: { kind: 'LCL', koliCount: 1 } } })
  const belum = internationalJob({ kepulangan: null })

  test('tanpa job → TANPA_JOB (bukan tuduhan menggantung)', () => {
    expect(eventTuntas([])).toBe('TANPA_JOB')
  })

  test('ada satu belum tuntas → BELUM_TUNTAS', () => {
    expect(eventTuntas([tuntas, belum])).toBe('BELUM_TUNTAS')
  })

  test('semua tuntas → TUNTAS', () => {
    expect(eventTuntas([tuntas, tuntas])).toBe('TUNTAS')
  })

  test('hitungJobBelumTuntas menghitung hanya yang belum', () => {
    expect(hitungJobBelumTuntas([tuntas, belum, belum])).toBe(2)
  })
})
