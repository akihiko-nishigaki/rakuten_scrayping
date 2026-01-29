/**
 * Login to Rakuten Affiliate and save session
 * Run this first: npx ts-node scripts/login-rakuten.ts
 */

import 'dotenv/config';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const SESSION_FILE = path.join(process.cwd(), '.rakuten-session.json');

async function main() {
    console.log('Starting browser for Rakuten login...');

    const browser = await chromium.launch({
        headless: false,
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    // Go to Rakuten Affiliate
    console.log('Navigating to Rakuten Affiliate...');
    await page.goto('https://affiliate.rakuten.co.jp/', { waitUntil: 'networkidle' });

    // Click login button
    console.log('Looking for login button...');

    // Try to find and click the login button/link
    const loginSelectors = [
        'a:has-text("ログイン")',
        'button:has-text("ログイン")',
        'a[href*="login"]',
        '.login-btn',
        '#login',
    ];

    let clicked = false;
    for (const selector of loginSelectors) {
        try {
            const loginBtn = await page.$(selector);
            if (loginBtn) {
                console.log('Found login button, clicking...');
                await loginBtn.click();
                clicked = true;
                break;
            }
        } catch (e) {
            continue;
        }
    }

    if (!clicked) {
        console.log('Could not find login button, navigating to login page directly...');
        await page.goto('https://grp01.id.rakuten.co.jp/rms/nid/vc?__event=login&service_id=ra', { waitUntil: 'networkidle' });
    }

    await page.waitForTimeout(2000);

    console.log('\n========================================');
    console.log('Please login in the browser window:');
    console.log('1. Enter your Rakuten ID and password');
    console.log('2. Complete any 2FA if required');
    console.log('3. Wait for redirect to affiliate page');
    console.log('========================================\n');

    // Wait for successful login - user will be redirected to affiliate page
    try {
        await page.waitForURL((url) => {
            const urlStr = url.toString();
            return urlStr.includes('affiliate.rakuten.co.jp') &&
                   !urlStr.includes('login') &&
                   !urlStr.includes('grp01.id.rakuten.co.jp');
        }, { timeout: 300000 }); // 5 minutes timeout

        console.log('Login detected! Waiting for page to stabilize...');
        await page.waitForTimeout(3000);

    } catch (e) {
        console.log('Timeout waiting for login. Checking current state...');
    }

    // Go to affiliate top page to verify
    console.log('Navigating to affiliate top page...');
    await page.goto('https://affiliate.rakuten.co.jp/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);

    // Check if still showing login button
    const stillHasLogin = await page.$('a:has-text("ログイン")');

    if (stillHasLogin) {
        console.log('\n⚠️  Still seeing login button. Login may have failed.');
        console.log('Please try again or check your credentials.');

        // Keep browser open for manual retry
        console.log('\nBrowser will stay open. Login manually, then press Enter here...');

        // Wait for user input
        await new Promise<void>((resolve) => {
            process.stdin.once('data', () => resolve());
        });

        // Re-check after manual login
        await page.goto('https://affiliate.rakuten.co.jp/', { waitUntil: 'networkidle' });
    }

    // Save session
    const cookies = await context.cookies();

    if (cookies.length === 0) {
        console.log('\n❌ No cookies found. Login may have failed.');
        await browser.close();
        return;
    }

    const sessionData = {
        cookies,
        localStorage: {},
        lastLogin: new Date().toISOString()
    };

    fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionData, null, 2));
    console.log('\n✓ Session saved to:', SESSION_FILE);
    console.log('  Cookies saved:', cookies.length);

    // Test access to link creator
    console.log('\nTesting access to link creator page...');
    await page.goto('https://affiliate.rakuten.co.jp/link/ichiba/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const pageTitle = await page.title();
    console.log('Page title:', pageTitle);

    // Take a screenshot for verification
    const screenshotPath = path.join(process.cwd(), 'login-verify.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('Screenshot saved to:', screenshotPath);

    // Check if we can see the search input
    const searchInput = await page.$('input[type="text"], input[type="search"], input[name*="keyword"]');
    if (searchInput) {
        console.log('✓ Search input found - login successful!');
    } else {
        console.log('⚠️  Search input not found');
    }

    console.log('\n========================================');
    console.log('Done! Browser will close in 5 seconds.');
    console.log('========================================');

    await page.waitForTimeout(5000);
    await browser.close();
}

main().catch(console.error);
