import { JobForm } from '@/components/job-form'
export default function EditJob({params}:{params:{id:string}}){return <><div className="mb-7"><h1 className="text-2xl font-bold">Edit job</h1></div><JobForm jobId={params.id}/></>}
