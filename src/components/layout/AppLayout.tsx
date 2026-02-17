'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { ReactNode, useState, useRef, useEffect } from 'react';

// Navigation items
const NAV_ITEMS = [
    { href: '/', label: 'ホーム', icon: HomeIcon },
    { href: '/verification/queue', label: '料率チェック', icon: CheckIcon, adminOnly: true },
    { href: '/snapshots', label: '履歴', icon: ClockIcon, adminOnly: true },
    { href: '/admin/users', label: 'メンバー', icon: UsersIcon, adminOnly: true },
];

function HomeIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
    );
}

function CheckIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    );
}

function ClockIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    );
}

function UsersIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
    );
}

function SettingsIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    );
}

function isNavActive(pathname: string, href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
}

export default function AppLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { data: session, status } = useSession();
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu on outside click
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

    // Close menu on route change
    useEffect(() => {
        setIsUserMenuOpen(false);
    }, [pathname]);

    // Don't show layout on login and password reset pages
    if (pathname.startsWith('/login') || pathname.startsWith('/reset-password')) {
        return <>{children}</>;
    }

    // Show loading state while checking session
    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 rounded-full border-3 border-pink-200 border-t-pink-500 animate-spin" />
                    <span className="text-sm text-gray-400">読み込み中...</span>
                </div>
            </div>
        );
    }

    const isAdmin = session?.user?.role === 'ADMIN';

    // Filter nav items based on role
    const visibleNavItems = NAV_ITEMS.filter(item => !item.adminOnly || isAdmin);

    // Bottom nav items (mobile) - max 4 for mobile
    const bottomNavItems = visibleNavItems.slice(0, 4);

    return (
        <div className="min-h-screen bg-[var(--background)] flex flex-col">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-md border-b border-pink-100/50 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-6">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                </svg>
                            </div>
                            <span className="text-lg font-bold gradient-text">ランクリ</span>
                        </Link>

                        {/* Desktop Navigation */}
                        <nav className="hidden md:flex gap-1">
                            {visibleNavItems.map((item) => {
                                const active = isNavActive(pathname, item.href);
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                            active
                                                ? 'bg-pink-50 text-pink-600'
                                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>

                    {/* Right side */}
                    <div className="flex items-center gap-3">
                        {isAdmin && (
                            <Link
                                href="/settings"
                                className={`p-2 rounded-lg transition-colors ${
                                    pathname === '/settings'
                                        ? 'bg-pink-50 text-pink-600'
                                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                <SettingsIcon className="w-5 h-5" />
                            </Link>
                        )}

                        {session?.user && (
                            <div className="relative" ref={menuRef}>
                                <button
                                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                                >
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center shadow-sm">
                                        <span className="text-white font-medium text-xs">
                                            {(session.user.name || session.user.email)?.[0]?.toUpperCase() || 'U'}
                                        </span>
                                    </div>
                                    <span className="hidden sm:inline max-w-[120px] truncate text-sm">
                                        {session.user.name || session.user.email}
                                    </span>
                                    <svg
                                        className={`w-3.5 h-3.5 transition-transform text-gray-400 ${isUserMenuOpen ? 'rotate-180' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {isUserMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-52 card-warm py-1 z-20 shadow-lg">
                                        <div className="px-4 py-3 border-b border-pink-50">
                                            <div className="text-sm font-medium text-gray-800 truncate">
                                                {session.user.name || session.user.email}
                                            </div>
                                            <div className="text-xs text-gray-400 mt-0.5">
                                                {session.user.role === 'ADMIN' ? '管理者' : '一般'}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setIsUserMenuOpen(false);
                                                router.push('/profile');
                                            }}
                                            className="w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:bg-pink-50 hover:text-pink-600 transition-colors"
                                        >
                                            マイ設定
                                        </button>
                                        <button
                                            onClick={() => signOut({ callbackUrl: '/login' })}
                                            className="w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:bg-pink-50 hover:text-pink-600 transition-colors"
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

            {/* Main Content */}
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
                {children}
            </main>

            {/* Mobile Bottom Navigation */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-pink-100/50 z-10 safe-area-bottom">
                <div className="flex justify-around items-center h-14 px-2">
                    {bottomNavItems.map((item) => {
                        const active = isNavActive(pathname, item.href);
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors min-w-0 ${
                                    active
                                        ? 'text-pink-600'
                                        : 'text-gray-400'
                                }`}
                            >
                                <Icon className="w-5 h-5" />
                                <span className="text-[10px] font-medium truncate">{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}
