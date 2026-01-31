import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function check() {
    console.log('Checking snapshots...\n');

    const snapshots = await prisma.rankingSnapshot.findMany({
        orderBy: { capturedAt: 'desc' },
        include: { _count: { select: { items: true } } }
    });

    console.log('All snapshots:');
    console.log('─'.repeat(80));

    for (const s of snapshots) {
        const date = s.capturedAt.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
        console.log(`[${s.categoryId.padEnd(8)}] ${date} | ${String(s._count.items).padStart(3)} items | ${s.status}`);
    }

    console.log('─'.repeat(80));
    console.log(`Total: ${snapshots.length} snapshots`);

    await prisma.$disconnect();
}

check().catch(console.error);
