import type {
  AbsoluteWindow,
  Assignment,
  CustomsControl,
  Evidence,
  Id,
  Information,
  InformationGap,
  ItemCustomsDecision,
  MovementTask,
  NonEmpty,
  OperationalActor,
  Project,
  ProjectChange,
  SourceReference,
  Task,
  ValidationResult,
} from './types'

const defaultOwner: OperationalActor = { kind: 'role-owner', role: 'field-operations' }

const gap = (path: string, code: string, impact: string, owner: OperationalActor = defaultOwner): InformationGap => ({
  path,
  code,
  impact,
  owner,
})

const informationGap = <T>(information: Information<T>, path: string, unknownCode: string): InformationGap[] => {
  switch (information.kind) {
    case 'known':
    case 'not-applicable':
      return []
    case 'unknown':
      return [gap(path, unknownCode, information.reason, information.owner)]
    case 'conflicting':
      return [gap(path, 'CONFLICTING_INFORMATION', 'Informasi bertentangan harus diselesaikan sebelum dipakai untuk perencanaan.', information.owner)]
  }
}

const requireKnown = <T>(information: Information<T>, path: string, code: string, impact: string): InformationGap[] => {
  if (information.kind === 'known') return []
  if (information.kind === 'conflicting') return [gap(path, 'CONFLICTING_INFORMATION', impact, information.owner)]
  if (information.kind === 'unknown') return [gap(path, code, information.reason, information.owner)]
  return [gap(path, code, impact)]
}

const validateWindow = (window: AbsoluteWindow, path: string): InformationGap[] =>
  Date.parse(window.endsAt) > Date.parse(window.startsAt)
    ? []
    : [gap(path, 'INVALID_TIME_WINDOW', 'Akhir jadwal harus sesudah awal jadwal.')]

