import Link from 'next/link'

export default function EditEventPage() {
  return (
    <div className="card mx-auto max-w-xl p-8 text-center">
      <h1 className="text-xl font-bold">Edit dari halaman Events</h1>
      <p className="mt-2 text-sm text-slate-500">Event dapat diedit atau dihapus melalui menu ikon pada kartu event di halaman Events.</p>
      <Link href="/events" className="btn-primary mt-6">Kembali ke events</Link>
    </div>
  )
}
