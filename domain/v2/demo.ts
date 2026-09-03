import {
  customerServiceActor,
  deliveryTask,
  id,
  initialProject,
  operationsActor,
  origin,
  requestSource,
  supervisorActor,
} from './examples'
import { known, notApplicable } from './types'
import type { Assignment, Evidence, MovementTask, Project } from './types'
import {
  applyProjectChange,
  assessCustomsReadiness,
  completeTask,
  identifyInformationGaps,
  summarizeProject,
  validateTaskForPlanning,
} from './validation'

const line = (title: string) => console.log(`\n=== ${title} ===`)
const actorLabel = (actor: import('./types').OperationalActor) =>
  actor.kind === 'participant' ? `${actor.role}@${actor.partyId}` : actor.role

let project: Project = { ...initialProject, tasks: [deliveryTask] }

line('1. Permintaan masuk')
console.log('Delivery diminta “besok”; FO menyusul (WhatsApp baris 8604–8611).')
console.log(`Readiness: ${project.tasks[0].readiness.kind}`)

line('2. Information gaps')
for (const item of identifyInformationGaps(project).filter((item) => item.path.startsWith('tasks.0'))) {
  console.log(`- [${item.code}] ${item.path}: ${item.impact} (owner: ${actorLabel(item.owner)})`)
}

const changed = applyProjectChange(
  project,
  {
    kind: 'task-requested-time',
    taskId: deliveryTask.id,
    value: known({ kind: 'exact', at: '2026-02-19T08:00:00+07:00' }, [requestSource]),
  },
  {
    id: id<'change'>('change-demo-confirm-time'),
    changeType: 'confirmation',
    reason: 'Waktu relatif dikonfirmasi menjadi waktu absolut.',
    actor: supervisorActor,
    occurredAt: '2026-02-18T17:00:00+07:00',
    source: requestSource,
  },
)
project = changed.project

const confirmedTask: MovementTask = {
  ...(project.tasks[0] as MovementTask),
  plannedTime: known({
    kind: 'window',
    startsAt: '2026-02-19T07:00:00+07:00',
    endsAt: '2026-02-19T10:00:00+07:00',
  }, [requestSource]),
  deadline: notApplicable('Tidak ada deadline tambahan.'),
  origin: known(origin, [requestSource]),
  resourceRequirements: [{
    kind: 'vehicle',
    vehicleType: known('CDD', [requestSource]),
    quantity: 1,
    minimumCapacityKg: known(1000, [requestSource]),
  }],
  blockers: [{
    kind: 'resolved',
    id: id<'blocker'>('blocker-fo'),
    blockerType: 'document',
    description: 'FO menyusul.',
    openedAt: requestSource.occurredAt,
    owner: customerServiceActor,
    resolvedAt: '2026-02-18T16:45:00+07:00',
    resolution: 'FO diterima dan dikonfirmasi.',
    evidenceIds: [],
  }],
}

line('3. Konfirmasi dan ChangeRecord')
console.log(`ChangeRecord: ${changed.record.field} — ${changed.record.reason}`)
console.log('Nilai sebelumnya tetap tersimpan di previousInformation.')

const validation = validateTaskForPlanning(confirmedTask, {
  confirmedAt: '2026-02-18T17:00:00+07:00',
  confirmedBy: supervisorActor,
})
if (!validation.ok) throw new Error(validation.issues.map((item) => item.code).join(', '))

const assignment: Assignment = {
  id: id<'assignment'>('assignment-demo'),
  taskId: confirmedTask.id,
  resource: { id: id<'resource'>('vehicle-cdd-01'), kind: 'vehicle', label: 'CDD 01' },
  window: { kind: 'window', startsAt: '2026-02-19T07:00:00+07:00', endsAt: '2026-02-19T10:00:00+07:00' },
  status: 'acknowledged',
  assignedBy: operationsActor,
  source: requestSource,
}
const plannedTask: MovementTask = {
  ...(validation.value as MovementTask),
  execution: { kind: 'planned', assignmentIds: [assignment.id], schedule: assignment.window },
}
project = { ...project, tasks: [plannedTask], assignments: [assignment] }

line('4. Planning gate dan assignment')
console.log(`Readiness: ${plannedTask.readiness.kind}`)
console.log(`Assignment: ${assignment.resource.label} (${assignment.status})`)

const evidence: Evidence = {
  id: id<'evidence'>('evidence-demo-receipt'),
  taskId: plannedTask.id,
  evidenceType: 'delivery-receipt',
  fileReference: 'demo://delivery-receipt',
  capturedAt: '2026-02-19T09:40:00+07:00',
  submittedBy: operationsActor,
  verification: 'accepted',
  sources: [requestSource],
}
const completion = completeTask(plannedTask, {
  completedAt: evidence.capturedAt,
  outcome: 'Barang diterima di tujuan.',
  evidence: [evidence],
})
if (!completion.ok) throw new Error(completion.issues.map((item) => item.code).join(', '))
project = { ...project, tasks: [completion.value] }

line('5. Evidence dan penyelesaian task')
console.log(`Evidence: ${evidence.evidenceType} (${evidence.verification})`)
console.log(`Execution: ${completion.value.execution.kind}`)

line('6. Customs menahan penutupan')
const customs = assessCustomsReadiness(project.customs)
console.log(`Status customs: ${customs.status}`)
for (const result of customs.itemResults) {
  console.log(`- ${result.cargoItemId}: ${result.ready ? 'ready' : result.issues.join('; ')}`)
}

line('7. Ringkasan project')
console.log(summarizeProject(project))
