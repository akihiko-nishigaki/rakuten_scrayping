import { getSnapshotListAction, getRankingItemsAction } from '@/app/actions/ranking';
import { format } from 'date-fns';
import Link from 'next/link';
import { getCategoryName } from '@/lib/rakuten/categories';

export const dynamic = 'force-dynamic';

interface PageProps {
    searchParams: Promise<{ snapshotId?: string }>;
}

export default async function RankingsPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const snapshots = await getSnapshotListAction();

    if (snapshots.length === 0) {
        return (
            <div className="p-8 text-center text-gray-500">
                <h2 className="text-2xl font-semibold mb-2">No Rankings Yet</h2>
                <p>Run the ingest job to fetch initial rankings.</p>
            </div>
        );
    }

    const selectedSnapshotId = params.snapshotId || snapshots[0]?.id;
    const selectedSnapshot = snapshots.find(s => s.id === selectedSnapshotId);
    const items = selectedSnapshotId ? await getRankingItemsAction(selectedSnapshotId) : [];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Rankings History</h1>
            </div>

            {/* Snapshot Selector */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Snapshot
                </label>
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {snapshots.slice(0, 10).map((snapshot) => (
                        <Link
                            key={snapshot.id}
                            href={`/rankings?snapshotId=${snapshot.id}`}
                            className={`flex-shrink-0 px-4 py-2 rounded-lg border text-sm ${
                                snapshot.id === selectedSnapshotId
                                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                        >
                            <div className="font-medium">
                                {format(new Date(snapshot.capturedAt), 'MM/dd HH:mm')}
                            </div>
                            <div className="text-xs opacity-75">
                                {getCategoryName(snapshot.categoryId)} ({snapshot._count.items} items)
                            </div>
                        </Link>
                    ))}
                    {snapshots.length > 10 && (
                        <Link
                            href="/snapshots"
                            className="flex-shrink-0 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-500 hover:border-gray-300 flex items-center"
                        >
                            View all →
                        </Link>
                    )}
                </div>
            </div>

            {/* Snapshot Info */}
            {selectedSnapshot && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex justify-between items-center">
                    <div>
                        <span className="text-sm text-blue-600 font-medium">
                            カテゴリ: {getCategoryName(selectedSnapshot.categoryId)}
                        </span>
                        <span className="mx-2 text-blue-300">|</span>
                        <span className="text-sm text-blue-600">
                            Type: {selectedSnapshot.rankingType}
                        </span>
                        <span className="mx-2 text-blue-300">|</span>
                        <span className="text-sm text-blue-600">
                            Status: <span className={selectedSnapshot.status === 'SUCCESS' ? 'text-green-600' : 'text-red-600'}>{selectedSnapshot.status}</span>
                        </span>
                    </div>
                    <div className="text-sm text-blue-500">
                        {format(new Date(selectedSnapshot.capturedAt), 'yyyy/MM/dd HH:mm:ss')}
                    </div>
                </div>
            )}

            {/* Rankings Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
                            <tr>
                                <th className="px-4 py-3 w-16">Rank</th>
                                <th className="px-4 py-3">Item</th>
                                <th className="px-4 py-3 w-24">Shop</th>
                                <th className="px-4 py-3 w-24 text-right">Rate</th>
                                <th className="px-4 py-3 w-24 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item) => (
                                <tr key={item.id} className="border-b hover:bg-gray-50">
                                    <td className="px-4 py-3 font-bold text-gray-900">
                                        #{item.rank}
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
                                    <td className="px-4 py-3 text-center">
                                        <Link
                                            href={`/verification/${encodeURIComponent(item.itemKey)}`}
                                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                        >
                                            Verify
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {items.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                        No items in this snapshot.
                    </div>
                )}
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                <div className="flex gap-6">
                    <div>
                        <span className="font-medium">Total Items:</span> {items.length}
                    </div>
                    <div>
                        <span className="font-medium">Verified:</span>{' '}
                        {items.filter(i => i.verifiedRate).length} ({((items.filter(i => i.verifiedRate).length / items.length) * 100 || 0).toFixed(1)}%)
                    </div>
                </div>
            </div>
        </div>
    );
}
