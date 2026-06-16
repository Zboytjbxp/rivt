import { chromium } from 'playwright';
const MOCK_USER = {
  id: '1', email: 'rivttesting@gmail.com', provider: 'email',
  display_name: 'Ryan Mitchell', role: 'contractor',
  organization: 'Mitchell Contracting', location: 'Jacksonville, FL',
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

await page.route('**/api/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'offline' }) }));
await page.route('**/api/auth/providers', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ providers: { email: { ok: true, mode: 'configured', missing: [], purpose: 'Email' } } }) }));
await page.route('**/api/auth/me', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: MOCK_USER }) }));

await page.goto('http://localhost:5174', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForSelector('.nav-item', { timeout: 10000 }).catch(() => null);
await page.waitForTimeout(800);

// Click the Messages icon button (chat bubble aria-label)
await page.click('[aria-label="Messages"]').catch(async () => {
  // Fallback: find in button list
  await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button')) {
      if (btn.getAttribute('aria-label') === 'Messages') { btn.click(); return; }
    }
  });
});
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/messages-check.png' });
console.log('Messages screenshot taken');
await browser.close();
