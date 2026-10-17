import { expect, test } from 'bun:test'
import type { LocalJob } from '@/lib/data-client'
import { buildJobNomor } from './job-number'

test('only exposes manually assigned job numbers', () => {
  const jobs = [
    { id: 'empty-job', jobNumber: '   ' },
    { id: 'numbered-job', jobNumber: 'OPS-2026-014' },
  ] as unknown as LocalJob[]

  expect(buildJobNomor(jobs)).toEqual(new Map([['numbered-job', 'OPS-2026-014']]))
})
