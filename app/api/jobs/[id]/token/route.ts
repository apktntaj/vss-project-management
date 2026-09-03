import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, unauthorized } from '@/lib/session'
import { generateTrackingToken } from '@/lib/tokens'
export async function POST(_:Request,{params}:{params:{id:string}}) { if(!await requireUser())return unauthorized(); const trackingToken=generateTrackingToken(); const job=await prisma.job.update({where:{id:params.id},data:{trackingToken}}).catch(()=>null); return job ? NextResponse.json({trackingToken}) : NextResponse.json({error:'Job tidak ditemukan'},{status:404}) }
