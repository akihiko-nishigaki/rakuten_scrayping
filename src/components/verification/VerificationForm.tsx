'use client';

import { upsertVerifiedRateAction } from '@/app/actions/verification';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export default function VerificationForm({
    itemKey,
    apiRate,
    currentRate
}: {
    itemKey: string,
    apiRate: number | null,
    currentRate: number | null
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [rate, setRate] = useState<string>(currentRate?.toString() ?? apiRate?.toString() ?? '');
    const [note, setNote] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numRate = parseFloat(rate);
        if (isNaN(numRate)) return alert("Please enter a valid number");

        startTransition(async () => {
            const res = await upsertVerifiedRateAction({
                itemKey,
                verifiedRate: numRate,
                note,
            });

            if (res.ok) {
                router.refresh();
                router.push('/verification/queue'); // Auto-advance
            }
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow-sm">
            <div>
                <label className="block text-sm font-medium text-gray-700">Verified Rate (%)</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                    <input
                        type="number"
                        step="0.01"
                        required
                        value={rate}
                        onChange={(e) => setRate(e.target.value)}
                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-3 pr-12 sm:text-sm border-gray-300 rounded-md py-2 border"
                        placeholder="0.00"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">%</span>
                    </div>
                </div>
                {apiRate !== null && (
                    <p className="mt-1 text-xs text-gray-500">API Value: {apiRate}%</p>
                )}
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Note (Optional)</label>
                <textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md border p-2"
                />
            </div>

            <div className="flex justify-between items-center pt-2">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="text-sm text-gray-500 hover:text-gray-700"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isPending}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                    {isPending ? 'Saving...' : 'Confirm & Next'}
                </button>
            </div>
        </form>
    );
}
