import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
    try {
        const { email, password } = await request.json();

        // Step 1: Check database connection
        const userCount = await prisma.user.count();

        // Step 2: Find user
        const user = await prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                email: true,
                password: true,
                role: true,
            },
        });

        if (!user) {
            return NextResponse.json({
                success: false,
                step: 'user_lookup',
                message: 'User not found',
                totalUsers: userCount,
                searchedEmail: email,
            });
        }

        // Step 3: Verify password
        const isValid = await bcrypt.compare(password, user.password);

        return NextResponse.json({
            success: isValid,
            step: 'password_verify',
            message: isValid ? 'Password valid' : 'Password invalid',
            totalUsers: userCount,
            userFound: true,
            userId: user.id,
            userRole: user.role,
            passwordHashPrefix: user.password.substring(0, 20) + '...',
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            step: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        }, { status: 500 });
    }
}
