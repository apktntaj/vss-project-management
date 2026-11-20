# Otorisasi job per event — Requirements

Ditulis oleh: manajer · Tanggal: 2026-11-19 · Item jadwal: B6 (`docs-v2/scope-v1.md`)

Aturan bisnis di bawah sudah diputuskan pengguna (19 Nov); tidak perlu analisis Pak Kur.

## Masalah

Klien meminta agar orang yang mengisi job Road Shipment tidak bisa mengubah job lain. Sekarang,
penerima akses yang diberi PIC event diperlakukan sebagai pengelola event penuh: ia bisa mengubah,
membatalkan, menghapus, dan mengarsip event, serta mengubah semua job di event itu
(`eventManagerGuard` di `features/events/use-cases/event-guards.ts` dipakai juga oleh
`authorizeJobWriteInEvent` di `features/jobs/use-cases/job-guards.ts`).

## Pengguna

| Peran | Situasi |
|---|---|
| PIC event | Mengelola eventnya dan menambahkan orang lain supaya bisa membuat job di event itu |
| Penerima akses (mis. pengisi Road Shipment) | Membuat job di event yang ia diberi akses dan mengurus job buatannya sendiri |
| Admin | Tetap bisa semuanya |

## Hasil yang diharapkan

- PIC event (dan admin) bisa memberi dan mencabut akses event ke pengguna lain, seperti sekarang.
- Penerima akses bisa **membuat job** di event itu.
- Penerima akses bisa **mengubah job yang ia buat sendiri** di event itu, dan tidak bisa mengubah
  job lain di event yang sama.
- Penerima akses **tidak bisa mengubah data event** (ubah, batal, hapus, arsip, kelola akses, atau
  data event lain di luar job).
- PIC event tetap bisa mengubah semua job di eventnya dan data eventnya.
- **Baca tidak berubah:** semua pengguna tetap bisa melihat semua event dan job.
- Di UI, tombol ubah/batal job yang tidak boleh dipakai tampil pudar; saat dicoba muncul toast
  berisi alasannya (keputusan 20 Nov). Alat kelola event disembunyikan bagi non-pengelola. Bila
  tetap dicoba lewat API, hasilnya 403 dengan toast gagal.

## Di luar cakupan

- Aturan di Settings (pengguna, EO, venue): **tidak diubah**.
- Membatasi akses baca.
- Job tanpa event (Genco/Project, B3).

## Pertanyaan terbuka

- [ ] Peran STAFF, OPERATIONS, dan DOCUMENT_ASSISTANT sekarang bisa mengubah job di event mana pun
      lewat tabel peran. Pengisi Road Shipment harus diberi peran yang tidak punya hak itu supaya
      aturan di atas berlaku. Peran apa yang dipakai? (Default sementara: tabel peran tidak diubah.)
- [ ] "Mengubah job" termasuk membatalkan job, upload/hapus lampiran, mengisi tagihan? (Usulan:
      batal dan lampiran ikut aturan ubah job; tagihan tetap khusus FINANCE seperti sekarang.)

## Keputusan pengguna (20 Nov)

- Tabel peran **diubah** (lihat pertanyaan peran di bawah). Pembuatan event pindah ke admin, bersama
  EO, venue, dan pengguna. FINANCE tidak bisa menulis job.
- Pemilik job turunan BC 2.5/3.0 = pembuat job masuknya.
- `POST /api/events/[id]/agents` ditutup di B6: hanya PIC dan admin.
- Celah `PUT /api/jobs/[id]/inward` dan upload lampiran ditutup: ikut aturan ubah job.
- Bekas penerima akses tidak bisa lagi mengubah job buatannya sendiri.
- Contoh perilaku Bima (Approval 2, bagian backend) disetujui.

## Model peran dari cerita klien (20 Nov, belum final)

- CS: biasanya memegang satu pameran (PIC event).
- Satu orang khusus Road Shipment, satu orang khusus Permanent Import. Keduanya tidak selalu untuk
  event; bisa juga untuk genco (konteks genco = B3, belum ada).
- Data pengguna nyata per 20 Nov: 10 pengguna, semuanya peran CS (3 di antaranya admin). STAFF,
  OPERATIONS, DOCUMENT_ASSISTANT, FINANCE belum dipakai siapa pun.

- [x] Peran spesialis: **satu peran** `SPESIALIS` + daftar jenis job yang dipegang (mis. Road Shipment,
      Permanent Import). STAFF, OPERATIONS, DOCUMENT_ASSISTANT dihapus (tidak dipakai). (Pengguna, 20 Nov)
