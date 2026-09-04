import 'next-auth'
type UserRole = 'STAFF' | 'SUPERVISOR' | 'CUSTOMER_SERVICE' | 'DOCUMENT_ASSISTANT'
declare module 'next-auth' { interface User { role: UserRole }; interface Session { user: { id: string; role: UserRole } & NonNullable<Session['user']> } }
declare module 'next-auth/jwt' { interface JWT { role?: UserRole } }
