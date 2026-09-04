import {
  AssignmentStatus,
  CustomsCloseOutStatus,
  CustomsRecommendation,
  CustomsTreatmentStatus,
  EvidenceVerification,
  IntendedDisposal,
  PrismaClient,
  ProjectRole,
  Role,
  TaskExecution,
  TaskKind,
  TaskReadiness,
} from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const demoProjectId = 'project-mice-2026-001'

async function main() {
  const supervisorEmail = (process.env.SEED_SUPERVISOR_EMAIL || 'admin@vss.local').trim().toLowerCase()
  const password = await bcrypt.hash(process.env.SEED_SUPERVISOR_PASSWORD || 'ChangeMe123!', 12)
  const teamPassword = await bcrypt.hash(process.env.SEED_USER_PASSWORD || 'ChangeMe123!', 12)
  const admin = await prisma.user.upsert({
    where: { email: supervisorEmail },
    update: {
      name: 'Administrator VSS',
      password,
      role: Role.SUPERVISOR,
      isActive: true,
    },
    create: {
      name: 'Administrator VSS',
      email: supervisorEmail,
      password,
      role: Role.SUPERVISOR,
    },
  })

  const teamUsers = [
    { name: 'Andy', email: 'andy@vss.local', role: Role.SUPERVISOR },
    { name: 'Mae Jung', email: 'mae.jung@vss.local', role: Role.SUPERVISOR },
    { name: 'Nurul', email: 'nurul@vss.local', role: Role.SUPERVISOR },
    { name: 'Siti', email: 'siti@vss.local', role: Role.CUSTOMER_SERVICE },
    { name: 'Dhea', email: 'dhea@vss.local', role: Role.CUSTOMER_SERVICE },
    { name: 'Rian', email: 'rian@vss.local', role: Role.CUSTOMER_SERVICE },
    { name: 'Nuri', email: 'nuri@vss.local', role: Role.CUSTOMER_SERVICE },
    { name: 'Ari', email: 'ari@vss.local', role: Role.DOCUMENT_ASSISTANT },
    { name: 'Lina', email: 'lina@vss.local', role: Role.DOCUMENT_ASSISTANT },
    { name: 'Shindu', email: 'shindu@vss.local', role: Role.DOCUMENT_ASSISTANT },
  ]

  await Promise.all(teamUsers.map((user) => prisma.user.upsert({
    where: { email: user.email },
    update: { name: user.name, password: teamPassword, role: user.role, isActive: true },
    create: { ...user, password: teamPassword },
  })))

  await prisma.project.upsert({
    where: { code: 'PRJ-MICE-2026-001' },
    update: {},
    create: {
      id: demoProjectId,
      code: 'PRJ-MICE-2026-001',
      name: 'Delivery & Customs MICE',
      status: 'ACTIVE',
      startsAt: new Date('2026-02-18T00:00:00+07:00'),
      endsAt: new Date('2026-08-18T23:59:59+07:00'),
      customsRelevant: true,
      customsRecommendation: CustomsRecommendation.REQUIRES_AUTHORITY_CONFIRMATION,
      closeOutOwnerLabel: 'Document & Customs',
      sourceReference: 'docs/whatsapp-operational-vss.txt:8604-8611,12449-12502,13116-13138',
      createdById: admin.id,
      participants: {
        create: [
          { partyName: 'VSS Operations', role: ProjectRole.FIELD_OPERATIONS, sourceReference: 'docs/whatsapp-operational-vss.txt:8591-8599' },
          { partyName: 'VSS Operations', role: ProjectRole.DOCUMENT_CUSTOMS, sourceReference: 'docs/whatsapp-operational-vss.txt:13116-13138' },
          { partyName: 'VSS Supervisor', role: ProjectRole.SUPERVISOR, sourceReference: 'docs/whatsapp-operational-vss.txt:8604-8611' },
          { partyName: 'Nunu XL', role: ProjectRole.CUSTOMER_SERVICE, sourceReference: 'docs/whatsapp-operational-vss.txt:8604-8611' },
        ],
      },
      cargoItems: {
        create: [
          {
            reference: 'CARGO-RETURN-01',
            description: 'Barang ATA yang perlu dicocokkan saat export kembali',
            ownerName: 'Exhibitor',
            identifiers: ['case-return-01'],
            quantity: 1,
            quantityUnit: 'case',
            intendedUse: 'Pameran',
            intendedDisposal: IntendedDisposal.RETURN_ABROAD,
            sourceReference: 'docs/whatsapp-operational-vss.txt:12449-12470',
            customsDecision: {
              create: {
                technicalDescriptionReady: true,
                treatmentStatus: CustomsTreatmentStatus.PROVISIONAL,
                routeLabel: 'ATA return',
                basis: 'Label operasional dari chat; bukan penetapan hukum.',
                confirmationNeeded: 'Konfirmasi PIC customs/otoritas atas route dan kewajiban.',
                closeOutStatus: CustomsCloseOutStatus.DUE,
                closeOutDueAt: new Date('2026-08-18T17:00:00+07:00'),
                openIssues: ['Rekonsiliasi dan evidence return per item'],
              },
            },
          },
          {
            reference: 'CARGO-LOCAL-01',
            description: 'Barang berubah dari temporary menjadi permanent/lokal',
            ownerName: 'Exhibitor',
            identifiers: ['case-local-01'],
            quantity: 3,
            quantityUnit: 'package',
            intendedUse: 'Dikirim ke pembeli lokal',
            intendedDisposal: IntendedDisposal.SOLD_OR_TRANSFERRED,
            sourceReference: 'docs/whatsapp-operational-vss.txt:13116-13138',
            customsDecision: {
              create: {
                technicalDescriptionReady: true,
                treatmentStatus: CustomsTreatmentStatus.PROVISIONAL,
                routeLabel: 'Perubahan temporary menjadi permanent/lokal',
                basis: 'Instruksi lokal pada chat; bukan penetapan hukum.',
                confirmationNeeded: 'Konfirmasi treatment oleh PIC customs/otoritas.',
                closeOutStatus: CustomsCloseOutStatus.EXCEPTION_OPEN,
                openIssues: ['Perubahan intended disposal memerlukan review'],
              },
            },
          },
        ],
      },
      tasks: {
        create: [
          {
            code: 'TSK-DELIVERY-001',
            title: 'Delivery barang Ferrings',
            kind: TaskKind.MOVEMENT,
            action: 'DELIVERY',
            mandatory: true,
            priority: 'NORMAL',
            readiness: TaskReadiness.NEEDS_INFORMATION,
            execution: TaskExecution.NOT_STARTED,
            requestedTimeText: 'besok',
            destination: 'Ferring Pharmaceuticals Industry, Taman Tekno BSD',
            informationGaps: [
              { code: 'RELATIVE_TIME', label: 'Waktu “besok” belum dikonfirmasi' },
              { code: 'UNKNOWN_ORIGIN', label: 'Lokasi asal belum tersedia' },
              { code: 'DOCUMENT_NOT_READY', label: 'FO menyusul' },
            ],
            evidenceRequirements: [{ evidenceType: 'delivery-receipt', minimum: 1 }],
            sourceReference: 'docs/whatsapp-operational-vss.txt:8604-8611',
            blockers: {
              create: [{
                projectId: demoProjectId,
                type: 'DOCUMENT',
                description: 'FO menyusul',
                ownerRole: ProjectRole.CUSTOMER_SERVICE,
                openedAt: new Date('2026-02-18T15:41:00+07:00'),
              }],
            },
          },
          {
            code: 'TSK-REPACK-001',
            title: 'Repacking setelah pameran',
            kind: TaskKind.HANDLING,
            action: 'REPACKING',
            mandatory: true,
            readiness: TaskReadiness.READY,
            execution: TaskExecution.PLANNED,
            plannedStartsAt: new Date('2026-05-13T18:00:00+07:00'),
            plannedEndsAt: new Date('2026-05-13T21:00:00+07:00'),
            location: 'Gudang Vivo',
            informationGaps: [],
            evidenceRequirements: [{ evidenceType: 'repacking-photo', minimum: 1 }],
            sourceReference: 'docs/whatsapp-operational-vss.txt:12449-12502',
            assignments: {
              create: [{
                projectId: demoProjectId,
                resourceType: 'PERSON',
                resourceLabel: 'Field Operations Team',
                startsAt: new Date('2026-05-13T18:00:00+07:00'),
                endsAt: new Date('2026-05-13T21:00:00+07:00'),
                status: AssignmentStatus.ACKNOWLEDGED,
                assignedById: admin.id,
                sourceReference: 'docs/whatsapp-operational-vss.txt:12449-12502',
              }],
            },
          },
          {
            code: 'TSK-CUSTOMS-001',
            title: 'Customs close-out per item',
            kind: TaskKind.CUSTOMS,
            action: 'CLOSE_OUT',
            mandatory: true,
            readiness: TaskReadiness.NEEDS_INFORMATION,
            execution: TaskExecution.NOT_STARTED,
            location: 'Customs control desk',
            informationGaps: [{ code: 'AUTHORITY_CONFIRMATION', label: 'Treatment per item belum dikonfirmasi' }],
            evidenceRequirements: [{ evidenceType: 'customs-close-out', minimum: 1 }],
            sourceReference: 'docs/whatsapp-operational-vss.txt:13116-13138',
          },
          {
            code: 'TSK-REPORT-001',
            title: 'Laporan operasional delivery',
            kind: TaskKind.ADMINISTRATIVE,
            action: 'REPORTING',
            mandatory: false,
            readiness: TaskReadiness.READY,
            execution: TaskExecution.COMPLETED,
            informationGaps: [],
            evidenceRequirements: [{ evidenceType: 'daily-report', minimum: 1 }],
            completedAt: new Date('2026-02-19T17:00:00+07:00'),
            outcome: 'Laporan harian tercatat',
            sourceReference: 'docs/whatsapp-operational-vss.txt:8619-8622',
            evidence: {
              create: [{
                projectId: demoProjectId,
                evidenceType: 'daily-report',
                fileReference: 'seed://daily-report',
                verification: EvidenceVerification.ACCEPTED,
                capturedAt: new Date('2026-02-19T17:00:00+07:00'),
                submittedById: admin.id,
              }],
            },
          },
        ],
      },
      milestones: {
        create: [
          {
            type: 'DELIVERY_MOVE_IN',
            title: 'Delivery / move-in',
            mandatory: true,
            state: 'IN_PROGRESS',
            ownerRole: ProjectRole.FIELD_OPERATIONS,
            exitEvidence: ['delivery-receipt'],
          },
          {
            type: 'CLOSE_OUT',
            title: 'Customs close-out',
            mandatory: true,
            state: 'PENDING',
            ownerRole: ProjectRole.DOCUMENT_CUSTOMS,
            exitEvidence: ['customs-close-out'],
          },
        ],
      },
      changes: {
        create: [{
          subject: 'task:TSK-DELIVERY-001',
          field: 'requestedTime',
          previousInformation: { kind: 'known', value: { kind: 'relative', expression: 'besok' } },
          newInformation: { kind: 'unknown', reason: 'Menunggu konfirmasi jam absolut' },
          changeType: 'CONFIRMATION_REQUIRED',
          reason: 'Waktu relatif tidak dapat dipakai untuk planning.',
          actorLabel: 'field-operations@VSS',
          occurredAt: new Date('2026-02-18T16:00:00+07:00'),
          sourceReference: 'docs/whatsapp-operational-vss.txt:8604-8611',
        }],
      },
    },
  })
}

main()
  .finally(() => prisma.$disconnect())
