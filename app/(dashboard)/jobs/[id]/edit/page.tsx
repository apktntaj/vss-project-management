import { JobEditor } from '@/components/job-editor'

export default function EditJob({ params }: { params: { id: string } }) {
  return <JobEditor jobId={params.id} />
}
