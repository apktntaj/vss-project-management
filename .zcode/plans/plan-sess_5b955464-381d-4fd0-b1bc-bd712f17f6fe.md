# Rencana: Halaman `/it-inventory` — demo "IT Inventory sebagai pembukuan arus barang"

## Konsep inti (pesan yang di-demo-kan)

IT Inventory ditampilkan **seperti pembukuan akuntansi, bukan stok gudang**:
- **Transaksi** = jurnal: setiap dokumen pabean yang diunggah menjadi satu entri transaksi (header + baris barang).
- **Jenis barang** = akun/buku besar: dikelompokkan per jenis (HS + uraian + satuan), saldo selalu **turunan dari jurnal** (running balance dihitung, tidak pernah diinput).
- **Saldo arus**: BC 2.3 = masuk (+), BC 2.5 & BC 3.0 = keluar (−), disortir kronologis per tanggal daftar.

## Batasan tegas (sesuai arahan user)

- **Tidak menyentuh database, migration, maupun data model yang sudah ada** — tidak ada tabel, repository, use-case, atau perubahan domain lain.
- Semua data hidup **di state client selama sesi** (tidak dipersist); refresh mengosongkan ledger — disebut eksplisit di UI ("demo tampilan").
- Gunakan folder yang sudah disiapkan: `domain/it-inventory/`, `components/it-inventory/`, `app/(dashboard)/it-inventory/`.

## Sumber data demo: file BUP di `docs/` (sudah dipelajari)

Ketiganya export CEISA relasional 21-sheet (VERSI 1.3), header di baris 1, data dari baris 2, tanpa merge:
- `bup-23.xlsx` — BC 2.3, 163 baris barang (masuk; venue JIE).
- `bup-25.xlsx` — BC 2.5, 23 baris, tiap baris menaut dokumen asal BC 2.3 (`NOMOR DAFTAR ASAL` + `SERI BARANG ASAL`).
- `bup-30.xlsx` — BC 3.0, 140 baris (keluar/re-export).

Kolom kunci yang dipakai:
- **HEADER** (1 baris data): `KODE DOKUMEN` (23/25/30 → arah), `NOMOR AJU`, `NOMOR DAFTAR`, `TANGGAL DAFTAR`, `KODE KANTOR`, `BRUTO`, `NETTO`, `CIF`.
- **BARANG**: `SERI BARANG`, `HS`, `KODE BARANG`, `URAIAN`, `MEREK`, `TIPE`, `UKURAN`, `KODE SATUAN`, `JUMLAH SATUAN`, `NETTO`, `BRUTO`, `CIF`, `HARGA SATUAN`, `NILAI BARANG`, `KODE NEGARA ASAL`, `KODE DOKUMEN ASAL`, `NOMOR DAFTAR ASAL`, `TANGGAL DAFTAR ASAL`, `SERI BARANG ASAL`.
- **ENTITAS**: `KODE ENTITAS` 3 = pemilik barang (tampil di rekap dokumen).
- Perangkap parsing yang sudah teridentifikasi: nama header duplikat di HEADER (ambil kemunculan pertama, by index kolom); tanggal campuran string `YYYY-MM-DD` vs date-cell (normalisasi ke string tanggal); `JUMLAH SATUAN` bisa string (parse numerik).

## File baru

