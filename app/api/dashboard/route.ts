import { prisma } from '@/lib/prisma'
import { requireUser, unauthorized } from '@/lib/session'
import { NextResponse } from 'next/server'
export async function GET() { if (!await requireUser()) return unauthorized(); const [total, inProgress, onHold, completed] = await Promise.all([prisma.job.count(), prisma.job.count({where:{status:'IN_PROGRESS'}}), prisma.job.count({where:{status:'ON_HOLD'}}), prisma.job.count({where:{status:'COMPLETED'}})]); return NextResponse.json({ total, inProgress, onHold, completed }) }
