import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await ctx.newPage();

// Mock as unauthenticated (guest login available)
await page.route('**/api/**', r => r.fulfill({ status: 503, body: '{}' }));
await page.route('**/api/auth/providers', r => r.fulfill({ status: 200, contentType: 'application/json',
  body: JSON.stringify({ providers: { email: { ok: true } } }) }));
await page.route('**/api/auth/me', r => r.fulfill({ status: 401, body: '{"error":"not authenticated"}' }));

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(2000);

const state = await page.evaluate(() => {
  return {
    url: window.location.href,
    hasGuestButton: !!Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('guest')),
    allButtonText: Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(t => t),
    title: document.title,
  };
});

console.log(JSON.stringify(state, null, 2));
await page.screenshot({ path: '/tmp/rivt-local-current.png', fullPage: false });
await browser.close();
