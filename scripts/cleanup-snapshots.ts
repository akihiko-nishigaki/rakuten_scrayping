import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function cleanup() {
    console.log('Starting cleanup...');

    // Get all unique categories
    const categories = await prisma.rankingSnapshot.findMany({
        select: { categoryId: true },
        distinct: ['categoryId'],
    });

    console.log(`Found ${categories.length} categories:`, categories.map(c => c.categoryId));

    let totalSnapshotsDeleted = 0;
    let totalItemsDeleted = 0;

    for (const { categoryId } of categories) {
        // Get all snapshots for this category
        const snapshots = await prisma.rankingSnapshot.findMany({
            where: { categoryId },
            orderBy: { capturedAt: 'desc' },
            select: { id: true, capturedAt: true },
        });

        console.log(`\nCategory ${categoryId}: ${snapshots.length} snapshots`);

        // Keep only latest 2
        const toDelete = snapshots.slice(2);

        if (toDelete.length > 0) {
            const ids = toDelete.map(s => s.id);

            // Delete items first
            const itemsDeleted = await prisma.snapshotItem.deleteMany({
                where: { snapshotId: { in: ids } }
            });

            // Delete snapshots
            const snapshotsDeleted = await prisma.rankingSnapshot.deleteMany({
                where: { id: { in: ids } }
            });

            console.log(`  Deleted: ${snapshotsDeleted.count} snapshots, ${itemsDeleted.count} items`);
            totalSnapshotsDeleted += snapshotsDeleted.count;
            totalItemsDeleted += itemsDeleted.count;
        } else {
            console.log('  No cleanup needed');
        }
    }

    console.log(`\n=== Cleanup Complete ===`);
    console.log(`Total snapshots deleted: ${totalSnapshotsDeleted}`);
    console.log(`Total items deleted: ${totalItemsDeleted}`);

    await prisma.$disconnect();
}

cleanup().catch(console.error);
