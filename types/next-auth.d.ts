import type { DefaultSession } from 'next-auth'
import type { Role } from '@/domain/auth/types'

// Mengapa augmentasi tunggal ini dibagi dua model: slice auth BARU (features/auth/nextauth.ts)
// membawa bentuk CurrentUser `{ id, role, workspaceId }` di sesi JWT, sementara `auth.ts` LAMA
// masih memakai flag `isAdmin`. Augmentasi NextAuth bersifat global — ia merge ke seluruh proyek —
// jadi kedua set field harus hidup di satu deklarasi agar tsc tetap bersih selama cutover (DD-A4).
// `isAdmin` dipertahankan WAJIB di `Session['user']` karena konsumen legacy (AppShell) membacanya
// sebagai boolean; `role`/`workspaceId` ditambahkan opsional. Pada objek `User`/`JWT` semua field
// dibuat opsional supaya objek lama (hanya `isAdmin`) dan objek baru (hanya `role`/`workspaceId`)
// sama-sama memenuhi tipe return `authorize`. Begitu auth lama dihapus, field legacy dibuang.

declare module 'next-auth' {
  interface User {
    isAdmin?: boolean
    role?: Role
    workspaceId?: string
  }

  interface Session {
    user: DefaultSession['user'] & {
      id: string
      isAdmin: boolean
      role?: Role
      workspaceId?: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    isAdmin?: boolean
    role?: Role
    workspaceId?: string
  }
}
