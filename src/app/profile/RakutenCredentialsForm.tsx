'use client';

import { useState, useTransition } from 'react';
import { updateOwnRakutenAction } from '@/app/actions/auth';

interface Props {
    rakutenAppId: string;
    rakutenAffiliateId: string;
}

export function RakutenCredentialsForm({ rakutenAppId, rakutenAffiliateId }: Props) {
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [formData, setFormData] = useState({
        rakutenAppId,
        rakutenAffiliateId,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        startTransition(async () => {
            try {
                const result = await updateOwnRakutenAction({
                    rakutenAppId: formData.rakutenAppId,
                    rakutenAffiliateId: formData.rakutenAffiliateId,
                });

                if (result.ok) {
                    setMessage({ type: 'success', text: '保存しました' });
                } else {
                    setMessage({ type: 'error', text: '保存に失敗しました' });
                }
            } catch {
                setMessage({ type: 'error', text: '保存に失敗しました' });
            }
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
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
                <p className="mt-1 text-xs text-gray-500">
                    未入力の場合、システム共通のアプリケーションIDが使用されます
                </p>
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
                <p className="mt-1 text-xs text-gray-500">
                    アフィリエイトIDを設定すると、あなた固有の個別料率がダッシュボードに表示されます
                </p>
            </div>

            <div className="pt-4 border-t border-gray-200 flex justify-end">
                <button
                    type="submit"
                    disabled={isPending}
                    className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${
                        isPending
                            ? 'bg-indigo-400 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                >
                    {isPending ? '保存中...' : '保存'}
                </button>
            </div>
        </form>
    );
}
