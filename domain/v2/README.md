# Domain Model V2

Prototipe ini menerjemahkan data definition operasional menjadi model dan fungsi domain
murni. Ia berjalan in-memory dengan TypeScript/Node, tanpa database, Prisma, API,
Next.js, layanan eksternal, atau environment variable.

- `types.ts`: `Project`, `ProjectRole`, `PartyParticipation`,
  `OperationalActor`, empat varian `Task`, cargo, assignment, milestone,
  blocker, evidence, perubahan append-only, dan customs decision per item.
- `validation.ts`: planning gate, information gaps, resource conflicts, perubahan,
  completion evidence, customs readiness, project close-out, dan ringkasan.
- `examples.ts`: fixture terstruktur yang hanya merujuk baris sumber
  `docs/whatsapp-operational-vss.txt` dalam periode 18 Februari–18 Agustus 2026.
- `demo.ts`: alur terminal dari request belum lengkap sampai project tertahan
  customs close-out.
- `validation.test.ts`: pengujian invariant dan seluruh fungsi utama.

Jalankan:

```bash
npm run domain:demo
npm run domain:test
npx tsc --noEmit
```

Prototipe tidak menentukan HS, LARTAS, tarif, ataupun ketentuan hukum. Route customs
yang belum diverifikasi tetap provisional atau membutuhkan konfirmasi otoritas.
