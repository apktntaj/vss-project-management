import { Sparkles } from 'lucide-react'

export function ComingSoon() {
  return (
    <section className="relative isolate flex min-h-[360px] items-center justify-center overflow-hidden rounded-3xl border border-orange-200 bg-orange-50 px-6 py-12 text-orange-950 shadow-xl shadow-orange-100/70">
      <div className="absolute -left-20 top-0 -z-10 h-56 w-56 rounded-full bg-orange-300/35 blur-3xl" />
      <div className="absolute -right-16 bottom-0 -z-10 h-64 w-64 rounded-full bg-amber-200/45 blur-3xl" />

      <div className="relative text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/25">
          <Sparkles size={25} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">coming soon</h1>
      </div>
    </section>
  )
}
