// Mengapa: guard arsitektur lintas-cutting yang menegakkan dua invariant desain redesign secara
// STATIS (tanpa menjalankan app, tanpa memodifikasi sumber) sehingga pelanggaran ketahuan di CI/
// pre-commit, bukan saat runtime atau code review manual:
//
//   P1 — batas server/klien (Req 3.1/3.3/3.4/3.5): sebuah file `'use client'` TIDAK boleh mengimpor
//        modul server-only (`features/**/use-cases/*`, `features/**/repository.ts`, `lib/server/*`,
//        atau modul apa pun yang diawali `import 'server-only'`) maupun `@supabase/supabase-js`,
//        baik LANGSUNG maupun TRANSITIF. Grep impor langsung saja tidak cukup — barrel seperti
//        `features/events/index.ts` mere-export use-case server-only tanpa menandai dirinya
//        server-only, jadi kita bangun graf impor dari tiap file klien dan telusuri sampai menyentuh
//        modul terlarang.
//
//   P5 — tanpa dua sumber kebenaran (Req 5.3/20.2, DD-A2): migrasi skema to-be TIDAK boleh membuat
//        tabel dengan kolom `payload jsonb` yang berdampingan dengan kolom relasional/bisnis nyata
//        di `create table` yang sama. Tabel agregat murni warisan (`workspace_id`/`id`/`payload`/
//        timestamps saja) BUKAN pelanggaran — yang dilarang adalah payload yang menggandakan field
//        relasional.
//
// Jalankan: `npm run guard:arch`. Read-only: tidak pernah menulis/mengubah file apa pun.
// Exit 0 = bersih; exit 1 = ada pelanggaran (dilaporkan dengan path + nomor baris); exit 2 = error
// internal guard (mis. root tidak ditemukan). Tanpa dependency baru: hanya `node:fs`/`node:path`,
// dijalankan via `tsx` yang sudah jadi devDependency.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

// Root repo = parent dari folder `scripts/`. Semua path dilaporkan relatif terhadap root ini.
const REPO_ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..')

// Ekstensi yang dicoba saat me-resolve impor tanpa ekstensi eksplisit, plus varian index direktori.
const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']
const INDEX_BASENAMES = RESOLVE_EXTENSIONS.map((ext) => `index${ext}`)

// Direktori yang di-skip saat memindai kandidat file klien.
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', '.turbo'])

// ── P1: pola modul server-only (dicek dengan path relatif-POSIX dari root) ──────────────────────
// `features/**/use-cases/*`, `features/**/repository.ts`, `lib/server/*` (termasuk subfolder).
const SERVER_ONLY_PATH_PATTERNS: RegExp[] = [
  /^features\/[^/]+\/use-cases\//,
  /^features\/[^/]+\/repository\.(ts|tsx)$/,
  /^lib\/server\//,
]

// Paket pihak ketiga yang membawa kredensial/akses DB — dilarang di bundle klien.
const FORBIDDEN_PACKAGES = ['@supabase/supabase-js']

// Akar tempat file `'use client'` dianggap sebagai permukaan klien. `app/api/**` DIKECUALIKAN
// (route handler jalan di server). Pengecualian itu diterapkan saat memindai, lihat `isClientSurface`.
const CLIENT_SCAN_ROOTS = ['app', 'components', 'features']

type Violation = { file: string; line: number; detail: string }

// ── util path ───────────────────────────────────────────────────────────────────────────────────
function toPosix(p: string): string {
  return p.split('\\').join('/')
}

function relPosix(absPath: string): string {
  return toPosix(relative(REPO_ROOT, absPath))
}

function isServerOnlyByPath(absPath: string): boolean {
  const rel = relPosix(absPath)
  return SERVER_ONLY_PATH_PATTERNS.some((re) => re.test(rel))
}

// `'use client'` / "use client" sebagai directive pertama yang berarti (lewati komentar & kosong).
function isUseClientFile(source: string): boolean {
  return hasLeadingDirective(source, 'use client')
}

