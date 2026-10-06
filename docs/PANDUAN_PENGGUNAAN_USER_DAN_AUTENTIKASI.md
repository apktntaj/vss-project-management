# Panduan Penggunaan User dan Autentikasi

## Tujuan dan cakupan

Panduan ini menjelaskan cara staf dan administrator menggunakan autentikasi, password, dan manajemen user VSS Project Management setelah refactor **Auth and User** diterapkan.

Satu akun mewakili satu orang. Jangan memakai akun bersama: creator ticket, PIC, komentar, dan activity tercatat memakai identitas akun yang sedang masuk.

## Istilah penting

| Istilah                   | Arti                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Member**                | User aktif yang dapat memakai fitur operasional workspace `default`, termasuk Event, Job, dan Ticket.                         |
| **Admin**                 | Member dengan akses tambahan untuk mengelola user dan settings.                                                               |
| **Job role**              | Metadata pekerjaan: Supervisor, Staff, Customer Service, atau Document Assistant. Role ini belum membatasi akses operasional. |
| **Akun aktif / disabled** | Akun disabled tidak dapat login atau memakai API/protected page.                                                              |
| **Credential temporary**  | Password sementara yang hanya dipakai untuk masuk pertama kali atau setelah reset; user wajib menggantinya.                   |
| **Session**               | Login browser yang berlaku maksimal delapan jam dan dapat dicabut lebih awal oleh perubahan keamanan.                         |
| **Membership**            | Keanggotaan user pada workspace `default`. User tanpa membership tidak dapat mengakses workspace.                             |

## Masuk ke aplikasi

1. Buka halaman **Masuk**.
2. Masukkan email akun dan password.
3. Klik **Masuk ke aplikasi**.
4. Jika login berhasil, sistem membawa Anda ke dashboard dan menampilkan notifikasi berhasil di kanan bawah.

Gunakan alamat email yang tersimpan pada akun. Pesan `Email atau password tidak cocok.` sengaja sama untuk email tidak dikenal, password salah, akun disabled, atau akun yang sedang terkunci.

### Jika login gagal berulang kali

Lima percobaan password yang gagal dalam 15 menit mengunci akun selama 15 menit. Selama masa ini, password yang benar pun tetap menerima pesan generik yang sama.

Tindakan yang benar:

1. Berhenti mencoba password sampai 15 menit berlalu.
2. Pastikan email benar dan keyboard tidak mengubah huruf besar/kecil.
3. Bila tetap gagal setelah masa tunggu, hubungi Admin untuk reset password.

Jangan mencoba login berulang-ulang atau membagikan password kepada rekan kerja.

## Login pertama dan password temporary

Admin membuat user tanpa meminta admin menentukan password. Sistem menghasilkan password temporary sepanjang 24 karakter dan menampilkannya **satu kali** pada dialog sukses.

Sebagai user baru:

1. Terima password temporary melalui kanal aman dari Admin.
2. Login dengan email dan password tersebut.
3. Anda akan diarahkan ke halaman **Ganti password**.
4. Isi password temporary pada **Password saat ini**.
5. Isi password baru dan konfirmasi password baru. Password baru harus 12–128 karakter.
6. Simpan perubahan.
7. Sistem mengakhiri session; login kembali dengan password baru.

Selama credential masih temporary, Anda hanya dapat autentikasi, logout, dan mengganti password. Akses Ticket, Job, Event, API, dan halaman dashboard ditolak sampai password diganti.

## Mengganti password sendiri

Untuk akun aktif, buka halaman keamanan akun lalu pilih **Ganti password**.

1. Masukkan password saat ini.
2. Masukkan password baru 12–128 karakter.
3. Masukkan konfirmasi password baru yang sama.
4. Simpan perubahan.
5. Login kembali dengan password baru.

Mengganti password membatalkan session saat ini. Jika browser lain masih membuka aplikasi, browser itu juga akan ditolak saat request berikutnya.

## Mengelola user sebagai Admin

Buka **Settings → Users**. Hanya Admin aktif pada workspace `default` yang dapat memakai halaman ini.

Tabel user menampilkan nama, email, job role, access level, account status, dan aksi edit/reset password.

### Membuat user

1. Klik **Tambah user**.
2. Isi nama, email, job role, dan access level (`Member` atau `Admin`).
3. Simpan.
4. Salin password temporary dari dialog sukses sebelum dialog ditutup.
5. Kirim password itu melalui kanal aman. Password tidak dapat dibuka kembali dari aplikasi.

Gunakan `Member` sebagai default. Berikan `Admin` hanya kepada orang yang benar-benar perlu mengelola user dan settings.

### Mengubah profil atau akses

Pilih **Edit** pada user, lalu ubah nama, email, job role, access level, atau account status yang diperlukan. Edit tidak mengubah password.

Perubahan email, status akun, access level, atau reset password mencabut session user yang terdampak. User harus login ulang setelah perubahan keamanan.

Sistem menolak:

- menonaktifkan akun Anda sendiri;
- menurunkan akses Admin akun Anda sendiri;
- menghapus/menurunkan satu-satunya Admin aktif workspace.

