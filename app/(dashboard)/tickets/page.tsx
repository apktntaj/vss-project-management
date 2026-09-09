'use client'
import { useEffect, useState } from 'react'
import { TicketWorkspace } from '@/components/ticket-workspace'
import { listEvents, listJobs, listUsers, type LocalEvent, type LocalJob, type LocalUser } from '@/lib/data-client'
export default function TicketsPage() { const [data, setData] = useState<{ events: LocalEvent[]; jobs: LocalJob[]; users: LocalUser[] } | null>(null); useEffect(() => { Promise.all([listEvents(), listJobs(), listUsers()]).then(([events, jobs, users]) => setData({ events, jobs, users })) }, []); return data ? <TicketWorkspace {...data} /> : <p className="text-sm text-slate-500">Memuat ticket…</p> }
