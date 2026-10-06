# Panduan Penggunaan Tickets

## Tujuan

Tickets adalah ruang koordinasi kerja bersama. Gunakan satu ticket untuk satu permintaan atau pekerjaan operasional agar PIC, konteks, diskusi, dan perubahan status dapat ditemukan kembali oleh seluruh staf aktif.

Buka **Tickets** dari navigasi utama, atau gunakan tombol **Tambah ticket** dari halaman Event maupun Job.

## Memahami tampilan Tickets

Halaman Tickets memiliki tiga tampilan:

- **Ticket saya** — ticket yang saat ini ditugaskan kepada Anda. Hanya tampilan ini yang dapat diurutkan dengan drag-and-drop.
- **Belum ditugaskan** — antrean kerja bersama yang belum mempunyai PIC.
- **Semua ticket** — seluruh ticket workspace, termasuk ticket milik staf lain.

Gunakan pencarian untuk mencari nomor ticket, judul, deskripsi, context, atau PIC. Filter context dan urgensi tersedia untuk mempersempit daftar.

Setiap kartu menampilkan nomor ticket, judul, context, PIC, urgensi, dan waktu aktivitas terakhir. Klik kartu untuk membuka detail ticket.

## Membuat ticket

1. Klik **Tambah ticket**.
2. Isi **Judul** dengan ringkasan pekerjaan yang jelas.
3. Pilih **Konteks**:
   - **General / belum ada konteks** untuk intake baru yang belum diketahui Event, Job, atau PIC-nya.
   - Pilih **Event** jika pekerjaan terkait satu event.
   - Pilih **Job** jika pekerjaan terkait satu job operasional.
4. Atur **Ditugaskan ke**:
   - Pilih **Belum ditugaskan** bila PIC belum diketahui.
   - Jika memilih Job yang memiliki PIC, pilihan ini akan memakai PIC Job sebagai default. Anda tetap dapat menggantinya sebelum menyimpan.
5. Tambahkan deskripsi dan pilih urgensi bila perlu.
6. Klik **Simpan**.

Ticket General tanpa PIC akan muncul pada **Belum ditugaskan**. Ticket yang dibuat langsung untuk staf lain tetap dapat Anda temukan melalui **Semua ticket**.

## Mengambil, mengganti, atau melepas PIC

Buka detail ticket untuk mengubah penugasan.

- **Ambil ticket** — tersedia bila ticket belum mempunyai PIC. Ticket akan ditugaskan kepada akun Anda.
- **Ganti PIC** — pilih staf aktif yang akan menjadi PIC baru.
- **Lepaskan assignment** — mengembalikan ticket ke antrean **Belum ditugaskan** tanpa mengubah statusnya.

Setiap perubahan PIC dicatat di timeline activity ticket.

## Mengelola status dan urutan kerja

Status ticket terdiri dari tiga kolom:

- **To Do** — pekerjaan belum dimulai.
- **In Progress** — pekerjaan sedang dikerjakan.
- **Done** — pekerjaan selesai.

Di tampilan **Ticket saya**, gunakan handle drag pada kartu untuk memindahkan ticket ke kolom lain atau mengubah urutan dalam kolom.

- Saat memindahkan ke **Done**, isi **Catatan hasil**. Catatan ini menjelaskan hasil pekerjaan yang telah selesai.
- Saat memindahkan ticket dari **Done** ke status lain, isi **Alasan membuka kembali**.

Status juga dapat diperbarui melalui tombol **Ubah status** pada halaman detail ticket.

## Berkoordinasi di detail ticket

Halaman detail ticket dapat dibagikan dengan URL `/tickets/[nomor-id]`. Di sana Anda dapat:

- Membaca judul, deskripsi, context, status, urgensi, PIC, dan creator.
- Membuka Event atau Job yang terkait.
- Menambahkan komentar melalui kolom **Tulis komentar…**.
- Mengubah metadata ticket melalui **Edit**, termasuk judul, deskripsi, context, PIC, dan urgensi.
- Membaca komentar dan activity system secara kronologis.

Komentar dan activity bersifat riwayat: tidak dapat diedit atau dihapus. Detail ticket memeriksa pembaruan secara berkala, sehingga komentar dan perubahan dari staf lain akan muncul tanpa reload manual.

## Mengakses ticket dari Event atau Job

Halaman detail Event dan Job memiliki section **Tickets**.

- **Tambah ticket** membuka form baru dengan Event atau Job tersebut sebagai context.
- **Lihat semua** membuka board Tickets yang sudah difilter ke context itu.
- Daftar pada section menunjukkan ticket terbaru serta jumlah pekerjaan terbuka dan selesai.

Jika context ticket diubah dari Event ke Job, ticket akan berhenti muncul pada section Event dan akan muncul pada section Job yang baru.

## Aturan kerja yang dianjurkan

- Buat ticket General segera saat permintaan masuk, meskipun PIC atau context belum lengkap.
- Tulis satu hasil atau keputusan per komentar; hindari menyimpan koordinasi penting hanya di WhatsApp.
- Gunakan **Ganti PIC** untuk handover, bukan hanya mengubah deskripsi ticket.
- Jangan tandai Done tanpa catatan hasil yang dapat dipahami rekan kerja.
- Gunakan context Event/Job bila sudah diketahui agar ticket mudah ditemukan dari halaman operasional terkait.

## Notifikasi dan kesalahan

Hasil create, edit, assignment, status, dan komentar akan tampil sebagai notifikasi di kanan bawah layar. Jika data tidak dapat disimpan, periksa pesan error tersebut dan field yang diperlukan di form.
