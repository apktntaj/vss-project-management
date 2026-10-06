'use client'

import Link from 'next/link'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { finishLoadingAfterMinimum, PageSkeleton } from '@/components/loading-skeletons'
import { createTicket, listEvents, listJobs, listTickets, listUsers, moveAndReorderTickets, type LocalEvent, type LocalJob, type LocalUser, type Ticket, type TicketContext, type TicketStatus } from '@/lib/data-client'

const columns: Array<{ status: TicketStatus; label: string }> = [
  { status: 'TODO', label: 'To Do' },
  { status: 'PROGRESS', label: 'In Progress' },
  { status: 'DONE', label: 'Done' },
]

type Scope = 'mine' | 'unassigned' | 'all'

function toast(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
}

function contextLabel(context: TicketContext, events: Map<string, string>, jobs: Map<string, string>) {
  if (context.kind === 'GENERAL') return 'General'
  const name = context.kind === 'EVENT' ? events.get(context.id) : jobs.get(context.id)
  return `${context.kind === 'EVENT' ? 'Event' : 'Job'} · ${name ?? 'Tidak tersedia'}`
}

function TicketCard({ ticket, context, assignee, sortable }: { ticket: Ticket; context: string; assignee: string; sortable: boolean }) {
  const item = useSortable({ id: ticket.id, disabled: !sortable })
  return <article ref={item.setNodeRef} style={sortable ? { transform: CSS.Transform.toString(item.transform), transition: item.transition } : undefined} {...(sortable ? item.attributes : {})} className="rounded-xl border bg-card p-3 shadow-sm">
    <div className="flex items-start gap-2">
      {sortable && <button type="button" {...item.listeners} aria-label={`Pindahkan ${ticket.title}`} className="mt-0.5 cursor-grab touch-none text-muted-foreground"><GripVertical /></button>}
      <Link href={`/tickets/${ticket.id}`} className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-muted-foreground">#{ticket.ticketNumber}</p>
        <p className="mt-1 line-clamp-2 text-sm font-semibold">{ticket.title}</p>
      </Link>
    </div>
    <div className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">
      <span className="truncate">{context}</span><span className="truncate">PIC: {assignee}</span>
      <span>{ticket.priority === 'URGENT' ? 'Urgent' : 'Normal'} · {new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(ticket.lastActivityAt))}</span>
    </div>
  </article>
}

function Column({ column, tickets, events, jobs, users, sortable }: { column: typeof columns[number]; tickets: Ticket[]; events: Map<string, string>; jobs: Map<string, string>; users: Map<string, string>; sortable: boolean }) {
  const drop = useDroppable({ id: column.status, disabled: !sortable })
  return <section ref={drop.setNodeRef} className="w-[min(86vw,22rem)] shrink-0 rounded-xl bg-muted p-3">
    <h2 className="mb-3 flex items-center justify-between text-sm font-semibold">{column.label}<span className="rounded-md bg-background px-2 py-0.5 text-xs text-muted-foreground">{tickets.length}</span></h2>
    <SortableContext items={tickets.map((ticket) => ticket.id)} strategy={verticalListSortingStrategy}>
      <div className="flex min-h-28 flex-col gap-3">{tickets.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} context={contextLabel(ticket.context, events, jobs)} assignee={ticket.assigneeId ? users.get(ticket.assigneeId) ?? 'Tidak tersedia' : 'Belum ditugaskan'} sortable={sortable} />)}{!tickets.length && <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">Belum ada ticket.</p>}</div>
    </SortableContext>
  </section>
}

