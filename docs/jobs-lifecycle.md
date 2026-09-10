Agents tidak perlu membaca ini. Ini adalah catatan internal untuk pengembang.

Ya. Untuk domain ini, state machine sebaiknya dipusatkan pada `CustomsJob`, sedangkan CIPL dan Shipment menjadi prasyarat/guard—bukan status yang dicampur ke lifecycle Job.

```text
DRAFT
  → PREPARING
  → SUBMITTED
  → REGISTERED
  → RELEASED
  → COMPLETED

Status pengecualian:
DRAFT | PREPARING | SUBMITTED | REGISTERED | RELEASED
  → ON_HOLD → kembali ke state sebelumnya
  → CANCELLED (terminal)
```

Maknanya:

| State        | Arti                               | Contoh syarat masuk                             |
| ------------ | ---------------------------------- | ----------------------------------------------- |
| `DRAFT`      | Job baru dibuat                    | Shipment dipilih                                |
| `PREPARING`  | Dokumen dan data sedang dilengkapi | PIC mulai mengerjakan                           |
| `SUBMITTED`  | Dokumen pabean telah diajukan      | CIPL siap, alokasi valid, dokumen wajib lengkap |
| `REGISTERED` | Nomor/tanggal pendaftaran tersedia | Nomor pendaftaran dicatat                       |
| `RELEASED`   | Barang mendapat release            | Bukti release tersedia                          |
| `COMPLETED`  | Operasi dan administrasi selesai   | Aktivitas akhir dikonfirmasi                    |
| `ON_HOLD`    | Terhambat sementara                | Wajib alasan dan target state saat dilanjutkan  |
| `CANCELLED`  | Job dibatalkan                     | Wajib alasan; tidak dapat dilanjutkan           |

Modelnya akan lebih kuat bila perubahan hanya melalui command, bukan edit status bebas:

```ts
startPreparing(jobId)
submitCustoms(jobId, evidence)
recordRegistration(jobId, registration)
recordRelease(jobId, evidence)
completeJob(jobId)
holdJob(jobId, reason)
resumeJob(jobId, reason)
cancelJob(jobId, reason)
```

Setiap command memeriksa guard yang relevan. Misalnya `submitCustoms` menolak bila CIPL belum `READY`, alokasi Shipment tidak valid, atau evidence belum ada.

Di codebase ini fondasinya sebenarnya sudah ada: `CustomsJobStatus` dan `validateJobTransition()` mendefinisikan alur linear `DRAFT → PREPARING → SUBMITTED → REGISTERED → RELEASED → COMPLETED`, serta `ON_HOLD` dan `CANCELLED`. Yang perlu diperjelas bila diimplementasikan penuh adalah:

- simpan `resumeToStatus` saat masuk `ON_HOLD`;
- definisikan guard per transisi;
- pertahankan `statusHistory` sebagai audit trail;
- gunakan `readiness` terpisah untuk “CIPL kurang”, “dokumen belum lengkap”, dan sebagainya—jangan menjadikannya status Job baru.

`LocalJob` yang masih memakai `IN_PROGRESS` dapat diperlakukan sebagai tampilan ringkas/legacy; lifecycle operasional kanonisnya sebaiknya memakai `CustomsJob`.
