// Mengapa: validator kredensial MURNI + logika kontrak hash yang dapat diuji tanpa efek.
// Semua fungsi di sini murni: tidak throw, mengumpulkan SEMUA issue, dan tidak menyentuh storage,
// HTTP, React, Supabase, atau node crypto. Derivasi scrypt yang sesungguhnya tinggal di tepi
// (lib/auth/password.ts); yang pure di sini adalah bentuk/penguraian nilai hash self-describing.
// Auth_Domain_Module — lihat Requirement 17.1 dan 17.3.

import { type Validation, fromIssues, issue } from '@/domain/shared/validation'
import type {
  Credential,
  ParsedPasswordHash,
  PasswordHashAlgorithm,
  ValidatedCredential,
} from '@/domain/auth/types'

// Pola email yang sengaja longgar: cukup "ada@ada.sesuatu" tanpa spasi. Validasi email yang ketat
// adalah rawan false-negative; domain hanya menolak bentuk yang jelas bukan email.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Validasi kredensial sign-in secara MURNI. Mengumpulkan seluruh issue sekaligus (tidak berhenti
// di kegagalan pertama) dan tidak pernah throw. Pada sukses mengembalikan ValidatedCredential
// dengan email ter-trim + lower-case. Requirement 17.3.
export function validateCredential(credential: Credential): Validation<ValidatedCredential> {
  const issues = []
  const email = credential.email.trim().toLowerCase()
  const password = credential.password

  if (email.length === 0) {
    issues.push(issue('email', 'Email wajib diisi.'))
  } else if (!EMAIL_PATTERN.test(email)) {
    issues.push(issue('email', 'Format email tidak valid.'))
  }

  if (password.length === 0) {
    issues.push(issue('password', 'Kata sandi wajib diisi.'))
  }

  return fromIssues(issues, { email, password })
}

// ── Kontrak hash self-describing: penguraian murni ──────────────────────────────────────────
// Format nilai hash self-describing berversi (Requirement 17.2), dipisah '$':
//   scrypt$<cost>$<blockSize>$<parallelization>$<saltBase64url>$<hashBase64url>
// Fungsi di sini MENGURAI dan MEMVALIDASI bentuknya secara murni; ia tidak menghitung scrypt.
// Komparasi waktu-konstan dan derivasi scrypt dilakukan oleh PasswordHasher di tepi.

const HASH_SEGMENT_COUNT = 6
const SUPPORTED_ALGORITHM: PasswordHashAlgorithm = 'scrypt'

// Mengurai nilai hash self-describing menjadi komponennya. Murni, tak throw: mengembalikan
// Validation yang mengumpulkan setiap bagian yang hilang/tidak valid. Dipakai implementasi
// verify() di tepi untuk mengekstrak parameter sebelum derivasi, dan dapat diuji sendiri.
export function parsePasswordHash(encoded: string): Validation<ParsedPasswordHash> {
  const segments = encoded.split('$')
  if (segments.length !== HASH_SEGMENT_COUNT) {
    return fromIssues(
      [issue('hash', 'Format nilai hash tidak dikenali.')],
      undefined as unknown as ParsedPasswordHash,
    )
  }

  const [algorithm, cost, blockSize, parallelization, salt, hash] = segments
  const issues = []

  if (algorithm !== SUPPORTED_ALGORITHM) {
    issues.push(issue('algorithm', 'Algoritma hash tidak didukung.'))
  }

  const parsedCost = Number(cost)
  const parsedBlockSize = Number(blockSize)
  const parsedParallelization = Number(parallelization)

  if (!isPositiveInteger(parsedCost)) {
    issues.push(issue('parameters.cost', 'Parameter cost hash tidak valid.'))
  }
  if (!isPositiveInteger(parsedBlockSize)) {
    issues.push(issue('parameters.blockSize', 'Parameter blockSize hash tidak valid.'))
  }
  if (!isPositiveInteger(parsedParallelization)) {
    issues.push(issue('parameters.parallelization', 'Parameter parallelization hash tidak valid.'))
  }
  if (salt.length === 0) {
    issues.push(issue('salt', 'Salt hash tidak boleh kosong.'))
  }
  if (hash.length === 0) {
    issues.push(issue('hash', 'Nilai hash tidak boleh kosong.'))
  }

  return fromIssues(issues, {
    algorithm: SUPPORTED_ALGORITHM,
    parameters: {
      cost: parsedCost,
      blockSize: parsedBlockSize,
      parallelization: parsedParallelization,
    },
    salt,
    hash,
  })
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0
}
