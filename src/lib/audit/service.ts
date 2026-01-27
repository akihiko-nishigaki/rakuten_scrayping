import { prisma } from '@/lib/prisma';

export const AuditService = {
    async log(actionType: string, actorId: string | null = null, entityType?: string, entityId?: string, meta?: any) {
        try {
            await prisma.auditLog.create({
                data: {
                    actionType,
                    actorId,
                    entityType,
                    entityId,
                    metaJson: meta ? JSON.parse(JSON.stringify(meta)) : undefined, // Ensure valid JSON
                }
            });
        } catch (e) {
            console.error("Failed to write audit log:", e);
            // Don't fail the main request just because logging failed? 
            // strict: throw e; 
            // forgiving: return;
        }
    }
};