1. `domain/it-inventory/types.ts` — tipe murni: `BupDocument` (header + baris barang + entitas ringkas), `LedgerJournalRow`, `LedgerItem` (jenis barang sebagai akun), `LedgerDocumentRecap`, arah `IN`/`OUT` dari `KODE DOKUMEN`.
2. `domain/it-inventory/validation.ts` — Zod untuk hasil parse (toleran field kosong; `KODE DOKUMEN` wajib 23/25/30), dipakai route import di batas.
3. `domain/it-inventory/ledger.ts` — fungsi murni pembukuan: `buildLedger(documents)` → jurnal kronologis (sort tanggal daftar), `buildItemLedger` (kartu stok + saldo berjalan qty & nilai), `buildDocumentRecap`, keying jenis barang (HS + uraian + kode satuan), penanda asal-barang dari kolom dokumen asal.
4. `domain/it-inventory/ledger.test.ts` — uji bun: arah masuk/keluar, saldo berjalan, agregasi lintas dokumen. **Daftarkan file ini ke script `npm run domain:test`** (explicit file list) agar benar-benar berjalan.
5. `lib/server/it-inventory/bup-parser.ts` — `server-only`; baca workbook via `xlsx` (pola `export-customs-workbook`): HEADER row 2 by-name (first occurrence), BARANG rows, ENTITAS; normalisasi tanggal & angka; error `ApiError(400, pesan Indonesia)` bila bukan BUP valid.
6. `app/api/it-inventory/import/route.ts` — POST multipart `file` → guard `requireCurrentUser()` → parse → 200 `BupDocument` JSON. Tidak menyimpan apa pun.
7. `app/api/it-inventory/export/route.ts` — POST JSON `{documents}` → guard → fungsi domain `ledger.ts` → susun workbook baru (sheet "Jurnal Mutasi", "Kartu Stok", "Rekap Dokumen") → balas blob xlsx (`Content-Disposition: attachment`).
8. `components/it-inventory/bup-upload.tsx` — area unggah (input file multi, accept `.xlsx`): POST per file ke route import, toast sukses/gagal (helper `components/toast.ts`), daftar chip dokumen terunggah dengan tombol hapus.
9. `components/it-inventory/ledger-views.tsx` — tab "Jurnal Mutasi" / "Kartu Stok" / "Rekap Dokumen":
   - **Jurnal Mutasi**: tabel kronologis: Tanggal Daftar | Dokumen (badge BC + Nomor Daftar) | Jenis Barang | Masuk | Keluar; baris dikelompokkan per dokumen (collapsible, pola grouping jobs page).
   - **Kartu Stok**: pilih jenis barang → tabel dengan kolom Saldo berjalan (qty + nilai) — inilah "buku besar per akun".
   - **Rekap Dokumen**: per dokumen: jenis, Nomor AJU, Nomor Daftar, tanggal, jumlah baris, total qty masuk/keluar, total CIF, pemilik barang.
10. `app/(dashboard)/it-inventory/page.tsx` — halaman client: header + tagline ("Setiap perpindahan dicatat sebagai transaksi; saldo dihitung dari jurnal."), tombol "Unduh Laporan (Excel)", ringkasan cards (dokumen, jenis barang, total mutasi, nilai masuk vs keluar), empty-state penjelasan saat belum ada unggahan. Styling `.card`/`.btn-*`/`.input` + Tailwind sesuai konvensi; teks Indonesia.
11. `components/layout.tsx` — tambah link `{ href: '/it-inventory', label: 'IT Inventory', icon: BookOpenText }` di daftar `links` (setelah Jobs).

## Yang sengaja tidak masuk rilis ini
Penyimpanan/persistensi, migrasi DB, relasi ke job/event/agent yang ada, dokumen BC lain (1.6/2.6.2/2.7/4.0), WIP (venue pameran tanpa produksi — pengecualian Pasal 39 ayat 2), penyesuaian manual (adjustment), tarik CEISA live.

## Urutan kerja
1. Domain types + validation + ledger + test → `npm run domain:test`.
2. Parser server + dua route API.
3. Komponen UI + halaman + nav link.
4. Verifikasi: `npx tsc --noEmit`, `npm run guard:arch`, `npm run build`, lalu uji manual di browser (dev server port 3100, login admin@vss.local): unggah ketiga file `docs/bup-*.xlsx`, cek saldo berjalan kartu stok, unduh laporan Excel.

## Risiko yang di-mitigasi
- Format BUP bervariasi antar instalasi → parser toleran (kolom opsional kosong), error jelas bila sheet/HEADER hilang.
- File besar (163 baris × 70 kolom) → parse di server, client hanya terima JSON ramping (kolom yang dipakai saja).
- Duplikat nama kolom & tipe tanggal campuran → ambil first occurrence by index + normalisasi tanggal terpusat.