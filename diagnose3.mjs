import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const OUT = '/tmp/rivt-diagnose3';
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

// ===== CONTEXT 1: Auth screen =====
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
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
  await shot(page, '01-auth-screen-fixed');
  await ctx.close();
}

// ===== CONTEXT 2: Logged in as tradesperson =====
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  await page.route('**/api/auth/providers', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ providers: { email: { ok: true, mode: 'configured', missing: [], purpose: 'Email/password sign-in' } } }),
  }));
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

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForSelector('.nav-item', { timeout: 8000 }).catch(() => null);
  await page.waitForTimeout(1500);
  await shot(page, '02-home');

  // Navigate to Tools
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('.nav-item')) {
      if (el.textContent?.includes('Tools')) { el.click(); return; }
    }
  });
  await page.waitForTimeout(1000);
  await shot(page, '03-tools-top');

  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(400);
  await shot(page, '04-tools-invoice');

  await page.evaluate(() => window.scrollBy(0, 600));
  await page.waitForTimeout(400);
  await shot(page, '05-tools-calculator');

  // Check construction calculator tabs
  const hasTabs = await page.evaluate(() => document.querySelectorAll('.calc-tab').length);
  console.log(`\nCalc tabs found: ${hasTabs}`);

  if (hasTabs > 1) {
    await page.evaluate(() => document.querySelectorAll('.calc-tab')[1]?.click());
    await page.waitForTimeout(400);
    await shot(page, '06-calc-shortcuts-tab');

    await page.evaluate(() => document.querySelectorAll('.calc-tab')[2]?.click());
    await page.waitForTimeout(400);
    await shot(page, '07-calc-materials-tab');
  }

  await page.evaluate(() => window.scrollBy(0, 600));
  await page.waitForTimeout(400);
  await shot(page, '08-tools-bottom');

  await ctx.close();
}

await browser.close();
console.log(`\nScreenshots in: ${OUT}`);
