'use server';

import { prisma } from '@/lib/prisma';
import { SettingsService } from '@/lib/settings/service';
import { AuditService } from '@/lib/audit/service';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/config';

export async function getSettingsAction() {
    return await SettingsService.getSettings();
}

export async function updateSettingsAction(data: {
    categories?: string[];
    rankingTypes?: string[];
    topN?: number;
    ingestEnabled?: boolean;
}) {
    const user = await requireAuth();

    const current = await SettingsService.getSettings();
    const updated = await SettingsService.updateSettings(data);

    await AuditService.log(
        'UPDATE_SETTINGS',
        user.id,
        'Settings',
        updated.id,
        {
            before: {
                categories: current.categories,
                rankingTypes: current.rankingTypes,
                topN: current.topN,
                ingestEnabled: current.ingestEnabled,
            },
            after: data,
        }
    );

    revalidatePath('/settings');
    return updated;
}

export async function addCategoryAction(categoryId: string) {
    const settings = await SettingsService.getSettings();
    if (settings.categories.includes(categoryId)) {
        throw new Error('Category already exists');
    }
    return await updateSettingsAction({
        categories: [...settings.categories, categoryId],
    });
}

export async function removeCategoryAction(categoryId: string) {
    const settings = await SettingsService.getSettings();
    return await updateSettingsAction({
        categories: settings.categories.filter(c => c !== categoryId),
    });
}

export async function getCategoriesWithStatsAction() {
    const settings = await SettingsService.getSettings();

    const stats = await prisma.rankingSnapshot.groupBy({
        by: ['categoryId'],
        _count: { id: true },
        _max: { capturedAt: true },
    });

    const statsMap = new Map(stats.map(s => [s.categoryId, {
        count: s._count.id,
        lastCaptured: s._max.capturedAt,
    }]));

    return settings.categories.map(categoryId => ({
        categoryId,
        snapshotCount: statsMap.get(categoryId)?.count || 0,
        lastCaptured: statsMap.get(categoryId)?.lastCaptured || null,
    }));
}
