-- Add the project-management aggregate without changing legacy shipment tables.
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ProjectRole" AS ENUM ('CUSTOMER', 'AGENT', 'EXHIBITOR', 'ORGANIZER', 'VENUE', 'FORWARDER', 'VENDOR', 'DRIVER', 'FIELD_OPERATIONS', 'WAREHOUSE', 'CUSTOMER_SERVICE', 'DOCUMENT_CUSTOMS', 'FINANCE', 'SUPERVISOR');
CREATE TYPE "TaskKind" AS ENUM ('MOVEMENT', 'HANDLING', 'CUSTOMS', 'ADMINISTRATIVE');
CREATE TYPE "TaskReadiness" AS ENUM ('NEEDS_INFORMATION', 'READY');
CREATE TYPE "TaskExecution" AS ENUM ('NOT_STARTED', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FAILED');
CREATE TYPE "AssignmentStatus" AS ENUM ('PROPOSED', 'CONFIRMED', 'ACKNOWLEDGED', 'RELEASED', 'CANCELLED');
CREATE TYPE "EvidenceVerification" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
CREATE TYPE "CustomsRecommendation" AS ENUM ('PROVISIONAL', 'READY_FOR_OPERATIONAL_REVIEW', 'REQUIRES_AUTHORITY_CONFIRMATION');
CREATE TYPE "CustomsTreatmentStatus" AS ENUM ('UNDECIDED', 'PROVISIONAL', 'CONFIRMED');
CREATE TYPE "CustomsCloseOutStatus" AS ENUM ('NOT_YET_DUE', 'DUE', 'EXCEPTION_OPEN', 'COMPLETED');
CREATE TYPE "IntendedDisposal" AS ENUM ('RETURN_ABROAD', 'RETURN_TO_INDONESIA', 'REMAIN_IN_INDONESIA', 'CONSUMED', 'DISTRIBUTED', 'SOLD_OR_TRANSFERRED', 'DESTROYED', 'UNDECIDED');

CREATE TABLE "Project" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "customsRelevant" BOOLEAN NOT NULL DEFAULT false,
  "customsRecommendation" "CustomsRecommendation",
  "closeOutOwnerLabel" TEXT,
  "sourceReference" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectParticipant" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "partyName" TEXT NOT NULL,
  "role" "ProjectRole" NOT NULL,
  "periodStartsAt" TIMESTAMP(3),
  "periodEndsAt" TIMESTAMP(3),
  "sourceReference" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectCargoItem" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "ownerName" TEXT,
  "identifiers" TEXT[],
  "quantity" DECIMAL(14,3) NOT NULL,
  "quantityUnit" TEXT NOT NULL,
  "intendedUse" TEXT,
  "intendedDisposal" "IntendedDisposal" NOT NULL,
  "sourceReference" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectCargoItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectTask" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "kind" "TaskKind" NOT NULL,
  "action" TEXT NOT NULL,
  "mandatory" BOOLEAN NOT NULL DEFAULT true,
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "readiness" "TaskReadiness" NOT NULL DEFAULT 'NEEDS_INFORMATION',
  "execution" "TaskExecution" NOT NULL DEFAULT 'NOT_STARTED',
  "requestedTimeText" TEXT,
  "plannedStartsAt" TIMESTAMP(3),
  "plannedEndsAt" TIMESTAMP(3),
  "origin" TEXT,
  "destination" TEXT,
  "location" TEXT,
  "informationGaps" JSONB NOT NULL,
  "evidenceRequirements" JSONB NOT NULL,
  "completedAt" TIMESTAMP(3),
  "outcome" TEXT,
  "sourceReference" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectAssignment" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceLabel" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "status" "AssignmentStatus" NOT NULL DEFAULT 'PROPOSED',
  "assignedById" TEXT NOT NULL,
  "sourceReference" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectBlocker" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "taskId" TEXT,
  "type" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "ownerRole" "ProjectRole" NOT NULL,
  "openedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "resolution" TEXT,
  CONSTRAINT "ProjectBlocker_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectEvidence" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "taskId" TEXT,
  "evidenceType" TEXT NOT NULL,
  "fileReference" TEXT NOT NULL,
  "verification" "EvidenceVerification" NOT NULL DEFAULT 'PENDING',
  "capturedAt" TIMESTAMP(3) NOT NULL,
  "submittedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectCustomsDecision" (
  "id" TEXT NOT NULL,
  "cargoItemId" TEXT NOT NULL,
  "technicalDescriptionReady" BOOLEAN NOT NULL DEFAULT false,
  "treatmentStatus" "CustomsTreatmentStatus" NOT NULL,
  "routeLabel" TEXT,
  "basis" TEXT,
  "confirmationNeeded" TEXT,
  "closeOutStatus" "CustomsCloseOutStatus" NOT NULL,
  "closeOutDueAt" TIMESTAMP(3),
  "openIssues" JSONB NOT NULL,
  "reconciliation" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectCustomsDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectMilestone" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "mandatory" BOOLEAN NOT NULL DEFAULT true,
  "state" TEXT NOT NULL DEFAULT 'PENDING',
  "plannedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "ownerRole" "ProjectRole" NOT NULL,
  "exitEvidence" JSONB NOT NULL,
  CONSTRAINT "ProjectMilestone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectChangeRecord" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "field" TEXT NOT NULL,
  "previousInformation" JSONB NOT NULL,
  "newInformation" JSONB NOT NULL,
  "changeType" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "actorLabel" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "sourceReference" TEXT NOT NULL,
  CONSTRAINT "ProjectChangeRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");
CREATE UNIQUE INDEX "ProjectParticipant_projectId_partyName_role_key" ON "ProjectParticipant"("projectId", "partyName", "role");
CREATE INDEX "ProjectParticipant_projectId_role_idx" ON "ProjectParticipant"("projectId", "role");
CREATE UNIQUE INDEX "ProjectCargoItem_projectId_reference_key" ON "ProjectCargoItem"("projectId", "reference");
CREATE UNIQUE INDEX "ProjectTask_projectId_code_key" ON "ProjectTask"("projectId", "code");
CREATE INDEX "ProjectTask_projectId_readiness_execution_idx" ON "ProjectTask"("projectId", "readiness", "execution");
CREATE INDEX "ProjectAssignment_resourceLabel_startsAt_endsAt_idx" ON "ProjectAssignment"("resourceLabel", "startsAt", "endsAt");
CREATE INDEX "ProjectBlocker_projectId_resolvedAt_idx" ON "ProjectBlocker"("projectId", "resolvedAt");
CREATE UNIQUE INDEX "ProjectCustomsDecision_cargoItemId_key" ON "ProjectCustomsDecision"("cargoItemId");
CREATE INDEX "ProjectChangeRecord_projectId_occurredAt_idx" ON "ProjectChangeRecord"("projectId", "occurredAt");

ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectParticipant" ADD CONSTRAINT "ProjectParticipant_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectCargoItem" ADD CONSTRAINT "ProjectCargoItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectAssignment" ADD CONSTRAINT "ProjectAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectAssignment" ADD CONSTRAINT "ProjectAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ProjectTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectAssignment" ADD CONSTRAINT "ProjectAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectBlocker" ADD CONSTRAINT "ProjectBlocker_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectBlocker" ADD CONSTRAINT "ProjectBlocker_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ProjectTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectEvidence" ADD CONSTRAINT "ProjectEvidence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectEvidence" ADD CONSTRAINT "ProjectEvidence_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ProjectTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectEvidence" ADD CONSTRAINT "ProjectEvidence_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectCustomsDecision" ADD CONSTRAINT "ProjectCustomsDecision_cargoItemId_fkey" FOREIGN KEY ("cargoItemId") REFERENCES "ProjectCargoItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectChangeRecord" ADD CONSTRAINT "ProjectChangeRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
