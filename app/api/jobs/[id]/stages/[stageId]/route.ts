import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, unauthorized } from '@/lib/session'
import { stageSchema } from '@/lib/validations'
type C={params:{stageId:string}}
export async function PUT(request:NextRequest,{params}:C) {if(!await requireUser())return unauthorized();const parsed=stageSchema.partial().safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:parsed.error.flatten()},{status:400});const stage=await prisma.jobStage.update({where:{id:params.stageId},data:{...parsed.data,completedAt:parsed.data.status==='DONE'?new Date():parsed.data.status?null:undefined}}).catch(()=>null);return stage?NextResponse.json(stage):NextResponse.json({error:'Stage tidak ditemukan'},{status:404})}
export async function DELETE(_:NextRequest,{params}:C) {if(!await requireUser())return unauthorized();await prisma.jobStage.delete({where:{id:params.stageId}}).catch(()=>null);return new NextResponse(null,{status:204})}
