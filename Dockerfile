# syntax=docker/dockerfile:1

# ──────────────────────────────────────────────────────────────────────────────
# Mengapa multi-stage: pisahkan "punya semua devDeps untuk build" dari "runtime
# seramping mungkin". Hasil akhirnya hanya output `standalone` Next.js + aset statis,
# berjalan sebagai user non-root. DB tetap eksternal (Supabase) — tidak ada Postgres
# di sini. Node 22 LTS dipin untuk reprodusibilitas (host dev boleh versi lain) dan karena
# @supabase/supabase-js kini mensyaratkan Node >= 22.
# ──────────────────────────────────────────────────────────────────────────────

# ── Stage 1: dependencies ──────────────────────────────────────────────────────
# Install dependency produksi+dev dari lockfile. Dipisah agar layer cache tidak
# ikut invalid saat hanya kode sumber yang berubah.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
# Hanya manifest + lockfile dulu supaya `npm ci` ter-cache selama lockfile tak berubah.
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: build ──────────────────────────────────────────────────────────────
# Kompilasi Next.js menjadi output `standalone`. Butuh seluruh node_modules (termasuk
# devDeps: typescript, tailwind, dll) dan seluruh sumber.
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── Stage 3: runner ──────────────────────────────────────────────────────────────
# Image runtime minimal. Hanya artefak yang dibutuhkan server standalone:
#   - .next/standalone : server.js + node_modules yang sudah di-trace
#   - .next/static     : aset build (tidak ikut di standalone, wajib disalin terpisah)
#   - public           : aset publik (tidak ikut di standalone)
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Jalankan sebagai user non-root bawaan image node (uid 1000). Mengurangi blast-radius
# bila proses dikompromikan.
RUN chown -R node:node /app
USER node

# Urutan copy mengikuti kebutuhan server standalone.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

EXPOSE 3000

# Healthcheck ringan: server dianggap sehat bila port 3000 menjawab. Dipakai oleh
# compose/monitoring untuk tahu kapan container siap. Tanpa curl/wget (image slim),
# jadi pakai node satu baris.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# `server.js` adalah entrypoint yang dihasilkan output standalone Next.js.
CMD ["node", "server.js"]
