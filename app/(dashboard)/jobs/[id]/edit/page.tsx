import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { JobForm } from '@/components/job-form'
export const dynamic='force-dynamic'
export default async function EditJob({params}:{params:{id:string}}){const [job,users]=await Promise.all([prisma.job.findUnique({where:{id:params.id}}),prisma.user.findMany({where:{isActive:true},select:{id:true,name:true},orderBy:{name:'asc'}})]);if(!job)notFound();return <><div className="mb-7"><h1 className="text-2xl font-bold">Edit {job.jobNumber}</h1></div><JobForm users={users} job={job}/></>}
