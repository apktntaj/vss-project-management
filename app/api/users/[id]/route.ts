import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requireUser, unauthorized, forbidden } from '@/lib/session'
import { userSchema } from '@/lib/validations'
export async function GET(_:Request,{params}:{params:{id:string}}){const user=await requireUser();if(!user)return unauthorized();if(user.role!=='SUPERVISOR')return forbidden();const result=await prisma.user.findUnique({where:{id:params.id},select:{id:true,name:true,email:true,role:true,isActive:true,createdAt:true}});return result?NextResponse.json(result):NextResponse.json({error:'Pengguna tidak ditemukan'},{status:404})}
export async function PUT(request:NextRequest,{params}:{params:{id:string}}){const user=await requireUser();if(!user)return unauthorized();if(user.role!=='SUPERVISOR')return forbidden();const parsed=userSchema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:parsed.error.flatten()},{status:400});const {password,...data}=parsed.data;const result=await prisma.user.update({where:{id:params.id},data:{...data,...(password?{password:await bcrypt.hash(password,12)}:{})}}).catch(()=>null);return result?NextResponse.json(result):NextResponse.json({error:'Pengguna tidak ditemukan'},{status:404})}
