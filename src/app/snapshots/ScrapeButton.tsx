'use client';

import { useState } from 'react';

interface ScrapeButtonProps {
    snapshotId: string;
    itemCount: number;
}

export function ScrapeButton({ snapshotId, itemCount }: ScrapeButtonProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<{
        success: number;
        failed: number;
        total: number;
    } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleScrape = async () => {
        if (!confirm(`${itemCount}件の商品の実際の料率を取得します。\n\n初回はブラウザでログインが必要です。\n続行しますか？`)) {
            return;
        }

        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'snapshot',
                    snapshotId,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Scraping failed');
            }

            setResult({
                success: data.data.success,
                failed: data.data.failed,
                total: data.data.total,
            });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="inline-flex items-center gap-2">
            <button
                onClick={handleScrape}
                disabled={isLoading}
                className={`text-xs px-2 py-1 rounded ${
                    isLoading
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                }`}
                title="実際のアフィリエイト料率を取得"
            >
                {isLoading ? '取得中...' : '料率取得'}
            </button>
            {result && (
                <span className="text-xs text-green-600">
                    {result.success}/{result.total}件成功
                </span>
            )}
            {error && (
                <span className="text-xs text-red-600 max-w-xs truncate" title={error}>
                    エラー: {error}
                </span>
            )}
        </div>
    );
}
