'use server'

import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/session'
import {
  AssignmentStatus,
  CustomsCloseOutStatus,
  CustomsTreatmentStatus,
  IntendedDisposal,
  ProjectRole,
  TaskExecution,
  TaskKind,
  TaskReadiness,
} from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim()
const projectRoleByUserRole = {
  STAFF: ProjectRole.FIELD_OPERATIONS,
  SUPERVISOR: ProjectRole.SUPERVISOR,
  CUSTOMER_SERVICE: ProjectRole.CUSTOMER_SERVICE,
  DOCUMENT_ASSISTANT: ProjectRole.DOCUMENT_CUSTOMS,
} as const

async function authenticatedUser() {
  const user = await requireUser()
  if (!user) redirect('/login')
  return user
}

export async function createProject(form: FormData) {
  const user = await authenticatedUser()
  const code = text(form, 'code').toUpperCase()
  const name = text(form, 'name')
  const sourceReference = text(form, 'sourceReference')
  if (!code || !name || !sourceReference) throw new Error('Kode, nama, dan sumber wajib diisi.')

  const project = await prisma.project.create({
    data: {
      code,
      name,
      startsAt: text(form, 'startsAt') ? new Date(text(form, 'startsAt')) : null,
      endsAt: text(form, 'endsAt') ? new Date(text(form, 'endsAt')) : null,
      customsRelevant: form.get('customsRelevant') === 'on',
      sourceReference,
      createdById: user.id,
      participants: {
        create: {
          partyName: user.name ?? user.email ?? 'Pengguna VSS',
          role: projectRoleByUserRole[user.role as keyof typeof projectRoleByUserRole],
          sourceReference,
        },
      },
    },
  })
  redirect(`/projects/${project.id}`)
}

export async function addParticipant(form: FormData) {
  await authenticatedUser()
  const projectId = text(form, 'projectId')
  await prisma.projectParticipant.create({
    data: {
      projectId,
      partyName: text(form, 'partyName'),
      role: text(form, 'role') as ProjectRole,
      sourceReference: text(form, 'sourceReference'),
    },
  })
  revalidatePath(`/projects/${projectId}`)
}

export async function addTask(form: FormData) {
  await authenticatedUser()
  const projectId = text(form, 'projectId')
  const kind = text(form, 'kind') as TaskKind
  const plannedStartsAt = text(form, 'plannedStartsAt')
  const plannedEndsAt = text(form, 'plannedEndsAt')
  const place = text(form, 'place')
  const gaps: Array<{ code: string; label: string }> = []
  if (!plannedStartsAt || !plannedEndsAt) gaps.push({ code: 'UNKNOWN_PLANNED_TIME', label: 'Jadwal absolut belum lengkap' })
  if (kind === TaskKind.MOVEMENT && !place.includes('→')) gaps.push({ code: 'UNKNOWN_ROUTE', label: 'Gunakan format Origin → Destination' })
  if ((kind === TaskKind.HANDLING || kind === TaskKind.CUSTOMS) && !place) gaps.push({ code: 'UNKNOWN_LOCATION', label: 'Lokasi belum tersedia' })

  await prisma.projectTask.create({
    data: {
      projectId,
      code: text(form, 'code').toUpperCase(),
      title: text(form, 'title'),
      kind,
      action: text(form, 'action').toUpperCase(),
      mandatory: form.get('mandatory') === 'on',
      readiness: gaps.length ? TaskReadiness.NEEDS_INFORMATION : TaskReadiness.READY,
      requestedTimeText: text(form, 'requestedTimeText') || null,
      plannedStartsAt: plannedStartsAt ? new Date(plannedStartsAt) : null,
      plannedEndsAt: plannedEndsAt ? new Date(plannedEndsAt) : null,
      origin: kind === TaskKind.MOVEMENT ? place.split('→')[0]?.trim() || null : null,
      destination: kind === TaskKind.MOVEMENT ? place.split('→')[1]?.trim() || null : null,
      location: kind === TaskKind.HANDLING || kind === TaskKind.CUSTOMS ? place : null,
      informationGaps: gaps,
      evidenceRequirements: [{ evidenceType: text(form, 'evidenceType') || 'completion-proof', minimum: 1 }],
      sourceReference: text(form, 'sourceReference'),
    },
  })
  revalidatePath(`/projects/${projectId}`)
}

