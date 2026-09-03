import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, unauthorized } from '@/lib/session'
import { stageSchema } from '@/lib/validations'
export async function GET(_:NextRequest,{params}:{params:{id:string}}) { if(!await requireUser())return unauthorized(); return NextResponse.json(await prisma.jobStage.findMany({where:{jobId:params.id},orderBy:{order:'asc'}})) }
export async function POST(request:NextRequest,{params}:{params:{id:string}}) { if(!await requireUser())return unauthorized(); const parsed=stageSchema.safeParse(await request.json()); if(!parsed.success)return NextResponse.json({error:parsed.error.flatten()},{status:400}); const count=await prisma.jobStage.count({where:{jobId:params.id}}); const stage=await prisma.jobStage.create({data:{...parsed.data,jobId:params.id,order:parsed.data.order ?? count,completedAt:parsed.data.status==='DONE'?new Date():null}}); return NextResponse.json(stage,{status:201}) }
