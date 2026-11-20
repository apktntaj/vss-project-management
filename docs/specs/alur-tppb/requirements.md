# Alur Job TPPB — Requirements

Ditulis oleh: manajer · Tanggal: 2026-11-19

Sumber: chat WhatsApp dengan Arsya (13 Okt 2026, alur 14 langkah) dan grup PPJK (Okt–Nov 2026),
dirangkum di [docs-v2/riwayat-scope.md](../../../docs-v2/riwayat-scope.md); catatan klien di
[docs/domain/sources/arsya-discussions.md](../../domain/sources/arsya-discussions.md). Kutipan dalam
tanda petik adalah kata-kata klien.

## Masalah

Barang pameran internasional masuk lewat fasilitas TPPB (venue sebagai tempat penimbunan berikat).
Satu job melewati sekitar 14 langkah selama beberapa minggu, melibatkan Kanwil, pelayaran, bonded,
hall, dan peserta. Saat ini progresnya dilacak di spreadsheet dan chat, dan dokumen tiap langkah
(surat DO, form pemindahan, form disposal, surat re-ekspor) diketik ulang dari CIPL yang sama.
Akibatnya status job sulit dilihat sekilas dan data barang diketik berkali-kali
("klo bisa di ketik 1 kali kenapa harus 7 kali").

## Pengguna

| Peran | Situasi |
|---|---|
| CS pameran | Menerima CIPL dan B/L dari agent/exhibitor, membuat job, mengisi data, mencetak dokumen |
| PIC event | Mengatur semua job di eventnya, termasuk job yang dibuat orang lain |
| Tim lapangan (ops) | Butuh data per package (berat, dimensi), hall dan booth, form yang dibawa ke venue |
| Finance | Melihat job mana yang sudah ditagih dan dibayar |
| Admin / pimpinan | Melihat semua job; pimpinan hanya melihat |

## Alur

Alur menurut Arsya (13 Okt), dengan dokumen yang keluar di tiap langkah:

| # | Langkah | Masuk | Keluar (dibuat sistem) |
|---|---|---|---|
| 1 | Terima CIPL, dicek tim. Lanjut bila harga dikonfirmasi peserta/agent dan LARTAS aman | CIPL | — |
| 2 | Daftarkan list barang ke Kanwil lewat venue | CIPL | Surat permohonan Kanwil, form rincian barang (Excel, dipindah ke kop venue) |
| 3 | Terima draft B/L, mulai draf BC 2.3 | B/L | Draf BC 2.3 / workbook BUP |
| 4 | Ambil DO di pelayaran | B/L endorse | Surat kuasa (kop importir), surat tugas, surat peminjaman container (FCL) |
| 5 | BC 2.3 SPPB, tarik barang, masuk bonded, periksa | SPPB | — |
| 6 | BC 2.5 untuk barang consumable atau yang dibeli saat pameran; bayar pajak | — | — |
| 7 | Pindahkan barang bonded → hall | — | Form pemindahan bonded → hall |
| 8 | Pameran | — | — |
| 9 | Serahkan barang ke peserta di booth | — | Form DO tanda terima Vissasa → peserta |
| 10 | Catat barang yang habis/dibuang saat pameran | — | Form disposal |
| 11 | Pindahkan barang hall → bonded menjelang pameran selesai | — | Form pemindahan hall → bonded |
| 12 | Ajukan re-ekspor: sisa barang awal dikurangi BC 2.5 | — | Surat permohonan re-ekspor |
| 13 | BC 3.0 | — | — |
| 14 | Barang keluar, selesai | — | Outward manifest |

Kemungkinan barang setelah masuk (31 Okt): re-ekspor (ke asal atau negara lain), BC 2.5 (bayar
pajak), atau pindah ke TPB lain lewat BC 2.7 (jarang, saat ini tidak bisa dipakai). Barang yang
disposed atau diberikan (give away) hanya dicatat; Vissasa tidak mengurus penyelesaiannya.

## Hasil yang diharapkan

### Penomoran dan identitas
- Setiap job TPPB punya No Job berformat `S.<urut>/<no invoice>` (laut) atau `A.<urut>/<no invoice>`
  (udara). Urutan per event mengikuti dokumen yang masuk duluan, supaya urut ke Kanwil.
- Satu job = satu dokumen BC (9 Nov): job masuk `S.01/Alp` (BC 2.3), turunannya `Ex S.01/Alp`
  (re-ekspor, BC 3.0) dan `S.01/Alp-BC25` (BC 2.5). Ketiganya terlihat sebagai rangkaian satu
  barang.
- Satu job memuat satu B/L dan satu CIPL, atas nama agent atau exhibitor. Satu job bisa berisi
  barang beberapa exhibitor.

