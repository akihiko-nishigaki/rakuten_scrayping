import { getOwnRakutenAction } from '@/app/actions/auth';
import { RakutenCredentialsForm } from './RakutenCredentialsForm';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
    const credentials = await getOwnRakutenAction();

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">マイ設定</h1>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">楽天API設定</h2>
                <p className="text-sm text-gray-500 mb-6">
                    アフィリエイトIDを設定すると、ダッシュボードであなた固有の料率が表示されます。
                    未設定の場合はシステム共通の料率が使用されます。
                </p>

                <RakutenCredentialsForm
                    rakutenAppId={credentials?.rakutenAppId || ''}
                    rakutenAccessKey={credentials?.rakutenAccessKey || ''}
                    rakutenAffiliateId={credentials?.rakutenAffiliateId || ''}
                />
            </div>
        </div>
    );
}