function taskPlanningGaps(task: Task): InformationGap[] {
  const gaps: InformationGap[] = []
  gaps.push(...requireKnown(task.requestedBy, 'requestedBy', 'UNKNOWN_REQUESTER', 'Peminta task harus diketahui.'))

  if (task.requestedTime.kind === 'known') {
    if (task.requestedTime.value.kind === 'relative') {
      gaps.push(gap('requestedTime', 'RELATIVE_TIME', 'Waktu relatif harus dikonfirmasi menjadi waktu absolut.'))
    } else if (task.requestedTime.value.kind === 'window') {
      gaps.push(...validateWindow(task.requestedTime.value, 'requestedTime'))
    }
  } else {
    gaps.push(...requireKnown(task.requestedTime, 'requestedTime', 'UNKNOWN_TIME', 'Waktu task harus diketahui.'))
  }

  gaps.push(...requireKnown(task.plannedTime, 'plannedTime', 'UNKNOWN_PLANNED_TIME', 'Jadwal absolut belum ditetapkan.'))
  if (task.plannedTime.kind === 'known') gaps.push(...validateWindow(task.plannedTime.value, 'plannedTime'))

  const resourceRequirements = task.kind === 'movement' || task.kind === 'handling' ? task.resourceRequirements : []
  resourceRequirements.forEach((requirement, index) => {
    const path = `resourceRequirements.${index}`
    if (requirement.quantity <= 0) gaps.push(gap(`${path}.quantity`, 'NON_POSITIVE_RESOURCE_QUANTITY', 'Jumlah resource harus positif.'))
    if (requirement.kind === 'vehicle') {
      gaps.push(...requireKnown(requirement.vehicleType, `${path}.vehicleType`, 'UNKNOWN_VEHICLE_TYPE', 'Jenis kendaraan diperlukan untuk feasibility.'))
      gaps.push(...requireKnown(requirement.minimumCapacityKg, `${path}.minimumCapacityKg`, 'UNKNOWN_CAPACITY', 'Kapasitas kendaraan diperlukan untuk feasibility.'))
    }
    if (requirement.kind === 'equipment') {
      gaps.push(...requireKnown(requirement.minimumCapacityKg, `${path}.minimumCapacityKg`, 'UNKNOWN_CAPACITY', 'Kapasitas alat diperlukan untuk feasibility.'))
    }
  })

  if (task.kind === 'movement') {
    gaps.push(...requireKnown(task.origin, 'origin', 'UNKNOWN_ORIGIN', 'Origin movement harus diketahui.'))
    gaps.push(...requireKnown(task.destination, 'destination', 'UNKNOWN_DESTINATION', 'Destination movement harus diketahui.'))
    if (task.origin.kind === 'known') gaps.push(...requireKnown(task.origin.value.contact, 'origin.contact', 'UNKNOWN_LOCATION_CONTACT', 'Kontak origin harus diketahui.'))
    if (task.destination.kind === 'known') gaps.push(...requireKnown(task.destination.value.contact, 'destination.contact', 'UNKNOWN_LOCATION_CONTACT', 'Kontak destination harus diketahui.'))
  } else if (task.kind === 'handling' || task.kind === 'customs') {
    gaps.push(...requireKnown(task.location, 'location', 'UNKNOWN_LOCATION', 'Lokasi task harus diketahui.'))
    if (task.location.kind === 'known') gaps.push(...requireKnown(task.location.value.contact, 'location.contact', 'UNKNOWN_LOCATION_CONTACT', 'Kontak lokasi harus diketahui.'))
  } else {
    gaps.push(...requireKnown(task.subject, 'subject', 'UNKNOWN_SUBJECT', 'Subjek pekerjaan administrasi harus diketahui.'))
  }

  if (task.kind === 'customs' || task.kind === 'administrative') {
    for (const [index, document] of task.documentRequirements.entries()) {
      if (document.criticality !== 'planning') continue
      const path = `documentRequirements.${index}.status`
      gaps.push(...requireKnown(document.status, path, 'DOCUMENT_NOT_READY', `${document.documentType} belum siap.`))
      if (document.status.kind === 'known' && !['verified', 'used'].includes(document.status.value)) {
        gaps.push(gap(path, 'DOCUMENT_NOT_READY', `${document.documentType} harus verified sebelum planning.`, { kind: 'role-owner', role: 'document-customs' }))
      }
    }
  }

  for (const blocker of task.blockers) {
    if (blocker.kind === 'open') gaps.push(gap(`blockers.${blocker.id}`, 'OPEN_BLOCKER', blocker.description, blocker.owner))
  }
  return gaps
}

export function identifyInformationGaps(project: Project): InformationGap[] {
  const gaps: InformationGap[] = []
  gaps.push(...informationGap(project.period, 'period', 'UNKNOWN_PROJECT_PERIOD'))
  project.cargoItems.forEach((item, index) => {
    const path = `cargoItems.${index}`
    gaps.push(...requireKnown(item.description, `${path}.description`, 'UNKNOWN_CARGO_DESCRIPTION', 'Deskripsi cargo diperlukan.'))
    gaps.push(...informationGap(item.owner, `${path}.owner`, 'UNKNOWN_CARGO_OWNER'))
    gaps.push(...informationGap(item.weightKg, `${path}.weightKg`, 'UNKNOWN_WEIGHT'))
    gaps.push(...informationGap(item.dimensionsCm, `${path}.dimensionsCm`, 'UNKNOWN_DIMENSIONS'))
    gaps.push(...informationGap(item.intendedUse, `${path}.intendedUse`, 'UNKNOWN_INTENDED_USE'))
    gaps.push(...informationGap(item.intendedDisposal, `${path}.intendedDisposal`, 'UNKNOWN_INTENDED_DISPOSAL'))
  })
  project.tasks.forEach((task, index) => {
    for (const taskGap of taskPlanningGaps(task)) gaps.push({ ...taskGap, path: `tasks.${index}.${taskGap.path}` })
  })
  return gaps
}

export function validateTaskForPlanning(
  task: Task,
  confirmation: { confirmedAt: string; confirmedBy: OperationalActor },
): ValidationResult<Task> {
  const issues = taskPlanningGaps(task)
  if (issues.length) return { ok: false, issues: issues as unknown as NonEmpty<InformationGap> }
  return { ok: true, value: { ...task, readiness: { kind: 'ready', ...confirmation } } }
}

