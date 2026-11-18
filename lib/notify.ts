// Pemicu toast global. Toast dirender oleh `components/layout.tsx` (tumpukan kanan bawah) yang
// mendengarkan event `vss:toast`; modul ini satu-satunya tempat event itu dibentuk dari komponen
// job. Aman dipanggil dari handler klien saja (butuh `window`).

export type NotifyTone = 'success' | 'error'

export function notify(message: string, tone: NotifyTone = 'success'): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
}
