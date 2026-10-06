'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { addTicketComment, assignTicket, getTicketDetail, listEvents, listJobs, listUsers, moveAndReorderTickets, takeTicket, type LocalEvent, type LocalJob, type LocalUser, type TicketDetail as TicketDetailData, type TicketStatus } from '@/lib/data-client'
import { mergeTicketTimeline } from '@/domain/ticket/timeline'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { TicketEditDialog } from '@/components/ticket-edit-dialog'

const notify = (message: string, tone: 'success' | 'error') => window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
const displayTime = (value: string) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

export function TicketDetail({ ticketId }: { ticketId: string }) {
  const [detail, setDetail] = useState<TicketDetailData | null>(null)
  const [users, setUsers] = useState<LocalUser[]>([])
  const [events, setEvents] = useState<LocalEvent[]>([])
  const [jobs, setJobs] = useState<LocalJob[]>([])
  const [error, setError] = useState('')
  const [comment, setComment] = useState('')
  const [commentSaving, setCommentSaving] = useState(false)
  const [assignmentOpen, setAssignmentOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const [nextDetail, nextUsers, nextEvents, nextJobs] = await Promise.all([getTicketDetail(ticketId), listUsers(), listEvents(), listJobs()])
      setDetail(nextDetail); setUsers(nextUsers); setEvents(nextEvents); setJobs(nextJobs); setError('')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Ticket tidak dapat dimuat.') }
  }, [ticketId])
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 5000); window.addEventListener('focus', load); return () => { window.clearInterval(timer); window.removeEventListener('focus', load) } }, [load])

  const names = useMemo(() => new Map(users.map((user) => [user.id, user.name])), [users])
  const eventNames = useMemo(() => new Map(events.map((event) => [event.id, event.officialName])), [events])
  const jobNames = useMemo(() => new Map(jobs.map((job) => [job.id, `${job.jobNumber} · ${job.clientName}`])), [jobs])
  if (error) return <div className="card mx-auto max-w-xl p-8"><h1 className="text-xl font-semibold">Ticket tidak tersedia</h1><p className="mt-2 text-sm text-muted-foreground">{error}</p><Link href="/kanban" className="mt-5 inline-flex">Kembali ke tickets</Link></div>
  if (!detail) return <div className="card p-8 text-sm text-muted-foreground">Memuat ticket…</div>

  const { ticket } = detail
  const owner = (id: string | null) => id ? names.get(id) ?? 'Tidak tersedia' : 'Tidak tersedia'
  const contextName = ticket.context.kind === 'GENERAL' ? 'General' : ticket.context.kind === 'EVENT' ? eventNames.get(ticket.context.id) ?? 'Event tidak tersedia' : jobNames.get(ticket.context.id) ?? 'Job tidak tersedia'
  const timeline = mergeTicketTimeline(detail.comments, detail.activities)
  async function submitComment() {
    if (!comment.trim()) return
    setCommentSaving(true)
    try { const added = await addTicketComment(ticket.id, comment); setDetail((current) => current ? { ...current, comments: [...current.comments, added] } : current); setComment(''); notify('Komentar ditambahkan.', 'success') } catch (caught) { notify(caught instanceof Error ? caught.message : 'Komentar gagal ditambahkan.', 'error') } finally { setCommentSaving(false) }
  }
  async function changeAssignment(form: FormData) {
    try { const value = String(form.get('assigneeId')); await assignTicket(ticket.id, value === 'NONE' ? null : value); await load(); setAssignmentOpen(false); notify('PIC ticket diperbarui.', 'success') } catch (caught) { notify(caught instanceof Error ? caught.message : 'PIC gagal diperbarui.', 'error') }
  }
  async function changeStatus(form: FormData) {
    const status = String(form.get('status')) as TicketStatus; const note = String(form.get('note') ?? '')
    try { await moveAndReorderTickets(ticket.id, status, undefined, status === 'DONE' ? note : undefined, ticket.status === 'DONE' && status !== 'DONE' ? note : undefined); await load(); setStatusOpen(false); notify('Status ticket diperbarui.', 'success') } catch (caught) { notify(caught instanceof Error ? caught.message : 'Status gagal diperbarui.', 'error') }
  }
  return <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"><main className="min-w-0"><Link href="/kanban" className="text-sm text-muted-foreground hover:text-foreground">← Semua tickets</Link><p className="mt-5 text-sm font-semibold text-muted-foreground">#{ticket.ticketNumber}</p><h1 className="mt-1 text-3xl font-bold">{ticket.title}</h1><p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{ticket.description || 'Tanpa deskripsi.'}</p><section className="mt-8 flex flex-col gap-3"><h2 className="text-lg font-semibold">Aktivitas</h2>{timeline.length ? timeline.map((item) => item.type === 'COMMENT' ? <article key={item.id} className="rounded-xl border bg-card p-4"><p className="text-sm font-semibold">{owner(item.authorId)} <span className="ml-2 text-xs font-normal text-muted-foreground">{displayTime(item.createdAt)}</span></p><p className="mt-2 whitespace-pre-wrap text-sm">{item.body}</p></article> : <div key={item.id} className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{displayTime(item.occurredAt)} · {owner(item.actorId)} · {item.kind === 'CREATED' ? 'membuat ticket' : item.kind === 'ASSIGNEE_CHANGED' ? 'mengubah PIC' : item.kind === 'STATUS_CHANGED' ? `mengubah status ${item.change.before} → ${item.change.after}` : 'memperbarui detail'}</div>) : <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">Belum ada aktivitas.</p>}</section><section className="mt-6 rounded-xl border bg-card p-4"><Field><FieldLabel htmlFor="ticket-comment">Tulis komentar…</FieldLabel><Textarea id="ticket-comment" value={comment} onChange={(event) => setComment(event.target.value)} /></Field><div className="mt-3 flex justify-end"><Button disabled={commentSaving || !comment.trim()} onClick={() => void submitComment()}>{commentSaving ? 'Mengirim…' : 'Kirim komentar'}</Button></div></section></main><aside><section className="rounded-xl border bg-card p-4"><h2 className="font-semibold">Ringkasan</h2><dl className="mt-4 flex flex-col gap-3 text-sm"><div><dt className="text-muted-foreground">Konteks</dt><dd>{ticket.context.kind === 'GENERAL' ? contextName : <Link className="underline" href={ticket.context.kind === 'EVENT' ? `/events/${ticket.context.id}` : `/jobs/${ticket.context.id}`}>{contextName}</Link>}</dd></div><div><dt className="text-muted-foreground">Status</dt><dd>{ticket.status}</dd></div><div><dt className="text-muted-foreground">Urgensi</dt><dd>{ticket.priority}</dd></div><div><dt className="text-muted-foreground">Ditugaskan ke</dt><dd>{ticket.assigneeId ? owner(ticket.assigneeId) : 'Belum ditugaskan'}</dd></div><div><dt className="text-muted-foreground">Creator</dt><dd>{owner(ticket.creatorId)}</dd></div></dl><div className="mt-5 flex flex-col gap-2">{!ticket.assigneeId && <Button onClick={() => void takeTicket(ticket.id).then(load).then(() => notify('Ticket diambil.', 'success')).catch((caught) => notify(caught instanceof Error ? caught.message : 'Ticket gagal diambil.', 'error'))}>Ambil ticket</Button>}<Button variant="outline" onClick={() => setAssignmentOpen(true)}>{ticket.assigneeId ? 'Ganti PIC' : 'Atur PIC'}</Button>{ticket.assigneeId && <Button variant="outline" onClick={() => void assignTicket(ticket.id, null).then(load).then(() => notify('Assignment dilepas.', 'success')).catch((caught) => notify(caught instanceof Error ? caught.message : 'Assignment gagal dilepas.', 'error'))}>Lepaskan assignment</Button>}<TicketEditDialog ticket={ticket} events={events} jobs={jobs} users={users} onSaved={load} /><Button variant="outline" onClick={() => setStatusOpen(true)}>Ubah status</Button></div></section></aside><Dialog open={assignmentOpen} onOpenChange={setAssignmentOpen}><DialogContent><DialogHeader><DialogTitle>Ganti PIC</DialogTitle><DialogDescription>Tentukan penanggung jawab ticket.</DialogDescription></DialogHeader><form action={changeAssignment}><Field><FieldLabel htmlFor="assignee">PIC</FieldLabel><select id="assignee" name="assigneeId" className="input" defaultValue={ticket.assigneeId ?? 'NONE'}><option value="NONE">Belum ditugaskan</option>{users.filter((user) => user.isActive).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></Field><DialogFooter><Button type="button" variant="outline" onClick={() => setAssignmentOpen(false)}>Batal</Button><Button type="submit">Simpan</Button></DialogFooter></form></DialogContent></Dialog><Dialog open={statusOpen} onOpenChange={setStatusOpen}><DialogContent><DialogHeader><DialogTitle>Ubah status</DialogTitle><DialogDescription>Done dan membuka kembali memerlukan catatan.</DialogDescription></DialogHeader><form action={changeStatus}><FieldGroup><Field><FieldLabel htmlFor="status">Status</FieldLabel><select id="status" name="status" className="input" defaultValue={ticket.status}><option value="TODO">To Do</option><option value="PROGRESS">In Progress</option><option value="DONE">Done</option></select></Field><Field><FieldLabel htmlFor="note">Catatan hasil atau alasan</FieldLabel><Textarea id="note" name="note" /></Field></FieldGroup><DialogFooter><Button type="button" variant="outline" onClick={() => setStatusOpen(false)}>Batal</Button><Button type="submit">Simpan</Button></DialogFooter></form></DialogContent></Dialog></div>
}