### Pencatatan per langkah
- Pengguna bisa mencatat tanggal dan nomor untuk: ETA, BC 1.1 (dari pelayaran),
  No Aju dan Nopen BC 2.3, SPPB, masuk bonded, pindah ke hall, kembali ke bonded, BC 2.5, BC 3.0,
  muat ekspor.
- Dari daftar job, pengguna melihat sekilas di langkah mana setiap job berada, dan job yang macet.
- Pengguna bisa membatalkan job dengan alasan; riwayatnya tetap ada.

### Data barang
- CIPL di-upload dan dibaca otomatis menjadi exhibitor → package → barang; manusia memeriksa
  sebelum disimpan.
- Per package tercatat jumlah, berat, dan dimensi; total volume job terhitung.
- Setiap barang punya disposisi dari CIPL: re-ekspor, disposed, give away, atau tidak disebut.
- Hall dan booth tercatat per exhibitor.
- Bila draft B/L tidak cocok dengan CIPL, yang direvisi B/L (CIPL sudah dibawa ke Kanwil).
  Daftar barang ke Kanwil boleh direvisi sampai H-3 pameran dengan format yang sama.

### Dokumen yang dihasilkan
- Semua dokumen di kolom "Keluar" pada tabel alur bisa diunduh dari job atau event, terisi dari data
  yang sudah dicatat, tanpa mengetik ulang.
- Surat permohonan re-ekspor menghitung sisa barang = barang awal − barang BC 2.5 − barang disposed.
- Inward manifest per event (Excel, format Allpack) dan outward manifest per event bisa diunduh.

### Tagihan
- Per job tercatat pihak yang ditagih (agent atau exhibitor), nomor invoice, dan status bayar.
- Tagihan inward bisa dibuat setelah barang masuk bonded; outward setelah barang di pelabuhan muat
  ekspor; final setelah semua biaya terkumpul.

## Sudah ada di aplikasi (per 2026-11-19)

Langkah 2: surat permohonan Kanwil (PDF) dan form rincian barang (Excel). Langkah 3: workbook BUP.
Langkah 14: inward dan outward manifest (termasuk LCL/FCL, nomor container, special instruction).
Juga: scan CIPL dan B/L, disposisi per barang, job turunan disposal/re-ekspor dari disposisi,
upload surat penunjukan, special instruction per job, milestone, tagihan (pihak, no invoice,
status).

Belum: dokumen langkah 4, 7, 9, 10, 11, 12; uji alur penuh dengan data nyata.

Keputusan klien di grup Workspace Vissasa: package yang berisi barang re-ekspor dan barang
disposal sekaligus ditandai, lalu **pengguna yang memutuskan** (Pak Andi, 17 Nov). Data re-ekspor
harus bisa diedit saat re-ekspor (17 Nov). Manifest re-ekspor BC 3.0 bisa dilihat per job, per hall,
per agent (17 Nov).

## Di luar cakupan
- Mengirim BC 2.3, 2.5, 3.0 langsung ke CEISA (fase 2)
- IT Inventory / buku saldo barang di bonded (fase 2, proyek terpisah)
- Perhitungan nilai tagihan dan biaya (sewa gudang, port charges)
- Reminder otomatis (ETA, surat penunjukan, barang menginap)
- BC 2.7 (pindah TPB), selama fasilitasnya tidak bisa dipakai

## Pertanyaan terbuka
- [x] Langkah 2: pendaftaran Kanwil tidak dicatat sebagai langkah; klien hanya meminta generate surat permohonan dan form rincian barang (sudah ada). (Pengguna, 19 Nov)
- [ ] Langkah 4: kop surat kuasa milik importir. Untuk job atas nama agent luar negeri, kop siapa?
- [ ] Langkah 6: BC 2.5 bisa terjadi beberapa kali dalam satu job (consumable di awal, mesin terjual
      di akhir)? Satu job turunan per BC 2.5, atau satu untuk semuanya?
- [ ] Langkah 7 dan 11: form pemindahan per job, per exhibitor, atau per hall?
- [ ] Langkah 9: form DO tanda terima per exhibitor atau per job?
- [ ] Langkah 10: form disposal diisi sebelum pameran (dari disposisi CIPL) atau saat pameran
      (barang yang benar-benar habis)?
- [ ] Langkah 12: ada tenggat re-ekspor TPPB yang perlu diingatkan sistem?
- [ ] Barang give away dan disposed: keluar dari hitungan re-ekspor tanpa dokumen apa pun?
- [ ] TPPB juga muncul di project (contoh Barbie, venue milik EO). Alurnya sama persis?
- [ ] Template semua dokumen di kolom "Keluar" (kecuali yang sudah ada: surat Kanwil, form rincian
      barang, workbook BUP, manifest).
