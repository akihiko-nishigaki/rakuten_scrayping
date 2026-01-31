import { getLatestRankingAction, getCategorySnapshotsAction } from '@/app/actions/ranking';
import { getCategoryName } from '@/lib/rakuten/categories';
import DashboardClient from './components/DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // Get all categories with data
  const categorySnapshots = await getCategorySnapshotsAction(100);

  if (categorySnapshots.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <h2 className="text-2xl font-semibold mb-2">データがありません</h2>
        <p>データ取り込みジョブを実行してランキングを取得してください。</p>
      </div>
    );
  }

  // Build categories list with names
  const categories = categorySnapshots.map(cs => ({
    categoryId: cs.categoryId,
    name: getCategoryName(cs.categoryId),
  }));

  // Sort categories: 総合 first, then others
  categories.sort((a, b) => {
    if (a.categoryId === '0') return -1;
    if (b.categoryId === '0') return 1;
    return a.name.localeCompare(b.name);
  });

  // Default to 総合ランキング (0) or first available category
  const defaultCategoryId = categories.find(c => c.categoryId === '0')?.categoryId || categories[0].categoryId;

  // Get initial data for default category
  const initialData = await getLatestRankingAction(defaultCategoryId);

  const formattedInitialData = initialData ? {
    categoryId: defaultCategoryId,
    snapshot: initialData.snapshot,
    items: initialData.items.map(item => ({
      id: item.id,
      rank: item.rank,
      itemKey: item.itemKey,
      itemName: item.itemName,
      itemUrl: item.itemUrl,
      shopName: item.shopName,
      imageUrl: item.imageUrl,
      price: item.price,
      apiRate: item.apiRate,
      verifiedRate: item.verifiedRate,
      rankChange: item.rankChange,
    })),
  } : null;

  return (
    <DashboardClient
      categories={categories}
      initialData={formattedInitialData}
      defaultCategoryId={defaultCategoryId}
    />
  );
}
