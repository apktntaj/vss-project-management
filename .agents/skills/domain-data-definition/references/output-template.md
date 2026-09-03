# Template Domain Data Definitions

Sesuaikan panjang dengan scope. Jangan membuat bagian kosong hanya demi mengikuti template.

## 1. Tujuan dan batas model

- Keputusan/proses yang harus didukung.
- Sumber informasi yang digunakan.
- In scope dan out of scope.
- Istilah yang masih ambigu atau bertentangan.

## 2. Peta konsep dan dependency

Tampilkan konsep dari yang paling sederhana ke komposisi yang menggunakannya. Untuk self-reference dan mutual reference, tandai arah referensinya.

```text
Atomic/Enumeration
→ Structure dasar
→ Itemization
→ List/Recursive aggregate
```

## 3. Data definition

Untuk setiap konsep gunakan bentuk berikut:

### `NamaKonsep`

**Definisi**

```text
NamaKonsep adalah ...
```

**Interpretasi**

Jelaskan informasi bisnis yang direpresentasikan, arti setiap alternatif/komponen, serta hal yang sengaja tidak direpresentasikan.

**Contoh**

Berikan instance sah yang meliputi setiap varian, boundary, cardinality, dan recursion yang material. Labeli contoh invalid secara eksplisit beserta alasan penolakannya.

**Template pemrosesan**

```text
Jika VariantA → proses komponen A ...
Jika VariantB → proses komponen B ...
Untuk setiap item → gunakan template Item
```

**Invariant**

Daftarkan hanya aturan yang menentukan keanggotaan data sah atau konsistensi antarbagian.

**Open questions**

Tuliskan keputusan domain yang belum dapat diturunkan dari evidence.

## 4. Invariant lintas konsep

Tulis constraint yang melibatkan lebih dari satu definisi, termasuk pemilik aturan dan source jika tersedia.

## 5. Fungsi atau pertanyaan turunan

Turunkan operasi dari bentuk data tanpa mengimplementasikannya:

```text
validateForPlanning : IntakeWorkOrder -> ValidationResult<ReadyWorkOrder>
```

Sertakan purpose singkat. Jangan menetapkan algoritma jika belum diperlukan.

## 6. Validasi contoh

| Skenario | Data definition terkait | Dapat direpresentasikan? | Branch/template yang dipakai | Gap |
|---|---|---:|---|---|

Minimal uji setiap variant, boundary, empty/non-empty cardinality, recursive level, invalid state penting, dan konflik evidence.

## 7. Mapping teknis opsional

Hanya jika diminta, petakan model konseptual ke target seperti TypeScript, Prisma, PostgreSQL, atau JSON Schema. Pertahankan nama dan invariant domain, jelaskan compromise, dan jangan menjadikan keterbatasan storage sebagai definisi informasi.