// `import 'server-only'` sebagai import efektif pertama menandai modul server-only secara eksplisit.
function hasServerOnlyImport(source: string): boolean {
  return /(^|\n)\s*import\s+['"]server-only['"]/.test(source)
}

// `'use server'` menandai modul Server Action: ia adalah BATAS RPC server/klien. Saat file klien
// mengimpornya, bundler mengganti impor dengan referensi RPC — implementasi (dan seluruh dependensi
// server-only-nya) TIDAK ikut ke bundle klien. Karena itu traversal berhenti di batas ini, sama
// seperti berhenti di paket npm (Req 18.1: Server Action adalah jalur tulis yang sah dari klien).
function isUseServerFile(source: string): boolean {
  return hasLeadingDirective(source, 'use server')
}

// Deteksi directive string ('use client'/'use server') di awal file, melewati komentar baris/blok,
// baris kosong, dan directive lain. Cukup ringan untuk kebutuhan guard (bukan parser penuh).
function hasLeadingDirective(source: string, directive: string): boolean {
  const lines = source.split('\n')
  let inBlockComment = false
  for (const raw of lines) {
    let line = raw.trim()
    if (inBlockComment) {
      const end = line.indexOf('*/')
      if (end === -1) continue
      line = line.slice(end + 2).trim()
      inBlockComment = false
    }
    if (line === '') continue
    if (line.startsWith('//')) continue
    if (line.startsWith('/*')) {
      if (line.includes('*/')) {
        line = line.slice(line.indexOf('*/') + 2).trim()
        if (line === '') continue
      } else {
        inBlockComment = true
        continue
      }
    }
    const m = line.match(/^['"]([^'"]+)['"]\s*;?$/)
    if (m) {
      if (m[1] === directive) return true
      continue // directive lain (mis. 'use strict') — lanjut periksa berikutnya
    }
    // Baris berarti pertama bukan directive → directive yang dicari tidak ada.
    return false
  }
  return false
}

// Ambil daftar specifier impor/re-export dari sumber beserta nomor baris kemunculannya.
// Menangkap: `import ... from 'x'`, `import 'x'`, `export ... from 'x'`, dan `import('x')` dinamis.
// Impor type-only (`import type ... from 'x'`, `export type ... from 'x'`) DILEWATI: TypeScript
// menghapusnya saat kompilasi (isolatedModules) sehingga tidak menghasilkan impor runtime apa pun di
// bundle klien — jadi bukan jalur kebocoran modul server-only.
function extractImports(source: string): { spec: string; line: number }[] {
  const results: { spec: string; line: number }[] = []
  const lines = source.split('\n')
  const patterns = [
    /\bimport\s+[^'";]*?\bfrom\s*['"]([^'"]+)['"]/, // import X from '...'
    /\bexport\s+[^'";]*?\bfrom\s*['"]([^'"]+)['"]/, // export ... from '...'
    /\bimport\s*['"]([^'"]+)['"]/, // import '...'
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/, // import('...')
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/, // require('...')
  ]
  // Lewati seluruh statement type-only: `import type ...` / `export type ...`.
  const typeOnly = /^\s*(?:import|export)\s+type\b/
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (typeOnly.test(line)) continue
    for (const re of patterns) {
      const m = line.match(re)
      if (m) results.push({ spec: m[1], line: i + 1 })
    }
  }
  return results
}

// Resolve specifier impor → path file absolut di dalam repo, atau null bila paket eksternal/
// tak terselesaikan. Mendukung alias `@/` (dari root repo) dan impor relatif.
function resolveSpecifier(spec: string, fromFile: string): string | null {
  let base: string
  if (spec.startsWith('@/')) {
    base = join(REPO_ROOT, spec.slice(2))
  } else if (spec.startsWith('./') || spec.startsWith('../')) {
    base = resolve(dirname(fromFile), spec)
  } else {
    return null // paket npm / bare import — ditangani terpisah lewat FORBIDDEN_PACKAGES
  }
  return resolveFileCandidate(base)
}

