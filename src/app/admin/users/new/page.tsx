'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createUserAction } from '@/app/actions/auth';
import { Role } from '@prisma/client';

export default function NewUserPage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        name: '',
        role: 'USER' as Role,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        if (formData.password !== formData.confirmPassword) {
            setMessage({ type: 'error', text: 'パスワードが一致しません' });
            return;
        }

        startTransition(async () => {
            const result = await createUserAction({
                email: formData.email,
                password: formData.password,
                name: formData.name || undefined,
                role: formData.role,
            });

            if (result.ok) {
                router.push('/admin/users');
                router.refresh();
            } else {
                setMessage({ type: 'error', text: result.error || '登録に失敗しました' });
            }
        });
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">ユーザー登録</h1>
                <Link
                    href="/admin/users"
                    className="text-sm text-gray-600 hover:text-gray-800"
                >
                    戻る
                </Link>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
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
                            メールアドレス <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="email"
                            type="email"
                            required
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="example@email.com"
                        />
                    </div>

                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                            名前
                        </label>
                        <input
                            id="name"
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="山田 太郎"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                            パスワード <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="password"
                            type="password"
                            required
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="••••••••"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            8文字以上、英大文字・英小文字・数字・記号のうち3種類以上
                        </p>
                    </div>

                    <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                            パスワード（確認） <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="confirmPassword"
                            type="password"
                            required
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="••••••••"
                        />
                    </div>

                    <div>
                        <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                            ロール <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="role"
                            value={formData.role}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        >
                            <option value="USER">一般</option>
                            <option value="ADMIN">管理者</option>
                        </select>
                        <p className="mt-1 text-xs text-gray-500">
                            管理者はユーザーの登録・編集・削除が可能です
                        </p>
                    </div>

                    <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
                        <Link
                            href="/admin/users"
                            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            キャンセル
                        </Link>
                        <button
                            type="submit"
                            disabled={isPending}
                            className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${
                                isPending
                                    ? 'bg-indigo-400 cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                        >
                            {isPending ? '登録中...' : '登録'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
