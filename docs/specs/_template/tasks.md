# <Nama fitur> — Tasks

Ditulis oleh: manajer · Dikerjakan oleh: Bebe

Prasyarat: `design.md` sudah lolos cek manajer (semua fungsi dan komponen punya
signature, purpose, contoh; wishlist kosong).

## 1. Tipe
- [ ] Terjemahkan `## Data` ke `domain/<aggregate>/types.ts`

## 2. Stub dan test
- [ ] Stub semua fungsi backend di desain (tsc bersih)
- [ ] Ubah setiap `check-expect` menjadi assertion di `*.test.ts`
- [ ] Daftarkan file test baru ke script `domain:test`

## 3. Body
- [ ] `fungsi-puncak`
- [ ] `helper-a`

## 4. Lapisan tepi
- [ ] Migrasi dari `## Storage` (skill `new-migration`, belum diterapkan)
- [ ] Akses Supabase di `lib/supabase/*` / `lib/server/*`
- [ ] Route handler `app/api/...`
- [ ] Kontrak `lib/data-client`

## 5. UI
- [ ] `komponen-puncak`
- [ ] `sub-komponen`

## 6. Penutup
- [ ] Gabungkan data definition baru/berubah ke `docs/domain/*-data-definitions.md`
- [ ] Verifikasi: `npm run domain:test`, `npx tsc --noEmit`, `npm run guard:arch`, `npm run build`