function resolveFileCandidate(base: string): string | null {
  // 1) path file apa adanya (sudah berekstensi)
  if (fileExists(base)) return base
  // 2) base + ekstensi
  for (const ext of RESOLVE_EXTENSIONS) {
    const withExt = base + ext
    if (fileExists(withExt)) return withExt
  }
  // 3) base/index.*
  for (const idx of INDEX_BASENAMES) {
    const indexPath = join(base, idx)
    if (fileExists(indexPath)) return indexPath
  }
  return null
}

function fileExists(p: string): boolean {
  try {
    return statSync(p).isFile()
  } catch {
    return false
  }
}

// ── P1: telusuri graf impor dari satu file klien ─────────────────────────────────────────────────
// Mengembalikan daftar pelanggaran: tiap jalur yang mencapai modul terlarang (langsung/transitif).
// `visited` dibagi lintas-file agar graf besar tidak ditelusuri ulang berkali-kali.
function traverseClientFile(
  entry: string,
  globalVisited: Set<string>,
): Violation[] {
  const violations: Violation[] = []
  // `viaLine` = nomor baris impor DI FILE ENTRY yang memulai jalur ini (agar penunjuk selalu dekat
  // kode klien). `depth` = jarak dari entry (1 = impor langsung, >1 = transitif) untuk memilih kata.
  type Frame = { file: string; viaLine: number; depth: number }
  const stack: Frame[] = [{ file: entry, viaLine: 0, depth: 0 }]
  const localVisited = new Set<string>()
  const origin = relPosix(entry)

  while (stack.length > 0) {
    const { file, viaLine, depth } = stack.pop() as Frame
    if (localVisited.has(file)) continue
    localVisited.add(file)
    globalVisited.add(file)

    let source: string
    try {
      source = readFileSync(file, 'utf8')
    } catch {
      continue
    }

    // Batas Server Action: modul `'use server'` yang dijangkau dari file klien adalah batas RPC —
    // implementasinya tidak di-bundle ke klien. Berhenti di sini tanpa menelusuri dependensinya dan
    // tanpa menandainya sebagai pelanggaran (kecuali entry sendiri, yang tak mungkin `'use server'`).
    if (file !== entry && isUseServerFile(source)) continue

    // Modul terlarang berdasarkan path ATAU penanda `import 'server-only'`.
    // File ENTRY klien itu sendiri tidak dihitung sebagai target (ia titik awal).
    if (file !== entry && (isServerOnlyByPath(file) || hasServerOnlyImport(file))) {
      const reason = isServerOnlyByPath(file)
        ? `modul server-only (${relPosix(file)})`
        : `modul bertanda import 'server-only' (${relPosix(file)})`
      const how = depth <= 1 ? `mengimpor ${reason} secara langsung` : `menjangkau ${reason} secara transitif`
      violations.push({ file: origin, line: viaLine, detail: how })
      // Tidak perlu menelusuri lebih dalam dari modul terlarang untuk tujuan P1.
      continue
    }

    for (const { spec, line } of extractImports(source)) {
      // Baris yang dilaporkan selalu dari file entry: baris impor nyata bila masih di entry, kalau
      // tidak pertahankan baris impor pertama yang memulai jalur ini.
      const reportLine = file === entry ? line : viaLine
      // Paket eksternal terlarang (mis. @supabase/supabase-js) — langsung/transitif dari file klien.
      if (FORBIDDEN_PACKAGES.includes(spec)) {
        const how =
          file === entry
            ? `mengimpor paket terlarang '${spec}' secara langsung`
            : `menjangkau paket terlarang '${spec}' secara transitif via ${relPosix(file)}:${line}`
        violations.push({ file: origin, line: reportLine, detail: how })
        continue
      }
      const resolved = resolveSpecifier(spec, file)
      if (!resolved) continue
      if (localVisited.has(resolved)) continue
      stack.push({ file: resolved, viaLine: reportLine, depth: depth + 1 })
    }
  }
  return violations
}

