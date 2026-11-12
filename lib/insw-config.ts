import type { LookupConfig } from './insw-lartas'

/** Konfigurasi INSW dari environment; dipakai route Cek LARTAS dan HS BTKI. */
export function inswLookupConfig(): LookupConfig {
  const timeout = Number(process.env.LARTAS_REQUEST_TIMEOUT_MS)
  return {
    baseUrl: process.env.LARTAS_BASE_URL?.trim() || 'https://api.insw.go.id',
    token: process.env.LARTAS_TOKEN?.trim(),
    tokenFilePath: process.env.LARTAS_TOKEN_FILE_PATH?.trim() || undefined,
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 30_000,
    clientId: process.env.INSW_CLIENT_ID?.trim(),
    clientBearer: process.env.INSW_CLIENT_BEARER?.trim(),
  }
}
