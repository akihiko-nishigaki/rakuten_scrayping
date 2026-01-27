import Link from 'next/link';
import { ReactNode } from 'react';

export default function AppLayout({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <Link href="/" className="text-xl font-bold text-blue-600">
                            Rakuten Rank Check
                        </Link>
                        <nav className="hidden md:flex gap-6 text-sm font-medium text-gray-600">
                            <Link href="/" className="hover:text-blue-600">Dashboard</Link>
                            <Link href="/rankings" className="hover:text-blue-600">Rankings</Link>
                            <Link href="/verification/queue" className="hover:text-blue-600">Verification</Link>
                            <Link href="/snapshots" className="hover:text-blue-600">History</Link>
                        </nav>
                    </div>
                    <div>
                        <Link href="/settings" className="text-sm text-gray-500 hover:text-gray-900">Settings</Link>
                    </div>
                </div>
            </header>
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
        </div>
    );
}
