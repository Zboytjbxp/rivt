import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const OUT = '/tmp/rivt-diagnose2';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5173';

let idx = 0;
async function shot(page, name) {
  const file = path.join(OUT, `${String(idx++).padStart(2,'0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`✓ ${path.basename(file)}`);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

// ===== 1. Auth screen =====
await page.route('**/api/auth/providers', route => route.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify({ providers: { email: { ok: true, mode: 'configured', missing: [], purpose: 'Email/password sign-in' } } }),
}));
await page.route('**/api/auth/me', route => route.fulfill({
  status: 401, contentType: 'application/json',
  body: JSON.stringify({ error: 'not authenticated' }),
}));

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(2000);
await shot(page, '01-auth-screen');

// ===== 2. Reload with logged-in mock =====
await page.unroute('**/api/auth/me');
await page.route('**/api/auth/me', route => route.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify({ user: {
    id: '1', email: 'rivttesting@gmail.com', provider: 'email',
    display_name: 'Ryan Mitchell', role: 'tradesperson',
    organization: 'Mitchell Contracting', location: 'Jacksonville, FL',
  }}),
}));
await page.route('**/api/**', route => route.fulfill({
  status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'offline' }),
}));

await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(2000);
await shot(page, '02-home');

// ===== 3. Tools =====
await page.evaluate(() => {
  for (const el of document.querySelectorAll('.nav-item')) {
    if (el.textContent?.includes('Tools')) { el.click(); return; }
  }
});
await page.waitForTimeout(800);
await shot(page, '03-tools-top');

await page.evaluate(() => window.scrollBy(0, 500));
await page.waitForTimeout(400);
await shot(page, '04-tools-invoice');

await page.evaluate(() => window.scrollBy(0, 600));
await page.waitForTimeout(400);
await shot(page, '05-tools-calculator');

await page.evaluate(() => window.scrollBy(0, 600));
await page.waitForTimeout(400);
await shot(page, '06-tools-bottom');

// ===== 4. Calculator tab switching =====
await page.evaluate(() => {
  const tabs = document.querySelectorAll('.calc-tab');
  if (tabs[1]) tabs[1].click();
});
await page.waitForTimeout(400);
await shot(page, '07-calc-shortcuts-tab');

await page.evaluate(() => {
  const tabs = document.querySelectorAll('.calc-tab');
  if (tabs[2]) tabs[2].click();
});
await page.waitForTimeout(400);
await shot(page, '08-calc-materials-tab');

await browser.close();
console.log(`\nScreenshots in: ${OUT}`);
