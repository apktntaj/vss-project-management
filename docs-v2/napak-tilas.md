# Napak Tilas dan Hutang Teknis

Status: catatan per 2026-11-18, dari analisis Pak Kur atas 229 commit, 27 migrasi,
`docs/`, dan kode. Item bertanda "perlu dicek" belum dipastikan.

## Fase perkembangan

| Fase | Tanggal | Yang terjadi |
|---|---|---|
| F0 Prototipe | 3–6 Sep | MVP berulang. Prisma diganti penyimpanan di browser. AI untuk mengisi form job |
| F1 "Exhibition v2" | 7 Sep | Rantai CIPL → Shipment → CustomsJob. **Dibuang 2 Nov** |
| F2 Ticket & login demo | 8–11 Sep | Dashboard job, kanban, tiket sebagai unit kerja utama |
| F3 Supabase & CEISA | 4–13 Okt | Pindah ke Supabase, API ditulis ulang, percobaan CEISA |
| F4 Fondasi domain | 14–24 Okt | Event + PIC, Agent, data definition pertama, IT Inventory, jenis job ditetapkan |
| F5 Siklus event & ekstraksi | 27 Okt–1 Nov | Status tuntas dihitung, ekstraksi dokumen (aturan + AI), CiplDocument |
| F6 Redesign besar | 1–3 Nov | Job = satu B/L, baris CIPL per job, Exhibitor per event, peran pengguna baru |
| F7 Detail job & dokumen klien | 4–12 Nov | Form CIPL, LARTAS, pembatalan job, surat Kanwil, form TPPB, Alat |
| F8 Rezim pabean | 15–18 Nov | Job = satu dokumen BC (job masuk + turunan), alur per rezim |

**Pola utama:** arti "Job" sudah berganti setidaknya lima kali: per exhibitor, CustomsJob
dalam rantai, Local/International (15 Okt), satu B/L (2 Nov), satu dokumen BC per tahap
(16 Nov). Arti Exhibitor juga bergeser tiga kali. Itu sumber utama rasa semrawut:
kode dan dokumen dari generasi berbeda hidup berdampingan.

## Hutang teknis

### Mendesak

- **Jalan belakang di `/api/operational-records`.** PUT/DELETE bisa mengubah atau menghapus
  event, agent, venue, dan pengguna hanya dengan login, tanpa cek peran
  (`lib/supabase/operational-records.ts:9`). Master Agent disimpan lewat jalur ini
  (`lib/data-client.ts:861`). Ini risiko keamanan.
- **Migrasi `20261117000000_regime_documents.sql` sedang diubah** (status git: modified),
  padahal kemungkinan sudah diterapkan. Perlu dicek.
- **Dua migrasi dengan timestamp sama** `20261116000000`. Urutan eksekusinya ambigu.

### Dokumen bertentangan dengan kode

| Dokumen | Selisih |
|---|---|
| `docs/domain/outward-data-definitions.md:18,32` | RE_EXPORT ditulis BC 2.5, padahal sudah dikoreksi menjadi BC 3.0 |
| `docs/domain/job-data-definitions.md` | Nomor VSS-XXXX (sudah dibuang), StatusJob tanpa CANCELLED, JobLocal punya agent (dilarang constraint), "tepat satu exhibitor", contoh BC 2.7 yang tidak dilayani, "TEMPORARY" vs `TEMPORARY_IMPORT`, open question yang sudah dijawab kode, rujukan ke file yang tidak ada |
| `docs/domain/cipl-data-definitions.md` | Merujuk tipe yang tidak ada di kode; menyebut versi immutable padahal CIPL diganti utuh |
| `docs/domain/event-data-definitions.md` | Peran lama, field "wajib" yang di kode opsional, CANCELLED masih ada, empat status tampil di kode vs tiga di dokumen |
| `docs/jobs-lifecycle.md` | Seluruhnya tentang CustomsJob yang sudah dibuang |
| `AGENTS.md` | Tidak menyebut `features/*/use-cases` dan `features/*/repository`, padahal di situ banyak logika dan akses database berada |

### Konsep ganda

- "Job" punya dua arti sekaligus (satu B/L dan satu dokumen BC). Rangkaian job tidak bernama.
- CIPL disimpan dua kali: dokumen mentah di `jobs.cipl_document` dan baris kerja di `job_cipl_lines`.
- Empat jalur untuk venue/EO: `/api/references/*`, `/api/event-records`, `/api/settings`, `/api/operational-records`.
- Dua sistem hak akses: `isAdmin` dan `Role`.
- Tiga sumber disposisi/re-ekspor: disposisi per baris, teks bebas `jobs.re_export`, `empty_storage`.
- Logika domain tersebar di `domain/`, `features/*/use-cases`, dan `lib/`.

### Nama tidak konsisten

- `domain/exhibition/` berisi CIPL (sisa nama F1).
- "Invoice" berarti tagihan jasa sekaligus commercial invoice.
- Campuran istilah: kepulangan / `JobReturn` / outward; tahap / stage / job turunan / `EX`;
  No Job / `manifestPrefix` + `manifestSeq` / `jobNumber`.

### Sisa fitur lama

- Batalkan event: route, use case, tabel, dan capability masih ada, padahal dokumen bilang sudah dihapus.
- Route legacy `/api/operational-records`, `/api/event-records`; tipe legacy di `domain/event/types.ts:171-247`; `domain/user/*` dan `lib/demo-users.ts`.
- `/ticket`, `/tickets` hanya redirect ke `/kanban`.

### Perlu dicek

- FK `event_agents.event_id` bertipe text dan `NOT VALID` setelah tabel `events` dibangun ulang.
- Timestamp migrasi 15–17 Sep lebih tua dari commit "add supabase" (4 Okt).
- Isi dan pemakai tabel `preferences`.
- Dokumen lain di `docs/` (CEISA*, REVIEW_DAN_BLUEPRINT*, WHATSAPP_6_BULAN, RENCANA_DEMO*).
