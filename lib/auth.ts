import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' }, pages: { signIn: '/login' },
  providers: [CredentialsProvider({ name: 'Email dan password', credentials: { email: { label: 'Email', type: 'email' }, password: { label: 'Password', type: 'password' } }, async authorize(credentials) {
    if (!credentials?.email || !credentials.password) return null
    const user = await prisma.user.findUnique({ where: { email: credentials.email } })
    if (!user?.isActive || !(await bcrypt.compare(credentials.password, user.password))) return null
    return { id: user.id, name: user.name, email: user.email, role: user.role }
  } })],
  callbacks: { jwt({ token, user }) { if (user) token.role = user.role; return token }, session({ session, token }) { if (session.user) { session.user.id = token.sub!; session.user.role = token.role as 'STAFF' | 'SUPERVISOR' }; return session } },
}
