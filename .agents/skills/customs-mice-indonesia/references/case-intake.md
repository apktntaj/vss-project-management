# Case Intake MICE

Gunakan intake secara proporsional. Jangan menahan seluruh analisis hanya karena sebagian data belum tersedia; tandai hasil sebagai provisional dan tanyakan informasi yang paling mungkin mengubah jalur.

## Data minimum untuk rekomendasi awal

- Tujuan pengguna: memilih jalur, review dokumen, menilai HS/LARTAS, menyusun timeline, menangani exception, atau close-out.
- Event: nama, jenis kegiatan, venue, kota, tanggal move-in, show days, dan move-out.
- Pergerakan: negara asal/tujuan, port atau airport, ETA/ETD, moda, direct atau transit, serta negara transit jika memakai carnet.
- Para pihak: owner barang, shipper, consignee/importer/exporter, exhibitor, organizer, venue, overseas agent, PPJK, dan pemegang carnet bila relevan.
- Barang per item: uraian teknis, fungsi, material/komposisi, merek/model/serial number, jumlah, kondisi, nilai dan mata uang, negara asal, kemasan, serta foto atau katalog.
- Intended use dan disposal: dipamerkan, didemonstrasikan, dipakai profesional, dikonsumsi, dibagikan, dijual, dire-ekspor, diimpor untuk dipakai, atau belum diputuskan.
- Dokumen tersedia: invoice/proforma invoice, packing list, transport document, izin, carnet, insurance, kontrak event, dan surat pendukung.
- Constraint: deadline venue, budget, larangan handling, dangerous goods, temperature control, oversized cargo, atau kebutuhan instalasi.

## Pertanyaan prioritas

Urutkan pertanyaan berdasarkan dampaknya terhadap jalur:

1. Barang mana yang pasti kembali dan mana yang akan habis, dibagikan, dijual, atau ditinggal?
2. Apakah setiap barang yang kembali mempunyai identifier yang dapat dicocokkan saat keluar?
3. Apakah carnet sudah diterbitkan, dan apakah itinerary serta customs office yang dilalui tercakup?
4. Apakah venue/event menggunakan fasilitas TPPB, dan siapa pengusaha/penanggung jawab fasilitasnya?
5. Apakah uraian teknis cukup untuk kandidat HS dan pemeriksaan LARTAS?
6. Siapa pihak legal yang bertindak sebagai importer/exporter dan siapa pemilik kewajiban close-out?
7. Berapa buffer antara ETA, clearance, delivery slot, dan move-in?

## Normalisasi item

Untuk mixed shipment, buat satu baris per item atau kelompok identik dengan field:

`item_id | description | function | material | model/serial | qty | value | origin | intended_use | intended_disposal | proposed_route | HS_candidate | LARTAS_status | evidence_needed | open_issue`

Jangan menggabungkan barang hanya karena berada pada invoice atau package yang sama jika treatment-nya berbeda.
