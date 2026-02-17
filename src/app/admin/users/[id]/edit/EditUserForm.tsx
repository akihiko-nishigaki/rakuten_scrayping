'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { updateUserAction } from '@/app/actions/auth';
import { Role } from '@prisma/client';

interface User {
    id: string;
    email: string;
    name: string | null;
    role: Role;
    rakutenAppId: string | null;
    rakutenAccessKey: string | null;
    rakutenAffiliateId: string | null;
}

interface EditUserFormProps {
    user: User;
}

export function EditUserForm({ user }: EditUserFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [formData, setFormData] = useState({
        name: user.name || '',
        role: user.role,
        password: '',
        confirmPassword: '',
        rakutenAppId: user.rakutenAppId || '',
        rakutenAccessKey: user.rakutenAccessKey || '',
        rakutenAffiliateId: user.rakutenAffiliateId || '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        if (formData.password && formData.password !== formData.confirmPassword) {
            setMessage({ type: 'error', text: 'パスワードが一致しません' });
            return;
        }

        startTransition(async () => {
            const result = await updateUserAction({
                id: user.id,
                name: formData.name,
                role: formData.role,
                password: formData.password || undefined,
                rakutenAppId: formData.rakutenAppId,
                rakutenAccessKey: formData.rakutenAccessKey,
                rakutenAffiliateId: formData.rakutenAffiliateId,
            });

            if (result.ok) {
                setMessage({ type: 'success', text: '更新しました' });
                setFormData((prev) => ({ ...prev, password: '', confirmPassword: '' }));
                router.refresh();
            } else {
                setMessage({ type: 'error', text: result.error || '更新に失敗しました' });
            }
        });
    };

    return (
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
                <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                    ロール
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
            </div>

            <div className="pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-4">
                    楽天API設定（個別料率取得用）
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                    ユーザー毎にアフィリエイトIDを設定すると、そのユーザー固有の料率が取得されます。未設定の場合はシステム共通の設定が使用されます。
                </p>

                <div className="space-y-4">
                    <div>
                        <label htmlFor="rakutenAppId" className="block text-sm font-medium text-gray-700">
                            アプリケーションID
                        </label>
                        <input
                            id="rakutenAppId"
                            type="text"
                            value={formData.rakutenAppId}
                            onChange={(e) => setFormData({ ...formData, rakutenAppId: e.target.value })}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-mono"
                            placeholder="例: 1039987707243862300"
                        />
                    </div>

                    <div>
                        <label htmlFor="rakutenAccessKey" className="block text-sm font-medium text-gray-700">
                            アクセスキー
                        </label>
                        <input
                            id="rakutenAccessKey"
                            type="text"
                            value={formData.rakutenAccessKey}
                            onChange={(e) => setFormData({ ...formData, rakutenAccessKey: e.target.value })}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-mono"
                            placeholder="例: your-access-key"
                        />
                    </div>

                    <div>
                        <label htmlFor="rakutenAffiliateId" className="block text-sm font-medium text-gray-700">
                            アフィリエイトID
                        </label>
                        <input
                            id="rakutenAffiliateId"
                            type="text"
                            value={formData.rakutenAffiliateId}
                            onChange={(e) => setFormData({ ...formData, rakutenAffiliateId: e.target.value })}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-mono"
                            placeholder="例: 1a1508b0.5343d308.1a1508b1.d48dd257"
                        />
                    </div>
                </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-4">
                    パスワード変更（変更する場合のみ入力）
                </h3>

                <div className="space-y-4">
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                            新しいパスワード
                        </label>
                        <input
                            id="password"
                            type="password"
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
                            新しいパスワード（確認）
                        </label>
                        <input
                            id="confirmPassword"
                            type="password"
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="••••••••"
                        />
                    </div>
                </div>
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
                    {isPending ? '更新中...' : '更新'}
                </button>
            </div>
        </form>
    );
}
