'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteUserAction } from '@/app/actions/auth';

interface DeleteUserButtonProps {
    userId: string;
    userEmail: string;
}

export function DeleteUserButton({ userId, userEmail }: DeleteUserButtonProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const handleDelete = async () => {
        if (!confirm(`${userEmail} を削除してもよろしいですか？\nこの操作は取り消せません。`)) {
            return;
        }

        setError(null);
        startTransition(async () => {
            const result = await deleteUserAction(userId);
            if (result.ok) {
                router.refresh();
            } else {
                setError(result.error || '削除に失敗しました');
            }
        });
    };

    return (
        <>
            <button
                onClick={handleDelete}
                disabled={isPending}
                className={`text-xs font-medium ${
                    isPending
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-red-600 hover:text-red-800'
                }`}
            >
                {isPending ? '削除中...' : '削除'}
            </button>
            {error && (
                <span className="text-xs text-red-600 ml-2">{error}</span>
            )}
        </>
    );
}
