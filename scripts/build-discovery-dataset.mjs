import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const sourcePath = path.join(root, 'docs/data/operational-request-samples.jsonl')
const outputDir = path.join(root, 'docs/data/relational')
const samples = (await readFile(sourcePath, 'utf8'))
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line))

const slug = (value) => value
  .normalize('NFKD')
  .replace(/[^a-zA-Z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .toUpperCase()

const unique = (items) => [...new Set(items)]
const writeJson = (name, data) => writeFile(
  path.join(outputDir, `${name}.json`),
  `${JSON.stringify(data, null, 2)}\n`,
)

function inferJobType(workstream) {
  if (workstream.includes('event')) return 'EVENT_PROJECT'
  if (workstream.includes('export') || workstream.includes('import') || workstream.includes('customs')) return 'SHIPMENT'
  if (workstream.includes('warehouse')) return 'WAREHOUSING'
  if (workstream.includes('install') || workstream.includes('handling')) return 'INSTALLATION'
  if (workstream.includes('distribution') || workstream.includes('delivery') || workstream === 'pickup') return 'LOCAL_DISTRIBUTION'
  return 'AD_HOC'
}

function canonicalJobRef(value) {
  const key = value.trim().toLowerCase()
  if (['solartech', 'solartech pickup lokal'].includes(key)) return 'Solartech Event Operations — April 2026'
  if (['nusantara', 'nusantara / nhi'].includes(key)) return 'Nusantara Contract Operations — 2026'
  if (['dupont handling', 'dupont missed cargo', 'dupont empty boxes'].includes(key)) return 'DuPont Event Operations — Agustus 2026'
  return value.trim()
}

function canonicalJobType(name, workstream) {
  if (name.includes('Solartech Event') || name.includes('DuPont Event')) return 'EVENT_PROJECT'
  if (name.includes('Nusantara Contract')) return 'CONTRACT_OPERATION'
  return inferJobType(workstream)
}

function normalizeDataGap(gap) {
  const value = gap.toLowerCase()
  if (/origin|asal/.test(value)) return 'ORIGIN'
  if (/destination|tujuan|locations/.test(value)) return 'DESTINATION'
  if (/package count|cargo count|count$|jumlah/.test(value)) return 'PACKAGE_COUNT'
  if (/weight|berat/.test(value)) return 'WEIGHT'
  if (/dimension|panjang|lebar|height|width/.test(value)) return 'DIMENSIONS'
  if (/cargo detail|cargo identity|^cargo$/.test(value)) return 'CARGO_DESCRIPTION'
  if (/vehicle|truck|mobil|kendaraan/.test(value)) return 'VEHICLE_REQUIREMENT'
  if (/pic|contact/.test(value)) return 'LOCATION_CONTACT'
  if (/schedule|time|arrival|window|reschedule/.test(value)) return 'SCHEDULE'
  if (/job identity|request identity/.test(value)) return 'JOB_IDENTITY'
  if (/evidence|pod/.test(value)) return 'EVIDENCE'
  if (/resource|driver/.test(value)) return 'RESOURCE_ASSIGNMENT'
  if (/document|packing list/.test(value)) return 'DOCUMENT'
  if (/billing|cost|charge/.test(value)) return 'BILLING'
  if (/warehouse|storage|capacity|exit plan/.test(value)) return 'WAREHOUSE'
  return 'OTHER'
}

function workOrderState(observed) {
  const map = {
    NEEDS_INFORMATION: ['NEEDS_INFORMATION', 'INCOMPLETE'],
    BLOCKED: ['NEEDS_INFORMATION', 'BLOCKED'],
    READY_TO_PLAN: ['READY_TO_PLAN', 'READY'],
    PLANNED: ['PLANNED', 'READY'],
    COMPLETED: ['COMPLETED', 'READY'],
    CANCELLED: ['CANCELLED', 'READY'],
    FAILED: ['IN_EXECUTION', 'BLOCKED'],
    DATA_DISPUTED: ['NEEDS_INFORMATION', 'BLOCKED'],
    DELIVERED_AWAITING_POD: ['IN_EXECUTION', 'BLOCKED'],
    PLAN_CHANGED: ['PLANNED', 'BLOCKED'],
    RESOURCE_PLAN_CHANGED: ['PLANNED', 'BLOCKED'],
    REWORK_REQUIRED: ['IN_EXECUTION', 'BLOCKED'],
  }
  return map[observed] ?? ['NEEDS_INFORMATION', 'INCOMPLETE']
}

function activityState(observed) {
  if (observed === 'COMPLETED') return 'DELIVERED'
  if (observed === 'DELIVERED_AWAITING_POD') return 'DELIVERED'
  if (observed === 'CANCELLED') return 'CANCELLED'
  if (observed === 'FAILED') return 'FAILED'
  if (observed === 'REWORK_REQUIRED') return 'FAILED'
  if (observed === 'READY_TO_PLAN' || observed === 'NEEDS_INFORMATION' || observed === 'BLOCKED' || observed === 'DATA_DISPUTED') return 'UNASSIGNED'
  return 'ASSIGNED'
}

function resourceType(text) {
  const value = text.toLowerCase()
  if (/forklift|hand ?pallet|equipment/.test(value)) return 'EQUIPMENT'
  if (/vehicle|truck|trucking|tronton|wingbox|lowbed|wuling|mobil|fuso/.test(value)) return 'VEHICLE'
  if (/driver|manpower|team|operator/.test(value)) return 'PERSON'
  return 'EXTERNAL_SERVICE'
}

function blockerType(sample) {
  const text = `${sample.exception ?? ''} ${sample.data_gaps.join(' ')} ${sample.dependencies.map((d) => `${d.type} ${d.status}`).join(' ')}`.toLowerCase()
  if (/gudang.*(penuh|full)|warehouse.*capacity/.test(text)) return 'WAREHOUSE_FULL'
  if (/sppb|peb|pib|do|fo|document|surat jalan|release/.test(text)) return 'WAITING_FOR_DOCUMENT'
  if (/driver/.test(text)) return 'NO_DRIVER'
  if (/vehicle|truck|mobil|kendaraan/.test(text)) return 'NO_SUITABLE_VEHICLE'
  if (/manpower/.test(text)) return 'NO_MANPOWER'
  if (/forklift|equipment/.test(text)) return 'NO_EQUIPMENT'
  if (/cargo|package|weight|dimension|barang/.test(text)) return 'MISSING_CARGO_DATA'
  return 'OTHER'
}

const jobKeyToId = new Map()
const jobs = []
for (const sample of samples) {
  const canonicalName = canonicalJobRef(sample.job_ref)
  const key = canonicalName.toLowerCase()
  if (!jobKeyToId.has(key)) {
    const id = `JOB-${String(jobs.length + 1).padStart(3, '0')}`
    jobKeyToId.set(key, id)
    jobs.push({
      id,
      job_number: `DISC-${sample.request_date.slice(0, 4)}-${String(jobs.length + 1).padStart(3, '0')}`,
      parent_job_id: null,
      name: canonicalName,
      job_type: canonicalJobType(canonicalName, sample.workstream),
      customer_id: null,
      status: sample.observed_status === 'CANCELLED' ? 'CANCELLED' : 'OPEN',
      commercial_status: 'UNQUOTED',
      needs_master_data_review: true,
    })
  }
}

const workOrders = []
const activities = []
const cargos = []
const activityCargo = []
const resourceRequirements = []
const documentRequirements = []
const blockers = []
const sourceLinks = []

for (const sample of samples) {
  const workOrderId = sample.sample_id.replace('SMP', 'WO')
  const canonicalName = canonicalJobRef(sample.job_ref)
  const jobId = jobKeyToId.get(canonicalName.toLowerCase())
  const [status, readiness] = workOrderState(sample.observed_status)
  workOrders.push({
    id: workOrderId,
    work_order_number: `DISC-${workOrderId}`,
    job_id: jobId,
    requested_at: `${sample.request_date}T00:00:00+07:00`,
    work_order_type: sample.workstream.toUpperCase(),
    priority: 'NORMAL',
    requested_window_raw: sample.schedule_text,
    status,
    readiness_status: readiness,
    observed_status_raw: sample.observed_status,
    instruction: sample.exception ?? null,
    normalization_confidence: sample.normalization_confidence,
    data_gaps: sample.data_gaps,
    normalized_data_gaps: unique(sample.data_gaps.map(normalizeDataGap)),
  })

  const allActivityTypes = [sample.activity_type, ...(sample.additional_activity_types ?? [])]
  allActivityTypes.forEach((type, index) => {
    const activityId = `ACT-${sample.sample_id.slice(4)}-${String(index + 1).padStart(2, '0')}`
    activities.push({
      id: activityId,
      work_order_id: workOrderId,
      sequence_no: index + 1,
      activity_type: type,
      origin_raw: index === 0 ? sample.origin : null,
      destination_raw: index === allActivityTypes.length - 1 ? sample.destination : null,
      planned_window_raw: sample.schedule_text,
      status: activityState(sample.observed_status),
      requires_pod: ['DELIVERY', 'MOVE_IN', 'MOVE_OUT'].includes(type),
      failure_reason: ['FAILED', 'REWORK_REQUIRED'].includes(sample.observed_status) ? sample.exception ?? 'Lihat sumber' : null,
    })

    if (sample.cargo_summary) {
      const cargoId = `CGO-${sample.sample_id.slice(4)}`
      if (index === 0) {
        cargos.push({
          id: cargoId,
          job_id: jobId,
          cargo_code: `DISC-${cargoId}`,
          description: sample.cargo_summary,
          package_count: null,
          gross_weight_kg: null,
          current_location_raw: sample.origin,
          data_quality_status: sample.observed_status === 'DATA_DISPUTED' ? 'DISPUTED' : 'PARTIAL',
        })
      }
      activityCargo.push({ activity_id: activityId, cargo_id: cargoId, planned_package_count: null, actual_package_count: null })
    }
  })

  sample.required_resources.forEach((requirement, index) => {
    resourceRequirements.push({
      id: `RR-${sample.sample_id.slice(4)}-${String(index + 1).padStart(2, '0')}`,
      activity_id: `ACT-${sample.sample_id.slice(4)}-01`,
      resource_type: resourceType(requirement),
      resource_subtype_raw: requirement,
      quantity: 1,
      is_mandatory: true,
      fulfilment_status: 'OPEN',
      needs_structuring: true,
    })
  })

  sample.dependencies.forEach((dependency, index) => {
    documentRequirements.push({
      id: `DR-${sample.sample_id.slice(4)}-${String(index + 1).padStart(2, '0')}`,
      work_order_id: workOrderId,
      activity_id: null,
      document_type_raw: dependency.type,
      status_raw: dependency.status,
      is_required: true,
      needs_mapping: true,
    })
  })

  if (readiness !== 'READY' || sample.exception) {
    blockers.push({
      id: `BLK-${sample.sample_id.slice(4)}-01`,
      work_order_id: workOrderId,
      activity_id: null,
      blocker_type: blockerType(sample),
      description: sample.exception ?? `Data belum lengkap: ${sample.data_gaps.join(', ')}`,
      opened_at: `${sample.request_date}T00:00:00+07:00`,
      resolved_at: status === 'COMPLETED' || status === 'CANCELLED' ? `${sample.request_date}T23:59:59+07:00` : null,
    })
  }

  sample.source_lines.forEach((line, index) => {
    sourceLinks.push({
      id: `SRC-${sample.sample_id.slice(4)}-${String(index + 1).padStart(2, '0')}`,
      source_type: 'WHATSAPP_EXPORT_LINE',
      source_file: 'docs/whatsapp-operational-vss.txt',
      source_line: line,
      entity_type: 'WORK_ORDER',
      entity_id: workOrderId,
      relation_type: index === 0 ? 'CREATED' : 'UPDATED',
      confidence: sample.normalization_confidence,
    })
  })
}

const locationCandidates = new Map()
for (const sample of samples) {
  for (const [usage, raw] of [['ORIGIN', sample.origin], ['DESTINATION', sample.destination]]) {
    if (!raw) continue
    const key = raw.trim().toLowerCase()
    const current = locationCandidates.get(key) ?? { candidate_id: `LOC-CAND-${String(locationCandidates.size + 1).padStart(3, '0')}`, raw_name: raw, occurrences: 0, usages: [], review_status: 'PENDING' }
    current.occurrences += 1
    current.usages = unique([...current.usages, usage])
    locationCandidates.set(key, current)
  }
}

const gapCounts = new Map()
for (const gap of samples.flatMap((sample) => sample.data_gaps)) gapCounts.set(gap, (gapCounts.get(gap) ?? 0) + 1)
const normalizedGapCounts = new Map()
for (const gap of samples.flatMap((sample) => unique(sample.data_gaps.map(normalizeDataGap)))) normalizedGapCounts.set(gap, (normalizedGapCounts.get(gap) ?? 0) + 1)
const qualitySummary = {
  generated_from: 'docs/data/operational-request-samples.jsonl',
  sample_count: samples.length,
  job_count: jobs.length,
  work_order_count: workOrders.length,
  activity_count: activities.length,
  cargo_count: cargos.length,
  missing_origin_count: samples.filter((sample) => sample.origin === null).length,
  missing_destination_count: samples.filter((sample) => sample.destination === null).length,
  missing_schedule_count: samples.filter((sample) => sample.schedule_text === null).length,
  dependency_count: documentRequirements.length,
  exception_count: samples.filter((sample) => sample.exception).length,
  top_data_gaps: [...gapCounts].map(([field, count]) => ({ field, count })).sort((a, b) => b.count - a.count),
  normalized_gap_counts: [...normalizedGapCounts].map(([field, count]) => ({ field, count })).sort((a, b) => b.count - a.count),
  warning: 'Discovery metrics; selected sample is not statistically random.',
}

const masterDataCandidates = {
  job_names: jobs.map(({ id, name, job_type }) => ({ job_id: id, raw_name: name, inferred_job_type: job_type, review_status: 'PENDING' })),
  locations: [...locationCandidates.values()],
  resource_subtypes: unique(resourceRequirements.map((item) => item.resource_subtype_raw)).sort().map((raw_name, index) => ({ candidate_id: `RES-CAND-${String(index + 1).padStart(3, '0')}`, raw_name, review_status: 'PENDING' })),
  document_types: unique(documentRequirements.map((item) => item.document_type_raw)).sort().map((raw_name, index) => ({ candidate_id: `DOC-CAND-${String(index + 1).padStart(3, '0')}`, raw_name, review_status: 'PENDING' })),
}

await mkdir(outputDir, { recursive: true })
await Promise.all([
  writeJson('jobs', jobs),
  writeJson('work-orders', workOrders),
  writeJson('activities', activities),
  writeJson('cargos', cargos),
  writeJson('activity-cargo', activityCargo),
  writeJson('resource-requirements', resourceRequirements),
  writeJson('document-requirements', documentRequirements),
  writeJson('blockers', blockers),
  writeJson('source-links', sourceLinks),
  writeJson('master-data-candidates', masterDataCandidates),
  writeJson('data-quality-summary', qualitySummary),
])

console.log(JSON.stringify({ outputDir, ...qualitySummary }, null, 2))
