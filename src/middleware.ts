import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth/auth.config';

/**
 * Middleware using Edge-compatible auth configuration
 * This does NOT import Node.js modules like bcryptjs
 */
export default NextAuth(authConfig).auth;

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
