# User

## Tujuan dan batas model

Model ini merepresentasikan akun yang dapat masuk ke demo dan keputusan apakah akun tersebut boleh
mengelola user. Penyimpanan persisten, pemulihan password, dan lifecycle akun berada di luar scope.

## Data definition

`User` adalah sebuah structure yang terdiri dari:

- `nama`: teks tidak kosong yang merepresentasikan nama pengguna.
- `email`: alamat email valid yang menjadi identitas unik user, dinormalisasi menjadi lowercase.
- `password`: teks tidak kosong yang dipakai untuk autentikasi demo.
- `isAdmin`: boolean; `true` berarti boleh melihat dan menambah user, `false` berarti tidak boleh.

Contoh admin: `Admin Demo VSS, admin@vss.demo, demo-vss-2026, true`.

Contoh non-admin: `Staf Operasional, operasional@vss.demo, operasional-2026, false`.

## Template pemrosesan

Untuk mengautentikasi, cocokkan email yang sudah dinormalisasi dan password. Untuk otorisasi
manajemen user, periksa `isAdmin`; hanya cabang `true` yang dapat melanjutkan. Untuk menambah user,
validasi keempat komponen lalu pastikan email belum digunakan.

## Invariant

- Keempat komponen selalu hadir.
- Nama dan password tidak kosong.
- Email valid, lowercase, dan unik dalam daftar user.
- Hanya user dengan `isAdmin: true` yang dapat menambah user lain atau menetapkan `isAdmin`.
- Password plain text dan store memori hanya diperbolehkan dalam scope demo ini.
