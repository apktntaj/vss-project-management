export type Id<T extends string> = string & { readonly __entity: T }
export type NonEmpty<T> = readonly [T, ...T[]]

export type SourceReference = {
  sourceType: 'whatsapp-export' | 'manual'
  sourceId: string
  occurredAt: string
}

export type Information<T> =
  | { kind: 'known'; value: T; sources: NonEmpty<SourceReference> }
  | { kind: 'unknown'; reason: string; owner: OperationalActor }
  | { kind: 'not-applicable'; reason: string }
  | { kind: 'conflicting'; candidates: NonEmpty<{ value: T; sources: NonEmpty<SourceReference> }>; owner: OperationalActor }

export type ExactMoment = { kind: 'exact'; at: string }
export type AbsoluteWindow = { kind: 'window'; startsAt: string; endsAt: string }
export type RelativeTime = { kind: 'relative'; expression: string; anchoredAt: string; timeZone: string }
export type RequestedTime = ExactMoment | AbsoluteWindow | RelativeTime

export type Party = { id: Id<'party'>; name: string }
export type ProjectRole =
  | 'customer'
  | 'agent'
  | 'exhibitor'
  | 'organizer'
  | 'venue'
  | 'forwarder'
  | 'vendor'
  | 'driver'
  | 'field-operations'
  | 'warehouse'
  | 'customer-service'
  | 'document-customs'
  | 'finance'
  | 'supervisor'

export type PersonResourceRole =
  | 'driver'
  | 'field-operator'
  | 'warehouse-operator'
  | 'customs-specialist'
  | 'installer'

export type OperationalActor =
  | { kind: 'participant'; partyId: Id<'party'>; role: ProjectRole }
  | { kind: 'role-owner'; role: ProjectRole }

export type PartyParticipation = {
  party: Party
  roles: NonEmpty<ProjectRole>
  period: Information<AbsoluteWindow>
  sources: NonEmpty<SourceReference>
}

export type Location = { id: Id<'location'>; name: string; contact: Information<string> }
export type Quantity = { value: number; unit: string }

export type IntendedDisposal =
  | 'return-abroad'
  | 'return-to-indonesia'
  | 'remain-in-indonesia'
  | 'consumed'
  | 'distributed'
  | 'sold-or-transferred'
  | 'destroyed'
  | 'undecided'

export type CargoItem = {
  id: Id<'cargo-item'>
  description: Information<string>
  owner: Information<Party>
  identifiers: readonly string[]
  quantities: NonEmpty<Quantity>
  weightKg: Information<number>
  dimensionsCm: Information<{ length: number; width: number; height: number }>
  intendedUse: Information<string>
  intendedDisposal: Information<IntendedDisposal>
  sources: NonEmpty<SourceReference>
}

export type ResourceRequirement =
  | { kind: 'person'; role: PersonResourceRole; quantity: number; skill: Information<string> }
  | { kind: 'vehicle'; vehicleType: Information<string>; quantity: number; minimumCapacityKg: Information<number> }
  | { kind: 'equipment'; equipmentType: string; quantity: number; minimumCapacityKg: Information<number> }
  | { kind: 'vendor-service'; service: string; quantity: number }

export type DocumentRequirement = {
  documentType: string
  criticality: 'planning' | 'execution' | 'completion'
  status: Information<'needed' | 'requested' | 'received' | 'verified' | 'used'>
}

export type EvidenceRequirement = { evidenceType: string; minimum: number }
export type Evidence = {
  id: Id<'evidence'>
  taskId: Id<'task'>
  evidenceType: string
  fileReference: string
  capturedAt: string
  submittedBy: OperationalActor
  verification: 'pending' | 'accepted' | 'rejected'
  sources: NonEmpty<SourceReference>
}

export type InformationGap = {
  path: string
  code: string
  impact: string
  owner: OperationalActor
}

export type Readiness =
  | { kind: 'needs-information'; gaps: NonEmpty<InformationGap> }
  | { kind: 'ready'; confirmedAt: string; confirmedBy: OperationalActor }

export type Resource = { id: Id<'resource'>; kind: 'person' | 'vehicle' | 'equipment' | 'vendor'; label: string }
export type Assignment = {
  id: Id<'assignment'>
  taskId: Id<'task'>
  resource: Resource
  window: AbsoluteWindow
  status: 'proposed' | 'confirmed' | 'acknowledged' | 'released' | 'cancelled'
  assignedBy: OperationalActor
  source: SourceReference
}

export type ExecutionState =
  | { kind: 'not-started' }
  | { kind: 'planned'; assignmentIds: NonEmpty<Id<'assignment'>>; schedule: AbsoluteWindow }
  | { kind: 'in-progress'; startedAt: string; latestUpdate: string }
  | { kind: 'completed'; completedAt: string; outcome: string; evidenceIds: NonEmpty<Id<'evidence'>> }
  | { kind: 'cancelled'; cancelledAt: string; reason: string; actor: OperationalActor }
  | { kind: 'failed'; failedAt: string; reason: string; nextAction: string }

export type Blocker =
  | { kind: 'open'; id: Id<'blocker'>; blockerType: string; description: string; openedAt: string; owner: OperationalActor }
  | { kind: 'resolved'; id: Id<'blocker'>; blockerType: string; description: string; openedAt: string; owner: OperationalActor; resolvedAt: string; resolution: string; evidenceIds: readonly Id<'evidence'>[] }

