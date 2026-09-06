'use client'
import { useRouter } from 'next/navigation'
export default function LoginPage() {
  const router = useRouter()
  return (
    <main className="grid min-h-screen place-items-center bg-black p-5">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <p className="text-sm font-bold uppercase tracking-widest text-blue-700">VSS Project Management</p>
        <h1 className="mt-3 text-2xl font-bold">Mode browser</h1>
        <p className="mt-2 text-sm text-black/50">
          Data disimpan di IndexedDB perangkat ini tanpa akun server atau database eksternal.
        </p>
        <button onClick={() => router.push('/')} className="btn-primary mt-6 w-full">
          Buka aplikasi
        </button>
      </div>
    </main>
  )
}
