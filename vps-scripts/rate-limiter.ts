/**
 * Per-appId Request Scheduler
 * applicationId単位でレート制限を管理するスケジューラ
 * 同一appIdのリクエストは間隔を空けて順次実行、異なるappIdは並列実行
 */

interface QueueItem<T = any> {
    fn: () => Promise<T>;
    resolve: (value: T) => void;
    reject: (reason: any) => void;
}

class RateLimitedQueue {
    private queue: QueueItem[] = [];
    private processing = false;
    private intervalMs: number;
    private label: string;
    private lastRequestTime = 0;

    constructor(intervalMs: number, label: string) {
        this.intervalMs = intervalMs;
        this.label = label;
    }

    enqueue<T>(fn: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.queue.push({ fn, resolve, reject });
            if (!this.processing) {
                this.processQueue();
            }
        });
    }

    private async processQueue() {
        this.processing = true;
        while (this.queue.length > 0) {
            // Ensure minimum interval since last request
            const elapsed = Date.now() - this.lastRequestTime;
            if (this.lastRequestTime > 0 && elapsed < this.intervalMs) {
                await new Promise(resolve => setTimeout(resolve, this.intervalMs - elapsed));
            }

            const item = this.queue.shift()!;
            this.lastRequestTime = Date.now();
            try {
                const result = await item.fn();
                item.resolve(result);
            } catch (error) {
                item.reject(error);
            }
        }
        this.processing = false;
    }

    get pending(): number {
        return this.queue.length;
    }
}

export class RequestScheduler {
    private queues = new Map<string, RateLimitedQueue>();
    private intervalMs: number;

    constructor(intervalMs: number = 1200) {
        this.intervalMs = intervalMs;
    }

    async enqueue<T>(appId: string, fn: () => Promise<T>): Promise<T> {
        let queue = this.queues.get(appId);
        if (!queue) {
            const shortId = appId.length > 12 ? appId.substring(0, 8) + '...' : appId;
            queue = new RateLimitedQueue(this.intervalMs, shortId);
            this.queues.set(appId, queue);
            console.log(`  [Scheduler] New queue for appId ${shortId} (interval: ${this.intervalMs}ms)`);
        }
        return queue.enqueue(fn);
    }
}
