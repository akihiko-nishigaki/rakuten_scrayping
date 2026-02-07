'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { getCategoryName } from '@/lib/rakuten/categories';

// Format date in Japan timezone
function formatJSTShort(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const jstDate = toZonedTime(d, 'Asia/Tokyo');
    return format(jstDate, 'MM/dd HH:mm');
}

interface RankingItem {
    id: string;
    rank: number;
    itemKey: string;
    title: string;
    itemUrl: string;
    shopName: string;
    price: number | null;
    imageUrl: string | null;
    apiRate: number | null;
    verifiedRate: { verifiedRate: number } | null;
    rankChange: number | 'new' | null;
}

interface CategoryData {
    categoryId: string;
    snapshot: {
        id: string;
        capturedAt: Date;
    };
    items: RankingItem[];
}

interface DashboardClientProps {
    categories: { categoryId: string; name: string }[];
    initialData: CategoryData | null;
    defaultCategoryId: string;
}

function RankBadge({ rank }: { rank: number }) {
    if (rank === 1) {
        return (
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold bg-gradient-to-br from-yellow-300 to-amber-500 text-white shadow-sm">
                {rank}
            </span>
        );
    }
    if (rank === 2) {
        return (
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold bg-gradient-to-br from-gray-300 to-gray-400 text-white shadow-sm">
                {rank}
            </span>
        );
    }
    if (rank === 3) {
        return (
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold bg-gradient-to-br from-orange-300 to-orange-500 text-white shadow-sm">
                {rank}
            </span>
        );
    }
    return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold bg-gray-100 text-gray-500">
            {rank}
        </span>
    );
}

