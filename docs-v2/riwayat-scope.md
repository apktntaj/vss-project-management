# Riwayat Scope dan Kebutuhan

Status: catatan per 2026-11-19, disusun dari dua riwayat WhatsApp (chat pribadi dengan Arsya
sejak 3 Sep 2026 dan grup "PPJK" sejak 21 Sep 2026). Hanya berisi kebutuhan dan fakta domain.
Hal komersial (harga, pembayaran) sengaja tidak dicatat di repo.

Kesepakatan proyek hanya lisan. Tidak pernah ada dokumen scope tertulis.

---

## 1. Kronologi permintaan

| Tanggal | Sumber | Isi |
|---|---|---|
| 3 Sep | Arsya | Ide awal: web "project management" untuk Vissasa, pengganti job list di spreadsheet. Lihat progres per job per hari, tracking internal dan eksternal, Pak Andi hanya boleh melihat. Mimpi besar: upload CIPL + B/L lalu jadi dokumen di CEISA. Target MVP disebut "paling lama dua minggu". |
| 3 Sep | Arsya | Referensi alur forwarder lain: BK → SO → EPL → PR → invoice (tidak pernah dijadikan scope). |
| 4 Sep | Arsya | Satu event satu EO. Dalam satu event ada import laut, import udara, local Vivo, local. |
| 8 Sep | Arsya | **IT Inventory = "project ke-2"**, terpisah (pengganti sistem lama vendor lain). 9 Sep: tidak mendesak, fokus project pertama. |
| 9–12 Sep | Dev | Auth dan kanban selesai. Draf BC 2.3 bisa dicetak dari B/L + CIPL. "80%, tinggal ticket". |
| 4 Okt | Pak Andi (via Arsya) | Lampu hijau: "kembangkan web manifest dan tracking, and all the things that Vissasa needs". Mulai dari entry job awal, clearance, masuk gudang. Seperti spreadsheet, ada no ref. Nanti connect ke CEISA, backup/restore, tinggal upload B/L dan CIPL. Mulai dari event Allpack. |
| 8 Okt | Arsya + Dev | Kalimat presentasi ke Pak Andi: **"Web aplikasi Workspace Vissasa untuk merekap dan mencatat keseluruhan pekerjaan di Vissasa. Termasuk Lokal, Door to Door, Genco, ETP (BC 2.3, 2.5, 3.0), ATA Carnet, Temporary Import/Export."** Setting: nama agent, tipe job. Event: edit nama, event batal turun ke bawah, agent + alamat + PIC. |
| 8 Okt | Arsya | "Harapan": connect CEISA, connect email (rangkum job masuk), dokumen otomatis (quotation, surat pabean, pengambilan DO, invoice). Notifikasi ETA dan reminder barang sudah tiba. Koreksi pengguna (19 Nov): **dokumen otomatis masuk scope sejak awal**; CEISA dan IT Inventory fase 2. Scope v1 ada di [scope-v1.md](scope-v1.md). |
| 13 Okt | Arsya | Alur per jenis job (lihat bagian 2). Harga disepakati dengan prinsip "jalankan semua yang bisa dibayangkan; penambahan fitur di-charge bila ada biaya". |
| 14 Okt | Arsya | Konteks job ada tiga: **genco** (klien rutin), **project** (contoh: konser), **event**. Dalam event bisa juga ATA Carnet, Permanent Import, Road Shipment, Temporary Import. |
| 16–20 Okt | Dev | IT Inventory dikerjakan semalam (demo, di luar project utama). |
| 28 Okt | Pak Andi (via Arsya) | Basic manifest job: No Ref Job, Bill To, No Aju, Nopen, Deliver To, Tgl ref. Kolom finance: no invoice dan status bayar. Analisis "dari agent ini dapat berapa". Daftar event setahun di awal tahun + reminder surat penunjukan. Agent + negara. |
| 29 Okt | Dev | "Scope project sekarang matangkan dulu inward manifest." |
| 29 Okt | Arsya | Upload surat penunjukan (event) dan shipping manual. Ditandai "on request, kalau sulit dikesampingkan". |
| 30 Okt | Dev + Arsya | Disepakati: "jangan terlalu matang di event, ide ada saja, kalau diladeni tidak jadi-jadi. Target yang paling dibutuhkan dulu." |
| 30 Okt–3 Nov | Arsya | Outward manifest muncul sebagai lanjutan inward ("seperti inventory gudang: masuk dari mana, keluar ke mana"). Invoice inward setelah barang masuk bonded, outward setelah barang di pelabuhan muat. |
| 3 Nov | Arsya | Hak akses: admin bisa semua, user lain sesuai peran (CS, finance), awalnya view saja. |
| 5 Nov | Arsya | Rencana CS memasukkan semua job (termasuk data lama). Butuh database semua job setahun, total tagihan, per agent, per pameran. Dev mengakui desain masih berorientasi pameran. |
| 6 Nov | Arsya | AI menyarankan HS code Indonesia dari CIPL luar negeri. |
| 9 Nov | Arsya | **Satu job = satu dokumen BC**: S.01/Alp, Ex S.01/Alp, S.01/Alp-BC25. Outward = BC 2.5 dan ekspor. Uji coba dengan CS (Dhea). |
| 11–12 Nov | Dev | Status: baru tahap event, baru TPPB. Belum Road Shipment, Temporary Import, dll. Belum genco dan project. Arsya bertanya "sampai kapan ini?". |
| 14 Nov | Arsya | Genco, Project, Road Shipment diinput orang berbeda (Genco: Pak Sahlani, Road Shipment: Muha, Project: Ulla/Nunu, Event: CS pameran). Job genco atau road shipment untuk pameran harus ikut muncul di manifest event. |
| 17 Nov | Dev | Catatan: klien mengerjakan hal lain sebelum mengecek yang sudah ada. |

