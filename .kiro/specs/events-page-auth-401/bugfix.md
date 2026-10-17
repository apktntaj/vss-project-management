# Bugfix Requirements Document

## Introduction

Halaman `/events` melempar runtime error `Autentikasi diperlukan.` (HTTP 401) untuk pengguna yang
sudah berhasil login, sehingga dashboard event tidak pernah ter-render. Error dilempar oleh
`requireCurrentUser()` pada `features/auth/authorize.ts` ketika sesi tidak membawa `role` dan
`workspaceId`.

Akar masalah bukan sekadar cookie basi. Sistem saat ini menjalankan dua jalur autentikasi paralel
yang berbagi satu cookie sesi: jalur sign-in yang dipakai login (legacy) hanya menuliskan klaim
`isAdmin` ke token JWT, sementara slice auth baru yang menjaga halaman dan API event mensyaratkan
klaim `role` dan `workspaceId`. Akibatnya setiap sesi — termasuk sesi yang baru saja dibuat lewat
form login saat ini — tidak membawa `role`/`workspaceId`, dan `requireCurrentUser()`
memperlakukannya sebagai belum terautentikasi lalu menolak dengan 401. Dampaknya meluas ke seluruh
permukaan yang memanggil `requireCurrentUser()` (halaman `/events` dan route handler event serta
master data referensi), yang semuanya menolak pengguna yang sebenarnya sudah login.

Kondisi bug (bug condition): sebuah permintaan ke permukaan terproteksi yang menurunkan CurrentUser
membawa sesi JWT yang tidak memuat klaim `role` dan/atau `workspaceId`. Perilaku yang diharapkan
(fix checking): untuk sesi pengguna yang sudah login, CurrentUser berhasil diturunkan dan permukaan
tidak lagi menolak dengan 401. Perilaku yang harus dipertahankan (preservation checking): permintaan
yang benar-benar tanpa sesi tetap diarahkan ke `/login` (halaman) atau ditolak 401 (API), kredensial
salah tetap gagal, dan penolakan otorisasi peran tetap 403.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN pengguna yang sudah berhasil login membuka halaman `/events` THEN sistem melempar
    `Autentikasi diperlukan.` (401) di `requireCurrentUser` dan halaman gagal ter-render.

1.2 WHEN jalur sign-in yang dipakai login membuat sesi THEN token JWT hanya memuat klaim `isAdmin`
    dan tidak memuat `role` maupun `workspaceId`.

1.3 WHEN `requireCurrentUser` membaca sesi pengguna yang sudah login namun tanpa `role`/`workspaceId`
    THEN sistem memperlakukannya sebagai belum terautentikasi dan melempar 401.

1.4 WHEN route handler event atau master data referensi (yang memanggil `requireCurrentUser`)
    dipanggil oleh pengguna yang sudah login dengan sesi tanpa `role`/`workspaceId` THEN sistem
    merespons 401 meskipun pengguna sebenarnya sudah login.

### Expected Behavior (Correct)

2.1 WHEN pengguna yang sudah berhasil login membuka halaman `/events` THEN sistem SHALL merender
    dashboard event tanpa melempar 401.

2.2 WHEN jalur sign-in membuat sesi untuk pengguna THEN token JWT SHALL memuat `role` dan
    `workspaceId` milik pengguna tersebut.

2.3 WHEN `requireCurrentUser` membaca sesi pengguna yang sudah login THEN sistem SHALL menurunkan
    CurrentUser `{ id, role, workspaceId }` dan SHALL tidak melempar 401.

2.4 WHEN route handler event atau master data referensi dipanggil oleh pengguna yang sudah login
    THEN sistem SHALL memutuskan akses berdasarkan peran pengguna (lolos atau 403 sesuai kapabilitas),
    bukan menolak dengan 401.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN sebuah permintaan halaman terproteksi datang tanpa sesi sama sekali THEN sistem SHALL
    CONTINUE TO mengalihkan ke `/login`.

3.2 WHEN sebuah permintaan `/api/*` terproteksi datang tanpa sesi sama sekali THEN sistem SHALL
    CONTINUE TO merespons 401 dengan body `{ "error": "Autentikasi diperlukan." }`.

3.3 WHEN `requireCurrentUser` dipanggil pada permintaan yang benar-benar tanpa sesi terverifikasi
    THEN sistem SHALL CONTINUE TO melempar 401 dengan pesan `Autentikasi diperlukan.`.

3.4 WHEN kredensial yang salah dikirim pada form login THEN sistem SHALL CONTINUE TO menolak sign-in
    dan menampilkan pesan kesalahan kredensial.

3.5 WHEN pengguna yang sudah login memiliki peran yang tidak berhak atas sebuah kapabilitas THEN
    sistem SHALL CONTINUE TO menolak tindakan tersebut dengan 403.

3.6 WHEN pengguna admin membuka halaman `/settings` THEN sistem SHALL CONTINUE TO mengizinkan akses
    berdasarkan `isAdmin`.