export async function addEvidence(form: FormData) {
  const user = await authenticatedUser()
  const projectId = text(form, 'projectId')
  const taskId = text(form, 'taskId')
  await prisma.projectEvidence.create({
    data: {
      projectId,
      taskId,
      evidenceType: text(form, 'evidenceType'),
      fileReference: text(form, 'fileReference'),
      verification: 'ACCEPTED',
      capturedAt: new Date(),
      submittedById: user.id,
    },
  })
  revalidatePath(`/projects/${projectId}`)
}

export async function addAssignment(form: FormData) {
  const user = await authenticatedUser()
  const projectId = text(form, 'projectId')
  const taskId = text(form, 'taskId')
  const resourceLabel = text(form, 'resourceLabel')
  const startsAt = new Date(text(form, 'startsAt'))
  const endsAt = new Date(text(form, 'endsAt'))
  if (!(startsAt < endsAt)) throw new Error('Akhir assignment harus setelah waktu mulai.')
  const conflict = await prisma.projectAssignment.findFirst({
    where: {
      resourceLabel,
      status: { notIn: [AssignmentStatus.CANCELLED, AssignmentStatus.RELEASED] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  })
  if (conflict) throw new Error(`Resource bentrok dengan assignment ${conflict.id}.`)
  await prisma.projectAssignment.create({
    data: {
      projectId,
      taskId,
      resourceType: text(form, 'resourceType'),
      resourceLabel,
      startsAt,
      endsAt,
      status: AssignmentStatus.CONFIRMED,
      assignedById: user.id,
      sourceReference: text(form, 'sourceReference'),
    },
  })
  await prisma.projectTask.update({ where: { id: taskId }, data: { execution: TaskExecution.PLANNED } })
  revalidatePath(`/projects/${projectId}`)
}

export async function addCargoItem(form: FormData) {
  await authenticatedUser()
  const projectId = text(form, 'projectId')
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { customsRelevant: true } })
  if (!project) throw new Error('Project tidak ditemukan.')
  const quantity = Number(text(form, 'quantity'))
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Quantity cargo harus positif.')
  await prisma.projectCargoItem.create({
    data: {
      projectId,
      reference: text(form, 'reference').toUpperCase(),
      description: text(form, 'description'),
      ownerName: text(form, 'ownerName') || null,
      identifiers: text(form, 'identifiers').split(',').map((item) => item.trim()).filter(Boolean),
      quantity,
      quantityUnit: text(form, 'quantityUnit'),
      intendedUse: text(form, 'intendedUse') || null,
      intendedDisposal: text(form, 'intendedDisposal') as IntendedDisposal,
      sourceReference: text(form, 'sourceReference'),
      customsDecision: project.customsRelevant ? {
        create: {
          technicalDescriptionReady: false,
          treatmentStatus: CustomsTreatmentStatus.UNDECIDED,
          closeOutStatus: CustomsCloseOutStatus.NOT_YET_DUE,
          openIssues: ['Technical description dan treatment perlu dikonfirmasi oleh PIC customs.'],
        },
      } : undefined,
    },
  })
  revalidatePath(`/projects/${projectId}`)
}

type EvidenceRequirement = { evidenceType: string; minimum: number }

export async function setTaskExecution(form: FormData) {
  await authenticatedUser()
  const projectId = text(form, 'projectId')
  const taskId = text(form, 'taskId')
  const execution = text(form, 'execution') as TaskExecution
  const task = await prisma.projectTask.findUnique({ where: { id: taskId }, include: { evidence: true } })
  if (!task || task.projectId !== projectId) throw new Error('Task tidak ditemukan.')
  if (execution === TaskExecution.COMPLETED) {
    const requirements = task.evidenceRequirements as EvidenceRequirement[]
    const missing = requirements.filter((requirement) =>
      task.evidence.filter((item) => item.verification === 'ACCEPTED' && item.evidenceType === requirement.evidenceType).length < requirement.minimum)
    if (missing.length) throw new Error(`Evidence belum lengkap: ${missing.map((item) => item.evidenceType).join(', ')}`)
  }
  await prisma.projectTask.update({
    where: { id: taskId },
    data: {
      execution,
      completedAt: execution === TaskExecution.COMPLETED ? new Date() : null,
      outcome: execution === TaskExecution.COMPLETED ? 'Selesai dengan evidence terverifikasi' : null,
    },
  })
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/')
}
