
import { PrismaClient } from '@prisma/client';
import { RankingIngestor } from '../lib/ingestor/rankingIngestor';

const prisma = new PrismaClient();

async function main() {
    console.log("Starting manual ingestion test...");

    // Check DB connection
    try {
        await prisma.$connect();
        console.log("DB Connected successfully.");
    } catch (e) {
        console.error("DB Connection failed:", e);
        process.exit(1);
    }

    // Run Ingestor
    try {
        const ingestor = new RankingIngestor(
            process.env.RAKUTEN_APP_ID || "TEST_APP_ID",
            process.env.RAKUTEN_AFFILIATE_ID
        );
        console.log("Ingestor initialized.");

        // We can just call the method
        const results = await ingestor.ingestAllConfiguredCategories();
        console.log("Ingestion results:", JSON.stringify(results, null, 2));

    } catch (e) {
        console.error("Ingestion failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
