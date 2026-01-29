'use server';

import { prisma } from '@/lib/prisma';
import { hashPassword, validatePassword, generateResetToken } from '@/lib/auth/password';
import { sendPasswordResetEmail } from '@/lib/auth/email';
import { requireAdmin } from '@/lib/auth/config';
import { AuditService } from '@/lib/audit/service';
import { Role } from '@prisma/client';

// ============================================================================
// User Management (Admin only)
// ============================================================================

interface CreateUserInput {
    email: string;
    password: string;
    name?: string;
    role: Role;
}

export async function createUserAction(input: CreateUserInput) {
    const admin = await requireAdmin();

    // Validate password
    const passwordValidation = validatePassword(input.password);
    if (!passwordValidation.valid) {
        return { ok: false, error: passwordValidation.errors.join(', ') };
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({
        where: { email: input.email },
    });
    if (existing) {
        return { ok: false, error: 'このメールアドレスは既に登録されています' };
    }

    // Hash password and create user
    const hashedPassword = await hashPassword(input.password);

    const user = await prisma.user.create({
        data: {
            email: input.email,
            password: hashedPassword,
            name: input.name || null,
            role: input.role,
        },
    });

    await AuditService.log(
        'CREATE_USER',
        admin.id,
        'User',
        user.id,
        { email: input.email, role: input.role }
    );

    return { ok: true, userId: user.id };
}

interface UpdateUserInput {
    id: string;
    name?: string;
    role?: Role;
    password?: string;
}

export async function updateUserAction(input: UpdateUserInput) {
    const admin = await requireAdmin();

    const updateData: {
        name?: string | null;
        role?: Role;
        password?: string;
    } = {};

    if (input.name !== undefined) {
        updateData.name = input.name || null;
    }

    if (input.role !== undefined) {
        updateData.role = input.role;
    }

    if (input.password) {
        const passwordValidation = validatePassword(input.password);
        if (!passwordValidation.valid) {
            return { ok: false, error: passwordValidation.errors.join(', ') };
        }
        updateData.password = await hashPassword(input.password);
    }

    const user = await prisma.user.update({
        where: { id: input.id },
        data: updateData,
    });

    await AuditService.log(
        'UPDATE_USER',
        admin.id,
        'User',
        user.id,
        { fields: Object.keys(updateData), newRole: input.role }
    );

    return { ok: true };
}

export async function deleteUserAction(userId: string) {
    const admin = await requireAdmin();

    // Prevent self-deletion
    if (userId === admin.id) {
        return { ok: false, error: '自分自身は削除できません' };
    }

    await prisma.user.delete({
        where: { id: userId },
    });

    await AuditService.log(
        'DELETE_USER',
        admin.id,
        'User',
        userId
    );

    return { ok: true };
}

export async function getUsersAction() {
    await requireAdmin();

    const users = await prisma.user.findMany({
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
            updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
    });

    return users;
}

export async function getUserAction(userId: string) {
    await requireAdmin();

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    return user;
}

// ============================================================================
// Password Reset
// ============================================================================

export async function requestPasswordResetAction(email: string) {
    // Always return success to prevent email enumeration
    const user = await prisma.user.findUnique({
        where: { email },
    });

    if (user) {
        const resetToken = generateResetToken();
        const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await prisma.user.update({
            where: { id: user.id },
            data: {
                resetToken,
                resetTokenExpiry,
            },
        });

        try {
            await sendPasswordResetEmail(email, resetToken);
        } catch (error) {
            console.error('Failed to send password reset email:', error);
            // Don't expose email sending errors to the user
        }

        await AuditService.log(
            'REQUEST_PASSWORD_RESET',
            user.id,
            'User',
            user.id
        );
    }

    return { ok: true, message: 'リセットメールを送信しました（登録されているメールアドレスの場合）' };
}

export async function resetPasswordAction(token: string, newPassword: string) {
    // Validate password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
        return { ok: false, error: passwordValidation.errors.join(', ') };
    }

    // Find user by reset token
    const user = await prisma.user.findUnique({
        where: { resetToken: token },
    });

    if (!user) {
        return { ok: false, error: '無効なリセットトークンです' };
    }

    // Check if token is expired
    if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
        return { ok: false, error: 'リセットトークンの有効期限が切れています' };
    }

    // Hash new password and update user
    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
        where: { id: user.id },
        data: {
            password: hashedPassword,
            resetToken: null,
            resetTokenExpiry: null,
        },
    });

    await AuditService.log(
        'RESET_PASSWORD',
        user.id,
        'User',
        user.id
    );

    return { ok: true };
}

export async function validateResetTokenAction(token: string) {
    const user = await prisma.user.findUnique({
        where: { resetToken: token },
    });

    if (!user) {
        return { valid: false };
    }

    if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
        return { valid: false };
    }

    return { valid: true };
}
