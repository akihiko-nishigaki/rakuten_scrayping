'use client';

import { useState } from 'react';
import Link from 'next/link';
import { requestPasswordResetAction } from '@/app/actions/auth';

export default function ResetPasswordRequestPage() {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        try {
            const result = await requestPasswordResetAction(email);
            setMessage({ type: 'success', text: result.message });
            setEmail('');
        } catch (error) {
            setMessage({ type: 'error', text: 'エラーが発生しました' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <h1 className="text-center text-3xl font-bold text-gray-900">
                        Rakuten Rank Check
                    </h1>
                    <h2 className="mt-6 text-center text-xl text-gray-600">
                        パスワードリセット
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-500">
                        登録されているメールアドレスを入力してください。
                        <br />
                        パスワードリセット用のリンクをお送りします。
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {message && (
                        <div
                            className={`px-4 py-3 rounded-lg text-sm ${
                                message.type === 'success'
                                    ? 'bg-green-50 border border-green-200 text-green-700'
                                    : 'bg-red-50 border border-red-200 text-red-700'
                            }`}
                        >
                            {message.text}
                        </div>
                    )}

                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                            メールアドレス
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-lg placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                            placeholder="example@email.com"
                        />
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white ${
                                isLoading
                                    ? 'bg-indigo-400 cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                            }`}
                        >
                            {isLoading ? '送信中...' : 'リセットリンクを送信'}
                        </button>
                    </div>

                    <div className="text-center">
                        <Link
                            href="/login"
                            className="text-sm text-indigo-600 hover:text-indigo-500"
                        >
                            ログインに戻る
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
