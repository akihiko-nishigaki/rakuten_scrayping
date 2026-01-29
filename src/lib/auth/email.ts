import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
    },
});

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
    email: string,
    resetToken: string
): Promise<void> {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/reset-password/${resetToken}`;

    const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@example.com',
        to: email,
        subject: 'パスワードリセットのご案内',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">パスワードリセット</h2>
                <p>パスワードリセットのリクエストを受け付けました。</p>
                <p>以下のリンクをクリックして、新しいパスワードを設定してください。</p>
                <p style="margin: 24px 0;">
                    <a href="${resetUrl}"
                       style="background-color: #4F46E5; color: white; padding: 12px 24px;
                              text-decoration: none; border-radius: 6px; display: inline-block;">
                        パスワードを再設定する
                    </a>
                </p>
                <p style="color: #666; font-size: 14px;">
                    このリンクは1時間後に無効になります。
                </p>
                <p style="color: #666; font-size: 14px;">
                    このメールに心当たりがない場合は、無視してください。
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
                <p style="color: #999; font-size: 12px;">
                    Rakuten Rank Check System
                </p>
            </div>
        `,
        text: `
パスワードリセット

パスワードリセットのリクエストを受け付けました。
以下のリンクをクリックして、新しいパスワードを設定してください。

${resetUrl}

このリンクは1時間後に無効になります。
このメールに心当たりがない場合は、無視してください。
        `,
    };

    await transporter.sendMail(mailOptions);
}
