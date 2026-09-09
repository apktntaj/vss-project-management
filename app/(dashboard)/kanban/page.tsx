import { TicketBoard } from '@/components/ticket-board'

export default function KanbanPage({ searchParams }: { searchParams: { event?: string; new?: string } }) {
  return <TicketBoard initialEventId={searchParams.event} openNew={searchParams.new === '1'} />
}
