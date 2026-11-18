# <Nama fitur> — Design

Notasi dan tabel terjemahan: `AGENTS.md`, bagian "Default delivery workflow".

| Bagian | Pemilik | Status |
|---|---|---|
| Data | Pak Kur (ditulis Bebe) | ☐ disetujui pengguna |
| Backend | Bima | ☐ contoh fungsi puncak disetujui pengguna |
| UI | Dicha | ☐ contoh komponen puncak disetujui pengguna |
| Storage | Bima | ☐ |

## Data

Rujuk definisi yang sudah ada di `docs/domain/` dengan namanya. Tandai yang BARU
atau BERUBAH.

```racket
;; NamaData is one of:
;;  - 'VARIAN_A
;;  - (make-varian-b Field)
;; interpretation: ...
;; invariant: ...
(define-struct varian-b (field))
```

## Backend

### Fungsi puncak

```racket
;; nama-fungsi : Input -> Output
;; purpose: ...
(check-expect (nama-fungsi contoh-1) hasil-1)
(check-expect (nama-fungsi contoh-2) hasil-2)

(define (nama-fungsi x)
  (cond [... (helper-a ...)]
        [... ...]))
```

### Wishlist

Setiap item: signature, purpose, contoh, body. Hapus dari daftar ini setelah
didesain lengkap di bawah.

- [ ] `helper-a : A -> B`

```racket
;; helper-a : A -> B
;; purpose: ...
(check-expect (helper-a ...) ...)
(define (helper-a a) ...)
```

### Lapisan tepi

Route handler, akses Supabase, dan kontrak `data-client`.

```racket
;; ambil-sesuatu : Id -> [IO Sesuatu]
;; purpose: ...
;; route: GET /api/...  · otorisasi: ...
```

## Storage

| Tabel | Perubahan | Constraint / index | RLS |
|---|---|---|---|
| | | | |

## UI

### Komponen puncak

```racket
;; nama-halaman : Props -> View
;; purpose: ...
;; client: tidak (Server Component)
;; contoh:
;;  - props dengan 3 item     ==> daftar 3 baris, ...
;;  - props kosong            ==> empty state "..."
(define (nama-halaman props)
  (Card
    (CardHeader ...)
    ...))

;; state: filter : Filter, awal 'SEMUA
;; on (pilih-filter f) : Filter -> Filter
;; on (simpan x) : [IO Hasil]  · toast sukses: "..." · toast gagal: "..."
```

### Wishlist UI

- [ ] `sub-komponen : Props -> View`

### Aksesibilitas

Label, semantik, urutan fokus, keyboard, target sentuh, kontras.

## Pertanyaan untuk Pak Kur

- [ ] ...
