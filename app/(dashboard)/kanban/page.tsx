import { TicketBoard } from '@/components/ticket-board'
import { auth } from '@/auth'

export default async function KanbanPage({ searchParams }: { searchParams: { event?: string; new?: string } }) {
  const session = await auth()
  return <TicketBoard userEmail={session?.user?.email ?? ''} initialEventId={searchParams.event} openNew={searchParams.new === '1'} />
}
