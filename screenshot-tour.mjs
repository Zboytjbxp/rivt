import { chromium } from 'playwright';
import fs from 'fs';

const OUT = '/tmp/rivt-tour';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
let i = 0;
const shot = async (page, name) => {
  await page.screenshot({ path: `${OUT}/${String(i++).padStart(2,'0')}-${name}.png` });
  console.log(`✓ ${name}`);
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();

await page.route('**/api/auth/providers', r => r.fulfill({ status: 200, contentType: 'application/json',
  body: JSON.stringify({ providers: { email: { ok: true } } }) }));
await page.route('**/api/auth/me', r => r.fulfill({ status: 401, body: '{"error":"not authenticated"}' }));
await page.route('**/api/**', r => r.fulfill({ status: 503, body: '{}' }));

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(2000);
await shot(page, 'auth-screen');

// Click guest
const guestClicked = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('guest'));
  if (btn) { btn.click(); return true; }
  return false;
});
console.log('Guest button found:', guestClicked);
await page.waitForTimeout(1500);
await shot(page, 'home-after-guest');

// Nav to Tools
await page.evaluate(() => {
  for (const el of document.querySelectorAll('.nav-item, [class*="nav"]')) {
    if (el.textContent?.includes('Tools')) { el.click(); return; }
  }
});
await page.waitForTimeout(1000);
await shot(page, 'tools-page');

// Scroll to calculator
await page.evaluate(() => {
  const el = document.querySelector('.construction-calculator, [class*="calculator"]');
  if (el) el.scrollIntoView({ block: 'start' });
});
await page.waitForTimeout(500);
await shot(page, 'calculator');

await browser.close();
console.log(`\nScreenshots: ${OUT}`);
