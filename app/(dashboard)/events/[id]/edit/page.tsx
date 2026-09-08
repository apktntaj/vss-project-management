'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, LoaderCircle } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { EventForm } from '@/components/event-form'
import { listEvents, type LocalEvent } from '@/lib/data-client'

export default function EditEventPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [event, setEvent] = useState<LocalEvent | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listEvents().then((events) => {
      setEvent(events.find((item) => item.id === params.id) ?? null)
      setLoading(false)
    })
  }, [params.id])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
        <LoaderCircle className="mr-2 animate-spin" size={18} /> Memuat event...
      </div>
    )
  }

  if (!event) {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <h1 className="text-xl font-bold">Event tidak ditemukan</h1>
        <p className="mt-2 text-sm text-slate-500">
          Data event mungkin sudah dihapus atau belum tersedia di perangkat ini.
        </p>
        <Link href="/events" className="btn-primary mt-6">
          Kembali ke events
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href="/events"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-orange-700"
        >
          <ArrowLeft size={16} /> Kembali ke events
        </Link>
        <p className="eyebrow mt-6">Event management</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Edit event</h1>
        <p className="mt-2 text-sm text-slate-500">
          Lengkapi informasi event dan daftar exhibitor yang berpartisipasi.
        </p>
      </div>
      <div className="card min-h-0 overflow-hidden">
        <EventForm
          event={event}
          enableExhibitors
          onSaved={() => router.push('/events')}
          onCancel={() => router.push('/events')}
        />
      </div>
    </div>
  )
}
