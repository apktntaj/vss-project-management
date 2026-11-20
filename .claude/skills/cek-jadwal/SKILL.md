---
name: cek-jadwal
description: Cek posisi pekerjaan terhadap kalender di docs-v2/scope-v1.md. Gunakan di awal setiap sesi kerja, saat pengguna bertanya "minggu ini kerjakan apa", "saya telat?", atau di hari Jumat untuk menyiapkan update mingguan ke grup klien.
---

Kamu membantu pengguna tetap di jadwal serah terima v1. Sumber kebenaran: `docs-v2/scope-v1.md`
(scope, daftar item A1–D2, kalender per minggu, bagian "Status item"). Jawab dalam bahasa
Indonesia, singkat dan langsung.

## Langkah

1. **Baca** `docs-v2/scope-v1.md`, terutama "Kalender" dan "Status item". Tentukan minggu
   kalender yang berjalan dari tanggal hari ini.
2. **Cek apa yang berubah sejak catatan terakhir.** Jalankan
   `git log --since="<tanggal entri terakhir di Log progres>" --format='%ad %s' --date=short`
   dan `git status --short`. Cocokkan commit dengan ID item.
3. **Tanya pengguna** satu pertanyaan saja bila perlu: item mana yang selesai sejak sesi terakhir
   (bila git tidak cukup jelas). Jangan menandai selesai tanpa bukti commit atau konfirmasi.
4. **Perbarui `docs-v2/scope-v1.md`:** ubah status item di "Status item" dan tambah satu baris di
   "Log progres". Hanya bagian itu; jangan mengubah scope atau kalender tanpa persetujuan.
5. **Laporkan** dalam format ini:

   ```
   Minggu <n> (<tanggal>) — <Tepat jadwal | Terlambat x hari | Lebih cepat>
   Kerjakan sekarang: <ID> <nama item>   (lalu item berikutnya minggu ini)
   Tertunda: <item minggu lalu yang belum selesai, bila ada>
   Ditunggu dari klien: <template/konfirmasi yang belum datang dan menghalangi>
   Tonggak berikutnya: <M?> <tanggal> — sisa <n> hari kerja
   ```

6. **Jaga fokus.** Bila pengguna menyebut pekerjaan yang bukan item minggu ini (poles UI, fitur
   baru, perubahan model), katakan terus terang bahwa itu di luar jadwal, sebut item yang
   tergeser, dan sarankan mencatatnya di antrean
   (`docs-v2/private/template-balasan-grup.md`) bila datang dari klien. Pengecualian: bug yang
   menghalangi klien bekerja.

7. **Hari Jumat** (atau bila diminta): susun draf "Update Jumat" memakai format di
   `docs-v2/private/template-balasan-grup.md`, dari item yang selesai minggu ini, rencana minggu
   depan, dan yang ditunggu dari klien. Tampilkan sebagai draf; jangan mengirim apa pun.

## Aturan menilai keterlambatan

- Item dianggap selesai hanya bila statusnya "Selesai" di "Status item".
- Hitung keterlambatan sebagai jumlah hari kerja item yang dijadwalkan sebelum minggu ini tetapi
  belum selesai.
- Bila terlambat lebih dari 3 hari kerja, usulkan satu dari: geser item ke cadangan Jumat,
  pindahkan item kecil ke fase 2 (perlu persetujuan Arsya), atau mundurkan tonggak. Jangan
  memutuskan sendiri.
