import { getLatestRankingAction, getCategorySnapshotsAction } from '@/app/actions/ranking';
import { getCategoryName } from '@/lib/rakuten/categories';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth/config';
import DashboardClient from './components/DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // Get all categories with data
  const categorySnapshots = await getCategorySnapshotsAction(100);

  if (categorySnapshots.length === 0) {
    return (
      <div className="card-warm p-12 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-pink-50 mb-4">
          <svg className="w-10 h-10 text-pink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-700 mb-2">データがありません</h2>
        <p className="text-sm text-gray-400">データ取り込みジョブを実行してランキングを取得してください。</p>
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

  // Fetch per-user rates for current user
  let userRateMap = new Map<string, number>();
  let hasUserCredentials = false;

  const session = await auth();
  if (session?.user?.id && initialData) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { rakutenAffiliateId: true },
    });
    hasUserCredentials = !!user?.rakutenAffiliateId;

    if (hasUserCredentials) {
      const itemKeys = initialData.items.map(i => i.itemKey);
      const userRates = await prisma.userAffiliateRate.findMany({
        where: {
          userId: session.user.id,
          itemKey: { in: itemKeys },
        },
        select: { itemKey: true, affiliateRate: true },
      });
      userRateMap = new Map(userRates.map(r => [r.itemKey, r.affiliateRate]));
    }
  }

  const formattedInitialData = initialData ? {
    categoryId: defaultCategoryId,
    snapshot: initialData.snapshot,
    hasUserCredentials,
    items: initialData.items.map(item => ({
      id: item.id,
      rank: item.rank,
      itemKey: item.itemKey,
      title: item.title,
      itemUrl: item.itemUrl,
      shopName: item.shopName,
      price: item.price,
      imageUrl: item.imageUrl,
      apiRate: item.apiRate,
      verifiedRate: item.verifiedRate,
      rankChange: item.rankChange,
      userRate: userRateMap.get(item.itemKey) ?? null,
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
