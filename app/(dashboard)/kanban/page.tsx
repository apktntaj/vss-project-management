import { TicketBoard } from '@/components/ticket-board'
import type { TicketContext } from '@/domain/ticket/types'

export default function KanbanPage({
  searchParams,
}: {
  searchParams: { new?: string; contextKind?: string; contextId?: string }
}) {
  const initialContext: TicketContext | undefined =
    searchParams.contextKind === 'EVENT' && searchParams.contextId
      ? { kind: 'EVENT', id: searchParams.contextId }
      : searchParams.contextKind === 'JOB' && searchParams.contextId
        ? { kind: 'JOB', id: searchParams.contextId }
        : undefined
  return <TicketBoard initialContext={initialContext} openNew={searchParams.new === '1'} />
}
