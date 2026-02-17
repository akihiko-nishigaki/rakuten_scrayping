import { getUsersAction, deleteUserAction } from '@/app/actions/auth';
import { formatJST } from '@/lib/utils/dateFormat';
import Link from 'next/link';
import { DeleteUserButton } from './DeleteUserButton';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
    const users = await getUsersAction();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">ユーザー管理</h1>
                <Link
                    href="/admin/users/new"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                >
                    新規登録
                </Link>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
                            <tr>
                                <th className="px-4 py-3">メールアドレス</th>
                                <th className="px-4 py-3">名前</th>
                                <th className="px-4 py-3 text-center">ロール</th>
                                <th className="px-4 py-3 text-center">楽天API</th>
                                <th className="px-4 py-3">登録日</th>
                                <th className="px-4 py-3 text-center">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => (
                                <tr key={user.id} className="border-b hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-gray-900">
                                        {user.email}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">
                                        {user.name || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span
                                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                user.role === 'ADMIN'
                                                    ? 'bg-purple-100 text-purple-700'
                                                    : 'bg-gray-100 text-gray-700'
                                            }`}
                                        >
                                            {user.role === 'ADMIN' ? '管理者' : '一般'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {user.rakutenAffiliateId ? (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                設定済
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                                                未設定
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">
                                        {formatJST(user.createdAt, 'yyyy/MM/dd HH:mm')}
                                    </td>
                                    <td className="px-4 py-3 text-center space-x-2">
                                        <Link
                                            href={`/admin/users/${user.id}/edit`}
                                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                        >
                                            編集
                                        </Link>
                                        <DeleteUserButton userId={user.id} userEmail={user.email} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {users.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                        ユーザーがいません
                    </div>
                )}
            </div>

            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                <div className="flex gap-6">
                    <div>
                        <span className="font-medium">合計:</span> {users.length}人
                    </div>
                    <div>
                        <span className="font-medium">管理者:</span>{' '}
                        {users.filter((u) => u.role === 'ADMIN').length}人
                    </div>
                    <div>
                        <span className="font-medium">一般:</span>{' '}
                        {users.filter((u) => u.role === 'USER').length}人
                    </div>
                </div>
            </div>
        </div>
    );
}
