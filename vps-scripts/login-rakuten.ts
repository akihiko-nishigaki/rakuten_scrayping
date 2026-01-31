/**
 * Rakuten Login Script
 * Opens browser for manual login and saves session
 * Run with: npm run login
 */
import 'dotenv/config';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const SESSION_FILE = path.join(__dirname, '.rakuten-session.json');

interface SessionState {
    cookies: any[];
    localStorage: Record<string, string>;
    lastLogin: string;
}

function prompt(question: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

async function main() {
    console.log('=== Rakuten Login ===');
    console.log('This will open a browser for you to login to Rakuten Affiliate.');
    console.log('After login, press Enter to save the session.\n');

    const browser = await chromium.launch({
        headless: false,
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    // Navigate to Rakuten Affiliate
    await page.goto('https://affiliate.rakuten.co.jp/', {
        waitUntil: 'networkidle',
    });

    console.log('Browser opened. Please login to Rakuten Affiliate.');
    console.log('URL:', page.url());

    await prompt('\nPress Enter after you have logged in...');

    // Verify login
    const currentUrl = page.url();
    console.log('\nCurrent URL:', currentUrl);

    // Get cookies
    const cookies = await context.cookies();
    console.log(`Captured ${cookies.length} cookies`);

    // Save session
    const session: SessionState = {
        cookies,
        localStorage: {},
        lastLogin: new Date().toISOString(),
    };

    fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
    console.log(`\nSession saved to: ${SESSION_FILE}`);

    await browser.close();
    console.log('Browser closed. You can now run the scraper.');
}

main().catch(console.error);
