import assert from 'node:assert/strict'
import {
  administrativeTask,
  customerServiceActor,
  customsActor,
  customsSource,
  customsTask,
  deliveryTask,
  destination,
  handlingTask,
  id,
  initialProject,
  operationsActor,
  origin,
  requestSource,
  supervisorActor,
} from './examples'
import { conflicting, known, notApplicable, unknown } from './types'
import type { Assignment, Evidence, MovementTask, Project, Task } from './types'
import {
  applyProjectChange,
  assessCustomsReadiness,
  canCompleteProject,
  completeTask,
  detectResourceConflicts,
  identifyInformationGaps,
  validateTaskForPlanning,
} from './validation'

const confirmation = { confirmedAt: '2026-02-18T17:00:00+07:00', confirmedBy: supervisorActor }
const codes = (issues: readonly { code: string }[]) => new Set(issues.map((item) => item.code))

const initialValidation = validateTaskForPlanning(deliveryTask, confirmation)
assert.equal(initialValidation.ok, false)
if (!initialValidation.ok) {
  assert(codes(initialValidation.issues).has('RELATIVE_TIME'))
  assert(codes(initialValidation.issues).has('UNKNOWN_ORIGIN'))
  assert(codes(initialValidation.issues).has('UNKNOWN_VEHICLE_TYPE'))
  assert(codes(initialValidation.issues).has('OPEN_BLOCKER'))
}

const conflictingLocationTask: MovementTask = {
  ...deliveryTask,
  origin: conflicting([
    { value: origin, sources: [requestSource] },
    { value: destination, sources: [customsSource] },
  ], operationsActor),
}
const conflictingValidation = validateTaskForPlanning(conflictingLocationTask, confirmation)
assert.equal(conflictingValidation.ok, false)
if (!conflictingValidation.ok) assert(codes(conflictingValidation.issues).has('CONFLICTING_INFORMATION'))

const readyCandidate: MovementTask = {
  ...deliveryTask,
  requestedTime: known({ kind: 'exact', at: '2026-02-19T08:00:00+07:00' }, [requestSource]),
  plannedTime: known({ kind: 'window', startsAt: '2026-02-19T07:00:00+07:00', endsAt: '2026-02-19T10:00:00+07:00' }, [requestSource]),
  deadline: notApplicable('Tidak ada deadline tambahan di luar planned window.'),
  origin: known(origin, [requestSource]),
  resourceRequirements: [{
    kind: 'vehicle',
    vehicleType: known('CDD', [requestSource]),
    quantity: 1,
    minimumCapacityKg: known(1000, [requestSource]),
  }],
  blockers: [],
}
const ready = validateTaskForPlanning(readyCandidate, confirmation)
assert.equal(ready.ok, true)
if (ready.ok) assert.equal(ready.value.readiness.kind, 'ready', 'task lengkap berpindah dari NeedsInformation ke Ready')

const documentMissing = validateTaskForPlanning(customsTask, confirmation)
assert.equal(documentMissing.ok, false)
if (!documentMissing.ok) assert(codes(documentMissing.issues).has('DOCUMENT_NOT_READY'))

const projectGaps = identifyInformationGaps(initialProject)
assert(codes(projectGaps).has('UNKNOWN_WEIGHT'), 'Information Unknown menjadi gap')
assert(codes(projectGaps).has('RELATIVE_TIME'), 'waktu relatif menjadi gap')
assert(!projectGaps.some((item) => item.path === 'cargoItems.1.weightKg'), 'Information NotApplicable bukan gap')

const resource = { id: id<'resource'>('vehicle-cdd-01'), kind: 'vehicle' as const, label: 'CDD 01' }
const assignmentA: Assignment = {
  id: id<'assignment'>('assignment-a'),
  taskId: deliveryTask.id,
  resource,
  window: { kind: 'window', startsAt: '2026-02-19T07:00:00+07:00', endsAt: '2026-02-19T10:00:00+07:00' },
  status: 'confirmed',
  assignedBy: operationsActor,
  source: requestSource,
}
const assignmentB: Assignment = {
  ...assignmentA,
  id: id<'assignment'>('assignment-b'),
  taskId: handlingTask.id,
  window: { kind: 'window', startsAt: '2026-02-19T09:00:00+07:00', endsAt: '2026-02-19T11:00:00+07:00' },
}
assert.equal(detectResourceConflicts([assignmentA, assignmentB]).length, 1)
assert.equal(detectResourceConflicts([assignmentA, { ...assignmentB, status: 'cancelled' }]).length, 0)