// ── pemindaian file ─────────────────────────────────────────────────────────────────────────────
function listSourceFiles(rootRel: string): string[] {
  const absRoot = join(REPO_ROOT, rootRel)
  if (!existsSync(absRoot)) return []
  const out: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (SKIP_DIRS.has(name)) continue
      const full = join(dir, name)
      const st = statSync(full)
      if (st.isDirectory()) walk(full)
      else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(name)) out.push(full)
    }
  }
  walk(absRoot)
  return out
}

// Permukaan klien yang dijaga: file `'use client'` di root yang dipindai, KECUALI `app/api/**`.
function isClientSurface(absPath: string): boolean {
  const rel = relPosix(absPath)
  if (rel.startsWith('app/api/')) return false
  return true
}

function runClientBoundaryGuard(): Violation[] {
  const violations: Violation[] = []
  const globalVisited = new Set<string>()
  for (const root of CLIENT_SCAN_ROOTS) {
    for (const file of listSourceFiles(root)) {
      if (!isClientSurface(file)) continue
      let source: string
      try {
        source = readFileSync(file, 'utf8')
      } catch {
        continue
      }
      if (!isUseClientFile(source)) continue
      violations.push(...traverseClientFile(file, globalVisited))
    }
  }
  return violations
}

// ── P5: guard migrasi payload-jsonb dua-sumber-kebenaran ─────────────────────────────────────────
// Pindai tiap `create table ... ( ... )` di migrasi. Pelanggaran: tabel yang mendeklarasikan kolom
// `payload jsonb` BERSAMAAN dengan kolom relasional/bisnis nyata lain (di luar envelope standar
// workspace_id/id/created_at/updated_at + constraint PK). Tabel agregat murni (hanya envelope +
// payload) tidak dihitung melanggar.
const ENVELOPE_COLUMNS = new Set(['workspace_id', 'id', 'created_at', 'updated_at'])

function runMigrationGuard(): Violation[] {
  const violations: Violation[] = []
  const files = listSqlFiles(join(REPO_ROOT, 'supabase', 'migrations'))
  for (const file of files) {
    let source: string
    try {
      source = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    for (const table of extractCreateTables(source)) {
      const columns = parseTopLevelColumns(table.body)
      const payloadCol = columns.find(
        (c) => c.name === 'payload' && /\bjsonb\b/i.test(c.type),
      )
      if (!payloadCol) continue
      const duplicatedRelational = columns.filter(
        (c) => c.name !== 'payload' && !ENVELOPE_COLUMNS.has(c.name),
      )
      if (duplicatedRelational.length > 0) {
        const names = duplicatedRelational.map((c) => c.name).join(', ')
        violations.push({
          file: relPosix(file),
          line: table.startLine + payloadCol.lineOffset,
          detail:
            `tabel '${table.name}' mendeklarasikan kolom 'payload jsonb' berdampingan dengan ` +
            `kolom relasional/bisnis (${names}) — dua sumber kebenaran per baris dilarang (P5/DD-A2). ` +
            `Pakai kolom relasional nyata saja, atau tabel agregat murni tanpa duplikasi.`,
        })
      }
    }
  }
  return violations
}

function listSqlFiles(absRoot: string): string[] {
  if (!existsSync(absRoot)) return []
  const out: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      const st = statSync(full)
      if (st.isDirectory()) walk(full)
      else if (name.endsWith('.sql')) out.push(full)
    }
  }
  walk(absRoot)
  return out.sort()
}

type ParsedTable = { name: string; body: string; startLine: number }

