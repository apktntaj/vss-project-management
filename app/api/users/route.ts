import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requireUser, unauthorized, forbidden } from '@/lib/session'
import { userSchema } from '@/lib/validations'
export async function GET(){const user=await requireUser();if(!user)return unauthorized();if(user.role!=='SUPERVISOR')return forbidden();return NextResponse.json(await prisma.user.findMany({select:{id:true,name:true,email:true,role:true,isActive:true,createdAt:true},orderBy:{createdAt:'desc'}}))}
export async function POST(request:NextRequest){const user=await requireUser();if(!user)return unauthorized();if(user.role!=='SUPERVISOR')return forbidden();const parsed=userSchema.safeParse(await request.json());if(!parsed.success||!parsed.data.password)return NextResponse.json({error:'Data tidak valid; password minimal 8 karakter.'},{status:400});const {password,...data}=parsed.data;try{return NextResponse.json(await prisma.user.create({data:{...data,password:await bcrypt.hash(password,12)}}),{status:201})}catch{return NextResponse.json({error:'Email sudah digunakan'},{status:409})}}
