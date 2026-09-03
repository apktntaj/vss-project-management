import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, unauthorized, forbidden } from '@/lib/session'
import { jobSchema } from '@/lib/validations'
type C = { params: { id:string } }
export async function GET(_:NextRequest,{params}:C) { if(!await requireUser()) return unauthorized(); const job=await prisma.job.findUnique({where:{id:params.id},include:{assignedTo:true,createdBy:true,stages:{orderBy:{order:'asc'}},documents:{include:{uploadedBy:true},orderBy:{createdAt:'desc'}}}}); return job ? NextResponse.json(job) : NextResponse.json({error:'Job tidak ditemukan'},{status:404}) }
export async function PUT(request:NextRequest,{params}:C) { if(!await requireUser()) return unauthorized(); const parsed=jobSchema.safeParse(await request.json()); if(!parsed.success) return NextResponse.json({error:parsed.error.flatten()},{status:400}); try{return NextResponse.json(await prisma.job.update({where:{id:params.id},data:parsed.data}))}catch{return NextResponse.json({error:'Job tidak ditemukan'},{status:404})} }
export async function DELETE(_:NextRequest,{params}:C) { const user=await requireUser(); if(!user)return unauthorized(); if(user.role!=='SUPERVISOR')return forbidden(); await prisma.job.delete({where:{id:params.id}}).catch(()=>null); return new NextResponse(null,{status:204}) }
