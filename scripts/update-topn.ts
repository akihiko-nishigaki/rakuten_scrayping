import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function updateTopN() {
    console.log('Updating topN setting to 100...');

    const settings = await prisma.settings.findFirst();

    if (!settings) {
        console.log('No settings found, creating...');
        await prisma.settings.create({
            data: {
                categories: ["0"],
                rankingTypes: ["realtime"],
                topN: 100,
                categoryOrder: [],
            }
        });
    } else {
        await prisma.settings.update({
            where: { id: settings.id },
            data: { topN: 100 }
        });
    }

    console.log('topN updated to 100');

    // Verify
    const updated = await prisma.settings.findFirst();
    console.log('Current topN:', updated?.topN);

    await prisma.$disconnect();
}

updateTopN().catch(console.error);