- [x] Exhibitor: penerima akses boleh menambah/mengubah exhibitor **lewat job miliknya** (CIPL job
      itu), tidak exhibitor event secara umum. Pengguna: "exhibitor seharusnya data milik CIPL". Untuk
      v1 ditegakkan sebagai aturan otorisasi; model data exhibitor tidak dirombak (aturan kerja 4
      scope-v1). (Pengguna, 20 Nov)


## Keputusan pengguna (20 Nov, lanjutan)

- Definisi data B6 (peran CS/SPESIALIS/FINANCE, jenis job yang dipegang, pemilik job) disetujui.
- Exhibitor yang ada di job milik beberapa orang: penerima akses ditolak (`'SHARED`). Alasan pengguna:
  satu salah input bisa memengaruhi job lain. Pengguna lebih suka exhibitor menjadi data milik CIPL
  (tidak berdiri sendiri di event); itu perubahan model, dianalisis terpisah oleh Pak Kur, bukan
  bagian B6.
- Calon penerima akses disaring ke CS dan Spesialis.
- CS tidak bisa lagi menambah venue/EO dari form event (hanya admin).
- `LOCAL` boleh dipegang Spesialis (jaga-jaga; biasanya Local dipegang PIC).
- Implementasi B6 dipecah menjadi tugas kecil supaya tiap panggilan Bebe tidak kebanyakan konteks.

## Jawaban pengguna lewat komentar halaman desain (20 Nov)

1. **Local sejajar dengan jenis lain** (TPPB, ATA Carnet, Road Shipment, dst.), tidak dibedakan.
   `JobJenis` B6 sudah datar (6 nilai termasuk LOCAL); pemisahan `kind` LOCAL/INTERNATIONAL di model
   job yang ada tidak dirombak di B6 (catat sebagai kandidat penyederhanaan).
2. **Aturan exhibitor `'SHARED` dianggap tidak perlu.** Alasan pengguna: exhibitor hakikatnya
   informasi di dalam CIPL, dan CIPL tiap job tidak pernah sama antar job, kecuali job turunan TPPB.
   Konsekuensi: selama hall/booth masih disimpan di master exhibitor event, menghapus `'SHARED` berarti
   ubahan satu job tetap memengaruhi job lain. Perlu keputusan: (a) sekaligus pindahkan hall/booth ke
   baris CIPL per job (opsi B Pak Kur, 1,5–2,5 hari) lalu hapus `'SHARED`, atau (b) hapus `'SHARED`
   saja dan terima efek lintas job sampai fase 2. **Belum diputuskan.**
3. Pengguna tidak paham `CiplLineModal`. Penjelasan: dialog untuk menambah/mengubah satu baris
   exhibitor di CIPL job secara manual (tanpa scan); saat ini tidak dipasang di halaman mana pun.
4. **Catatan baca-saja tidak perlu.** Penjelasan kenapa tidak bisa mengubah hanya ditampilkan saat
   pengguna mencoba mengubah. Desain UI Dicha ("sembunyikan tombol + catatan") perlu direvisi: tombol
   ubah tetap tampil (atau tampil nonaktif) dan alasan muncul saat dicoba.
5. **Spesialisasi ditentukan admin saat membuat/mengubah pengguna** (Settings → Pengguna, admin saja).
   Sudah sesuai desain.

Pertanyaan Dicha 1 (kartu Akses event di detail event) dan 2 (wizard: pilih event dulu) tidak
dikomentari; anggap belum dijawab.

## Keputusan pengguna (20 Nov, sesi implementasi)

- Exhibitor: opsi **(b)**. Aturan `'SHARED` dihapus; hall/booth tetap di master exhibitor event, efek
  lintas job diterima sampai fase 2. Penerima akses tetap hanya boleh menambah/mengubah exhibitor
  lewat job miliknya yang mencantumkan exhibitor itu.
- Pertanyaan UI Dicha 1: kartu "Akses event" dipasang di detail event, di bawah daftar job. Setuju.
- Pertanyaan UI Dicha 2: wizard `/jobs` memilih event dulu, baru jenis job. Setuju.
- Approval 2 UI disetujui: tombol ubah job tampil pudar, alasan muncul sebagai toast saat dicoba;
  Event baru, menu kelola event, dan kartu Akses event disembunyikan bagi yang tidak berhak.
- "Ubah" Tagihan untuk non-Finance tetap disembunyikan (perilaku lama, tidak diubah di B6).
