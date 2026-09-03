import { readFile, writeFile } from 'node:fs/promises'

type DiscoverySample = {
  sample_id: string
  request_date: string
  job_ref: string
  activity_type: string
  additional_activity_types?: string[]
  origin: string | null
  destination: string | null
  schedule_text: string | null
  cargo_summary: string | null
  required_resources: string[]
  dependencies: Array<{ type: string; status: string }>
  observed_status: string
  data_gaps: string[]
  exception?: string
  source_lines: number[]
  normalization_confidence: number
}

type Issue = { code: string; path: string; severity: 'error' | 'warning'; message: string }

const input = 'docs/data/operational-request-samples.jsonl'
const output = 'docs/data/domain-validation-results.json'
const samples = (await readFile(input, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as DiscoverySample)
const movementTypes = new Set(['PICKUP', 'DELIVERY', 'TRANSFER', 'MOVE_IN', 'MOVE_OUT'])
const relativeTime = /\b(besok|hari ini|pagi|siang|sore|malam|senin|selasa|rabu|kamis|jumat|sabtu|minggu)\b/i

function includesGap(sample: DiscoverySample, pattern: RegExp) {
  return sample.data_gaps.some((gap) => pattern.test(gap))
}

function validate(sample: DiscoverySample) {
  const issues: Issue[] = []
  const add = (code: string, path: string, message: string, severity: Issue['severity'] = 'error') => issues.push({ code, path, severity, message })

  if (!sample.source_lines.length) add('MISSING_SOURCE', 'source_lines', 'Fakta discovery tidak memiliki referensi sumber.')
  if (sample.normalization_confidence < 0.7) add('LOW_CONFIDENCE', 'normalization_confidence', 'Interpretasi memerlukan review manusia.', 'warning')
  if (/tidak teridentifikasi/i.test(sample.job_ref) || includesGap(sample, /job identity|request identity/i)) add('UNKNOWN_JOB', 'job_ref', 'Job induk belum dapat diidentifikasi.')

  if (!sample.schedule_text) add('UNKNOWN_SCHEDULE', 'schedule_text', 'Requested time window belum diketahui.')
  else if (relativeTime.test(sample.schedule_text)) add('UNRESOLVED_TIME', 'schedule_text', 'Bahasa waktu relatif/belum presisi harus diselesaikan menjadi time window absolut.')

  if (movementTypes.has(sample.activity_type)) {
    if (!sample.origin) add('UNKNOWN_ORIGIN', 'origin', 'Movement activity memerlukan origin.')
    if (!sample.destination) add('UNKNOWN_DESTINATION', 'destination', 'Movement activity memerlukan destination.')
  } else if (!sample.origin && !sample.destination) {
    add('UNKNOWN_SITE', 'origin|destination', 'Site/customs activity memerlukan lokasi pelaksanaan.')
  }

  if (!sample.cargo_summary || includesGap(sample, /cargo detail|cargo identity|^cargo$/i)) add('UNKNOWN_CARGO', 'cargo_summary', 'Deskripsi/identitas cargo belum cukup.')
  if (includesGap(sample, /package count|cargo count|(^| )count$|jumlah/i)) add('UNKNOWN_PACKAGE_COUNT', 'cargo', 'Jumlah package belum diketahui atau diperselisihkan.')
  if (includesGap(sample, /weight|berat/i)) add('UNKNOWN_WEIGHT', 'cargo', 'Berat belum diketahui atau belum di-waive.')
  if (includesGap(sample, /dimension|panjang|lebar|height|width/i)) add('UNKNOWN_DIMENSIONS', 'cargo', 'Dimensi belum diketahui atau belum di-waive.')
  if (includesGap(sample, /pic|contact/i)) add('UNKNOWN_LOCATION_CONTACT', 'location.contact', 'PIC lokasi belum diketahui.')

  if (!sample.required_resources.length && movementTypes.has(sample.activity_type)) add('UNKNOWN_RESOURCES', 'required_resources', 'Kebutuhan resource belum dinyatakan.')
  if (includesGap(sample, /vehicle|truck|mobil|kendaraan/i)) add('UNKNOWN_VEHICLE_REQUIREMENT', 'required_resources', 'Jenis/kapasitas kendaraan belum pasti.')

  for (const [index, dependency] of sample.dependencies.entries()) {
    if (/INCOMPLETE|UNKNOWN|RECONSIDER|REJECTED/i.test(dependency.status)) add('UNRESOLVED_DEPENDENCY', `dependencies.${index}`, `${dependency.type} berstatus ${dependency.status}.`)
    else if (/REQUESTED|PARTIAL/i.test(dependency.status)) add('OPEN_DEPENDENCY', `dependencies.${index}`, `${dependency.type} masih ${dependency.status}.`, 'warning')
  }

  if (sample.exception) add('OBSERVED_EXCEPTION', 'exception', sample.exception, 'warning')
  if (sample.additional_activity_types?.length) add('COMPOSITE_WORK_ORDER', 'additional_activity_types', 'Work order harus diuraikan menjadi beberapa activity.', 'warning')
  if (/dua pekerjaan berbeda/i.test(sample.exception ?? '')) add('SOURCE_SPLITS_TO_MULTIPLE_WORK_ORDERS', 'source_lines', 'Satu source record perlu menghasilkan lebih dari satu work order.', 'warning')

  const errors = issues.filter((item) => item.severity === 'error')
  return {
    sample_id: sample.sample_id,
    intake_representable: sample.source_lines.length > 0 && Boolean(sample.request_date && sample.job_ref && sample.activity_type),
    planning_eligible: errors.length === 0,
    error_count: errors.length,
    warning_count: issues.length - errors.length,
    issues,
  }
}

const results = samples.map(validate)
const issueCounts = new Map<string, number>()
for (const result of results) for (const issue of result.issues) issueCounts.set(issue.code, (issueCounts.get(issue.code) ?? 0) + 1)

const document = {
  method: 'Language-derived domain gate; no database schema involved.',
  source: input,
  sample_count: samples.length,
  intake_representable_count: results.filter((item) => item.intake_representable).length,
  planning_eligible_count: results.filter((item) => item.planning_eligible).length,
  needs_information_count: results.filter((item) => !item.planning_eligible).length,
  issue_counts: [...issueCounts].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count),
  results,
}

await writeFile(output, `${JSON.stringify(document, null, 2)}\n`)
console.log(JSON.stringify({
  output,
  sample_count: document.sample_count,
  intake_representable_count: document.intake_representable_count,
  planning_eligible_count: document.planning_eligible_count,
  needs_information_count: document.needs_information_count,
  issue_counts: document.issue_counts,
}, null, 2))
