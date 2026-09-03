import 'next-auth'
declare module 'next-auth' { interface User { role: 'STAFF' | 'SUPERVISOR' }; interface Session { user: { id: string; role: 'STAFF' | 'SUPERVISOR' } & NonNullable<Session['user']> } }
declare module 'next-auth/jwt' { interface JWT { role?: 'STAFF' | 'SUPERVISOR' } }
