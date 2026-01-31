import { getVerificationDetailAction } from '@/app/actions/verification';
import VerificationForm from '@/components/verification/VerificationForm';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function VerificationItemPage({ params }: { params: Promise<{ itemKey: string }> }) {
    const { itemKey } = await params;
    const detail = await getVerificationDetailAction(decodeURIComponent(itemKey));

    if (!detail || !detail.snapshotItem) {
        return <div>Item not found or no snapshot available.</div>;
    }

    const { snapshotItem, currentVerified } = detail;
    const itemKeyDecoded = decodeURIComponent(itemKey); // Already decoded above, but keep for display

    return (
        <div className="h-[calc(100vh-8rem)] flex gap-6">
            {/* Left Panel: Info & Form */}
            <div className="w-1/3 flex flex-col gap-6 overflow-y-auto pr-2">
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900 leading-tight mb-2">
                        {snapshotItem.title}
                    </h2>
                    <div className="text-sm text-gray-500 mb-4">
                        Shop: {snapshotItem.shopName}
                    </div>

                    <div className="flex gap-4 text-sm mb-4">
                        <div className="bg-gray-50 p-2 rounded">
                            <span className="block text-xs text-gray-500">Latest Rank</span>
                            <span className="font-bold">#{snapshotItem.rank}</span>
                        </div>
                        <div className="bg-gray-50 p-2 rounded">
                            <span className="block text-xs text-gray-500">API Rate</span>
                            <span className="font-bold">{snapshotItem.apiRate ?? '-'}%</span>
                        </div>
                    </div>

                    <div className="text-xs text-gray-400 break-all">
                        Key: {itemKeyDecoded}
                    </div>
                </div>

                <VerificationForm
                    itemKey={itemKeyDecoded}
                    apiRate={snapshotItem.apiRate}
                    currentRate={currentVerified?.verifiedRate ?? null}
                />

                <div className="bg-blue-50 p-4 rounded-md border border-blue-100 text-sm text-blue-800">
                    <strong>Target Link:</strong><br />
                    <a href={snapshotItem.itemUrl} target="_blank" className="underline break-all">
                        {snapshotItem.itemUrl}
                    </a>
                </div>
            </div>

            {/* Right Panel: Browser View (Simulation with simple iframe for now, usually external link is better due to x-frame-options) */}
            <div className="flex-1 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center relative">
                <div className="text-center p-8">
                    <p className="text-gray-500 mb-4">
                        Rakuten pages usually block iframes (X-Frame-Options).
                        <br />Please open the link below to verify:
                    </p>
                    <a
                        href={snapshotItem.itemUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                    >
                        Open Product Page ↗
                    </a>
                </div>
            </div>
        </div>
    );
}
