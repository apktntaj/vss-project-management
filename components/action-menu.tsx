'use client'

// Menu aksi titik tiga yang dipakai baris tabel dan header halaman job. Panel di-anchor `fixed` dari
// getBoundingClientRect agar tidak terpotong wadah tabel yang overflow, ditutup saat scroll/resize,
// dan bisa dioperasikan dengan keyboard (panah, Home/End, Escape mengembalikan fokus ke tombol).

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { MoreVertical, type LucideIcon } from 'lucide-react'

export type ActionMenuItem = {
  key: string
  label: string
  icon: LucideIcon
  onSelect: () => void
  /** `danger` untuk aksi merusak (Batalkan); tampil merah. */
  tone?: 'danger'
  disabled?: boolean
  /** Garis pemisah di atas item ini. */
  separatorBefore?: boolean
}

type Anchor = { top: number; left: number }

const ITEM_HEIGHT = 40
const PANEL_PADDING = 8
const EDGE = 8

export function ActionMenu({
  label,
  items,
  width = 224,
  bordered = false,
}: {
  /** Nama aksesibel tombol dan menu, mis. "Menu aksi untuk S.01". */
  label: string
  items: ActionMenuItem[]
  width?: number
  /** Tombol berbingkai (header halaman) atau polos (baris tabel). */
  bordered?: boolean
}) {
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const close = useCallback((restoreFocus: boolean) => {
    setAnchor(null)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  // Posisi tetap tidak ikut bergerak saat scroll, jadi tutup saja.
  useEffect(() => {
    if (!anchor) return
    const dismiss = () => setAnchor(null)
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)
    return () => {
      window.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('resize', dismiss)
    }
  }, [anchor])

  useEffect(() => {
    if (anchor)
      panelRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus()
  }, [anchor])

  if (!items.length) return null

  function toggle() {
    if (anchor) return close(false)
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const height = items.length * ITEM_HEIGHT + PANEL_PADDING
    const left = Math.max(EDGE, Math.min(rect.right - width, window.innerWidth - width - EDGE))
    // Buka ke atas bila panel tidak muat di bawah tombol.
    const below = rect.bottom + 4
    const top =
      below + height > window.innerHeight - EDGE ? Math.max(EDGE, rect.top - height - 4) : below
    setAnchor({ top, left })
  }

  function onPanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      return close(true)
    }
    if (event.key === 'Tab') return close(false)
    const enabled = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [],
    )
    const index = enabled.indexOf(document.activeElement as HTMLElement)
    const target =
      event.key === 'ArrowDown'
        ? enabled[(index + 1) % enabled.length]
        : event.key === 'ArrowUp'
          ? enabled[(index - 1 + enabled.length) % enabled.length]
          : event.key === 'Home'
            ? enabled[0]
            : event.key === 'End'
              ? enabled[enabled.length - 1]
              : null
    if (target) {
      event.preventDefault()
      target.focus()
    }
  }

  return (
    // Klik di dalam menu tidak boleh memicu klik baris tabel di atasnya.
    <span className="inline-flex" onClick={(event) => event.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-expanded={anchor !== null}
        aria-haspopup="menu"
        aria-controls={anchor ? menuId : undefined}
        title="Menu aksi"
        className={`inline-flex size-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 ${bordered ? 'border border-slate-200 bg-white' : ''}`}
      >
        <MoreVertical size={18} aria-hidden="true" />
      </button>
      {anchor && (
        <>
          <div className="fixed inset-0 z-40" role="presentation" onClick={() => close(false)} />
          <div
            ref={panelRef}
            id={menuId}
            role="menu"
            aria-label={label}
            onKeyDown={onPanelKeyDown}
            className="fixed z-50 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
            style={{ top: anchor.top, left: anchor.left, width }}
          >
            {items.map((item) => (
              <div key={item.key}>
                {item.separatorBefore && (
                  <div className="my-1 border-t border-slate-200" role="separator" />
                )}
                <button
                  role="menuitem"
                  type="button"
                  disabled={item.disabled}
                  onClick={() => {
                    close(false)
                    item.onSelect()
                  }}
                  className={`flex h-10 w-full items-center gap-2.5 px-3 text-left text-sm focus-visible:outline-none disabled:cursor-not-allowed disabled:text-slate-500 ${
                    item.tone === 'danger'
                      ? 'text-rose-700 hover:bg-rose-50 focus-visible:bg-rose-50'
                      : 'text-slate-700 hover:bg-slate-50 focus-visible:bg-slate-100'
                  }`}
                >
                  <item.icon size={15} aria-hidden="true" className="shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </span>
  )
}
