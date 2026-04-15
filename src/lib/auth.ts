import { NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { Role } from '@prisma/client'
import { getLarkRoleForEmail } from '@/lib/lark-sync'

async function verifyPassword(plaintext: string, hashed: string): Promise<boolean> {
  // Support both bcrypt hashes (new) and legacy SHA-256 hashes (migration path)
  if (hashed.startsWith('$2')) {
    return bcrypt.compare(plaintext, hashed)
  }
  // Legacy SHA-256 — auto-upgrade to bcrypt on next successful login
  const { createHash } = await import('crypto')
  const sha256 = createHash('sha256').update(plaintext).digest('hex')
  return sha256 === hashed
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions['adapter'],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required')
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user) {
          throw new Error('Invalid credentials')
        }

        if (!user.active) {
          throw new Error('Account is inactive. Contact your administrator.')
        }

        const isValid = await verifyPassword(credentials.password, user.password)
        if (!isValid) {
          throw new Error('Invalid credentials')
        }

        // JIT Lark sync: refresh role, name, and avatar from Lark on every login.
        // This ensures that if someone's job title changes in Lark, it is reflected
        // immediately the next time they log in — no manual admin action needed.
        // Runs in the background; if Lark is unreachable the local DB values are used.
        try {
          const larkProfile = await getLarkRoleForEmail(user.email)
          if (larkProfile) {
            // Use raw SQL for the update to handle larkOpenId which may not yet
            // be in the generated Prisma client (column added by ensureLarkOpenIdColumn)
            await prisma.$executeRawUnsafe(
              `UPDATE "users"
               SET role = $1::\"Role\", name = $2, avatar = COALESCE($3, avatar), "larkOpenId" = COALESCE($4, "larkOpenId"), "updatedAt" = NOW()
               WHERE id = $5`,
              larkProfile.role,
              larkProfile.name,
              larkProfile.avatar ?? null,
              larkProfile.larkOpenId ?? null,
              user.id,
            )
            // Reflect the fresh Lark values in the issued JWT
            user.role   = larkProfile.role
            user.name   = larkProfile.name
            user.avatar = larkProfile.avatar ?? user.avatar
          }
        } catch {
          // Lark unreachable or column not yet created — continue with local DB values
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.avatar,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { id: string; role: Role }).role
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as Role
      }
      return session
    },
  },
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: Role
    }
  }

  interface User {
    id: string
    role: Role
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: Role
  }
}
