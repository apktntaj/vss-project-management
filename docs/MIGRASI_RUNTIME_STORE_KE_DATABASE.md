# Catatan migrasi runtime store ke database

## Kondisi sekarang

`lib/file.ts` adalah adapter data aktif dan `lib/data-client.ts` tetap menjadi façade untuk UI. Seluruh koleksi pada `RuntimeStore` hidup di memori JavaScript. Seed utama berasal dari `lib/mock-data.ts` dan dimuat sekali untuk setiap umur module di browser.

CRUD hanya mengubah koleksi tersebut selama runtime. Reload penuh, tab baru, restart development server yang membangun ulang client, atau koneksi ulang yang memuat ulang aplikasi akan mengembalikan data ke seed awal. Tidak ada data yang ditulis ke filesystem, IndexedDB, `localStorage`, maupun database.

## Pemetaan yang disarankan

Gunakan properti eksplisit `RuntimeStore` sebagai daftar repository atau tabel awal. Bentuk record kanonik berada di:

- `lib/file.ts`: user, event, venue, event organizer, exhibitor, Job lama, stage, dokumen Job, file runtime, preference, dan counter runtime.
- `domain/exhibition/types.ts`: CIPL, versi CIPL, shipment, Customs Job, attachment metadata, coordination agent, dan migration review item.
- `domain/ticket/types.ts`: Ticket serta riwayat statusnya.

Pertahankan `lib/data-client.ts` sebagai batas akses saat adapter database dibuat agar UI dan logika bisnis tidak perlu mengetahui driver database.

## Hal yang tidak dapat di-hardcode secara persisten

Isi PDF (`Blob`/`File`) hanya dapat dipertahankan sebagai `StoredFile.content` selama runtime. Database relasional sebaiknya menyimpan metadata dan object-storage key; byte file dipindahkan ke object storage. Operasi yang menulis agregat dan file harus dibuat atomik dari sudut pandang aplikasi, misalnya melalui transaksi database ditambah mekanisme kompensasi upload.

Operasi multi-record saat ini konsisten karena mutasi array berlangsung sinkron dalam satu runtime JavaScript dan tidak mempunyai kegagalan I/O. Adapter database wajib mengembalikan jaminan transaksi untuk:

- pengurutan atau perpindahan Ticket;
- penyimpanan Job bersama dokumennya;
- perubahan exhibitor bersama Job turunannya;
- pembuatan CIPL/versi bersama attachment;
- penerbitan nomor Customs Job bersama counter.

Nomor urut yang dihitung dari panjang koleksi aman hanya untuk demo single-runtime. Pada database, gunakan sequence/identity atau counter row yang dikunci dalam transaksi agar tidak terjadi nomor ganda saat ada request bersamaan.

Data lama di IndexedDB tidak lagi dibaca oleh aplikasi. Jika data browser lama perlu diselamatkan, buat alat ekspor terpisah sebelum migrasi produksi; adapter runtime ini sengaja tidak menjalankan migrasi IndexedDB.
