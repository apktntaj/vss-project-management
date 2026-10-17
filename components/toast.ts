// Mengapa: helper toast BERSAMA. Build lama menyalin fungsi tiga baris ini ke 5+ komponen; di sini
// ia hidup di satu tempat agar komponen baru mengimpornya, bukan menggandakannya (konvensi repo).
// Mekanismenya custom event `vss:toast` yang didengarkan AppShell di `components/layout.tsx`, yang
// merender toast di kanan bawah viewport lalu menutupnya otomatis. Modul ini menyentuh `window`,
// jadi hanya dipanggil dari jalur klien ('use client') — bukan dari Server Component.

export type ToastTone = 'success' | 'error'

// Kirim toast. `tone` menentukan warna (sukses/gagal). Aman dipanggil dari event handler klien;
// tidak melakukan apa pun bila `window` tak tersedia (mis. render server defensif).
export function toast(message: string, tone: ToastTone): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
}
