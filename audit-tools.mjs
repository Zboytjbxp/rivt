import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const OUT = '/tmp/rivt-tools-audit';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5173';

let idx = 0;
async function shot(page, name) {
  const file = path.join(OUT, `${String(idx++).padStart(2,'0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`✓ ${path.basename(file)}`);
}

const MOCK_USER = {
  id: '1',
  email: 'rivttesting@gmail.com',
  provider: 'email',
  display_name: 'Ryan Mitchell',
  role: 'tradesperson',
  organization: 'Mitchell Contracting',
  location: 'Jacksonville, FL',
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

await page.route('**/api/**', route =>
  route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'offline' }) })
);
await page.route('**/api/auth/providers', route => route.fulfill({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({
    providers: { email: { ok: true, mode: 'configured', missing: [], purpose: 'Email/password sign-in' } },
  }),
}));
await page.route('**/api/auth/me', route => route.fulfill({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ user: MOCK_USER }),
}));

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForSelector('.topbar, .workspace, .nav-item', { timeout: 10000 }).catch(() => null);
await page.waitForTimeout(1000);

console.log('=== TOOLS SECTION AUDIT ===\n');

// Navigate to Tools
await page.evaluate(() => {
  for (const el of document.querySelectorAll('.nav-item')) {
    if (el.textContent?.includes('Tools')) { el.click?.(); return; }
  }
});
await page.waitForTimeout(600);

// Screenshot: Full Tools view (top)
await page.evaluate(() => { document.querySelector('.tools-layout')?.scrollIntoView?.(); });
await page.waitForTimeout(200);
await shot(page, 'tools-top');

// Scroll down to see invoice tool
await page.evaluate(() => {
  const el = document.querySelector('.invoice-tool');
  if (el) el.scrollIntoView({ behavior: 'auto' });
});
await page.waitForTimeout(300);
await shot(page, 'invoice-tool-form');

// Scroll to see invoice preview
await page.evaluate(() => {
  const el = document.querySelector('.invoice-preview');
  if (el) el.scrollIntoView({ behavior: 'auto' });
});
await page.waitForTimeout(300);
await shot(page, 'invoice-preview');

// Scroll down to see small tools grid
await page.evaluate(() => {
  const el = document.querySelector('.tools-grid');
  if (el) el.scrollIntoView({ behavior: 'auto' });
});
await page.waitForTimeout(300);
await shot(page, 'tools-grid-cards');

// Scroll to calculator
await page.evaluate(() => {
  const el = document.querySelector('.calculator-layout');
  if (el) el.scrollIntoView({ behavior: 'auto' });
});
await page.waitForTimeout(300);
await shot(page, 'calculator-form');

// Scroll to calculator results
await page.evaluate(() => {
  const el = document.querySelector('.calculator-results-panel');
  if (el) el.scrollIntoView({ behavior: 'auto' });
});
await page.waitForTimeout(300);
await shot(page, 'calculator-results');

console.log('\nTools audit complete. Analyzing current state...\n');

// Analyze what's there
const hasInvoice = await page.evaluate(() => !!document.querySelector('.invoice-tool'));
const hasCalc = await page.evaluate(() => !!document.querySelector('.calculator-layout'));
const hasFraction = await page.evaluate(() => {
  const text = document.body.innerText;
  return text.includes('Foot-inch') || text.includes('Field math');
});
const hasMaterial = await page.evaluate(() => {
  const text = document.body.innerText;
  return text.includes('Waste') && text.includes('Material');
});
const hasPayment = await page.evaluate(() => {
  const text = document.body.innerText;
  return text.includes('Direct payment') || text.includes('Bookkeeping');
});

console.log('Current Tools:');
console.log(`✓ Invoice builder: ${hasInvoice}`);
console.log(`✓ Estimate calculator: ${hasCalc}`);
console.log(`✓ Fraction/foot-inch tool: ${hasFraction}`);
console.log(`✓ Material waste calculator: ${hasMaterial}`);
console.log(`✓ Payment note tool: ${hasPayment}`);

await browser.close();
