import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const SESSION_FILE = path.join(process.cwd(), '.rakuten-session.json');

export interface SessionState {
    cookies: any[];
    localStorage: Record<string, string>;
    lastLogin: string;
}

export class RakutenSessionManager {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;

    /**
     * Initialize browser with saved session if available
     */
    async init(): Promise<boolean> {
        const savedSession = this.loadSession();

        if (!savedSession) {
            console.log('No valid session found. Please run: npx ts-node scripts/login-rakuten.ts');
            return false;
        }

        this.browser = await chromium.launch({
            headless: false, // Show browser for debugging
        });

        this.context = await this.browser.newContext({
            storageState: {
                cookies: savedSession.cookies,
                origins: []
            },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        });

        this.page = await this.context.newPage();
        console.log('Browser initialized with saved session from:', savedSession.lastLogin);

        // Verify session is still valid
        const isValid = await this.verifySession();
        if (!isValid) {
            console.log('Session expired. Please run: npx ts-node scripts/login-rakuten.ts');
            await this.close();
            return false;
        }

        return true;
    }

    /**
     * Verify the session is still valid
     */
    private async verifySession(): Promise<boolean> {
        if (!this.page) return false;

        try {
            await this.page.goto('https://affiliate.rakuten.co.jp/link/ichiba/', {
                waitUntil: 'networkidle',
                timeout: 30000
            });

            // Wait a bit for page to fully load
            await this.page.waitForTimeout(2000);

            const pageUrl = this.page.url();
            console.log('Verify session - current URL:', pageUrl);

            // If redirected to login page, session is invalid
            if (pageUrl.includes('grp01.id.rakuten.co.jp') || pageUrl.includes('login')) {
                console.log('Redirected to login page - session invalid');
                return false;
            }

            // Check if we can see the search form or product search elements
            const searchElements = await this.page.$$('input, form, .raf-form');
            console.log('Found elements on page:', searchElements.length);

            // If we're on the affiliate page and not redirected to login, assume session is valid
            if (pageUrl.includes('affiliate.rakuten.co.jp') && searchElements.length > 0) {
                return true;
            }

            return false;

        } catch (error) {
            console.error('Error verifying session:', error);
            return false;
        }
    }

    /**
     * Load session from file
     */
    private loadSession(): SessionState | null {
        try {
            if (fs.existsSync(SESSION_FILE)) {
                const data = fs.readFileSync(SESSION_FILE, 'utf-8');
                const session = JSON.parse(data) as SessionState;

                // Check if session is not too old (7 days)
                const lastLogin = new Date(session.lastLogin);
                const daysSinceLogin = (Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24);

                if (daysSinceLogin < 7) {
                    return session;
                } else {
                    console.log('Session expired (older than 7 days)');
                    return null;
                }
            }
        } catch (error) {
            console.error('Error loading session:', error);
        }
        return null;
    }

    /**
     * Get the current page
     */
    getPage(): Page {
        if (!this.page) throw new Error('Session not initialized');
        return this.page;
    }

    /**
     * Close browser
     */
    async close(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.context = null;
            this.page = null;
        }
    }

    /**
     * Check if session file exists
     */
    static hasSession(): boolean {
        return fs.existsSync(SESSION_FILE);
    }
}
