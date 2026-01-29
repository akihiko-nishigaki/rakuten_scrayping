/**
 * Create initial admin user
 *
 * Usage:
 *   npx tsx scripts/create-admin.ts <email> <password> [name]
 *
 * Example:
 *   npx tsx scripts/create-admin.ts admin@example.com "SecureP@ss123" "Admin User"
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

function createPrismaClient() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL environment variable is not set');
    }
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
}

const prisma = createPrismaClient();

function validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
        errors.push('8文字以上必要です');
    }

    let typeCount = 0;
    if (/[A-Z]/.test(password)) typeCount++;
    if (/[a-z]/.test(password)) typeCount++;
    if (/[0-9]/.test(password)) typeCount++;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) typeCount++;

    if (typeCount < 3) {
        errors.push('英大文字・英小文字・数字・記号のうち3種類以上を含めてください');
    }

    return { valid: errors.length === 0, errors };
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.error('Usage: npx tsx scripts/create-admin.ts <email> <password> [name]');
        process.exit(1);
    }

    const [email, password, name] = args;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        console.error('Error: Invalid email format');
        process.exit(1);
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
        console.error('Error: Password does not meet requirements');
        passwordValidation.errors.forEach(err => console.error(`  - ${err}`));
        process.exit(1);
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({
        where: { email },
    });

    if (existing) {
        console.error(`Error: User with email "${email}" already exists`);
        process.exit(1);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create admin user
    const user = await prisma.user.create({
        data: {
            email,
            password: hashedPassword,
            name: name || null,
            role: 'ADMIN',
        },
    });

    console.log('Admin user created successfully!');
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.name || '(not set)'}`);
    console.log(`  Role: ${user.role}`);
}

main()
    .catch((e) => {
        console.error('Error:', e.message);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
