'use client'

import { useState } from 'react'
import type { Ticket } from '@/domain/ticket/types'
import type { LocalEvent, LocalJob, LocalUser } from '@/lib/data-client'
import { updateTicketDetails } from '@/lib/data-client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export function TicketEditDialog({ ticket, events, jobs, users, onSaved }: { ticket: Ticket; events: LocalEvent[]; jobs: LocalJob[]; users: LocalUser[]; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false); const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const contextValue = ticket.context.kind === 'GENERAL' ? 'GENERAL' : `${ticket.context.kind}:${ticket.context.id}`
  async function submit(form: FormData) {
    const [kind, id] = String(form.get('context')).split(':') as ['GENERAL' | 'EVENT' | 'JOB', string | undefined]
    const context = kind === 'GENERAL' ? { kind } as const : { kind, id: id ?? '' } as const
    const assignee = String(form.get('assigneeId'))
    setSaving(true); setError('')
    try { await updateTicketDetails(ticket.id, { title: String(form.get('title') ?? ''), description: String(form.get('description') ?? '') || null, context, priority: String(form.get('priority')) as Ticket['priority'], assigneeId: assignee === 'NONE' ? null : assignee }); await onSaved(); setOpen(false); window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message: 'Detail ticket diperbarui.', tone: 'success' } })) } catch (caught) { setError(caught instanceof Error ? caught.message : 'Detail ticket gagal diperbarui.') } finally { setSaving(false) }
  }
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger render={<Button variant="outline" />}>Edit</DialogTrigger><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Edit ticket</DialogTitle><DialogDescription>Perubahan metadata dicatat pada aktivitas ticket.</DialogDescription></DialogHeader><form action={submit}><FieldGroup><Field><FieldLabel htmlFor="edit-title">Judul</FieldLabel><Input id="edit-title" name="title" defaultValue={ticket.title} required /></Field><Field><FieldLabel htmlFor="edit-context">Konteks</FieldLabel><select id="edit-context" name="context" defaultValue={contextValue} className="input"><option value="GENERAL">General / belum ada konteks</option>{events.filter((event) => event.status === 'ACTIVE').map((event) => <option key={event.id} value={`EVENT:${event.id}`}>Event · {event.officialName}</option>)}{jobs.filter((job) => !['COMPLETED', 'CANCELLED'].includes(job.status)).map((job) => <option key={job.id} value={`JOB:${job.id}`}>Job · {job.jobNumber} · {job.clientName}</option>)}</select></Field><Field><FieldLabel htmlFor="edit-assignee">Ditugaskan ke</FieldLabel><select id="edit-assignee" name="assigneeId" defaultValue={ticket.assigneeId ?? 'NONE'} className="input"><option value="NONE">Belum ditugaskan</option>{users.filter((user) => user.isActive).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></Field><Field><FieldLabel htmlFor="edit-description">Deskripsi</FieldLabel><Textarea id="edit-description" name="description" defaultValue={ticket.description ?? ''} /></Field><Field><FieldLabel htmlFor="edit-priority">Urgensi</FieldLabel><select id="edit-priority" name="priority" defaultValue={ticket.priority} className="input"><option value="NORMAL">Normal</option><option value="URGENT">Urgent</option></select></Field>{error && <p className="text-sm text-destructive">{error}</p>}</FieldGroup><DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button type="submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</Button></DialogFooter></form></DialogContent></Dialog>
}
