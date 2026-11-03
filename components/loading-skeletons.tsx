import { Skeleton } from '@/components/ui/skeleton'

export function PageSkeleton({ cards = 3, rows = 4 }: { cards?: number; rows?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Memuat data">
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cards }, (_, index) => (
          <Skeleton key={index} className="h-32 rounded-2xl" />
        ))}
      </div>
      <div className="rounded-2xl border p-5">
        <div className="flex flex-col gap-4">
          {Array.from({ length: rows }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function FormSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className="card mx-auto max-w-3xl p-6" aria-busy="true" aria-label="Memuat formulir">
      <Skeleton className="h-8 w-52" />
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {Array.from({ length: fields }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Memuat daftar">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  )
}

/** Nama event serta venue · tanggal pameran, tepat di bawah nomor job. */
export function JobEventInfoSkeleton() {
  return (
    <div aria-busy="true" aria-label="Memuat informasi event">
      <Skeleton className="mt-2 h-6 w-64 max-w-full" />
      <Skeleton className="mt-1.5 h-5 w-80 max-w-full" />
    </div>
  )
}

/** Kerangka halaman detail job: header (nomor, event, agent, jenis job), tombol aksi, blok manifest. */
export function JobDetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Memuat job">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-3 h-10 w-52" />
          <JobEventInfoSkeleton />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-6 w-32 rounded-full" />
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>
      </div>
      <Skeleton className="h-72 w-full rounded-2xl" />
      <Skeleton className="h-20 w-full rounded-2xl" />
    </div>
  )
}
