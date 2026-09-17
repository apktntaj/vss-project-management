import Link from 'next/link'

export default function EditEventPage() {
  return (
    <div className="card mx-auto max-w-xl p-8 text-center">
      <h1 className="text-xl font-bold">Event tidak dapat diedit</h1>
      <p className="mt-2 text-sm text-slate-500">Event bersifat immutable. Batalkan event yang salah lalu buat event baru dengan data yang benar.</p>
      <Link href="/events" className="btn-primary mt-6">Kembali ke events</Link>
    </div>
  )
}
