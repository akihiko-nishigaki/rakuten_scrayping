import { getLatestRankingAction } from '@/app/actions/ranking';
import { getVerificationQueueAction } from '@/app/actions/verification';
import Link from 'next/link';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const rankingData = await getLatestRankingAction();
  const queueTasks = await getVerificationQueueAction(5);

  const pendingCount = queueTasks.length; // Approximate for now, real count needs separate query if needed exact total

  if (!rankingData) {
    return (
      <div className="p-8 text-center text-gray-500">
        <h2 className="text-2xl font-semibold mb-2">No Data Yet</h2>
        <p>Run the ingest job to fetch initial rankings.</p>
        {/* Helper button for manual trigger if we had a client component here */}
      </div>
    );
  }

  const { snapshot, items } = rankingData;

  const verifiedCount = items.filter(i => i.verifiedRate).length;
  const coverage = items.length > 0 ? (verifiedCount / items.length) * 100 : 0;

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="text-gray-500 text-sm font-medium">Latest Snapshot</div>
          <div className="text-xl font-bold mt-1 text-gray-900">
            {format(new Date(snapshot.capturedAt), "MM/dd HH:mm")}
          </div>
          <div className="mt-2 text-xs text-blue-600">
            {items.length} items
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="text-gray-500 text-sm font-medium">Queue</div>
          <div className="text-2xl font-bold mt-1 text-indigo-600">
            {pendingCount}+ <span className="text-sm font-normal text-gray-400">pending</span>
          </div>
          <div className="mt-2">
            <Link href="/verification/queue" className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">
              Start Verification &rarr;
            </Link>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="text-gray-500 text-sm font-medium">Coverage (Top {snapshot.fetchedCount})</div>
          <div className="text-2xl font-bold mt-1 text-green-600">
            {coverage.toFixed(1)}%
          </div>
          <div className="mt-2 text-xs text-gray-400">
            Certified Rates
          </div>
        </div>
      </div>

      {/* Main Table Preview */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-semibold text-gray-800">Rankings (Top 10 Preview)</h3>
          <Link href={`/rankings?snapshotId=${snapshot.id}`} className="text-sm text-blue-600 hover:underline">
            View All
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="bg-gray-50 text-gray-700 uppercase">
              <tr>
                <th className="px-6 py-3">Rank</th>
                <th className="px-6 py-3">Item</th>
                <th className="px-6 py-3">Rate</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 10).map((item) => (
                <tr key={item.id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">#{item.rank}</td>
                  <td className="px-6 py-4 max-w-xs truncate">
                    <a href={item.itemUrl} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                      {item.title}
                    </a>
                  </td>
                  <td className="px-6 py-4 font-mono">
                    {item.verifiedRate ? (
                      item.verifiedRate.verifiedRate !== item.apiRate ? (
                        <span className="bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded">{item.verifiedRate.verifiedRate}%</span>
                      ) : (
                        <span className="text-gray-500">{item.verifiedRate.verifiedRate}%</span>
                      )
                    ) : item.apiRate !== null ? (
                      <span className="text-gray-500">{item.apiRate}%</span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
