'use server';

import { prisma } from '@/lib/prisma';
import { VerificationService } from '@/lib/verification/service';
import { AuditService } from '@/lib/audit/service';
import { TaskStatus } from '@prisma/client';

/**
 * Get the verification queue, sorted by priority
 */
export async function getVerificationQueueAction(limit = 20) {
    return await prisma.verificationTask.findMany({
        where: {
            status: { in: ['PENDING', 'IN_PROGRESS'] }
        },
        orderBy: [
            { priority: 'desc' },
            { lastSeenAt: 'desc' },
        ],
        take: limit,
        include: {
            // Just to display basic info in the list
            // In a real app we might snapshot Item details here too
        }
    });
}

/**
 * Get everything needed to verify an item:
 * - Current known info (VerificationTask)
 * - The latest snapshot item details
 * - History of verified rates
 */
export async function getVerificationDetailAction(itemKey: string) {
    const task = await prisma.verificationTask.findUnique({
        where: { itemKey }
    });

    if (!task || !task.latestSnapshotItemId) return null;

    const snapshotItem = await prisma.snapshotItem.findUnique({
        where: { id: task.latestSnapshotItemId },
        include: { snapshot: true }
    });

    const currentVerified = await prisma.verifiedRateCurrent.findUnique({
        where: { itemKey }
    });

    const history = await prisma.verifiedRateHistory.findMany({
        where: { itemKey },
        orderBy: { createdAt: 'desc' },
        take: 5
    });

    return { task, snapshotItem, currentVerified, history };
}

/**
 * Submit a verification result
 */
export async function upsertVerifiedRateAction(input: {
    itemKey: string;
    verifiedRate: number;
    evidenceUrl?: string;
    note?: string;
    userId: string; // In real app, get from session
}) {
    const { itemKey, verifiedRate, evidenceUrl, note, userId } = input;

    // 1. Upsert Current Rate
    const verified = await prisma.verifiedRateCurrent.upsert({
        where: { itemKey },
        create: {
            itemKey,
            verifiedRate,
            evidenceUrl,
            note,
            updatedBy: userId,
        },
        update: {
            verifiedRate,
            evidenceUrl,
            note,
            updatedBy: userId,
        }
    });

    // 2. Add to History
    await prisma.verifiedRateHistory.create({
        data: {
            itemKey,
            verifiedRate,
            evidenceUrl,
            note,
            createdBy: userId,
        }
    });

    // 3. Update Task Status
    await prisma.verificationTask.update({
        where: { itemKey },
        data: {
            status: TaskStatus.VERIFIED,
            priority: 0, // Reset priority? Or keep calculation? Usually verified means done for now.
        }
    });

    // 4. Audit
    await AuditService.log("VERIFY_RATE", userId, "VerifiedRate", verified.id, {
        itemKey, verifiedRate
    });

    return { ok: true, id: verified.id };
}
