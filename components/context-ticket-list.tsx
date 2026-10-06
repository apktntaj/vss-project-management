'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { listTickets, type Ticket } from '@/lib/data-client'

export function ContextTicketList({ contextKind, contextId }: { contextKind: 'EVENT' | 'JOB'; contextId: string }) {
  const [tickets, setTickets] = useState<Ticket[]>([]); const [error, setError] = useState('')
  useEffect(() => { void listTickets({ scope: 'all', contextKind, contextId }).then(setTickets).catch((caught) => setError(caught instanceof Error ? caught.message : 'Ticket gagal dimuat.')) }, [contextId, contextKind])
  const open = tickets.filter((ticket) => ticket.status !== 'DONE').length
  return <section className="card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Tickets</h2><p className="mt-1 text-sm text-muted-foreground">{open} terbuka · {tickets.length - open} selesai</p></div><div className="flex gap-2"><Link href={`/kanban?contextKind=${contextKind}&contextId=${contextId}`} className="btn-secondary">Lihat semua</Link><Link href={`/kanban?new=1&contextKind=${contextKind}&contextId=${contextId}`} className="btn-primary">Tambah ticket</Link></div></div>{error ? <p className="mt-4 text-sm text-destructive">{error}</p> : tickets.length ? <div className="mt-4 flex flex-col gap-2">{tickets.slice(0, 5).map((ticket) => <Link key={ticket.id} href={`/tickets/${ticket.id}`} className="rounded-lg border p-3 text-sm hover:bg-muted"><span className="font-semibold">#{ticket.ticketNumber} · {ticket.title}</span><span className="ml-2 text-muted-foreground">{ticket.status}</span></Link>)}</div> : <p className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Belum ada ticket untuk konteks ini.</p>}</section>
}
