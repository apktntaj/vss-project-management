import { prisma } from '@/lib/prisma'
import { JobForm } from '@/components/job-form'
export const dynamic='force-dynamic'
export default async function NewJob(){const users=await prisma.user.findMany({where:{isActive:true},select:{id:true,name:true},orderBy:{name:'asc'}});return <><div className="mb-7"><h1 className="text-2xl font-bold">Buat job baru</h1><p className="mt-1 text-sm text-slate-500">Nomor job dan link tracking dibuat otomatis.</p></div><JobForm users={users}/></>}
