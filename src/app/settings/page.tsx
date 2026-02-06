import { getSettingsAction, getCategoriesWithStatsAction } from '@/app/actions/settings';
import { formatJST } from '@/lib/utils/dateFormat';
import { SettingsForm } from './SettingsForm';
import { getCategoryName } from '@/lib/rakuten/categories';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
    const [settings, categoriesWithStats] = await Promise.all([
        getSettingsAction(),
        getCategoriesWithStatsAction(),
    ]);

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
            </div>

            {/* Current Status */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Ingest Status</h2>
                <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${settings.ingestEnabled ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-gray-700">
                        Auto-ingest is <strong>{settings.ingestEnabled ? 'enabled' : 'disabled'}</strong>
                    </span>
                </div>
            </div>

            {/* Settings Form */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuration</h2>
                <SettingsForm settings={settings} />
            </div>

            {/* Categories */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Tracked Categories</h2>

                {categoriesWithStats.length === 0 ? (
                    <p className="text-gray-500">No categories configured.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
                                <tr>
                                    <th className="px-4 py-3">カテゴリ</th>
                                    <th className="px-4 py-3 text-center">Snapshots</th>
                                    <th className="px-4 py-3">Last Captured</th>
                                </tr>
                            </thead>
                            <tbody>
                                {categoriesWithStats.map((cat) => (
                                    <tr key={cat.categoryId} className="border-b">
                                        <td className="px-4 py-3">{getCategoryName(cat.categoryId)}</td>
                                        <td className="px-4 py-3 text-center">{cat.snapshotCount}</td>
                                        <td className="px-4 py-3">
                                            {cat.lastCaptured
                                                ? formatJST(cat.lastCaptured, 'yyyy/MM/dd HH:mm')
                                                : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="mt-4 text-sm text-gray-500">
                    <p>
                        To add or remove categories, update the categories list below and save.
                    </p>
                </div>
            </div>

            {/* API Configuration */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">API Configuration</h2>
                <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-600">Rakuten App ID</span>
                        <span className="font-mono text-gray-900">
                            {settings.rakutenAppId ? '••••••••' + settings.rakutenAppId.slice(-4) : 'Not configured (using env)'}
                        </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-600">Ranking Types</span>
                        <span className="font-mono text-gray-900">{settings.rankingTypes.join(', ')}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-600">Items per Category (TopN)</span>
                        <span className="font-mono text-gray-900">{settings.topN}</span>
                    </div>
                </div>
            </div>

            {/* Manual Trigger */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-yellow-800 mb-2">Manual Ingest</h2>
                <p className="text-sm text-yellow-700 mb-4">
                    Trigger a manual ingest to fetch the latest ranking data from Rakuten API.
                </p>
                <a
                    href="/api/ingest"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700"
                >
                    Trigger Ingest (GET /api/ingest)
                </a>
            </div>
        </div>
    );
}
