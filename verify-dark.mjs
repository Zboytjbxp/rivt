import { chromium } from 'playwright';
import fs from 'fs';
const MOCK_USER = {
  id: '1', email: 'rivttesting@gmail.com', provider: 'email',
  display_name: 'Ryan Mitchell', role: 'contractor',
  organization: 'Mitchell Contracting', location: 'Jacksonville, FL',
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

await page.route('**/api/**', r => r.fulfill({ status: 503, body: JSON.stringify({ error: 'offline' }) }));
await page.route('**/api/auth/providers', r => r.fulfill({ status: 200, body: JSON.stringify({ providers: { email: { ok: true, mode: 'configured', missing: [], purpose: 'Email' } } }) }));
await page.route('**/api/auth/me', r => r.fulfill({ status: 200, body: JSON.stringify({ user: MOCK_USER }) }));

await page.goto('http://localhost:5174', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForSelector('.nav-item', { timeout: 10000 }).catch(() => null);
await page.waitForTimeout(800);

// Switch to dark mode
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button')) {
    if (btn.textContent?.includes('Dark mode')) { btn.click(); return; }
  }
});
await page.waitForTimeout(500);

// Home dark
await page.screenshot({ path: '/tmp/dark-home.png' });

// Work dark
await page.evaluate(() => {
  for (const el of document.querySelectorAll('.nav-item')) {
    if (el.textContent?.trim() === 'Work') { el.click(); return; }
  }
});
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/dark-work.png' });

// Shop Talk dark
await page.evaluate(() => {
  for (const el of document.querySelectorAll('.nav-item')) {
    if (el.textContent?.trim() === 'Shop Talk') { el.click(); return; }
  }
});
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/dark-shoptalk.png' });

// Account panel dark
await page.evaluate(() => { document.querySelector('.user-menu')?.click(); });
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/dark-account.png' });
await page.keyboard.press('Escape');

// Crew dark
await page.evaluate(() => {
  for (const el of document.querySelectorAll('.nav-item')) {
    if (el.textContent?.trim() === 'Crew') { el.click(); return; }
  }
});
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/dark-crew.png' });

await browser.close();
console.log('Dark mode screenshots done');
