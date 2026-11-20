'use client'

// Mengapa: tombol tulis job selalu tampil ("tampil, jelaskan saat dicoba"). Bila pengguna tidak
// boleh, tombol tampil pudar (aria-disabled, bukan `disabled`, supaya tetap bisa difokus dan diklik)
// dan klik/sentuh/Enter menampilkan alasannya sebagai toast tanpa menjalankan aksi.

import type { ComponentPropsWithoutRef, MouseEvent } from 'react'

import { toast } from '@/components/toast'

/** Tampilkan alasan penolakan sebagai toast 'error' kanan bawah; tidak memanggil server. */
export function denyWrite(reason: string): void {
  toast(reason, 'error')
}

export type GuardedButtonProps = ComponentPropsWithoutRef<'button'> & {
  /** null = boleh; string = alasan penolakan (tidak kosong). */
  denial: string | null
}

export function GuardedButton({
  denial,
  type,
  className,
  onClick,
  children,
  ...rest
}: GuardedButtonProps) {
  const denied = typeof denial === 'string'

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (typeof denial === 'string') {
      event.preventDefault()
      event.stopPropagation()
      denyWrite(denial)
      return
    }
    onClick?.(event)
  }

  return (
    <button
      {...rest}
      type={denied ? 'button' : (type ?? 'button')}
      aria-disabled={denied ? 'true' : undefined}
      className={`${className ?? ''} aria-disabled:cursor-not-allowed aria-disabled:opacity-50`.trim()}
      onClick={handleClick}
    >
      {children}
    </button>
  )
}
