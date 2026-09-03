# Analisis Informasi Domain Bisnis

## Mulai dari pekerjaan yang harus didukung

Catat pertanyaan dan keputusan yang harus dapat dibuat program, misalnya “apakah work order siap dijadwalkan?” atau “bukti apa yang masih kurang?”. Struktur data dinilai dari kemampuannya mewakili informasi yang diperlukan untuk menjawab pertanyaan tersebut.

## Evidence dan kosakata

- Gunakan kebijakan, formulir, pesan operasional, contoh kasus, sistem lama, dan wawancara domain expert sebagai evidence.
- Simpan istilah asli beserta sumber dan konteksnya. Tandai sinonim, homonim, singkatan, dan istilah yang berubah antar tim.
- Bedakan fakta operasional, aturan formal, kebiasaan, proposal desain, dan inferensi analis.
- Jika sumber bertentangan, tampilkan konflik dan dampaknya; jangan memilih diam-diam.

## Information statements

Tulis pernyataan sebelum data definition:

```text
Satu work order dapat berada pada tepat satu keadaan lifecycle pada suatu waktu.
Work order yang Ready mempunyai minimal satu activity dan seluruh data planning-critical.
Permintaan waktu dapat berupa waktu pasti, rentang, atau ekspresi relatif yang belum diselesaikan.
```

Pernyataan harus menyebut cardinality, kondisi, waktu, dan pengecualian bila relevan.

## Pertanyaan analisis

### Identity dan reference

- Apakah konsep ini mempunyai identity yang bertahan ketika atribut berubah?
- Mana identifier internal dan mana nomor referensi eksternal?
- Dapatkah satu reference menunjuk beberapa konsep atau berubah sepanjang waktu?

### Classification dan variants

- Apakah “jenis” hanya label, atau setiap jenis membawa data dan aturan berbeda?
- Apakah dua keadaan membutuhkan aksi, evidence, atau validasi berbeda?
- Apakah kategori saling eksklusif dan lengkap untuk scope saat ini?

### Composition dan relationship

- Komponen apa yang bersama-sama membentuk satu informasi?
- Apakah hubungan mempunyai informasi sendiri, seperti role, quantity, period, atau status?
- Apakah cardinality tepat satu, opsional, nol-atau-lebih, atau satu-atau-lebih?
- Apakah urutan, uniqueness, atau duplicate bermakna?

### Lifecycle dan time

- Apakah state saat ini cukup, atau history/transitions juga merupakan informasi domain?
- Mana planned, requested, estimated, actual, dan recorded time?
- Apakah tanggal tanpa waktu berbeda dari timestamp? Zona waktu siapa yang memberi makna?

### Quantity dan measurement

- Apa unit, precision, range, dan aturan konversinya?
- Apakah nol sah? Apakah nilai negatif mempunyai arti?
- Apakah jumlah rencana dan aktual harus hidup berdampingan?

### Absence dan uncertainty

- Apakah nilai tidak ada berarti unknown, not applicable, not yet requested, withheld, atau benar-benar kosong?
- Apakah source, timestamp, confidence, atau approver perlu dipertahankan?
- Kapan informasi provisional berubah menjadi confirmed?

### Hierarchy dan arbitrary size

- Apakah konsep dapat memuat konsep sejenis secara nyata, atau hanya merujuk parent di storage?
- Apa base case-nya? Apakah kedalaman perlu dibatasi oleh aturan bisnis?
- Apakah cycle sah atau menandakan error?

## Uji kualitas model

- **Representability:** semua skenario penting dapat dibuat sebagai data sah.
- **Exclusion:** keadaan yang jelas mustahil tidak diterima tanpa penanda invalid.
- **Distinguishability:** perbedaan yang mengubah perilaku terlihat pada bentuk data.
- **Traceability:** setiap aturan penting dapat ditelusuri ke evidence atau ditandai sebagai proposal.
- **Processability:** template dapat diturunkan tanpa menebak jenis atau kehadiran field.
- **Evolvability:** perluasan wajar dapat ditambahkan tanpa mengaburkan makna saat ini.

## Boundary dengan desain teknis

Data definition boleh memakai notasi seperti sum type, product type, list, dan recursion, tetapi tidak memutuskan table splitting, foreign key, index, JSON shape, serialization, cache, atau UI control. Setelah model konseptual stabil, buat mapping teknis terpisah dan catat setiap kompromi representasi.
