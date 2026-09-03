import { NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { requireUser, unauthorized } from '@/lib/session'
export async function DELETE(_:Request,{params}:{params:{docId:string}}) {if(!await requireUser())return unauthorized();const doc=await prisma.document.delete({where:{id:params.docId}}).catch(()=>null);if(doc)await unlink(path.join(process.cwd(),'public',doc.fileUrl)).catch(()=>null);return new NextResponse(null,{status:204})}