export type ResourceConflict = {
  resourceId: Id<'resource'>
  assignmentIds: readonly [Id<'assignment'>, Id<'assignment'>]
  overlap: AbsoluteWindow
}

export function detectResourceConflicts(assignments: readonly Assignment[]): ResourceConflict[] {
  const active = assignments.filter((assignment) => !['cancelled', 'released'].includes(assignment.status))
  const conflicts: ResourceConflict[] = []
  for (let left = 0; left < active.length; left += 1) {
    for (let right = left + 1; right < active.length; right += 1) {
      const a = active[left]
      const b = active[right]
      if (a.resource.id !== b.resource.id) continue
      const startsAt = Date.parse(a.window.startsAt) >= Date.parse(b.window.startsAt) ? a.window.startsAt : b.window.startsAt
      const endsAt = Date.parse(a.window.endsAt) <= Date.parse(b.window.endsAt) ? a.window.endsAt : b.window.endsAt
      if (Date.parse(startsAt) < Date.parse(endsAt)) {
        conflicts.push({ resourceId: a.resource.id, assignmentIds: [a.id, b.id], overlap: { kind: 'window', startsAt, endsAt } })
      }
    }
  }
  return conflicts
}

export type ChangeMetadata = {
  id: Id<'change'>
  changeType: 'correction' | 'confirmation' | 'replan'
  reason: string
  actor: OperationalActor
  occurredAt: string
  source: SourceReference
}

export function applyProjectChange(project: Project, change: ProjectChange, metadata: ChangeMetadata) {
  let previousInformation: unknown
  const tasks = project.tasks.map((task): Task => {
    if (task.id !== change.taskId) return task
    switch (change.kind) {
      case 'task-requested-time':
        previousInformation = task.requestedTime
        return { ...task, requestedTime: change.value }
      case 'task-planned-time':
        previousInformation = task.plannedTime
        return { ...task, plannedTime: change.value }
      case 'movement-destination':
        if (task.kind !== 'movement') throw new Error('Destination hanya dapat diubah pada movement task.')
        previousInformation = task.destination
        return { ...task, destination: change.value }
    }
  })
  if (previousInformation === undefined) throw new Error(`Task ${change.taskId} tidak ditemukan.`)
  const field = change.kind === 'task-requested-time' ? 'requestedTime' : change.kind === 'task-planned-time' ? 'plannedTime' : 'destination'
  const record = {
    ...metadata,
    subject: `task:${change.taskId}`,
    field,
    previousInformation,
    newInformation: change.value,
  }
  return {
    project: { ...project, tasks: tasks as unknown as Project['tasks'], changes: [...project.changes, record] },
    record,
  }
}

export type CustomsReadiness = {
  status: 'not-relevant' | 'needs-information' | 'provisional' | 'requires-authority-confirmation' | 'ready'
  itemResults: readonly { cargoItemId: Id<'cargo-item'>; ready: boolean; issues: readonly string[] }[]
}

function customsDecisionIssues(decision: ItemCustomsDecision): string[] {
  const issues = [...decision.openIssues]
  if (decision.intendedUse.kind !== 'known') issues.push('Intended use belum tunggal dan diketahui.')
  if (decision.intendedDisposal.kind !== 'known' || decision.intendedDisposal.value === 'undecided') issues.push('Intended disposal belum diputuskan.')
  if (!decision.technicalDescriptionReady) issues.push('Deskripsi teknis belum siap.')
  if (decision.treatment.kind === 'undecided') issues.push(...decision.treatment.missingInformation)
  if (decision.treatment.kind === 'provisional') issues.push(`Konfirmasi diperlukan: ${decision.treatment.confirmationNeeded}`)
  return issues
}

