// Mengapa: barrel tipis batas publik slice dashboard (dipakai Server Component `/`). Efektif
// server-only karena mere-export use-case ber-`import 'server-only'` — jangan diimpor dari file
// `'use client'` mana pun.

export { getDashboard, type DashboardData } from '@/features/dashboard/use-cases/get-dashboard'
