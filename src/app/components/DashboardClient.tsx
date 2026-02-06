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
    const colorClass = rank === 1 ? 'bg-yellow-100 text-yellow-700' :
        rank === 2 ? 'bg-gray-200 text-gray-600' :
        rank === 3 ? 'bg-orange-100 text-orange-700' :
        'bg-gray-100 text-gray-600';

    return (
        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold ${colorClass}`}>
            {rank}
        </span>
    );
}

function RankChange({ change }: { change: number | 'new' | null }) {
    if (change === 'new') {
        return (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                NEW
            </span>
        );
    }
    if (change !== null && change !== 0) {
        return (
            <span className={`inline-flex items-center text-xs font-medium ${change > 0 ? 'text-red-600' : 'text-blue-600'}`}>
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

// 金額をフォーマット（カンマ区切り）
function formatPrice(price: number | null): string {
    if (price === null) return '-';
    return price.toLocaleString('ja-JP');
}

// ポイント計算（金額 × 料率）
function calculatePoints(item: RankingItem): number | null {
    const rate = item.verifiedRate?.verifiedRate ?? item.apiRate;
    if (item.price === null || rate === null) return null;
    return Math.floor(item.price * rate / 100);
}

function RateBadge({ item }: { item: RankingItem }) {
    const apiRate = item.apiRate;
    const verifiedRate = item.verifiedRate?.verifiedRate;

    // 特別料率がある場合
    if (verifiedRate !== undefined && verifiedRate !== null) {
        // 通常料率と異なる場合のみ緑色ハイライト
        if (apiRate !== null && verifiedRate !== apiRate) {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    {verifiedRate}%
                </span>
            );
        }
        // 同じ場合は通常表示
        return <span className="text-sm text-gray-600">{verifiedRate}%</span>;
    }

    // 通常料率のみの場合
    if (apiRate !== null) {
        return <span className="text-sm text-gray-600">{apiRate}%</span>;
    }

    return <span className="text-gray-400 text-sm">-</span>;
}

export default function DashboardClient({
    categories,
    initialData,
    defaultCategoryId,
}: DashboardClientProps) {
    const [selectedCategory, setSelectedCategory] = useState(defaultCategoryId);
    const [categoryData, setCategoryData] = useState<CategoryData | null>(initialData);
    const [loading, setLoading] = useState(false);

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

    return (
        <div className="space-y-3">
            {/* Category Tabs - Horizontal scroll on mobile */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 overflow-x-auto">
                <div className="flex gap-2 min-w-max">
                    {categories.map((cat) => (
                        <button
                            key={cat.categoryId}
                            onClick={() => handleCategoryChange(cat.categoryId)}
                            disabled={loading}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                                selectedCategory === cat.categoryId
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            )}

            {/* Ranking Content */}
            {!loading && categoryData && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    {/* Header */}
                    <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                        <div className="flex justify-between items-center">
                            <h2 className="text-base font-semibold text-gray-800">
                                {getCategoryName(selectedCategory)}
                            </h2>
                            <span className="text-xs text-gray-500">
                                {formatJSTShort(categoryData.snapshot.capturedAt)}
                            </span>
                        </div>
                    </div>

                    {/* Mobile: Card Layout */}
                    <div className="md:hidden divide-y divide-gray-100">
                        {categoryData.items.map((item) => {
                            const points = calculatePoints(item);
                            return (
                                <div key={item.id} className="p-3">
                                    <div className="flex items-start gap-3">
                                        <RankBadge rank={item.rank} />
                                        {/* 商品画像 */}
                                        {item.imageUrl && (
                                            <a href={item.itemUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                                                <img
                                                    src={item.imageUrl}
                                                    alt={item.title}
                                                    className="w-16 h-16 object-contain rounded border border-gray-200"
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
                                                className="text-sm text-gray-900 hover:text-blue-600 line-clamp-2 block"
                                            >
                                                {item.title}
                                            </a>
                                            <div className="flex items-center gap-3 mt-1 text-xs">
                                                <span className="text-gray-500">{item.shopName}</span>
                                                {item.price !== null && (
                                                    <span className="font-medium text-gray-700">¥{formatPrice(item.price)}</span>
                                                )}
                                                {points !== null && (
                                                    <span className="text-orange-600 font-medium">{points.toLocaleString()}pt</span>
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
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-14">
                                        順位
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-16">
                                        変動
                                    </th>
                                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase w-16">
                                        画像
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                        商品名
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-28">
                                        ショップ
                                    </th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">
                                        金額
                                    </th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-16">
                                        料率
                                    </th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">
                                        ポイント
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {categoryData.items.map((item) => {
                                    const points = calculatePoints(item);
                                    return (
                                        <tr key={item.id} className="hover:bg-gray-50">
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <RankBadge rank={item.rank} />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <RankChange change={item.rankChange} />
                                                {item.rankChange === null || item.rankChange === 0 ? (
                                                    <span className="text-gray-400">-</span>
                                                ) : null}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                {item.imageUrl ? (
                                                    <a href={item.itemUrl} target="_blank" rel="noopener noreferrer">
                                                        <img
                                                            src={item.imageUrl}
                                                            alt={item.title}
                                                            className="w-12 h-12 object-contain rounded border border-gray-200"
                                                        />
                                                    </a>
                                                ) : (
                                                    <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">
                                                        No img
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2">
                                                <a
                                                    href={item.itemUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm text-gray-900 hover:text-blue-600 line-clamp-2"
                                                >
                                                    {item.title}
                                                </a>
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                                {item.shopName}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-right text-sm text-gray-700">
                                                {item.price !== null ? `¥${formatPrice(item.price)}` : '-'}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-right">
                                                <RateBadge item={item} />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium text-orange-600">
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
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
                    <p>このカテゴリのデータがありません</p>
                </div>
            )}
        </div>
    );
}