type TaskBase = {
  id: Id<'task'>
  title: string
  mandatory: boolean
  requestedBy: Information<Party>
  requestedTime: Information<RequestedTime>
  plannedTime: Information<AbsoluteWindow>
  deadline: Information<string>
  priority: 'low' | 'normal' | 'high' | 'urgent'
  readiness: Readiness
  execution: ExecutionState
  blockers: readonly Blocker[]
  dependencies: readonly Id<'task'>[]
  evidenceRequirements: NonEmpty<EvidenceRequirement>
  evidence: readonly Evidence[]
  sources: NonEmpty<SourceReference>
}

export type MovementTask = TaskBase & {
  kind: 'movement'
  action: 'pickup' | 'delivery' | 'transfer' | 'move-in' | 'move-out'
  origin: Information<Location>
  destination: Information<Location>
  cargoItemIds: NonEmpty<Id<'cargo-item'>>
  resourceRequirements: NonEmpty<ResourceRequirement>
}

export type HandlingTask = TaskBase & {
  kind: 'handling'
  action: 'loading' | 'unloading' | 'packing' | 'unpacking' | 'repacking' | 'installation' | 'survey' | 'warehouse-handling'
  location: Information<Location>
  cargoItemIds: NonEmpty<Id<'cargo-item'>>
  resourceRequirements: NonEmpty<ResourceRequirement>
}

export type CustomsTask = TaskBase & {
  kind: 'customs'
  action: 'document-preparation' | 'inspection' | 'release' | 'export' | 'import' | 'close-out'
  location: Information<Location>
  cargoItemIds: NonEmpty<Id<'cargo-item'>>
  documentRequirements: readonly DocumentRequirement[]
}

export type AdministrativeTask = TaskBase & {
  kind: 'administrative'
  action: 'quotation' | 'booking' | 'document-courier' | 'reporting' | 'billing-preparation'
  subject: Information<string>
  documentRequirements: readonly DocumentRequirement[]
}

export type Task = MovementTask | HandlingTask | CustomsTask | AdministrativeTask

export type CustomsTreatment =
  | { kind: 'undecided'; missingInformation: NonEmpty<string> }
  | { kind: 'provisional'; route: string; basis: string; confirmationNeeded: string }
  | { kind: 'confirmed'; route: string; authoritySource: SourceReference; obligations: readonly string[] }

export type CustomsCloseOut =
  | { kind: 'not-yet-due'; dueAt: string; obligations: NonEmpty<string> }
  | { kind: 'due'; dueAt: string; remainingObligations: NonEmpty<string> }
  | { kind: 'exception-open'; exceptionType: string; affectedQuantity: Quantity; owner: OperationalActor; authorityQuestion: string }
  | { kind: 'completed'; outcome: string; inboundQuantity: Quantity; reconciledQuantity: Quantity; evidenceIds: NonEmpty<Id<'evidence'>>; completedAt: string; reviewer: OperationalActor }

export type ItemCustomsDecision = {
  cargoItemId: Id<'cargo-item'>
  intendedUse: Information<string>
  intendedDisposal: Information<IntendedDisposal>
  technicalDescriptionReady: boolean
  treatment: CustomsTreatment
  closeOut: CustomsCloseOut
  openIssues: readonly string[]
}

export type CustomsControl =
  | { kind: 'not-relevant'; reason: string }
  | { kind: 'case'; movementContext: string; closeOutOwner: OperationalActor; decisions: NonEmpty<ItemCustomsDecision>; documents: readonly DocumentRequirement[]; recommendationStatus: 'provisional' | 'ready-for-operational-review' | 'requires-authority-confirmation' }

export type Milestone = {
  id: Id<'milestone'>
  type: 'technical-meeting' | 'pre-alert' | 'pre-arrival' | 'arrival' | 'clearance' | 'delivery-move-in' | 'show' | 'move-out' | 're-export-re-import' | 'close-out'
  mandatory: boolean
  owner: OperationalActor
  state: 'pending' | 'ready' | 'in-progress' | 'completed' | 'missed'
  exitEvidenceIds: readonly Id<'evidence'>[]
}

export type ChangeRecord = {
  id: Id<'change'>
  subject: string
  field: string
  previousInformation: unknown
  newInformation: unknown
  changeType: 'correction' | 'confirmation' | 'replan'
  reason: string
  actor: OperationalActor
  occurredAt: string
  source: SourceReference
}

export type Project = {
  id: Id<'project'>
  name: string
  period: Information<AbsoluteWindow>
  participants: NonEmpty<PartyParticipation>
  cargoItems: readonly CargoItem[]
  tasks: NonEmpty<Task>
  assignments: readonly Assignment[]
  milestones: readonly Milestone[]
  blockers: readonly Blocker[]
  customs: CustomsControl
  changes: readonly ChangeRecord[]
  sources: NonEmpty<SourceReference>
}

export type ProjectChange =
  | { kind: 'task-requested-time'; taskId: Id<'task'>; value: Information<RequestedTime> }
  | { kind: 'task-planned-time'; taskId: Id<'task'>; value: Information<AbsoluteWindow> }
  | { kind: 'movement-destination'; taskId: Id<'task'>; value: Information<Location> }

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; issues: NonEmpty<InformationGap> }

export const known = <T>(value: T, sources: NonEmpty<SourceReference>): Information<T> => ({ kind: 'known', value, sources })
export const unknown = <T>(reason: string, owner: OperationalActor): Information<T> => ({ kind: 'unknown', reason, owner })
export const notApplicable = <T>(reason: string): Information<T> => ({ kind: 'not-applicable', reason })
export const conflicting = <T>(candidates: NonEmpty<{ value: T; sources: NonEmpty<SourceReference> }>, owner: OperationalActor): Information<T> => ({ kind: 'conflicting', candidates, owner })
