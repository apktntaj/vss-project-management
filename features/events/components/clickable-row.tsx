'use client'

// Mengapa: daftar event adalah Server Component, sedangkan klik baris butuh handler klien. Leaf kecil
// ini membungkus `<tr>` agar seluruh baris menuju detail event. Tautan judul tetap ada untuk
// keyboard, klik-tengah, dan "buka di tab baru".

import type { MouseEvent, ReactNode } from 'react'
import { useRouter } from 'next/navigation'

// Penanda sel/elemen yang klik-nya tidak boleh memicu navigasi baris (mis. sel menu aksi + modalnya).
// Server Component menulis atribut ini sebagai literal; nilai ekspor modul klien tidak terbaca di server.
const ROW_CLICK_IGNORE_ATTR = 'data-row-click-ignore'

const INTERACTIVE = `a, button, input, select, textarea, label, [${ROW_CLICK_IGNORE_ATTR}]`

export function ClickableRow({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: ReactNode
}) {
  const router = useRouter()

  function handleClick(event: MouseEvent<HTMLTableRowElement>) {
    const target = event.target as Element
    // Klik dari portal (modal/menu) bukan keturunan DOM baris ini; elemen interaktif menangani dirinya.
    if (!event.currentTarget.contains(target) || target.closest(INTERACTIVE)) return
    // Pengguna sedang menyeleksi teks, bukan membuka baris.
    if (window.getSelection()?.toString()) return
    router.push(href)
  }

  return (
    <tr onClick={handleClick} className={`cursor-pointer ${className ?? ''}`}>
      {children}
    </tr>
  )
}
