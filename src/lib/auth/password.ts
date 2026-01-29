import bcrypt from 'bcryptjs';

/**
 * Password validation result
 */
export interface PasswordValidationResult {
    valid: boolean;
    errors: string[];
}

/**
 * Validate password against requirements:
 * - At least 8 characters
 * - At least 3 of 4 character types: uppercase, lowercase, numbers, symbols
 */
export function validatePassword(password: string): PasswordValidationResult {
    const errors: string[] = [];

    if (password.length < 8) {
        errors.push('8文字以上必要です');
    }

    let typeCount = 0;
    if (/[A-Z]/.test(password)) typeCount++; // Uppercase
    if (/[a-z]/.test(password)) typeCount++; // Lowercase
    if (/[0-9]/.test(password)) typeCount++; // Numbers
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) typeCount++; // Symbols

    if (typeCount < 3) {
        errors.push('英大文字・英小文字・数字・記号のうち3種類以上を含めてください');
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

/**
 * Generate a secure random token for password reset
 */
export function generateResetToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 64; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}
