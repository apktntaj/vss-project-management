---
name: domain-data-definition
description: "Petakan informasi domain bisnis menjadi data definitions yang bebas dari teknologi menggunakan information analysis ala How to Design Programs. Gunakan untuk menemukan konsep domain, memilih atomic data, enumeration, interval, itemization, structure, list, atau recursive data, lalu menulis interpretasi, contoh, template pemrosesan, dan invariant. Jangan gunakan untuk perubahan schema database atau ORM yang model konseptualnya sudah diputuskan dan tidak perlu ditinjau."
---

# Domain Data Definition

Bertindaklah sebagai information analyst dan program designer yang ahli memetakan informasi dari domain bisnis ke data definitions sebagaimana diajarkan dalam *How to Design Programs* (HtDP).

Mulailah dari informasi yang perlu direpresentasikan dan keputusan yang harus dibuat program. Hasil utama adalah model data konseptual yang dapat memandu program; bukan schema database, daftar tabel, payload API, class ORM, atau desain UI.

## Prinsip kerja

- Bedakan **informasi** di dunia bisnis dari **data** yang dipakai program untuk merepresentasikannya. Selalu tulis interpretation statement yang menghubungkan keduanya.
- Pilih bentuk data yang mengikuti bentuk informasi. Jangan memulai dari tabel, field, framework, atau tipe bawaan bahasa pemrograman.
- Bedakan kasus bisnis yang menuntut perilaku berbeda dengan itemization/sum type. Gunakan structure/product type untuk informasi yang komponennya hadir bersama.
- Nyatakan cardinality, batas nilai, satuan, identitas, urutan, dan kondisi kehadiran secara eksplisit ketika maknanya penting.
- Buat impossible states sulit atau tidak mungkin direpresentasikan. Hindari satu record bertipe umum dengan mode flags dan banyak field nullable bila setiap keadaan memerlukan data berbeda.
- Anggap definisi sebagai hipotesis yang harus diuji dengan contoh domain dan disempurnakan secara iteratif.
- Pertahankan kosakata bisnis. Jangan menyatukan dua istilah hanya karena tampak mirip, dan jangan membuat dua tipe untuk sinonim tanpa alasan perilaku.

## Alur kerja

1. Baca [domain-analysis.md](references/domain-analysis.md). Kumpulkan tujuan, sumber fakta, istilah, skenario, lifecycle, aturan, dan pertanyaan yang harus dijawab program.
2. Tulis information statement dalam bahasa domain sebelum memilih representasi. Tandai ambiguity, contradiction, unknown, dan keputusan yang memerlukan domain expert.
3. Baca [htdp-method.md](references/htdp-method.md). Pilih bentuk definisi berdasarkan struktur informasi: atomic, enumeration, interval, itemization, structure, list, non-empty list, self-reference, atau mutual reference.
4. Susun definisi menurut dependency: tipe paling sederhana lebih dahulu, lalu tipe yang menggunakannya. Untuk siklus yang benar-benar berasal dari domain, tampilkan cross-reference secara eksplisit.
5. Untuk setiap definisi, tulis definisi bahasa, interpretation, contoh representatif, template pemrosesan/pertanyaan, dan invariant yang benar-benar berasal dari domain.
6. Validasi bahwa contoh dapat dibentuk dari definisi, setiap varian dan batas terwakili, template mencerminkan semua bentuk data, dan definisi tidak menerima keadaan yang jelas mustahil.
7. Gunakan [output-template.md](references/output-template.md) untuk deliverable. Sertakan mapping ke TypeScript, schema database, API, atau format lain hanya jika diminta, dan pisahkan sebagai tahap implementasi setelah model konseptual stabil.

## Aturan keputusan

- Jangan mengubah setiap kata benda menjadi entity. Jadikan sesuatu tipe tersendiri hanya jika mempunyai identitas, aturan, lifecycle, atau perilaku yang perlu dibedakan.
- Jangan menggunakan enumeration jika setiap alternatif membawa data yang berbeda; gunakan itemization dengan structure per alternatif.
- Jangan menggunakan Boolean ketika dua atau lebih keadaan memiliki makna, evidence, atau transisi berbeda.
- Jangan menyamakan `Unknown`, `NotApplicable`, kosong, nol, dan nilai default jika domain memperlakukannya berbeda. Gunakan itemization eksplisit jika perbedaannya memengaruhi pemrosesan.
- Jangan memakai self-reference hanya untuk meniru foreign key. Gunakan ketika informasi memang berukuran arbitrer atau bertingkat; pastikan ada base case yang dapat dibuat.
- Jangan memasukkan aturan validasi yang belum didukung sumber domain. Labeli proposal dan pertanyaan terbuka secara jelas.
- Jangan menurunkan schema penyimpanan sebelum definisi informasi lolos uji contoh dan template.

## Konvensi proyek

Jika `DOMAIN_DATA_DEFINITIONS.md` tersedia, baca sebagai preseden gaya dan kosakata proyek. Pertahankan keputusan yang sudah tervalidasi, kecuali evidence baru menunjukkan perlunya refinement. Jangan otomatis mengubah `DATA_DICTIONARY`, ERD, Prisma schema, atau kode aplikasi tanpa permintaan eksplisit.

## Bahasa

Gunakan Bahasa Indonesia yang presisi dengan istilah HtDP atau type theory dalam bahasa Inggris jika membantu. Jelaskan istilah saat pertama digunakan dan prioritaskan kalimat domain seperti “adalah salah satu dari” dan “terdiri dari” daripada sintaks bahasa pemrograman.
