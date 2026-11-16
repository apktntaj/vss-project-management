// Tanggal kalender WIB dari sebuah instan. Satu definisi "hari ini" untuk seluruh aplikasi:
// server berjalan di UTC, sedangkan operasional PPJK mengikuti WIB (Asia/Jakarta) — tanpa helper
// ini, tanggal berpindah pada 07:00 WIB, bukan tengah malam. Murni (tanpa `server-only`) agar
// bisa dipakai modul murni, Server Component, maupun leaf klien.

const WIB_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Tanggal kalender WIB (YYYY-MM-DD) dari sebuah instan. */
export function wibDateOf(value: Date): string {
  return WIB_DATE.format(value)
}
