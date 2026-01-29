import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from './password';
import { authConfig } from './auth.config';

/**
 * Full auth configuration with providers (server-side only)
 * This imports Node.js modules like bcryptjs through verifyPassword
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            name: 'credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null;
                }

                const email = credentials.email as string;
                const password = credentials.password as string;

                const user = await prisma.user.findUnique({
                    where: { email },
                });

                if (!user) {
                    return null;
                }

                const isValid = await verifyPassword(password, user.password);

                if (!isValid) {
                    return null;
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                };
            },
        }),
    ],
});

/**
 * Check if the current user is an admin
 */
export async function isAdmin(): Promise<boolean> {
    const session = await auth();
    return session?.user?.role === 'ADMIN';
}

/**
 * Get the current user from session
 */
export async function getCurrentUser() {
    const session = await auth();
    return session?.user ?? null;
}

/**
 * Require admin role - throws if not admin
 */
export async function requireAdmin() {
    const session = await auth();
    if (!session?.user) {
        throw new Error('認証が必要です');
    }
    if (session.user.role !== 'ADMIN') {
        throw new Error('管理者権限が必要です');
    }
    return session.user;
}

/**
 * Require authentication - throws if not logged in
 */
export async function requireAuth() {
    const session = await auth();
    if (!session?.user) {
        throw new Error('認証が必要です');
    }
    return session.user;
}
