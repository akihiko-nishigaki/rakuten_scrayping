'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { getCategoryName } from '@/lib/rakuten/categories';

interface RankingItem {
    id: string;
    rank: number;
    itemKey: string;
    itemName: string;
    itemUrl: string;
    shopName: string;
    imageUrl: string | null;
    price: number;
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
        <div className="space-y-4">
            {/* Category Tabs */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2">
                <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                        <button
                            key={cat.categoryId}
                            onClick={() => handleCategoryChange(cat.categoryId)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                selectedCategory === cat.categoryId
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
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

            {/* Ranking Table */}
            {!loading && categoryData && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-semibold text-gray-800">
                                {getCategoryName(selectedCategory)}
                            </h2>
                            <span className="text-sm text-gray-500">
                                {format(new Date(categoryData.snapshot.capturedAt), 'yyyy/MM/dd HH:mm')} 更新
                            </span>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                                        順位
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                                        変動
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        商品名
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                                        ショップ
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                                        価格
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                                        料率
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {categoryData.items.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                                                item.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                                                item.rank === 2 ? 'bg-gray-200 text-gray-600' :
                                                item.rank === 3 ? 'bg-orange-100 text-orange-700' :
                                                'bg-gray-100 text-gray-600'
                                            }`}>
                                                {item.rank}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            {item.rankChange === 'new' ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                    NEW
                                                </span>
                                            ) : item.rankChange !== null && item.rankChange !== 0 ? (
                                                <span className={`inline-flex items-center text-sm font-medium ${
                                                    item.rankChange > 0 ? 'text-red-600' : 'text-blue-600'
                                                }`}>
                                                    {item.rankChange > 0 ? (
                                                        <>
                                                            <svg className="w-4 h-4 mr-0.5" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                            {item.rankChange}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <svg className="w-4 h-4 mr-0.5" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                            {Math.abs(item.rankChange)}
                                                        </>
                                                    )}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <a
                                                href={item.itemUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm text-gray-900 hover:text-blue-600 line-clamp-2"
                                            >
                                                {item.itemName}
                                            </a>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                            {item.shopName}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                                            {item.price.toLocaleString()}円
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right">
                                            {item.verifiedRate ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                    {item.verifiedRate.verifiedRate}%
                                                </span>
                                            ) : item.apiRate !== null ? (
                                                <span className="text-sm text-gray-600">{item.apiRate}%</span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
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
