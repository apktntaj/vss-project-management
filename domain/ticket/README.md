# Ticket Saya — definisi domain v1

`Ticket` adalah satu pekerjaan personal milik tepat satu user aktif. Ticket memiliki satu konteks; v1 hanya menerima `EVENT`, sementara `GENERAL_CARGO` dan `PROJECT` telah dinyatakan sebagai varian untuk perluasan berikutnya.

Status adalah salah satu dari `TODO`, `PROGRESS`, atau `DONE`. Ticket `DONE` selalu memiliki `Completion(note, completedAt)`; ticket yang dibuka kembali menyimpan alasan dalam `statusHistory` append-only. `Blocker` adalah informasi terpisah dari status, terdiri dari alasan, tindak lanjut, waktu catat, dan resolusi opsional—karenanya ticket terhambat dapat tetap berada di Progress.

Urutan hanya bermakna di dalam kolom status bagi satu pemilik. Perpindahan dan pengurutan tujuan disimpan dalam satu transaksi. Data ini tidak memuat file atau detail IndexedDB; penyimpanan hanya memetakan agregat storage-neutral ini ke record lokal.
