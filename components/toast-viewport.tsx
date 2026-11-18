'use client'

// Tumpukan toast global di kanan bawah viewport. Pemicunya event `vss:toast` (lihat `lib/notify.ts`).
// Tiap toast punya timer sendiri (auto-dismiss), pesan yang sama tidak digandakan, dan jumlah yang
// tampil dibatasi supaya beruntun tidak saling menimpa. z-index di atas overlay dialog (z-50).
// `aria-live` pada wadah juga membuat toast tetap terbaca saat dialog modal membuka.

import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

type ToastTone = 'success' | 'error'
type ToastItem = { id: number; message: string; tone: ToastTone }

const MAX_VISIBLE = 4
const DURATION_MS: Record<ToastTone, number> = { success: 4000, error: 6500 }

export function ToastViewport() {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Map<number, number>())

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer !== undefined) window.clearTimeout(timer)
    timers.current.delete(id)
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  useEffect(() => {
    const activeTimers = timers.current
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: unknown; tone?: unknown }>).detail
      if (
        !detail ||
        typeof detail.message !== 'string' ||
        (detail.tone !== 'success' && detail.tone !== 'error')
      ) {
        return
      }
      const { message, tone } = detail as { message: string; tone: ToastTone }
      const id = ++nextId.current
      setItems((current) => {
        // Pesan identik menggantikan yang lama (timer ikut diulang), bukan menumpuk.
        const rest = current.filter((item) => {
          if (item.message !== message || item.tone !== tone) return true
          const timer = activeTimers.get(item.id)
          if (timer !== undefined) window.clearTimeout(timer)
          activeTimers.delete(item.id)
          return false
        })
        const next = [...rest, { id, message, tone }]
        for (const dropped of next.slice(0, Math.max(0, next.length - MAX_VISIBLE))) {
          const timer = activeTimers.get(dropped.id)
          if (timer !== undefined) window.clearTimeout(timer)
          activeTimers.delete(dropped.id)
        }
        return next.slice(-MAX_VISIBLE)
      })
      activeTimers.set(
        id,
        window.setTimeout(() => dismiss(id), DURATION_MS[tone]),
      )
    }
    window.addEventListener('vss:toast', receive)
    return () => {
      window.removeEventListener('vss:toast', receive)
      activeTimers.forEach((timer) => window.clearTimeout(timer))
      activeTimers.clear()
    }
  }, [dismiss])

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-5 z-[110] flex w-[calc(100%-2rem)] max-w-sm flex-col items-end gap-2 sm:right-5"
    >
      {items.map((item) => (
        <div
          key={item.id}
          role={item.tone === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex w-full items-start gap-2 rounded-xl border py-3 pr-2 pl-4 text-sm shadow-lg ${
            item.tone === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          <p className="min-w-0 flex-1 break-words">{item.message}</p>
          <button
            type="button"
            onClick={() => dismiss(item.id)}
            aria-label="Tutup notifikasi"
            className="-my-1 inline-flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-black/5"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  )
}
