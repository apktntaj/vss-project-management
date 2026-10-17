---
inclusion: fileMatch
fileMatchPattern: '**/ceisa/**'
---

# Integrasi CEISA 4.0

CEISA adalah sistem kepabeanan elektronik DJBC. Di repo ini integrasinya **read-mostly** plus
generator draft BC 2.3 lokal. Belum terhubung ke pipeline CIPL→Shipment→CustomsJob dan nav-nya
dimatikan (`available: false` di `components/layout.tsx`). Latar belakang ada di `CEISA40_ARCHIVE.md`
dan `CEISA_GET_INTEGRATIONS_PLAN.md`.

## Lapisan

| Lapisan | Isi |
|---|---|
| `domain/ceisa/types.ts` | Observasi ber-timestamp: `CeisaStatusObservation`, `CeisaLocationReference`, `CeisaExchangeRateObservation`, `CeisaTariffObservation`, `CeisaManifestEntry`, `CeisaObservationRecord` |
| `domain/ceisa/bc23.ts` | Kontrak BC 2.3: `BC23_SCHEMA`, `bc23RequiredPaths` (41 path), `bc23ManualFields` (38 field), `Bc23DraftStatus`, `Bc23Provenance`, `Bc23DraftIssue`, `bc23DraftSchema` (passthrough) |
| `lib/ceisa/bc23-draft.ts` | Builder murni: `createBc23Draft`, `completeBc23Draft` — memetakan hasil ekstraksi invoice + transport ke field CEISA, mencatat provenance per field, memunculkan issue |
| `lib/server/ceisa/` | `crypto.ts` (AES-256-GCM), `repository.ts` (kredensial + observasi di Supabase), `client.ts` (`CeisaClient`, login JWT + cache token), `http.ts` (`requireCeisaUser`) |
| `app/api/ceisa/*` | 8 route: `settings`, `settings/test`, `status`, `documents`, `financial`, `manifest`, `references`, `bc-23/draft` |
| `components/ceisa/` | `ceisa-get-console.tsx`, `bc23-draft-demo.tsx`, `bc23-ceisa-references.tsx` |

## Prinsip yang wajib dijaga

- **Jawaban CEISA adalah observasi, bukan state milik kita.** Setiap record membawa `fetchedAt`
  (dan `observedAt` untuk status). Jangan menyalin nilai CEISA menjadi field domain yang dianggap
  sumber kebenaran.
- **Jangan pernah mengarang kode referensi.** `kodeKantor`, `kodePelMuat`, `kodeTps`, dan sejenisnya
  harus berasal dari endpoint referensi CEISA atau diisi operator. Deskripsi field di
  `bc23ManualFields` secara eksplisit melarang mengisi nama kantor/pelabuhan sebagai pengganti kode.
- **Provenance wajib.** Setiap field draft mencatat asalnya:
  `INVOICE | TRANSPORT | CONSTANT | MANUAL | CEISA_REFERENCE`.
- **`LOCALLY_VALID` adalah verdict lokal.** Artinya hanya "41 required path terisi", bukan diterima
  CEISA. Belum ada submit ke CEISA; jangan menuliskan atau menyiratkan ke user bahwa dokumen sudah terkirim.
- **Kredensial server-only dan terenkripsi.** Disimpan di `ceisa_connections` sebagai ciphertext +
  iv + tag. `ceisaSettings()` hanya mengembalikan boolean `hasCompanyId`/`hasIdPlatform` dan
  `verificationState`. Jangan menambah endpoint yang mengembalikan plaintext.
- Field name mengikuti ejaan CEISA (bahasa Indonesia, camelCase): `nomorAju`, `nomorBc11`, `posBc11`,
  `ndpbm`, `bruto`, `netto`, `kodeValuta`. Jangan diterjemahkan atau di-rename.

## Pola route CEISA

```ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const denied = await requireCeisaUser()        // requireCeisaUser(true) untuk endpoint kredensial
  if (denied) return denied
  const parsed = querySchema.safeParse(...)      // validasi query inline dengan Zod
  if (!parsed.success) return NextResponse.json({ error: '...' }, { status: 400 })
  try {
    ...
  } catch (error) {
    return ceisaFailure(error)
  }
}
```

Error vendor dibungkus `CeisaError`. Pemetaan status di `ceisaFailure()`:
`CEISA_NOT_FOUND` → 404, `CEISA_CONTRACT_MISMATCH` → 502 (bentuk respons berubah),
sisanya termasuk `CEISA_UNAVAILABLE` → 503 (jaringan/timeout/down). Payload pihak ketiga selalu
diparse Zod sebelum dipakai. Respons dikirim dengan header `ceisaNoStore`.

`CeisaClient` menyimpan token JWT per workspace di memori, memakai `exp` dari token dengan margin
30 detik dan fallback TTL 4 menit, serta `AbortSignal.timeout` dari `CEISA_REQUEST_TIMEOUT_MS`.
Pembaca field toleran terhadap nama Inggris maupun Indonesia
(`text(row, 'submissionNumber', 'nomorAju', 'nomor_aju')`).

## Kalau menyambungkan CEISA ke pipeline utama

Titik sambung yang sudah disiapkan tapi belum dipakai adalah
`StatusChange.ceisaObservationId` di `domain/exhibition/types.ts` — observasi CEISA dirujuk dari
riwayat status Customs Job. Gunakan itu daripada membuat relasi baru.
