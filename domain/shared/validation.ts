// Mengapa: tipe hasil validasi bersama lintas-domain. Validator invariant memakai bentuk ini —
// fungsi murni yang TIDAK throw dan mengumpulkan SEMUA issue sekaligus, bukan berhenti di yang
// pertama. Modul ini murni: tanpa storage, HTTP, React, atau Supabase (Domain_Module).

// Satu issue validasi: path field yang bermasalah + pesan untuk pengguna (bahasa Indonesia).
export type ValidationIssue = { path: string; message: string }

// Hasil validasi: sukses membawa nilai ter-validasi, gagal membawa daftar semua issue.
export type Validation<T> =
  | { ok: true; value: T }
  | { ok: false; issues: ValidationIssue[] }

// Konstruktor sukses.
export function ok<T>(value: T): Validation<T> {
  return { ok: true, value }
}

// Konstruktor gagal dari satu issue atau lebih. Menerima daftar issue (varargs) agar ringkas
// di call-site; selalu mengumpulkan semuanya.
export function fail<T = never>(...issues: ValidationIssue[]): Validation<T> {
  return { ok: false, issues }
}

// Konstruktor gagal dari sebuah array issue yang sudah terkumpul.
export function failWith<T = never>(issues: readonly ValidationIssue[]): Validation<T> {
  return { ok: false, issues: [...issues] }
}

// Pembentuk issue tunggal — gula sintaks untuk { path, message }.
export function issue(path: string, message: string): ValidationIssue {
  return { path, message }
}

// Bangun hasil dari daftar issue yang terkumpul: kosong → sukses membawa value, selain itu gagal
// membawa SEMUA issue. Pola umum di validator yang mendorong issue ke sebuah array lalu memutuskan
// di akhir.
export function fromIssues<T>(issues: readonly ValidationIssue[], value: T): Validation<T> {
  return issues.length ? failWith(issues) : ok(value)
}

// Gabungkan beberapa hasil validasi menjadi satu, MENGUMPULKAN SEMUA issue dari setiap hasil yang
// gagal (tidak berhenti di kegagalan pertama). Bila semua sukses, kembalikan tuple nilai-nilainya.
export function combine<T extends readonly unknown[]>(
  ...validations: { [K in keyof T]: Validation<T[K]> }
): Validation<T> {
  const issues: ValidationIssue[] = []
  const values: unknown[] = []
  for (const validation of validations) {
    if (validation.ok) values.push(validation.value)
    else issues.push(...validation.issues)
  }
  return issues.length ? failWith(issues) : ok(values as unknown as T)
}

// Gabungkan semua issue dari beberapa hasil ke dalam satu daftar datar. Berguna saat pemanggil
// hanya ingin tahu kumpulan masalahnya, bukan nilai gabungannya.
export function mergeIssues(
  ...validations: readonly Validation<unknown>[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const validation of validations) {
    if (!validation.ok) issues.push(...validation.issues)
  }
  return issues
}
