'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { ReactNode, useState, useRef, useEffect } from 'react';

export default function AppLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const { data: session, status } = useSession();
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
        };

        if (isUserMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isUserMenuOpen]);

    // Don't show layout on login and password reset pages
    if (pathname.startsWith('/login') || pathname.startsWith('/reset-password')) {
        return <>{children}</>;
    }

    // Show loading state while checking session
    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-gray-500">Loading...</div>
            </div>
        );
    }

    const isAdmin = session?.user?.role === 'ADMIN';

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <Link href="/" className="text-xl font-bold text-blue-600">
                            Rakuten Rank Check
                        </Link>
                        <nav className="hidden md:flex gap-6 text-sm font-medium text-gray-600">
                            <Link
                                href="/"
                                className={pathname === '/' ? 'text-blue-600' : 'hover:text-blue-600'}
                            >
                                Dashboard
                            </Link>
                            <Link
                                href="/rankings"
                                className={pathname.startsWith('/rankings') ? 'text-blue-600' : 'hover:text-blue-600'}
                            >
                                Rankings
                            </Link>
                            <Link
                                href="/verification/queue"
                                className={pathname.startsWith('/verification') ? 'text-blue-600' : 'hover:text-blue-600'}
                            >
                                Verification
                            </Link>
                            <Link
                                href="/snapshots"
                                className={pathname.startsWith('/snapshots') ? 'text-blue-600' : 'hover:text-blue-600'}
                            >
                                History
                            </Link>
                            {isAdmin && (
                                <Link
                                    href="/admin/users"
                                    className={pathname.startsWith('/admin') ? 'text-blue-600' : 'hover:text-blue-600'}
                                >
                                    Users
                                </Link>
                            )}
                        </nav>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link
                            href="/settings"
                            className={`text-sm ${
                                pathname === '/settings' ? 'text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-900'
                            }`}
                        >
                            Settings
                        </Link>

                        {session?.user && (
                            <div className="relative" ref={menuRef}>
                                <button
                                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                    className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
                                >
                                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                                        <span className="text-indigo-700 font-medium">
                                            {(session.user.name || session.user.email)?.[0]?.toUpperCase() || 'U'}
                                        </span>
                                    </div>
                                    <span className="hidden sm:inline max-w-[120px] truncate">
                                        {session.user.name || session.user.email}
                                    </span>
                                    <svg
                                        className={`w-4 h-4 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {isUserMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                                        <div className="px-4 py-2 border-b border-gray-100">
                                            <div className="text-sm font-medium text-gray-900 truncate">
                                                {session.user.name || session.user.email}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {session.user.role === 'ADMIN' ? '管理者' : '一般'}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => signOut({ callbackUrl: '/login' })}
                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                        >
                                            ログアウト
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </header>
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
        </div>
    );
}
