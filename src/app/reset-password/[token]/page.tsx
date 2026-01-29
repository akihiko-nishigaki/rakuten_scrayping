'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { validateResetTokenAction, resetPasswordAction } from '@/app/actions/auth';

export default function ResetPasswordPage() {
    const router = useRouter();
    const params = useParams();
    const token = params.token as string;

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isValidating, setIsValidating] = useState(true);
    const [isValidToken, setIsValidToken] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        async function validateToken() {
            try {
                const result = await validateResetTokenAction(token);
                setIsValidToken(result.valid);
            } catch (error) {
                setIsValidToken(false);
            } finally {
                setIsValidating(false);
            }
        }
        validateToken();
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        if (password !== confirmPassword) {
            setMessage({ type: 'error', text: 'パスワードが一致しません' });
            return;
        }

        setIsLoading(true);

        try {
            const result = await resetPasswordAction(token, password);
            if (result.ok) {
                setMessage({ type: 'success', text: 'パスワードを変更しました。ログインしてください。' });
                setTimeout(() => {
                    router.push('/login');
                }, 2000);
            } else {
                setMessage({ type: 'error', text: result.error || 'エラーが発生しました' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'エラーが発生しました' });
        } finally {
            setIsLoading(false);
        }
    };

    if (isValidating) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-gray-500">検証中...</div>
            </div>
        );
    }

    if (!isValidToken) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-md w-full space-y-8 text-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            無効なリンク
                        </h1>
                        <p className="mt-4 text-gray-600">
                            このパスワードリセットリンクは無効または期限切れです。
                        </p>
                    </div>
                    <div>
                        <Link
                            href="/reset-password"
                            className="text-indigo-600 hover:text-indigo-500"
                        >
                            もう一度リセットリンクを送信する
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <h1 className="text-center text-3xl font-bold text-gray-900">
                        Rakuten Rank Check
                    </h1>
                    <h2 className="mt-6 text-center text-xl text-gray-600">
                        新しいパスワードを設定
                    </h2>
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

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                新しいパスワード
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-lg placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                placeholder="••••••••"
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                8文字以上、英大文字・英小文字・数字・記号のうち3種類以上
                            </p>
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                                パスワード（確認）
                            </label>
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-lg placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                placeholder="••••••••"
                            />
                        </div>
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
                            {isLoading ? '変更中...' : 'パスワードを変更'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
