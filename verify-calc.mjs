import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const OUT = '/tmp/rivt-calc-verify';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5173';

let idx = 0;
async function shot(page, name) {
  const file = path.join(OUT, `${String(idx++).padStart(2,'0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`✓ ${path.basename(file)}`);
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); // iPhone size

// Mock auth as logged-in
await ctx.route('**/api/**', r => r.fulfill({ status: 503, body: '{}' }));
await ctx.route('**/api/auth/providers', r => r.fulfill({ status: 200, contentType: 'application/json',
  body: JSON.stringify({ providers: { email: { ok: true } } }) }));
await ctx.route('**/api/auth/me', r => r.fulfill({ status: 200, contentType: 'application/json',
  body: JSON.stringify({ user: { id: '1', email: 'test@example.com', provider: 'email',
    display_name: 'Ryan Mitchell', role: 'tradesperson', organization: 'Mitchell Contracting', location: 'Jacksonville, FL' } }) }));

const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForSelector('.nav-item', { timeout: 8000 }).catch(() => null);
await page.waitForTimeout(1500);

// Navigate to Tools
await page.evaluate(() => {
  for (const el of document.querySelectorAll('.nav-item')) {
    if (el.textContent?.includes('Tools')) { el.click(); return; }
  }
});
await page.waitForTimeout(800);
await shot(page, '01-tools-page');

// Scroll to construction calculator
await page.evaluate(() => {
  const el = document.querySelector('.construction-calculator');
  if (el) el.scrollIntoView({ block: 'start' });
});
await page.waitForTimeout(500);
await shot(page, '02-calc-measurement-tab');

// Click a few buttons to test the calculator
await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('.calc-num'));
  const btn5 = btns.find(b => b.textContent?.trim() === '5');
  if (btn5) btn5.click();
});
await page.waitForTimeout(300);
await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('.calc-mode-btn'));
  const inBtn = btns.find(b => b.textContent?.trim() === 'IN');
  if (inBtn) inBtn.click();
});
await page.waitForTimeout(200);
await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('.calc-num'));
  const btn9 = btns.find(b => b.textContent?.trim() === '9');
  if (btn9) btn9.click();
});
await page.waitForTimeout(200);
// Click 1/4 fraction
await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('.calc-frac-btn'));
  const frac14 = btns.find(b => b.textContent?.trim() === '1/4');
  if (frac14) frac14.click();
});
await page.waitForTimeout(300);
await shot(page, '03-calc-after-input-5ft9in14');

// Test the Sheet Optimizer tab
await page.evaluate(() => {
  const tabs = document.querySelectorAll('.calc-tab');
  for (const t of tabs) {
    if (t.textContent?.includes('Sheet')) { t.click(); return; }
  }
});
await page.waitForTimeout(600);
await shot(page, '04-sheet-optimizer-tab');

// Scroll to see the SVG layout
await page.evaluate(() => {
  const svg = document.querySelector('.sheet-svg');
  if (svg) svg.scrollIntoView({ block: 'center' });
});
await page.waitForTimeout(400);
await shot(page, '05-sheet-layout-svg');

await browser.close();
console.log(`\nScreenshots in: ${OUT}`);