Sejak 9 Nov ada grup WhatsApp "Workspace Vissasa" (developer, Arsya, Pak Andi, tim CS/ops).
Permintaan dari grup itu:

| Tanggal | Dari | Isi | Hasil |
|---|---|---|---|
| 9 Nov | Pak Andi (via Arsya) | Manifest disortir per hall, untuk cetak label; bill to / bill from | Per hall dibuat |
| 9 Nov | CS | Kolom negara, remark (ETA, Nopen, SPPB, bonded, BC 2.5, BC 3.0, return), hall, booth | |
| 9 Nov | Arsya | User input, admin menyetujui | Developer menawarkan jadi requirement baru; Arsya: skip |
| 13 Nov | Pak Andi | Road Shipment sudah tercover? Muha input penerimaan barang tanpa B/L | Arsya: fokus inward dulu |
| 14 Nov | Pak Andi | Tampilan per agent | Dibuat |
| 15 Nov | Pak Andi | Tambah venue; konflik venue dibedakan per hall | Dibuat (kalender venue) |
| 15 Nov | Pak Andi | Upload DO, airport storage, penawaran | Arsya: penawaran dan airport storage "konsep awal, next development"; upload DO memberatkan |
| 15 Nov | Pak Andi | **"Ini udah perfect bisa segera running."** Akun dan peran untuk tim, mulai input event 2027 | |
| 15 Nov | Pak Andi | Generate form DO tanda terima; special instruction tampil di dashboard per event | Special instruction dibuat |
| 15 Nov | Nurul | Finance jangan dulu. Setelah PRI, semua tim isi job semester kedua; blast ke tim akhir Des / awal Jan | |
| 16 Nov | CS | Manifest: jumlah package, LCL/FCL, container (1x20'), CBM, format remark lama | Dibuat |
| 17 Nov | Pak Andi | Genco dan Road Shipment memilih event lalu input, otomatis masuk satu manifest; job non-pameran ke genco | |
| 17 Nov | Pak Andi | Road Shipment bisa pameran dan non-pameran; Temporary Import untuk genco dan pameran | |
| 17 Nov | Pak Andi | Manifest re-ekspor BC 3.0 per job / hall / agent; data bisa diedit saat re-ekspor | |
| 17 Nov | Pak Andi | Package campur disposal dan re-ekspor: user yang memutuskan | |
| 18 Nov | Pak Andi | TPPB khas event; jenis lain bisa di ketiga kategori | |

---

## 2. Alur per jenis job (Arsya, 13 Okt 2026)

**Event TPPB (pameran internasional):**
1. Terima CIPL, dicek tim
2. Daftarkan list barang ke Kanwil (upload CIPL, unduh untuk Kanwil)
3. Terima draft B/L, draf BC 2.3
4. Pengambilan DO (surat kelengkapan otomatis)
5. BC 2.3 SPPB, tarik barang, masuk bonded, periksa
6. BC 2.5 untuk barang consumable, bayar pajak
7. Form pemindahan bonded → hall
8. Pameran
9. Form DO tanda terima Vissasa → peserta di booth (otomatis)
10. Form Disposal (otomatis)
11. Form pemindahan hall → bonded
12. Surat permohonan re-ekspor (sisa barang awal dikurangi BC 2.5)
13. BC 3.0
14. Keluar, selesai

**Genco:** terima CIPL → terima B/L/AWB → surat pengambilan DO → draf PIB, bayar pajak → bila SPJM periksa barang → SPPB, selesai.

**ATA Carnet:** inquiry dan penawaran → copy carnet → surat kelengkapan → clear di port tanpa PIB/BC 2.3 → keluar → setelah dipakai, surat re-ekspor → re-ekspor. Tetap pakai B/L/AWB dan pengambilan DO.

**Import Sementara:** inquiry, cek CIPL, penawaran → draft B/L/AWB, permit Import Sementara → DO → skep turun, PIB → periksa, SPPB → antar ke klien → menjelang jatuh tempo, pemberitahuan re-ekspor → PEB, periksa → ekspor.

**Ekspor Sementara:** inquiry, cek negara tujuan → jadwal kapal/pesawat → surat ekspor sementara → PEB, ekspor → selesai dipakai → surat re-impor → PIB, SPPB, selesai.

**Kemungkinan barang setelah inward TPPB (31 Okt):** re-ekspor (ke asal atau negara lain), pindah TPB via BC 2.7 (jarang, sedang tidak bisa), BC 2.5 (bayar pajak). Road Shipment: selesai di venue (normal) atau kembali ke gudang (jarang). ATA dan TI: re-ekspor.

---

## 3. Fakta domain lain dari chat

- No Job (S.01, A.05) adalah referensi internal; semua bagian berpatokan padanya. Urut dari dokumen yang masuk duluan, supaya urut ke Kanwil.
- B/L dan CIPL atas nama agent atau exhibitor (biasanya peserta yang barangnya paling banyak). Satu agent bisa membawa banyak exhibitor, B/L dan CIPL tetap satu.
- Bill to: siapa yang membawa inquiry (agent atau exhibitor). Tagih per exhibitor biasanya di local dan export show.
- Road Shipment: 95% dari agent. Data diambil setelah barang tiba di gudang Vissasa. Tanpa dokumen pabean; hanya packing list.
- Kelengkapan ambil DO: surat kuasa (kop importir, draf dari Vissasa, Word), surat tugas, surat peminjaman container (FCL), B/L endorse, copy KTP direktur dan kurir.
- Packing: total package lalu breakdown per package (berat, dimensi); jenis bisa case/box/crate, di manifest disebut package.
- Move in 2–3 hari sebelum pameran. Batas kirim: 2 minggu sebelum event (udara), 18 hari (laut).
- Surat penunjukan dari EO (asli, tanda tangan basah, discan) disimpan untuk bidding.
- Satu barang bisa berpindah lintas job: pameran 2026 (inward/outward) → project → pameran 2027.
