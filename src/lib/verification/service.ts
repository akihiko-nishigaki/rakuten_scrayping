import { prisma } from '@/lib/prisma'; // Assumes you'll create a singleton for prisma client
import { TaskStatus } from '@prisma/client';

export const VerificationService = {
    /**
     * Calculate priority score for a task.
     * Higher score = Higher priority.
     * Format:
     *  - Rank: Top 1-3 (+50), Top 10 (+30), Top 50 (+10)
     *  - Diff Suspicion: (Logic to be added later)
     *  - Stagnation: Hours since last verified
     */
    calculatePriority(rank: number, apiRate: number | null, verifiedRate: number | null, lastVerifiedAt?: Date): number {
        let score = 0;

        // Rank weight
        if (rank <= 3) score += 50;
        else if (rank <= 10) score += 30;
        else if (rank <= 50) score += 10;
        else score += 1;

        // Diff Suspicion: If API rate differs from Verified rate significantly, prioritize
        if (apiRate !== null && verifiedRate !== null) {
            const diff = Math.abs(apiRate - verifiedRate);
            if (diff >= 5.0) score += 40; // High priority for large diff
            else if (diff >= 1.0) score += 20; // Medium priority for small diff
        }

        // TODO: Stagnation weight can be added here (e.g. +1 per day since lastVerifiedAt)

        return score;
    },

    /**
     * Upsert a verification task for a ranking item.
     * This is called during the ingest process.
     */
    async upsertTaskFromIngest(
        itemKey: string,
        snapshotItemId: string,
        rank: number,
        apiRate: number | null,
        currentVerifiedRate: number | null,
        lastVerifiedAt?: Date
    ) {
        // Determine status
        let status: TaskStatus = TaskStatus.PENDING;
        let shouldReopen = false;

        if (currentVerifiedRate !== null) {
            status = TaskStatus.VERIFIED;

            // Re-open if significant change detected
            if (apiRate !== null) {
                const diff = Math.abs(apiRate - currentVerifiedRate);
                if (diff >= 1.0) {
                    status = TaskStatus.PENDING;
                    shouldReopen = true;
                }
            }
        }

        const priority = this.calculatePriority(rank, apiRate, currentVerifiedRate, lastVerifiedAt);

        await prisma.verificationTask.upsert({
            where: { itemKey },
            create: {
                itemKey,
                latestSnapshotItemId: snapshotItemId,
                status,
                priority,
                lastSeenAt: new Date(),
            },
            update: {
                latestSnapshotItemId: snapshotItemId,
                // Update status only if we decided to re-open or if it was already pending/in_progress
                // logic: if it IS verified, and we decide to reopen, we set to PENDING.
                // if it IS verified, and no reopen, we leave it (but upsert update requires value).
                // Actually, if we pass undefined to update, Prisma ignores it? No, explicit update.
                // We should check current status in DB? upsert doesn't let us read inside update.
                // Strategy: Always update priority and lastSeen. 
                // Status: If shouldReopen is true, force PENDING. Otherwise, do not change (keep existing).
                // Limtation: Prisma upsert update cannot conditionally keep existing value based on DB value easily without raw query or separate 'update' call.
                // Use a separate update if the record exists? No, upsert is for concurrently safe ingest.
                // Simplified Logic: If it's a "Reopen" case, we force PENDING. If not, we don't include 'status' in update, 
                // BUT we can't emit 'status' conditionally in the object literal easily if strict typing.
                // Actually, if we don't include 'status' in update, it won't change.

                ...(shouldReopen ? { status: TaskStatus.PENDING } : {}),

                priority,
                lastSeenAt: new Date(),
            },
        });
    }
};