export function assessCustomsReadiness(customs: CustomsControl): CustomsReadiness {
  if (customs.kind === 'not-relevant') return { status: 'not-relevant', itemResults: [] }
  const itemResults = customs.decisions.map((decision) => {
    const issues = customsDecisionIssues(decision)
    return { cargoItemId: decision.cargoItemId, ready: issues.length === 0 && decision.treatment.kind === 'confirmed', issues }
  })
  let status: CustomsReadiness['status'] = 'ready'
  if (itemResults.some((item) => item.issues.some((issue) => !issue.startsWith('Konfirmasi diperlukan:')))) status = 'needs-information'
  else if (customs.recommendationStatus === 'requires-authority-confirmation') status = 'requires-authority-confirmation'
  else if (customs.recommendationStatus === 'provisional' || itemResults.some((item) => !item.ready)) status = 'provisional'
  return { status, itemResults }
}

export type CompletionRequest = { completedAt: string; outcome: string; evidence: readonly Evidence[] }

export function completeTask(task: Task, request: CompletionRequest): ValidationResult<Task> {
  const issues: InformationGap[] = []
  for (const requirement of task.evidenceRequirements) {
    const count = request.evidence.filter((evidence) =>
      evidence.taskId === task.id && evidence.evidenceType === requirement.evidenceType && evidence.verification === 'accepted').length
    if (count < requirement.minimum) {
      issues.push(gap('evidence', 'MISSING_COMPLETION_EVIDENCE', `Perlu ${requirement.minimum} evidence accepted bertipe ${requirement.evidenceType}.`, { kind: 'role-owner', role: 'field-operations' }))
    }
  }
  if (issues.length) return { ok: false, issues: issues as unknown as NonEmpty<InformationGap> }
  const evidenceIds = request.evidence.map((evidence) => evidence.id) as unknown as NonEmpty<Id<'evidence'>>
  return {
    ok: true,
    value: { ...task, evidence: [...task.evidence, ...request.evidence], execution: { kind: 'completed', completedAt: request.completedAt, outcome: request.outcome, evidenceIds } },
  }
}

export function canCompleteProject(project: Project): { ok: boolean; reasons: string[] } {
  const reasons: string[] = []
  for (const task of project.tasks) {
    if (!task.mandatory) continue
    if (task.execution.kind !== 'completed') {
      reasons.push(`Task wajib ${task.title} belum selesai.`)
      continue
    }
    for (const requirement of task.evidenceRequirements) {
      const accepted = task.evidence.filter((evidence) =>
        evidence.evidenceType === requirement.evidenceType && evidence.verification === 'accepted').length
      if (accepted < requirement.minimum) reasons.push(`Evidence task wajib ${task.title} belum memenuhi ${requirement.evidenceType}.`)
    }
  }
  for (const milestone of project.milestones) {
    if (milestone.mandatory && milestone.state !== 'completed') reasons.push(`Milestone ${milestone.type} belum selesai.`)
  }
  if (project.customs.kind === 'case') {
    for (const decision of project.customs.decisions) {
      if (decision.closeOut.kind !== 'completed') reasons.push(`Customs close-out item ${decision.cargoItemId} masih ${decision.closeOut.kind}.`)
      if (decision.closeOut.kind === 'completed' &&
        (decision.closeOut.inboundQuantity.unit !== decision.closeOut.reconciledQuantity.unit ||
          decision.closeOut.inboundQuantity.value !== decision.closeOut.reconciledQuantity.value)) {
        reasons.push(`Rekonsiliasi item ${decision.cargoItemId} tidak seimbang.`)
      }
    }
  }
  return { ok: reasons.length === 0, reasons }
}

export function summarizeProject(project: Project): string {
  const completed = project.tasks.filter((task) => task.execution.kind === 'completed').length
  const openBlockers = [
    ...project.blockers,
    ...project.tasks.flatMap((task) => task.blockers),
  ].filter((blocker) => blocker.kind === 'open')
  const customs = assessCustomsReadiness(project.customs)
  const completion = canCompleteProject(project)
  return [
    `Project: ${project.name}`,
    `Task: ${completed}/${project.tasks.length} selesai`,
    `Blocker terbuka: ${openBlockers.length}`,
    `Customs: ${customs.status}`,
    `Dapat ditutup: ${completion.ok ? 'ya' : 'tidak'}`,
    ...completion.reasons.map((reason) => `- ${reason}`),
  ].join('\n')
}