Tambahkan dan aktifkan Admin kedua terlebih dahulu bila Admin saat ini perlu diturunkan atau dinonaktifkan.

### Reset password user

1. Pilih **Reset password** pada user.
2. Salin password temporary dari dialog sukses; password hanya terlihat sekali.
3. Kirimkan password melalui kanal aman.
4. User login dengan password tersebut lalu wajib menggantinya.

Reset password langsung membatalkan session lama user tersebut.

### Menonaktifkan user atau menghapus membership

Sebelum disable user atau menghapus membership workspace, periksa ticket terbuka yang masih menjadi tanggung jawabnya.

- Ticket `TODO` atau `PROGRESS` harus dialihkan terlebih dahulu memakai **Ganti PIC** atau **Lepaskan assignment**.
- Sistem menolak disable/removal membership bila user masih menjadi assignee ticket terbuka.
- Ticket `DONE` boleh tetap menunjukkan PIC yang kini disabled agar riwayat kerja tidak hilang.

Urutan handover yang disarankan:

1. Buka **Tickets → Semua ticket** dan filter PIC lama.
2. Buka setiap ticket yang belum `DONE`.
3. Pilih **Ganti PIC** ke Member aktif atau **Lepaskan assignment** bila PIC baru belum ditentukan.
4. Pastikan handover tercatat sebagai `ASSIGNEE_CHANGED` di timeline.
5. Baru ubah account status menjadi disabled atau hapus membership.

## Dampak pada Ticket dan Job

### PIC Ticket

Hanya Member aktif di workspace saat ini yang muncul sebagai pilihan PIC. Anda tidak dapat menugaskan ticket secara eksplisit kepada user disabled atau user tanpa membership.

Identitas user nonaktif tetap tampil dalam riwayat ticket sebagai `Nama — Nonaktif`. Ini berlaku untuk creator, PIC terdahulu, penulis komentar, dan actor activity; histori tidak dihapus.

### Default PIC Job

Saat membuat ticket dengan context Job, PIC Job menjadi default hanya jika orang tersebut masih Member aktif.

- PIC Job aktif → field **Ditugaskan ke** otomatis memakai PIC Job; Anda dapat menggantinya atau memilih **Belum ditugaskan**.
- PIC Job disabled atau tanpa membership → ticket dibuat **Belum ditugaskan**; create ticket tidak gagal hanya karena default PIC lama.

Ticket tidak mengikuti perubahan PIC Job setelah disimpan. Handover Ticket harus dilakukan secara eksplisit dari detail ticket.

## Session dan akses ditolak

Sistem memeriksa status akun, membership, credential status, dan versi session pada setiap request terlindungi.

| Keadaan                              | Perilaku                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| Session kosong/kedaluwarsa/dicabut   | Browser diarahkan ke `/login`.                                                |
| Password masih temporary             | Browser diarahkan ke `/change-password`.                                      |
| Member mencoba Settings user         | Halaman diarahkan ke dashboard; API mengembalikan akses ditolak.              |
| Akun disabled atau membership hilang | Request berikutnya ditolak; login baru diperlukan setelah akun kembali aktif. |
| Layanan autentikasi tidak tersedia   | Aplikasi menampilkan pesan layanan tidak tersedia tanpa detail database.      |

Pada halaman detail Ticket, pemeriksaan pembaruan berjalan berkala. Jika session dicabut ketika halaman terbuka, redirect terjadi pada request pemeriksaan berikutnya.

## Notifikasi dan bantuan

Create, edit, reset password, perubahan status akun, dan perubahan password menampilkan notifikasi sukses/gagal di kanan bawah. Kesalahan validasi—misalnya password terlalu pendek atau konfirmasi tidak sama—tetap muncul di field terkait.

Saat meminta bantuan kepada Admin, sertakan:

- email akun;
- waktu kejadian dan pesan yang tampil;
- apakah masalah terjadi setelah reset password, perubahan email, atau perubahan access level;
- untuk handover, nomor ticket dan PIC tujuan.

Jangan pernah mengirim password, password temporary, hash password, cookie session, atau screenshot yang memperlihatkan kredensial melalui ticket atau grup chat.

## Untuk operator deployment: menghubungkan Supabase CLI

Migration user/auth dan guard assignee Ticket hanya dapat diterapkan setelah repository ditautkan ke proyek Supabase development.

1. Dapatkan **project ref** dari URL proyek: pada `https://<project-ref>.supabase.co`, bagian `<project-ref>` adalah nilainya.
2. Dari root repository, jalankan:

   ```bash
   npx supabase link --project-ref <project-ref>
   ```

3. Masukkan database password ketika CLI memintanya.
4. Terapkan migration:

   ```bash
   npx supabase db push
   ```

5. Jalankan skenario verifikasi user, session revocation, handover Ticket, dan assignee Job nonaktif sebelum menutup issue implementasi.

Jangan mengarahkan `db push` ke production tanpa prosedur rilis dan backup yang disetujui.
