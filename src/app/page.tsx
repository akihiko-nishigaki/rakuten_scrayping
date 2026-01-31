import { getCategorySnapshotsAction } from '@/app/actions/ranking';
import { getSettingsAction } from '@/app/actions/settings';
import Link from 'next/link';
import { format } from 'date-fns';
import { getCategoryName } from '@/lib/rakuten/categories';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [categorySnapshots, settings] = await Promise.all([
    getCategorySnapshotsAction(3),
    getSettingsAction(),
  ]);

  if (categorySnapshots.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <h2 className="text-2xl font-semibold mb-2">データがありません</h2>
        <p>データ取り込みジョブを実行してランキングを取得してください。</p>
      </div>
    );
  }

  // Sort by categoryOrder from settings
  const categoryOrder = settings.categoryOrder || [];
  const sortedSnapshots = [...categorySnapshots].sort((a, b) => {
    const indexA = categoryOrder.indexOf(a.categoryId);
    const indexB = categoryOrder.indexOf(b.categoryId);
    // Categories not in order list go to the end
    const orderA = indexA === -1 ? 999 : indexA;
    const orderB = indexB === -1 ? 999 : indexB;
    return orderA - orderB;
  });

  return (
    <div className="space-y-6">
      {/* Category Cards */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">カテゴリ別最新データ</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categorySnapshots.map(({ categoryId, snapshot, items }) => (
            <div key={categoryId} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              {/* Card Header */}
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-800">{getCategoryName(categoryId)}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {format(new Date(snapshot.capturedAt), 'MM/dd HH:mm')} 更新
                    </p>
                  </div>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    {snapshot.fetchedCount}件
                  </span>
                </div>
              </div>

              {/* Top 3 Items */}
              <div className="divide-y divide-gray-100">
                {items.map((item, idx) => (
                  <div key={item.id} className="px-4 py-2 flex items-start gap-3">
                    <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                      idx === 1 ? 'bg-gray-200 text-gray-600' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {item.rank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <a
                        href={item.itemUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-gray-700 hover:text-blue-600 line-clamp-2"
                        title={item.title}
                      >
                        {item.title}
                      </a>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400">{item.shopName}</span>
                        {item.verifiedRate ? (
                          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                            {item.verifiedRate.verifiedRate}%
                          </span>
                        ) : item.apiRate !== null ? (
                          <span className="text-xs text-gray-500">{item.apiRate}%</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Card Footer */}
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                <Link
                  href={`/rankings?snapshotId=${snapshot.id}`}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  すべて表示 &rarr;
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
