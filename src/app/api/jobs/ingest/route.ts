import { NextRequest, NextResponse } from 'next/server';
import { RankingIngestor } from '@/lib/ingestor/rankingIngestor';
import { AuditService } from '@/lib/audit/service';
import { SettingsService } from '@/lib/settings/service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds for the job

export async function POST(req: NextRequest) {
    const startTime = Date.now();

    // Authorization check
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        await AuditService.log('INGEST_JOB', null, 'System', undefined, {
            status: 'UNAUTHORIZED',
            ip: req.headers.get('x-forwarded-for') || 'unknown',
        });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if ingest is enabled
    try {
        const settings = await SettingsService.getSettings();
        if (!settings.ingestEnabled) {
            return NextResponse.json({
                ok: false,
                error: 'Ingest is disabled in settings',
                timestamp: new Date().toISOString(),
            }, { status: 503 });
        }
    } catch (error) {
        console.error('Failed to check settings:', error);
        // Continue with ingest even if settings check fails
    }

    const appId = process.env.RAKUTEN_APP_ID;
    const affiliateId = process.env.RAKUTEN_AFFILIATE_ID;

    if (!appId) {
        await AuditService.log('INGEST_JOB', null, 'System', undefined, {
            status: 'CONFIG_ERROR',
            error: 'RAKUTEN_APP_ID not configured',
        });
        return NextResponse.json({ error: 'RAKUTEN_APP_ID not configured' }, { status: 500 });
    }

    try {
        const ingestor = new RankingIngestor(appId, affiliateId);
        const results = await ingestor.ingestAllConfiguredCategories();

        const duration = Date.now() - startTime;
        const successCount = results.filter(r => r.status === 'SUCCESS').length;
        const errorCount = results.filter(r => r.status === 'ERROR').length;

        await AuditService.log('INGEST_JOB', null, 'RankingSnapshot', undefined, {
            status: 'COMPLETED',
            duration,
            successCount,
            errorCount,
            results,
        });

        return NextResponse.json({
            ok: true,
            results,
            summary: {
                total: results.length,
                success: successCount,
                error: errorCount,
                duration: `${duration}ms`,
            },
            timestamp: new Date().toISOString(),
        });

    } catch (error: any) {
        const duration = Date.now() - startTime;

        console.error('Ingest Job Failed:', error);

        await AuditService.log('INGEST_JOB', null, 'System', undefined, {
            status: 'FAILED',
            error: error.message,
            duration,
        });

        return NextResponse.json({
            ok: false,
            error: error.message,
            timestamp: new Date().toISOString(),
        }, { status: 500 });
    }
}

// Health check endpoint for the job
export async function GET() {
    return NextResponse.json({
        status: 'ready',
        endpoint: '/api/jobs/ingest',
        method: 'POST',
        auth: 'Bearer token required',
    });
}
