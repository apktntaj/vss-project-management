import { Skeleton } from '@/components/ui/skeleton'

export const MINIMUM_SKELETON_DURATION_MS = 600

export function finishLoadingAfterMinimum(startedAt: number, finish: () => void) {
  const remainingDuration = MINIMUM_SKELETON_DURATION_MS - (Date.now() - startedAt)
  if (remainingDuration <= 0) {
    finish()
    return
  }
  window.setTimeout(finish, remainingDuration)
}

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
