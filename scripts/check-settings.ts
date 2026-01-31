import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function check() {
    const settings = await prisma.settings.findFirst();
    console.log('Current Settings:');
    console.log('─'.repeat(40));
    console.log('  topN:', settings?.topN);
    console.log('  categories:', settings?.categories);
    console.log('  ingestEnabled:', settings?.ingestEnabled);
    console.log('  categoryOrder:', settings?.categoryOrder);
    await prisma.$disconnect();
}
check().catch(console.error);