function TicketDialog({ open, onOpenChange, events, jobs, users, initialContext, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; events: LocalEvent[]; jobs: LocalJob[]; users: LocalUser[]; initialContext?: TicketContext; onSaved: () => Promise<void> }) {
  const [contextKey, setContextKey] = useState(initialContext?.kind === 'GENERAL' ? 'GENERAL' : initialContext ? `${initialContext.kind}:${initialContext.id}` : 'GENERAL')
  const [assignee, setAssignee] = useState<string | null | undefined>(undefined)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const contexts = [{ value: 'GENERAL', label: 'General / belum ada konteks' }, ...events.filter((event) => event.status === 'ACTIVE').map((event) => ({ value: `EVENT:${event.id}`, label: `Event · ${event.officialName}` })), ...jobs.filter((job) => !['COMPLETED', 'CANCELLED'].includes(job.status)).map((job) => ({ value: `JOB:${job.id}`, label: `Job · ${job.jobNumber} · ${job.clientName}` }))]
  const selectedJob = contextKey.startsWith('JOB:') ? jobs.find((job) => job.id === contextKey.slice(4)) : undefined
  async function submit(form: FormData) {
    const [kind, id] = contextKey.split(':') as ['GENERAL' | 'EVENT' | 'JOB', string | undefined]
    const context: TicketContext = kind === 'GENERAL' ? { kind } : { kind, id: id ?? '' }
    setSaving(true); setError('')
    try {
      await createTicket({ title: String(form.get('title') ?? ''), description: String(form.get('description') ?? '') || null, priority: form.get('priority') === 'URGENT' ? 'URGENT' : 'NORMAL', context, assigneeId: assignee })
      await onSaved(); toast('Ticket berhasil dibuat.', 'success'); onOpenChange(false)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Ticket gagal dibuat.') } finally { setSaving(false) }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Tambah ticket</DialogTitle><DialogDescription>Buat intake General atau pilih konteks operasional.</DialogDescription></DialogHeader><form action={submit}><FieldGroup><Field><FieldLabel htmlFor="ticket-title">Judul</FieldLabel><Input id="ticket-title" name="title" required /></Field><Field><FieldLabel htmlFor="ticket-context">Konteks</FieldLabel><select id="ticket-context" value={contextKey} onChange={(event) => { setContextKey(event.target.value); setAssignee(undefined) }} className="input"><>{contexts.map((context) => <option key={context.value} value={context.value}>{context.label}</option>)}</></select></Field><Field><FieldLabel htmlFor="ticket-assignee">Ditugaskan ke</FieldLabel><select id="ticket-assignee" value={assignee === undefined ? '' : assignee ?? 'NONE'} onChange={(event) => setAssignee(event.target.value === '' ? undefined : event.target.value === 'NONE' ? null : event.target.value)} className="input"><option value="">{selectedJob?.assignedToId ? 'Gunakan PIC Job sebagai default' : 'Belum ditugaskan'}</option><option value="NONE">Belum ditugaskan</option>{users.filter((user) => user.isActive).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select>{selectedJob?.assignedToId && assignee === undefined && <FieldDescription>Mengikuti PIC Job sebagai default.</FieldDescription>}</Field><Field><FieldLabel htmlFor="ticket-description">Deskripsi</FieldLabel><Textarea id="ticket-description" name="description" /></Field><Field><FieldLabel htmlFor="ticket-priority">Urgensi</FieldLabel><select id="ticket-priority" name="priority" className="input"><option value="NORMAL">Normal</option><option value="URGENT">Urgent</option></select></Field>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</FieldGroup><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button><Button type="submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</Button></DialogFooter></form></DialogContent></Dialog>
}

export function TicketBoard({ initialContext, openNew = false }: { initialContext?: TicketContext; openNew?: boolean }) {
  const [scope, setScope] = useState<Scope>('mine'); const [tickets, setTickets] = useState<Ticket[]>([]); const [events, setEvents] = useState<LocalEvent[]>([]); const [jobs, setJobs] = useState<LocalJob[]>([]); const [users, setUsers] = useState<LocalUser[]>([]); const [query, setQuery] = useState(''); const [contextFilter, setContextFilter] = useState(initialContext?.kind === 'GENERAL' ? '' : initialContext ? `${initialContext.kind}:${initialContext.id}` : ''); const [priority, setPriority] = useState(''); const [newOpen, setNewOpen] = useState(openNew); const [pendingMove, setPendingMove] = useState<{ ticket: Ticket; status: TicketStatus; ids: string[] } | null>(null)
  const load = useCallback(async () => { const started = Date.now(); try { const [nextTickets, nextEvents, nextJobs, nextUsers] = await Promise.all([listTickets({ scope, ...(contextFilter ? { contextKind: contextFilter.split(':')[0] as 'EVENT' | 'JOB', contextId: contextFilter.split(':')[1] } : {}) }), listEvents(), listJobs(), listUsers()]); setTickets(nextTickets); setEvents(nextEvents); setJobs(nextJobs); setUsers(nextUsers) } catch (caught) { toast(caught instanceof Error ? caught.message : 'Ticket gagal dimuat.', 'error') } finally { finishLoadingAfterMinimum(started, () => undefined) } }, [scope, contextFilter])
  useEffect(() => { void load() }, [load])
  const eventNames = useMemo(() => new Map(events.map((event) => [event.id, event.officialName])), [events]); const jobNames = useMemo(() => new Map(jobs.map((job) => [job.id, `${job.jobNumber} · ${job.clientName}`])), [jobs]); const userNames = useMemo(() => new Map(users.map((user) => [user.id, user.name])), [users])
  const visible = tickets.filter((ticket) => (!query || `${ticket.ticketNumber} ${ticket.title} ${ticket.description ?? ''} ${contextLabel(ticket.context, eventNames, jobNames)} ${ticket.assigneeId ? userNames.get(ticket.assigneeId) ?? '' : ''}`.toLowerCase().includes(query.toLowerCase())) && (!priority || ticket.priority === priority))
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  function drag(event: DragEndEvent) { const ticket = tickets.find((item) => item.id === String(event.active.id)); if (!ticket || !event.over) return; const overTicket = tickets.find((item) => item.id === String(event.over?.id)); const status = (overTicket?.status ?? String(event.over.id)) as TicketStatus; if (!columns.some((column) => column.status === status)) return; const ids = tickets.filter((item) => item.status === status && item.id !== ticket.id).sort((a, b) => a.order - b.order).map((item) => item.id); ids.splice(overTicket ? Math.max(0, ids.indexOf(overTicket.id)) : ids.length, 0, ticket.id); setPendingMove({ ticket, status, ids }) }
  async function confirmMove(form: FormData) { if (!pendingMove) return; try { await moveAndReorderTickets(pendingMove.ticket.id, pendingMove.status, pendingMove.ids, String(form.get('note') ?? '') || undefined, String(form.get('note') ?? '') || undefined); await load(); toast('Status ticket diperbarui.', 'success'); setPendingMove(null) } catch (caught) { toast(caught instanceof Error ? caught.message : 'Ticket gagal dipindahkan.', 'error') } }
  return <div className="flex flex-col gap-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Workspace</p><h1 className="mt-1 text-3xl font-bold">Tickets</h1><p className="mt-1 text-sm text-muted-foreground">Koordinasi kerja yang dapat ditemukan seluruh staf.</p></div><Button onClick={() => setNewOpen(true)}><Plus data-icon="inline-start" />Tambah ticket</Button></div><div className="flex flex-wrap gap-2"><Button variant={scope === 'mine' ? 'default' : 'outline'} onClick={() => setScope('mine')}>Ticket saya</Button><Button variant={scope === 'unassigned' ? 'default' : 'outline'} onClick={() => setScope('unassigned')}>Belum ditugaskan</Button><Button variant={scope === 'all' ? 'default' : 'outline'} onClick={() => setScope('all')}>Semua ticket</Button></div><div className="grid gap-3 rounded-xl border bg-muted/40 p-3 md:grid-cols-3"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nomor, judul, konteks, atau PIC…" /><select value={contextFilter} onChange={(event) => setContextFilter(event.target.value)} className="input"><option value="">Semua konteks</option>{events.map((event) => <option key={event.id} value={`EVENT:${event.id}`}>Event · {event.officialName}</option>)}{jobs.map((job) => <option key={job.id} value={`JOB:${job.id}`}>Job · {job.jobNumber}</option>)}</select><select value={priority} onChange={(event) => setPriority(event.target.value)} className="input"><option value="">Semua urgensi</option><option value="NORMAL">Normal</option><option value="URGENT">Urgent</option></select></div>{scope === 'mine' ? <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={drag}><div className="flex gap-4 overflow-x-auto pb-3">{columns.map((column) => <Column key={column.status} column={column} tickets={visible.filter((ticket) => ticket.status === column.status).sort((a, b) => a.order - b.order)} events={eventNames} jobs={jobNames} users={userNames} sortable />)}</div></DndContext> : <div className="flex gap-4 overflow-x-auto pb-3">{columns.map((column) => <Column key={column.status} column={column} tickets={visible.filter((ticket) => ticket.status === column.status).sort((a, b) => a.order - b.order)} events={eventNames} jobs={jobNames} users={userNames} sortable={false} />)}</div>}<TicketDialog open={newOpen} onOpenChange={setNewOpen} events={events} jobs={jobs} users={users} initialContext={initialContext} onSaved={load} /><Dialog open={!!pendingMove} onOpenChange={(open) => !open && setPendingMove(null)}><DialogContent><DialogHeader><DialogTitle>{pendingMove?.status === 'DONE' ? 'Selesaikan ticket' : pendingMove?.ticket.status === 'DONE' ? 'Buka kembali ticket' : 'Pindahkan ticket'}</DialogTitle><DialogDescription>{pendingMove?.status === 'DONE' ? 'Catatan hasil wajib diisi.' : pendingMove?.ticket.status === 'DONE' ? 'Alasan membuka kembali wajib diisi.' : 'Konfirmasi perubahan status ticket.'}</DialogDescription></DialogHeader><form action={confirmMove}><Field><FieldLabel htmlFor="move-note">{pendingMove?.status === 'DONE' ? 'Catatan hasil' : pendingMove?.ticket.status === 'DONE' ? 'Alasan membuka kembali' : 'Catatan (opsional)'}</FieldLabel><Textarea id="move-note" name="note" required={pendingMove?.status === 'DONE' || pendingMove?.ticket.status === 'DONE'} /></Field><DialogFooter><Button type="button" variant="outline" onClick={() => setPendingMove(null)}>Batal</Button><Button type="submit">Simpan</Button></DialogFooter></form></DialogContent></Dialog></div>
}
