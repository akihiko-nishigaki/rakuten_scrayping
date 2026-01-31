'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { updateSettingsAction } from '@/app/actions/settings';
import { RAKUTEN_CATEGORIES } from '@/lib/rakuten/categories';

interface SettingsFormProps {
    settings: {
        id: string;
        categories: string[];
        rankingTypes: string[];
        topN: number;
        ingestEnabled: boolean;
        categoryOrder: string[];
    };
}

export function SettingsForm({ settings }: SettingsFormProps) {
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        if (isDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isDropdownOpen]);

    const [formData, setFormData] = useState({
        categories: settings.categories,
        rankingTypes: settings.rankingTypes.join(', '),
        topN: settings.topN,
        ingestEnabled: settings.ingestEnabled,
        categoryOrder: (settings.categoryOrder && settings.categoryOrder.length > 0)
            ? settings.categoryOrder
            : settings.categories, // Default to categories order
    });

    const handleCategoryToggle = (categoryId: string) => {
        setFormData(prev => {
            const isSelected = prev.categories.includes(categoryId);
            let newCategories: string[];
            let newCategoryOrder: string[];

            if (isSelected) {
                newCategories = prev.categories.filter(id => id !== categoryId);
                newCategoryOrder = prev.categoryOrder.filter(id => id !== categoryId);
            } else {
                newCategories = [...prev.categories, categoryId];
                newCategoryOrder = [...prev.categoryOrder, categoryId];
            }

            return { ...prev, categories: newCategories, categoryOrder: newCategoryOrder };
        });
    };

    const getSelectedCategoryNames = () => {
        if (formData.categories.length === 0) return 'カテゴリを選択してください';
        return formData.categories
            .map(id => RAKUTEN_CATEGORIES.find(c => c.id === id)?.nameJa || id)
            .join(', ');
    };

    const moveCategory = (index: number, direction: 'up' | 'down') => {
        const newOrder = [...formData.categoryOrder];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= newOrder.length) return;

        [newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]];
        setFormData({ ...formData, categoryOrder: newOrder });
    };

    const getCategoryName = (categoryId: string) => {
        return RAKUTEN_CATEGORIES.find(c => c.id === categoryId)?.nameJa || categoryId;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        startTransition(async () => {
            try {
                await updateSettingsAction({
                    categories: formData.categories,
                    rankingTypes: formData.rankingTypes.split(',').map(s => s.trim()).filter(Boolean),
                    topN: formData.topN,
                    ingestEnabled: formData.ingestEnabled,
                    categoryOrder: formData.categoryOrder,
                });
                setMessage({ type: 'success', text: 'Settings saved successfully!' });
            } catch (error: any) {
                setMessage({ type: 'error', text: error.message || 'Failed to save settings' });
            }
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {message && (
                <div
                    className={`p-3 rounded-lg text-sm ${
                        message.type === 'success'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                >
                    {message.text}
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categories (カテゴリ)
                </label>
                <div className="relative" ref={dropdownRef}>
                    <button
                        type="button"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-left bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex justify-between items-center"
                    >
                        <span className="truncate text-gray-700">
                            {getSelectedCategoryNames()}
                        </span>
                        <svg
                            className={`w-5 h-5 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {isDropdownOpen && (
                        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {RAKUTEN_CATEGORIES.map(category => (
                                <label
                                    key={category.id}
                                    className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={formData.categories.includes(category.id)}
                                        onChange={() => handleCategoryToggle(category.id)}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">
                                        {category.nameJa}
                                        <span className="text-gray-400 ml-1">({category.id})</span>
                                    </span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                    取得するランキングカテゴリを選択（複数選択可）
                </p>
            </div>

            {/* Category Order */}
            {formData.categoryOrder.length > 0 && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        ダッシュボード表示順
                    </label>
                    <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                        {formData.categoryOrder.map((categoryId, index) => (
                            <div key={categoryId} className="flex items-center justify-between px-3 py-2 bg-white hover:bg-gray-50">
                                <div className="flex items-center gap-3">
                                    <span className="text-gray-400 text-sm w-6">{index + 1}.</span>
                                    <span className="text-sm text-gray-700">{getCategoryName(categoryId)}</span>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        type="button"
                                        onClick={() => moveCategory(index, 'up')}
                                        disabled={index === 0}
                                        className={`p-1 rounded ${
                                            index === 0
                                                ? 'text-gray-300 cursor-not-allowed'
                                                : 'text-gray-500 hover:bg-gray-200'
                                        }`}
                                        title="上に移動"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                        </svg>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => moveCategory(index, 'down')}
                                        disabled={index === formData.categoryOrder.length - 1}
                                        className={`p-1 rounded ${
                                            index === formData.categoryOrder.length - 1
                                                ? 'text-gray-300 cursor-not-allowed'
                                                : 'text-gray-500 hover:bg-gray-200'
                                        }`}
                                        title="下に移動"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                        上下ボタンでダッシュボードでの表示順を変更できます
                    </p>
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ranking Types (comma-separated)
                </label>
                <input
                    type="text"
                    value={formData.rankingTypes}
                    onChange={(e) => setFormData({ ...formData, rankingTypes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="realtime"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Top N Items
                </label>
                <input
                    type="number"
                    min="0"
                    max="120"
                    value={formData.topN}
                    onChange={(e) => setFormData({ ...formData, topN: parseInt(e.target.value) || 0 })}
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                    Number of top-ranked items to fetch per category (0 = all available, max 120)
                </p>
            </div>

            <div className="flex items-center gap-3">
                <input
                    type="checkbox"
                    id="ingestEnabled"
                    checked={formData.ingestEnabled}
                    onChange={(e) => setFormData({ ...formData, ingestEnabled: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="ingestEnabled" className="text-sm text-gray-700">
                    Enable automatic ingest (Cron jobs)
                </label>
            </div>

            <div className="pt-4 border-t border-gray-200">
                <button
                    type="submit"
                    disabled={isPending}
                    className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${
                        isPending
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                >
                    {isPending ? 'Saving...' : 'Save Settings'}
                </button>
            </div>
        </form>
    );
}
