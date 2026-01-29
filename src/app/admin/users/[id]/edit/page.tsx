import { getUserAction } from '@/app/actions/auth';
import { EditUserForm } from './EditUserForm';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function EditUserPage({ params }: PageProps) {
    const { id } = await params;
    const user = await getUserAction(id);

    if (!user) {
        notFound();
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">ユーザー編集</h1>
                <Link
                    href="/admin/users"
                    className="text-sm text-gray-600 hover:text-gray-800"
                >
                    戻る
                </Link>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="mb-6 pb-4 border-b border-gray-200">
                    <div className="text-sm text-gray-500">メールアドレス</div>
                    <div className="text-lg font-medium text-gray-900">{user.email}</div>
                </div>

                <EditUserForm user={user} />
            </div>
        </div>
    );
}