// Ekstrak blok `create table [if not exists] <name> ( <body> )`. Mengabaikan varian
// `create table ... (like ...)` karena itu tidak mendeklarasikan kolom sendiri.
function extractCreateTables(source: string): ParsedTable[] {
  const tables: ParsedTable[] = []
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?([^\s(]+)\s*\(/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) {
    const name = m[1].replace(/^public\./i, '')
    const openParenIdx = re.lastIndex - 1
    const body = extractBalancedParens(source, openParenIdx)
    if (body === null) continue
    // `(like public.venues including all)` → bukan deklarasi kolom; lewati.
    if (/^\s*like\s+/i.test(body)) continue
    const startLine = source.slice(0, openParenIdx).split('\n').length
    tables.push({ name, body, startLine })
  }
  return tables
}

// Dari indeks '(' pembuka, kembalikan isi di dalam pasangan kurung yang seimbang (tanpa kurung luar).
function extractBalancedParens(source: string, openIdx: number): string | null {
  let depth = 0
  for (let i = openIdx; i < source.length; i += 1) {
    const ch = source[i]
    if (ch === '(') depth += 1
    else if (ch === ')') {
      depth -= 1
      if (depth === 0) return source.slice(openIdx + 1, i)
    }
  }
  return null
}

type ParsedColumn = { name: string; type: string; lineOffset: number }

// Pisah body tabel menjadi definisi top-level (pisah pada koma di kedalaman kurung 0), lalu ambil
// yang berupa definisi KOLOM (bukan constraint tabel seperti primary key/foreign key/unique/check/
// constraint). `lineOffset` = jumlah baris sebelum definisi ini relatif awal body.
function parseTopLevelColumns(body: string): ParsedColumn[] {
  const parts: { text: string; lineOffset: number }[] = []
  let depth = 0
  let current = ''
  let lineOffset = 0
  let partStartLineOffset = 0
  let seenNonSpaceInPart = false
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i]
    if (ch === '\n') {
      lineOffset += 1
      if (!seenNonSpaceInPart) partStartLineOffset = lineOffset
    } else if (!/\s/.test(ch) && !seenNonSpaceInPart) {
      seenNonSpaceInPart = true
      partStartLineOffset = lineOffset
    }
    if (ch === '(') depth += 1
    else if (ch === ')') depth -= 1
    if (ch === ',' && depth === 0) {
      parts.push({ text: current.trim(), lineOffset: partStartLineOffset })
      current = ''
      seenNonSpaceInPart = false
      continue
    }
    current += ch
  }
  if (current.trim() !== '') {
    parts.push({ text: current.trim(), lineOffset: partStartLineOffset })
  }

  const CONSTRAINT_LEADERS =
    /^(primary\s+key|foreign\s+key|unique|check|constraint|exclude|like)\b/i
  const columns: ParsedColumn[] = []
  for (const part of parts) {
    if (part.text === '') continue
    if (CONSTRAINT_LEADERS.test(part.text)) continue
    // `[\s\S]` menggantikan `.` + flag `s` (dotAll) agar kompatibel dengan target es2017 — definisi
    // kolom bisa mencakup newline (mis. CHECK multi-baris), jadi tipe perlu melahap newline juga.
    const m = part.text.match(/^("?)([a-zA-Z_][a-zA-Z0-9_]*)\1\s+([\s\S]+)$/)
    if (!m) continue
    columns.push({ name: m[2].toLowerCase(), type: m[3].trim(), lineOffset: part.lineOffset })
  }
  return columns
}

// ── pelaporan ─────────────────────────────────────────────────────────────────────────────────
function report(title: string, violations: Violation[]): void {
  if (violations.length === 0) return
  console.error(`\n✗ ${title} — ${violations.length} pelanggaran:`)
  for (const v of violations) {
    const where = v.line > 0 ? `${v.file}:${v.line}` : v.file
    console.error(`  - ${where}\n      ${v.detail}`)
  }
}

function main(): void {
  let p1: Violation[] = []
  let p5: Violation[] = []
  try {
    p1 = runClientBoundaryGuard()
    p5 = runMigrationGuard()
  } catch (error) {
    console.error('Guard arsitektur gagal dijalankan (error internal):')
    console.error(error instanceof Error ? error.stack ?? error.message : String(error))
    process.exit(2)
  }

  report('P1 batas server/klien (file klien mengimpor modul server-only)', p1)
  report('P5 dua sumber kebenaran (payload jsonb + kolom relasional)', p5)

  const total = p1.length + p5.length
  if (total > 0) {
    console.error(`\nGuard arsitektur GAGAL: ${total} pelanggaran ditemukan.`)
    process.exit(1)
  }
  console.log('✓ Guard arsitektur lolos: batas server/klien (P1) dan tanpa dua sumber kebenaran (P5) terjaga.')
}

main()
