import type { NextAuthConfig } from 'next-auth';
import type { Role } from '@prisma/client';

declare module 'next-auth' {
    interface User {
        id: string;
        email: string;
        name: string | null;
        role: Role;
    }
    interface Session {
        user: User;
    }
}

declare module '@auth/core/jwt' {
    interface JWT {
        id: string;
        role: Role;
    }
}

/**
 * Edge-compatible auth configuration
 * This file should NOT import any Node.js-only modules (like bcryptjs)
 */
export const authConfig: NextAuthConfig = {
    pages: {
        signIn: '/login',
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = user.role;
            }
            return token;
        },
        async session({ session, token }) {
            if (token) {
                session.user.id = token.id;
                session.user.role = token.role;
            }
            return session;
        },
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const userRole = auth?.user?.role;
            const pathname = nextUrl.pathname;

            // Public routes
            const publicRoutes = ['/login', '/reset-password'];
            if (publicRoutes.some(route => pathname.startsWith(route))) {
                return true;
            }

            // Allow NextAuth API routes
            if (pathname.startsWith('/api/auth')) {
                return true;
            }

            // Allow CRON job endpoints (they have their own auth)
            if (pathname.startsWith('/api/jobs')) {
                return true;
            }

            // Allow debug endpoints (temporary)
            if (pathname.startsWith('/api/debug')) {
                return true;
            }

            // Require authentication for all other routes
            if (!isLoggedIn) {
                return false; // Will redirect to signIn page
            }

            // USER role can only access dashboard, rankings and their APIs
            if (userRole === 'USER') {
                const userAllowedPaths = ['/', '/api/dashboard', '/rankings', '/api/rankings'];
                const isAllowed = userAllowedPaths.some(p =>
                    pathname === p || pathname.startsWith(p + '/')
                );
                if (!isAllowed) {
                    return Response.redirect(new URL('/', nextUrl.origin));
                }
            }

            // Check admin routes
            const adminRoutes = ['/admin', '/settings', '/verification', '/snapshots'];
            if (adminRoutes.some(route => pathname.startsWith(route))) {
                if (userRole !== 'ADMIN') {
                    return Response.redirect(new URL('/', nextUrl.origin));
                }
            }

            return true;
        },
    },
    session: {
        strategy: 'jwt',
    },
    providers: [], // Providers are added in config.ts (server-side only)
};
