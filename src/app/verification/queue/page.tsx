import { getVerificationQueueAction } from '@/app/actions/verification';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

export const dynamic = 'force-dynamic';

export default async function VerificationQueuePage() {
    const queue = await getVerificationQueueAction(50);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Verification Queue</h1>
                <div className="text-sm text-gray-500">
                    Showing top {queue.length} priority items
                </div>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
                <ul className="divide-y divide-gray-200">
                    {queue.length === 0 ? (
                        <li className="p-8 text-center text-gray-500">
                            No pending items in queue.
                        </li>
                    ) : (
                        queue.map((task) => (
                            <li key={task.id} className="hover:bg-gray-50 transition-colors">
                                <div className="p-4 sm:px-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                                    P{task.priority}
                                                </span>
                                                <p className="text-sm font-medium text-indigo-600 truncate">
                                                    Item Key: {task.itemKey}
                                                </p>
                                            </div>
                                            <div className="mt-2 flex">
                                                <div className="flex items-center text-sm text-gray-500">
                                                    <p>
                                                        Last seen {formatDistanceToNow(new Date(task.lastSeenAt))} ago
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex-shrink-0 ml-5">
                                            <Link
                                                href={`/verification/${task.itemKey}`}
                                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                                            >
                                                Verify
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </li>
                        ))
                    )}
                </ul>
            </div>
        </div>
    );
}