const changed = applyProjectChange(
  initialProject,
  { kind: 'task-requested-time', taskId: deliveryTask.id, value: known({ kind: 'exact', at: '2026-02-19T08:00:00+07:00' }, [requestSource]) },
  {
    id: id<'change'>('change-confirm-time'),
    changeType: 'confirmation',
    reason: '“besok” dikonfirmasi menjadi waktu absolut.',
    actor: supervisorActor,
    occurredAt: confirmation.confirmedAt,
    source: requestSource,
  },
)
assert.equal(changed.project.changes.length, 1)
const previous = changed.record.previousInformation as MovementTask['requestedTime']
assert.equal(previous.kind, 'known')
if (previous.kind === 'known') assert.equal(previous.value.kind, 'relative', 'nilai dan sumber sebelumnya dipertahankan')

const rejectedEvidence: Evidence = {
  id: id<'evidence'>('evidence-rejected'),
  taskId: readyCandidate.id,
  evidenceType: 'delivery-receipt',
  fileReference: 'delivery-receipt.jpg',
  capturedAt: '2026-02-19T10:00:00+07:00',
  submittedBy: operationsActor,
  verification: 'rejected',
  sources: [requestSource],
}
assert.equal(completeTask(readyCandidate, { completedAt: rejectedEvidence.capturedAt, outcome: 'Delivered', evidence: [] }).ok, false)
assert.equal(completeTask(readyCandidate, { completedAt: rejectedEvidence.capturedAt, outcome: 'Delivered', evidence: [rejectedEvidence] }).ok, false)
const acceptedEvidence = { ...rejectedEvidence, id: id<'evidence'>('evidence-accepted'), verification: 'accepted' as const }
const completed = completeTask(readyCandidate, { completedAt: acceptedEvidence.capturedAt, outcome: 'Delivered', evidence: [acceptedEvidence] })
assert.equal(completed.ok, true)

assert.equal(initialProject.customs.kind, 'case')
if (initialProject.customs.kind === 'case') {
  assert.equal(initialProject.customs.decisions.length, 2)
  assert.notEqual(
    initialProject.customs.decisions[0].intendedDisposal.kind === 'known' && initialProject.customs.decisions[0].intendedDisposal.value,
    initialProject.customs.decisions[1].intendedDisposal.kind === 'known' && initialProject.customs.decisions[1].intendedDisposal.value,
    'intended disposal berbeda menghasilkan keputusan per item terpisah',
  )
}
assert.equal(assessCustomsReadiness(initialProject.customs).status, 'requires-authority-confirmation')

const completedExecution = {
  kind: 'completed' as const,
  completedAt: '2026-08-18T17:00:00+07:00',
  outcome: 'Selesai',
  evidenceIds: [acceptedEvidence.id] as const,
}
const operationallyComplete: Project = {
  ...initialProject,
  tasks: initialProject.tasks.map((task): Task => ({
    ...task,
    execution: completedExecution,
    evidence: [{ ...acceptedEvidence, taskId: task.id }],
  })) as unknown as Project['tasks'],
}
const taskStillOpen: Project = {
  ...operationallyComplete,
  customs: { kind: 'not-relevant', reason: 'Skenario khusus gate task.' },
  tasks: [{ ...operationallyComplete.tasks[0], execution: { kind: 'not-started' } }],
}
assert.equal(canCompleteProject(taskStillOpen).ok, false, 'task wajib terbuka menahan project')

const heldByCustoms = canCompleteProject(operationallyComplete)
assert.equal(heldByCustoms.ok, false)
assert(heldByCustoms.reasons.some((reason) => reason.includes('Customs close-out')))

const fullyClosed: Project = {
  ...operationallyComplete,
  customs: operationallyComplete.customs.kind === 'case'
    ? {
        ...operationallyComplete.customs,
        decisions: operationallyComplete.customs.decisions.map((decision) => ({
          ...decision,
          closeOut: {
            kind: 'completed' as const,
            outcome: 'Reconciled',
            inboundQuantity: { value: 1, unit: 'item' },
            reconciledQuantity: { value: 1, unit: 'item' },
            evidenceIds: [acceptedEvidence.id],
            completedAt: '2026-08-18T17:00:00+07:00',
            reviewer: customsActor,
          },
        })) as unknown as typeof operationallyComplete.customs.decisions,
      }
    : operationallyComplete.customs,
}
assert.equal(canCompleteProject(fullyClosed).ok, true)

assert.equal(handlingTask.kind, 'handling')
assert.equal(customsTask.kind, 'customs')
assert.equal(administrativeTask.kind, 'administrative')
assert.equal(unknown('belum ada', customerServiceActor).kind, 'unknown')
assert(initialProject.participants[0].roles.includes('document-customs'))
assert.equal(initialProject.participants[0].sources[0], requestSource)
assert.equal(initialProject.participants[0].period.kind, 'not-applicable')
assert.equal(operationsActor.kind, 'participant')
if (operationsActor.kind === 'participant') assert.equal(operationsActor.partyId, initialProject.participants[0].party.id)

console.log('domain-v2-tests=passed')
