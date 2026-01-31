import { getLatestRankingAction } from '@/app/actions/ranking';
import { getSettingsAction } from '@/app/actions/settings';
import { format } from 'date-fns';
import Link from 'next/link';
import { getCategoryName } from '@/lib/rakuten/categories';

export const dynamic = 'force-dynamic';

interface PageProps {
    searchParams: Promise<{ category?: string }>;
}

export default async function RankingsPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const settings = await getSettingsAction();

    // Get categories from settings, sorted by categoryOrder
    const categoryOrder = settings.categoryOrder || [];
    const categories = [...settings.categories].sort((a, b) => {
        const indexA = categoryOrder.indexOf(a);
        const indexB = categoryOrder.indexOf(b);
        const orderA = indexA === -1 ? 999 : indexA;
        const orderB = indexB === -1 ? 999 : indexB;
        return orderA - orderB;
    });

    if (categories.length === 0) {
        return (
            <div className="p-8 text-center text-gray-500">
                <h2 className="text-2xl font-semibold mb-2">カテゴリが設定されていません</h2>
                <p>設定ページでカテゴリを追加してください。</p>
                <Link href="/settings" className="text-blue-600 hover:underline mt-2 inline-block">
                    設定ページへ →
                </Link>
            </div>
        );
    }

    const selectedCategory = params.category || categories[0];
    const rankingData = await getLatestRankingAction(selectedCategory);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">ランキング</h1>
            </div>

            {/* Category Selector */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    カテゴリを選択
                </label>
                <div className="flex gap-2 flex-wrap">
                    {categories.map((categoryId) => (
                        <Link
                            key={categoryId}
                            href={`/rankings?category=${categoryId}`}
                            className={`px-4 py-2 rounded-lg border text-sm ${
                                categoryId === selectedCategory
                                    ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium'
                                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                        >
                            {getCategoryName(categoryId)}
                        </Link>
                    ))}
                </div>
            </div>

            {!rankingData ? (
                <div className="p-8 text-center text-gray-500 bg-white rounded-lg border border-gray-200">
                    <h2 className="text-lg font-semibold mb-2">データがありません</h2>
                    <p>このカテゴリのランキングデータはまだ取得されていません。</p>
                </div>
            ) : (
                <>
                    {/* Snapshot Info */}
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex justify-between items-center">
                        <div>
                            <span className="text-sm text-blue-600 font-medium">
                                {getCategoryName(rankingData.snapshot.categoryId)}
                            </span>
                            <span className="mx-2 text-blue-300">|</span>
                            <span className="text-sm text-blue-600">
                                {rankingData.items.length}件
                            </span>
                        </div>
                        <div className="text-sm text-blue-500">
                            {format(new Date(rankingData.snapshot.capturedAt), 'yyyy/MM/dd HH:mm')} 更新
                        </div>
                    </div>

                    {/* Rankings Table */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
                                    <tr>
                                        <th className="px-4 py-3 w-16">順位</th>
                                        <th className="px-4 py-3 w-20 text-center">変動</th>
                                        <th className="px-4 py-3">商品名</th>
                                        <th className="px-4 py-3 w-32">ショップ</th>
                                        <th className="px-4 py-3 w-24 text-right">還元率</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rankingData.items.map((item) => (
                                        <tr key={item.id} className="border-b hover:bg-gray-50">
                                            <td className="px-4 py-3 font-bold text-gray-900">
                                                #{item.rank}
                                            </td>
                                            <td className="px-4 py-3 w-20 text-center">
                                                {item.rankChange === 'new' ? (
                                                    <span className="inline-block px-2 py-0.5 text-xs font-bold bg-yellow-100 text-yellow-700 rounded">
                                                        NEW
                                                    </span>
                                                ) : item.rankChange !== null && item.rankChange !== 0 ? (
                                                    <span className={`inline-block px-1.5 py-0.5 text-xs font-bold rounded ${
                                                        item.rankChange > 0
                                                            ? 'bg-green-100 text-green-700'
                                                            : 'bg-red-100 text-red-700'
                                                    }`}>
                                                        {item.rankChange > 0 ? `+${item.rankChange}` : item.rankChange}
                                                    </span>
                                                ) : item.rankChange === 0 ? (
                                                    <span className="text-xs text-gray-400">-</span>
                                                ) : null}
                                            </td>
                                            <td className="px-4 py-3">
                                                <a
                                                    href={item.itemUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-gray-900 hover:text-blue-600 line-clamp-2"
                                                >
                                                    {item.title}
                                                </a>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 truncate max-w-[120px]">
                                                {item.shopName}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono">
                                                {item.verifiedRate ? (
                                                    item.verifiedRate.verifiedRate !== item.apiRate ? (
                                                        <span className="bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded">
                                                            {item.verifiedRate.verifiedRate}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-500">
                                                            {item.verifiedRate.verifiedRate}%
                                                        </span>
                                                    )
                                                ) : item.apiRate !== null ? (
                                                    <span className="text-gray-500">
                                                        {item.apiRate}%
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {rankingData.items.length === 0 && (
                            <div className="p-8 text-center text-gray-500">
                                このスナップショットにはアイテムがありません。
                            </div>
                        )}
                    </div>

                    {/* Summary */}
                    <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                        <div className="flex gap-6">
                            <div>
                                <span className="font-medium">総アイテム数:</span> {rankingData.items.length}
                            </div>
                            <div>
                                <span className="font-medium">検証済み:</span>{' '}
                                {rankingData.items.filter(i => i.verifiedRate).length} ({((rankingData.items.filter(i => i.verifiedRate).length / rankingData.items.length) * 100 || 0).toFixed(1)}%)
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
