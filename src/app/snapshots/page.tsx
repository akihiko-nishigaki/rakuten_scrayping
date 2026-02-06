import { getSnapshotsAction, getSnapshotStatsAction } from '@/app/actions/snapshot';
import { formatJST, formatJSTShort } from '@/lib/utils/dateFormat';
import Link from 'next/link';
import { ScrapeButton } from './ScrapeButton';
import { getCategoryName } from '@/lib/rakuten/categories';

export const dynamic = 'force-dynamic';

interface PageProps {
    searchParams: Promise<{ page?: string; categoryId?: string }>;
}

export default async function SnapshotsPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const page = parseInt(params.page || '1', 10);
    const categoryId = params.categoryId;
    const limit = 20;
    const offset = (page - 1) * limit;

    const [{ snapshots, total, hasMore }, stats] = await Promise.all([
        getSnapshotsAction({ categoryId, limit, offset }),
        getSnapshotStatsAction(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Snapshot History</h1>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                    <div className="text-gray-500 text-sm font-medium">Total Snapshots</div>
                    <div className="text-2xl font-bold mt-1 text-gray-900">{stats.total}</div>
                </div>
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                    <div className="text-gray-500 text-sm font-medium">Successful</div>
                    <div className="text-2xl font-bold mt-1 text-green-600">{stats.successCount}</div>
                </div>
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                    <div className="text-gray-500 text-sm font-medium">Errors</div>
                    <div className="text-2xl font-bold mt-1 text-red-600">{stats.errorCount}</div>
                </div>
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                    <div className="text-gray-500 text-sm font-medium">Last Captured</div>
                    <div className="text-lg font-bold mt-1 text-gray-900">
                        {stats.latestCapturedAt
                            ? formatJSTShort(stats.latestCapturedAt)
                            : '-'}
                    </div>
                </div>
            </div>

            {/* Category Filter */}
            {stats.categoryBreakdown.length > 1 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="text-sm font-medium text-gray-700 mb-2">カテゴリで絞り込み</div>
                    <div className="flex gap-2 flex-wrap">
                        <Link
                            href="/snapshots"
                            className={`px-3 py-1.5 rounded-full text-sm ${
                                !categoryId
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            すべて ({stats.total})
                        </Link>
                        {stats.categoryBreakdown.map((cat) => (
                            <Link
                                key={cat.categoryId}
                                href={`/snapshots?categoryId=${cat.categoryId}`}
                                className={`px-3 py-1.5 rounded-full text-sm ${
                                    categoryId === cat.categoryId
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {getCategoryName(cat.categoryId)} ({cat.count})
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Snapshots Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
                            <tr>
                                <th className="px-4 py-3">Captured At</th>
                                <th className="px-4 py-3">カテゴリ</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3 text-center">Items</th>
                                <th className="px-4 py-3 text-center">Status</th>
                                <th className="px-4 py-3">Error</th>
                                <th className="px-4 py-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {snapshots.map((snapshot) => (
                                <tr key={snapshot.id} className="border-b hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-gray-900">
                                        {formatJST(snapshot.capturedAt)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                                            {getCategoryName(snapshot.categoryId)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">
                                        {snapshot.rankingType}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="font-medium">{snapshot._count.items}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span
                                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                snapshot.status === 'SUCCESS'
                                                    ? 'bg-green-100 text-green-700'
                                                    : snapshot.status === 'PARTIAL'
                                                    ? 'bg-yellow-100 text-yellow-700'
                                                    : 'bg-red-100 text-red-700'
                                            }`}
                                        >
                                            {snapshot.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">
                                        {snapshot.errorMessage || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-center space-x-2">
                                        <Link
                                            href={`/rankings?snapshotId=${snapshot.id}`}
                                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                        >
                                            View Rankings
                                        </Link>
                                        <ScrapeButton
                                            snapshotId={snapshot.id}
                                            itemCount={snapshot._count.items}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {snapshots.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                        No snapshots found.
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center gap-2">
                    {page > 1 && (
                        <Link
                            href={`/snapshots?page=${page - 1}${categoryId ? `&categoryId=${categoryId}` : ''}`}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                        >
                            Previous
                        </Link>
                    )}
                    <div className="px-4 py-2 text-sm text-gray-500">
                        Page {page} of {totalPages}
                    </div>
                    {hasMore && (
                        <Link
                            href={`/snapshots?page=${page + 1}${categoryId ? `&categoryId=${categoryId}` : ''}`}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                        >
                            Next
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}
