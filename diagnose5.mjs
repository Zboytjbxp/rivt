import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const OUT = '/tmp/rivt-diagnose5';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5173';

let idx = 0;
async function shot(page, name) {
  const file = path.join(OUT, `${String(idx++).padStart(2,'0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false }); // viewport only
  console.log(`✓ ${path.basename(file)}`);
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await ctx.newPage();

await page.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' }));
await page.route('**/api/auth/providers', route => route.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify({ providers: { email: { ok: true, mode: 'configured', missing: [], purpose: 'Email/password sign-in' } } }),
}));
await page.route('**/api/auth/me', route => route.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify({ user: {
    id: '1', email: 'test@example.com', provider: 'email',
    display_name: 'Ryan Mitchell', role: 'tradesperson',
    organization: 'Mitchell Contracting', location: 'Jacksonville, FL',
  }}),
}));

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForSelector('.nav-item', { timeout: 8000 }).catch(() => null);
await page.waitForTimeout(1500);

// Auth screen first
await ctx.close();

const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page2 = await ctx2.newPage();
await page2.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' }));
await page2.route('**/api/auth/providers', route => route.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify({ providers: { email: { ok: true, mode: 'configured', missing: [], purpose: 'Email/password sign-in' } } }),
}));
await page2.route('**/api/auth/me', route => route.fulfill({
  status: 401, contentType: 'application/json', body: '{"error":"not authenticated"}',
}));
await page2.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
await page2.waitForTimeout(2000);
await shot(page2, '01-auth-screen');
await ctx2.close();

// Logged-in sessions
const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page3 = await ctx3.newPage();
await page3.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' }));
await page3.route('**/api/auth/providers', route => route.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify({ providers: { email: { ok: true, mode: 'configured', missing: [], purpose: 'Email/password sign-in' } } }),
}));
await page3.route('**/api/auth/me', route => route.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify({ user: {
    id: '1', email: 'test@example.com', provider: 'email',
    display_name: 'Ryan Mitchell', role: 'tradesperson',
    organization: 'Mitchell Contracting', location: 'Jacksonville, FL',
  }}),
}));

await page3.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
await page3.waitForSelector('.nav-item', { timeout: 8000 }).catch(() => null);
await page3.waitForTimeout(1500);
await shot(page3, '02-home');

// Navigate to Tools
await page3.evaluate(() => {
  for (const el of document.querySelectorAll('.nav-item')) {
    if (el.textContent?.includes('Tools')) { el.click(); return; }
  }
});
await page3.waitForTimeout(800);
await shot(page3, '03-tools-command-bar');

// Scroll to invoice
await page3.evaluate(() => {
  const el = document.querySelector('.invoice-tool');
  if (el) el.scrollIntoView({ block: 'start' });
});
await page3.waitForTimeout(500);
await shot(page3, '04-invoice-tool');

// Scroll to construction calculator
await page3.evaluate(() => {
  const el = document.querySelector('.construction-calculator');
  if (el) el.scrollIntoView({ block: 'start' });
});
await page3.waitForTimeout(500);
await shot(page3, '05-construction-calculator-measurements');

// Click Shortcuts tab
await page3.evaluate(() => {
  const tabs = document.querySelectorAll('.calc-tab');
  if (tabs[1]) tabs[1].click();
});
await page3.waitForTimeout(400);
await shot(page3, '06-calculator-shortcuts');

// Click Materials tab
await page3.evaluate(() => {
  const tabs = document.querySelectorAll('.calc-tab');
  if (tabs[2]) tabs[2].click();
});
await page3.waitForTimeout(400);
await shot(page3, '07-calculator-materials');

// Invoice line items
await page3.evaluate(() => {
  const el = document.querySelector('.invoice-line-items, .invoice-line-table');
  if (el) el.scrollIntoView({ block: 'center' });
});
await page3.waitForTimeout(400);
await shot(page3, '08-invoice-line-items');

await ctx3.close();
await browser.close();
console.log(`\nScreenshots in: ${OUT}`);
