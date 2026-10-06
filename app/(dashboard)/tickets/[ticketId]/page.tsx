import { TicketDetail } from '@/components/ticket-detail'

export default function TicketDetailPage({ params }: { params: { ticketId: string } }) {
  return <TicketDetail ticketId={params.ticketId} />
}