function RankChange({ change }: { change: number | 'new' | null }) {
    if (change === 'new') {
        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r from-emerald-400 to-teal-500 text-white">
                NEW
            </span>
        );
    }
    if (change !== null && change !== 0) {
        return (
            <span className={`inline-flex items-center text-xs font-semibold ${change > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {change > 0 ? (
                    <>
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                        {change}
                    </>
                ) : (
                    <>
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {Math.abs(change)}
                    </>
                )}
            </span>
        );
    }
    return null;
}

function formatPrice(price: number | null): string {
    if (price === null) return '-';
    return price.toLocaleString('ja-JP');
}

function calculatePoints(item: RankingItem): number | null {
    const rate = item.verifiedRate?.verifiedRate ?? item.apiRate;
    if (item.price === null || rate === null) return null;
    return Math.floor(item.price * rate / 100);
}

function RateBadge({ item }: { item: RankingItem }) {
    const apiRate = item.apiRate;
    const verifiedRate = item.verifiedRate?.verifiedRate;

    if (verifiedRate !== undefined && verifiedRate !== null) {
        if (apiRate !== null && verifiedRate !== apiRate) {
            return (
                <span className="badge-special-rate">
                    {verifiedRate}%
                </span>
            );
        }
        return <span className="text-sm text-gray-600">{verifiedRate}%</span>;
    }

    if (apiRate !== null) {
        return <span className="text-sm text-gray-600">{apiRate}%</span>;
    }

    return <span className="text-gray-300 text-sm">-</span>;
}

type SortOption = 'rank' | 'price' | 'rate' | 'points';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: 'rank', label: 'ランキング順' },
    { value: 'price', label: '金額が高い順' },
    { value: 'rate', label: '料率が高い順' },
    { value: 'points', label: 'ポイントが高い順' },
];

function getEffectiveRate(item: RankingItem): number {
    return item.verifiedRate?.verifiedRate ?? item.apiRate ?? 0;
}

// Highlight cards data
function getHighlightCards(items: RankingItem[]) {
    const highRateItems = items.filter(i => getEffectiveRate(i) >= 4).length;
    const rankUpItems = items.filter(i => typeof i.rankChange === 'number' && i.rankChange < 0).length;
    const newItems = items.filter(i => i.rankChange === 'new').length;
    return { highRateItems, rankUpItems, newItems };
}

// Top picks by rate
function getTopPicks(items: RankingItem[], count: number = 3): RankingItem[] {
    return [...items]
        .sort((a, b) => getEffectiveRate(b) - getEffectiveRate(a))
        .filter(i => getEffectiveRate(i) > 0)
        .slice(0, count);
}

export default function DashboardClient({
    categories,
    initialData,
    defaultCategoryId,
}: DashboardClientProps) {
    const [selectedCategory, setSelectedCategory] = useState(defaultCategoryId);
    const [categoryData, setCategoryData] = useState<CategoryData | null>(initialData);
    const [loading, setLoading] = useState(false);
    const [sortBy, setSortBy] = useState<SortOption>('rank');

    const sortedItems = categoryData?.items ? [...categoryData.items].sort((a, b) => {
        switch (sortBy) {
            case 'price':
                if (a.price === null && b.price === null) return 0;
                if (a.price === null) return 1;
                if (b.price === null) return -1;
                return b.price - a.price;
            case 'rate':
                return getEffectiveRate(b) - getEffectiveRate(a);
            case 'points':
                const pointsA = calculatePoints(a);
                const pointsB = calculatePoints(b);
                if (pointsA === null && pointsB === null) return 0;
                if (pointsA === null) return 1;
                if (pointsB === null) return -1;
                return pointsB - pointsA;
            case 'rank':
            default:
                return a.rank - b.rank;
        }
    }) : [];

    const handleCategoryChange = async (categoryId: string) => {
        if (categoryId === selectedCategory) return;

        setSelectedCategory(categoryId);
        setLoading(true);

        try {
            const response = await fetch(`/api/dashboard/category?categoryId=${categoryId}`);
            if (response.ok) {
                const data = await response.json();
                setCategoryData(data);
            }
        } catch (error) {
            console.error('Failed to fetch category data:', error);
        } finally {
            setLoading(false);
        }
    };

    const highlights = categoryData?.items ? getHighlightCards(categoryData.items) : null;
    const topPicks = categoryData?.items ? getTopPicks(categoryData.items) : [];

    return (
        <div className="space-y-4">
            {/* Highlight Cards */}
            {highlights && (
                <div className="grid grid-cols-3 gap-3">
                    <div className="card-warm p-3 sm:p-4 text-center">
                        <div className="text-2xl sm:text-3xl font-bold text-pink-500">{highlights.highRateItems}</div>
                        <div className="text-[11px] sm:text-xs text-gray-500 mt-1">高料率アイテム</div>
                    </div>
                    <div className="card-warm p-3 sm:p-4 text-center">
                        <div className="text-2xl sm:text-3xl font-bold text-emerald-500">{highlights.rankUpItems}</div>
                        <div className="text-[11px] sm:text-xs text-gray-500 mt-1">ランクアップ</div>
                    </div>
                    <div className="card-warm p-3 sm:p-4 text-center">
                        <div className="text-2xl sm:text-3xl font-bold text-purple-500">{highlights.newItems}</div>
                        <div className="text-[11px] sm:text-xs text-gray-500 mt-1">新着商品</div>
                    </div>
                </div>
            )}

            {/* Top Picks (high rate items) */}
            {topPicks.length > 0 && (
                <div className="card-warm p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        おすすめ高料率アイテム
                    </h3>
                    <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
                        {topPicks.map((item) => {
                            const points = calculatePoints(item);
                            return (
                                <a
                                    key={item.id}
                                    href={item.itemUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-shrink-0 w-36 sm:w-44 rounded-xl border border-pink-100 bg-gradient-to-b from-white to-pink-50/30 p-3 hover:shadow-md transition-shadow group"
                                >
                                    {item.imageUrl && (
                                        <div className="w-full aspect-square rounded-lg overflow-hidden bg-gray-50 mb-2">
                                            <img
                                                src={item.imageUrl}
                                                alt={item.title}
                                                className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                                            />
                                        </div>
                                    )}
                                    <div className="text-xs text-gray-700 line-clamp-2 leading-relaxed mb-2">
                                        {item.title}
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="badge-special-rate">
                                            {getEffectiveRate(item)}%
                                        </span>
                                        {points !== null && (
                                            <span className="text-xs font-bold text-amber-500">
                                                {points.toLocaleString()}pt
                                            </span>
                                        )}
                                    </div>
                                </a>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Category Tabs */}
            <div className="card-warm p-2 overflow-x-auto">
                <div className="flex gap-1.5 min-w-max">
                    {categories.map((cat) => (
                        <button
                            key={cat.categoryId}
                            onClick={() => handleCategoryChange(cat.categoryId)}
                            disabled={loading}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                                selectedCategory === cat.categoryId
                                    ? 'btn-gradient text-white shadow-none'
                                    : 'bg-gray-50 text-gray-600 hover:bg-pink-50 hover:text-pink-600'
                            } ${loading ? 'opacity-70 cursor-wait' : ''}`}
                        >
                            {loading && selectedCategory === cat.categoryId && (
                                <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            )}
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Loading State */}
            {loading && (
                <div className="flex justify-center py-12">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 rounded-full border-3 border-pink-200 border-t-pink-500 animate-spin" />
                        <span className="text-xs text-gray-400">読み込み中...</span>
                    </div>
                </div>
            )}

            {/* Ranking Content */}
            {!loading && categoryData && (
                <div className="card-warm overflow-hidden">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-pink-50 bg-gradient-to-r from-pink-50/50 to-purple-50/50">
                        <div className="flex justify-between items-center flex-wrap gap-2">
                            <h2 className="text-base font-semibold text-gray-800">
                                {getCategoryName(selectedCategory)}
                            </h2>
                            <div className="flex items-center gap-3">
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                                    className="text-xs border border-pink-200 rounded-lg px-2 py-1 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-pink-200"
                                >
                                    {SORT_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                <span className="text-[11px] text-gray-400">
                                    {formatJSTShort(categoryData.snapshot.capturedAt)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Mobile: Card Layout */}
                    <div className="md:hidden divide-y divide-pink-50">
                        {sortedItems.map((item) => {
                            const points = calculatePoints(item);
                            const hasHighRate = getEffectiveRate(item) >= 4;
                            return (
                                <div key={item.id} className={`p-3 ${hasHighRate ? 'bg-pink-50/30' : ''}`}>
                                    <div className="flex items-start gap-3">
                                        <RankBadge rank={item.rank} />
                                        {item.imageUrl && (
                                            <a href={item.itemUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                                                <img
                                                    src={item.imageUrl}
                                                    alt={item.title}
                                                    className="w-16 h-16 object-contain rounded-lg border border-pink-100"
                                                />
                                            </a>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <RankChange change={item.rankChange} />
                                                <RateBadge item={item} />
                                            </div>
                                            <a
                                                href={item.itemUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm text-gray-800 hover:text-pink-600 line-clamp-2 block transition-colors"
                                            >
                                                {item.title}
                                            </a>
                                            <div className="flex items-center gap-3 mt-1.5 text-xs">
                                                <span className="text-gray-400">{item.shopName}</span>
                                                {item.price !== null && (
                                                    <span className="font-medium text-gray-600">&yen;{formatPrice(item.price)}</span>
                                                )}
                                                {points !== null && (
                                                    <span className="font-bold text-amber-500">{points.toLocaleString()}pt</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Desktop: Table Layout */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="min-w-full divide-y divide-pink-100">
                            <thead className="bg-gradient-to-r from-pink-50/60 to-purple-50/60">
                                <tr>
                                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase w-14">
                                        順位
                                    </th>
                                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase w-16">
                                        変動
                                    </th>
                                    <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-gray-500 uppercase w-16">
                                        画像
                                    </th>
                                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase">
                                        商品名
                                    </th>
                                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase w-28">
                                        ショップ
                                    </th>
                                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase w-24">
                                        金額
                                    </th>
                                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase w-16">
                                        料率
                                    </th>
                                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase w-24">
                                        ポイント
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-pink-50">
                                {sortedItems.map((item) => {
                                    const points = calculatePoints(item);
                                    const hasHighRate = getEffectiveRate(item) >= 4;
                                    return (
                                        <tr key={item.id} className={`hover:bg-pink-50/40 transition-colors ${hasHighRate ? 'border-l-2 border-l-pink-400' : ''}`}>
                                            <td className="px-3 py-2.5 whitespace-nowrap">
                                                <RankBadge rank={item.rank} />
                                            </td>
                                            <td className="px-3 py-2.5 whitespace-nowrap">
                                                <RankChange change={item.rankChange} />
                                                {item.rankChange === null || item.rankChange === 0 ? (
                                                    <span className="text-gray-300">-</span>
                                                ) : null}
                                            </td>
                                            <td className="px-3 py-2.5 whitespace-nowrap">
                                                {item.imageUrl ? (
                                                    <a href={item.itemUrl} target="_blank" rel="noopener noreferrer">
                                                        <img
                                                            src={item.imageUrl}
                                                            alt={item.title}
                                                            className="w-12 h-12 object-contain rounded-lg border border-pink-100"
                                                        />
                                                    </a>
                                                ) : (
                                                    <div className="w-12 h-12 bg-pink-50 rounded-lg flex items-center justify-center text-gray-300 text-xs">
                                                        No img
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <a
                                                    href={item.itemUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm text-gray-800 hover:text-pink-600 line-clamp-2 transition-colors"
                                                >
                                                    {item.title}
                                                </a>
                                            </td>
                                            <td className="px-3 py-2.5 whitespace-nowrap text-sm text-gray-400">
                                                {item.shopName}
                                            </td>
                                            <td className="px-3 py-2.5 whitespace-nowrap text-right text-sm text-gray-600">
                                                {item.price !== null ? `\u00a5${formatPrice(item.price)}` : '-'}
                                            </td>
                                            <td className="px-3 py-2.5 whitespace-nowrap text-right">
                                                <RateBadge item={item} />
                                            </td>
                                            <td className="px-3 py-2.5 whitespace-nowrap text-right text-sm font-bold text-amber-500">
                                                {points !== null ? `${points.toLocaleString()}pt` : '-'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* No Data State */}
            {!loading && !categoryData && (
                <div className="card-warm p-12 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-pink-50 mb-4">
                        <svg className="w-8 h-8 text-pink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                    </div>
                    <p className="text-gray-500 text-sm">このカテゴリのデータがありません</p>
                </div>
            )}
        </div>
    );
}
