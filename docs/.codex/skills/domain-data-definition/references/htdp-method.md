# Metode Data Definition ala HtDP

Adaptasi ini mempertahankan hubungan information → data → template dari *How to Design Programs*, tetapi memakai notasi language-neutral untuk kebutuhan domain bisnis. Rujukan utama adalah [How to Design Programs, Second Edition](https://htdp.org/2026-5-28/Book/index.html), khususnya bagian fixed-size data, arbitrarily large data, dan intertwined data.

## Tujuan data definition

Sebuah data definition:

1. Memberi nama bermakna pada satu kelas data.
2. Menjelaskan cara membentuk anggota kelas tersebut dan membedakan anggota yang sah dari data lain.
3. Menyertakan interpretation yang menjelaskan informasi dunia nyata yang direpresentasikan.
4. Memungkinkan contoh dan template pemrosesan diturunkan secara sistematis.

## Bentuk data

### Atomic data

Gunakan ketika informasi diperlakukan sebagai satu nilai dan program tidak perlu memodelkan bagian internalnya.

```text
OrderNumber adalah Text yang diberikan oleh sistem order.
Interpretasi: nomor referensi bisnis, bukan identitas internal entity.
```

Tambahkan constraint hanya jika berasal dari domain. Nama tipe semantik tidak menggantikan penjelasan format atau makna.

### Enumeration

Gunakan untuk himpunan nilai tunggal yang terbatas dan diketahui.

```text
Priority adalah salah satu dari LOW, NORMAL, HIGH, atau URGENT.
```

Pastikan setiap nilai mempunyai makna yang saling dapat dibedakan. Jika suatu alternatif membawa komponen data sendiri, gunakan itemization.

### Interval

Gunakan untuk nilai berurutan dengan batas bermakna.

```text
CompletionPercentage adalah Number dari 0 sampai 100, inklusif.
```

Nyatakan unit, inklusivitas batas, dan presisi jika memengaruhi domain.

### Itemization atau sum type

Gunakan ketika informasi adalah tepat satu dari beberapa bentuk.

```text
RequestedTime adalah salah satu dari:
- ExactMoment(timestamp)
- BoundedWindow(start, end)
- RelativeExpression(text, anchor)
```

Alternatif harus cukup berbeda sehingga program dapat mengenali bentuknya. Hindari kombinasi tag dan field opsional yang dapat menghasilkan keadaan tidak konsisten.

### Structure atau product type

Gunakan ketika satu informasi terdiri dari sejumlah komponen yang hadir bersama.

```text
Money terdiri dari amount dan currency.
```

Tentukan tipe dan interpretation setiap komponen. Pisahkan konsep bila sekelompok field mempunyai makna mandiri atau digunakan ulang.

### List dan non-empty list

Gunakan list ketika jumlah anggota berhingga tetapi tidak ditentukan sebelumnya. Nyatakan apakah urutan dan duplikasi bermakna.

```text
LineItems adalah daftar Item, boleh kosong, berurutan menurut input.
AssignedResources adalah daftar tidak kosong dari ResourceId, tanpa duplikasi.
```

Jangan menggunakan list untuk tepat satu nilai atau pasangan dengan peran berbeda.

### Self-referential data

Gunakan ketika informasi bertingkat atau berukuran arbitrer. Definisi harus mempunyai base case dan recursive case yang membuat kemajuan menuju base case.

```text
WorkBreakdown adalah salah satu dari:
- Task(name)
- Group(name, daftar tidak kosong dari WorkBreakdown)
```

Validasi dengan membuat contoh base, satu tingkat, dan beberapa tingkat. Jika contoh yang makin besar tidak dapat dibentuk, definisinya mungkin tidak sah.

### Mutually referential atau intertwined data

Gunakan ketika beberapa jenis informasi secara alami saling merujuk. Gambarkan dependency/cross-reference dan pastikan setidaknya ada contoh yang dapat dimulai tanpa siklus tak berujung. Turunkan template pemrosesan untuk setiap definisi yang saling terkait.

## Menurunkan template

Template bukan business logic final. Template adalah kerangka pertanyaan atau fungsi yang mengikuti bentuk data:

- Atomic: gunakan nilai sesuai interpretation dan constraint-nya.
- Enumeration: satu case untuk setiap nilai yang memengaruhi pemrosesan.
- Interval: periksa batas atau rentang yang dibedakan domain.
- Itemization: satu branch untuk setiap alternatif.
- Structure: periksa komponen yang relevan melalui selector konseptual.
- List: tangani empty/non-empty lalu proses setiap elemen.
- Self-reference: satu branch per bentuk dan recursive processing pada setiap self-reference.
- Cross-reference: delegasikan pemrosesan ke template tipe yang dirujuk.

Jika template penuh dengan kondisi yang tidak terlihat pada definisi, model mungkin kehilangan distinction. Jika banyak komponen definisi selalu diabaikan, model mungkin terlalu besar atau function concern terlalu luas.

## Memilih contoh

- Atomic: contoh normal dan nilai yang menguji constraint penting.
- Enumeration: setiap nilai yang sah.
- Interval: setiap boundary yang termasuk atau berdekatan dengan batas, serta nilai interior.
- Itemization: minimal satu contoh per alternatif.
- Structure: contoh dengan anggota sah untuk setiap komponen.
- List: empty jika sah, satu anggota, dan beberapa anggota.
- Recursive/intertwined: base case, satu ekspansi, beberapa ekspansi, dan semua jalur cross-reference.
- Invalid examples: sertakan hanya untuk menjelaskan batas keanggotaan atau invariant; labeli sebagai invalid.

## Iterative refinement

Mulai dengan definisi yang cukup untuk menjawab skenario nyata. Jalankan contoh dan template, temukan ambiguity atau impossible state, lalu refine definisi dan fungsi turunannya bersama-sama. Catat perubahan makna; jangan memperbaiki hanya representasi teknis ketika masalahnya berada pada information model.
