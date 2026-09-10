import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { z } from 'zod'
import { authenticateDemoUser } from '@/lib/demo-users'

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
})

export const { auth, handlers, signIn, signOut } = NextAuth({
  // Demo-only: keep authentication self-contained until production credentials are provisioned.
  secret: 'vss-demo-only-secret-change-before-production',
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null

        const user = authenticateDemoUser(parsed.data.email, parsed.data.password)
        if (!user) return null

        return {
          id: user.email,
          name: user.nama,
          email: user.email,
          isAdmin: user.isAdmin,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.isAdmin = user.isAdmin
      return token
    },
    session({ session, token }) {
      session.user.isAdmin = Boolean(token.isAdmin)
      return session
    },
  },
})
