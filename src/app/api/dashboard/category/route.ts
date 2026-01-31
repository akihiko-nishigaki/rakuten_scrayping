import { NextRequest, NextResponse } from 'next/server';
import { getLatestRankingAction } from '@/app/actions/ranking';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const categoryId = searchParams.get('categoryId');

    if (!categoryId) {
        return NextResponse.json({ error: 'categoryId is required' }, { status: 400 });
    }

    try {
        const data = await getLatestRankingAction(categoryId);

        if (!data) {
            return NextResponse.json(null);
        }

        return NextResponse.json({
            categoryId,
            snapshot: data.snapshot,
            items: data.items,
        });
    } catch (error) {
        console.error('Error fetching category data:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}
