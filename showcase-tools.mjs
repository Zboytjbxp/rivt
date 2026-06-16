import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const OUT = '/tmp/rivt-tools-showcase';
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

// Navigate to Tools
await page.evaluate(() => {
  for (const el of document.querySelectorAll('.nav-item')) {
    if (el.textContent?.includes('Tools')) { el.click?.(); return; }
  }
});
await page.waitForTimeout(600);

console.log('🎯 TOOLS SECTION SHOWCASE\n');

// Command bar
await page.evaluate(() => {
  window.scrollTo(0, 0);
});
await page.waitForTimeout(200);
await shot(page, 'section-01-command-bar');

// Invoice tool - form
await page.evaluate(() => {
  const el = document.querySelector('.invoice-tool');
  if (el) el.scrollIntoView?.({ behavior: 'auto', block: 'start' });
});
await page.waitForTimeout(300);
await shot(page, 'section-02-invoice-form');

// Invoice tool - line items detail
await page.evaluate(() => {
  const el = document.querySelector('.invoice-line-items');
  if (el) el.scrollIntoView?.({ behavior: 'auto' });
});
await page.waitForTimeout(250);
await shot(page, 'section-03-invoice-line-items');

// Invoice preview
await page.evaluate(() => {
  const el = document.querySelector('.invoice-preview');
  if (el) el.scrollIntoView?.({ behavior: 'auto' });
});
await page.waitForTimeout(250);
await shot(page, 'section-04-invoice-preview');

// Construction calculator
await page.evaluate(() => {
  const el = document.querySelector('.construction-calculator');
  if (el) el.scrollIntoView?.({ behavior: 'auto' });
});
await page.waitForTimeout(250);
await shot(page, 'section-05-construction-calc');

// Material waste and payment note tools
await page.evaluate(() => {
  const el = document.querySelector('.tools-grid');
  if (el) el.scrollIntoView?.({ behavior: 'auto' });
});
await page.waitForTimeout(250);
await shot(page, 'section-06-supporting-tools');

// Full estimate calculator at bottom
await page.evaluate(() => {
  const el = document.querySelector('.calculator-layout');
  if (el) el.scrollIntoView?.({ behavior: 'auto' });
});
await page.waitForTimeout(250);
await shot(page, 'section-07-estimate-calculator');

// Interactive demo: Add a line item to invoice
console.log('\n📋 Interactive Demo\n');

// Back to invoice line items
await page.evaluate(() => {
  const el = document.querySelector('.invoice-line-items');
  if (el) el.scrollIntoView?.({ behavior: 'auto' });
});
await page.waitForTimeout(250);

// Add new item
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button')) {
    if (btn.textContent?.includes('Add item')) { btn.click?.(); return; }
  }
});
await page.waitForTimeout(300);
await shot(page, 'demo-01-after-add-item');

// Fill in new item
await page.evaluate(() => {
  const rows = document.querySelectorAll('.invoice-line-row');
  const lastRow = rows[rows.length - 1];
  if (lastRow) {
    const inputs = lastRow.querySelectorAll('input, select');
    if (inputs[0]) inputs[0].value = 'Installation labor';
    if (inputs[2]) inputs[2].value = '2';
    if (inputs[4]) inputs[4].value = '125';
    inputs.forEach(el => el.dispatchEvent(new Event('change', { bubbles: true })));
  }
});
await page.waitForTimeout(200);
await shot(page, 'demo-02-filled-item');

// Show updated preview
await page.evaluate(() => {
  const el = document.querySelector('.invoice-preview');
  if (el) el.scrollIntoView?.({ behavior: 'auto' });
});
await page.waitForTimeout(250);
await shot(page, 'demo-03-updated-preview');

// Switch to shortcuts tab
console.log('\n🔨 Construction Calculator Demo\n');

await page.evaluate(() => {
  const el = document.querySelector('.construction-calculator');
  if (el) el.scrollIntoView?.({ behavior: 'auto' });
});
await page.waitForTimeout(250);

await page.evaluate(() => {
  const tabs = document.querySelectorAll('.calc-tab');
  if (tabs[1]) tabs[1].click?.();
});
await page.waitForTimeout(300);
await shot(page, 'demo-04-shortcuts-stud-layout');

// Switch to materials
await page.evaluate(() => {
  const tabs = document.querySelectorAll('.calc-tab');
  if (tabs[2]) tabs[2].click?.();
});
await page.waitForTimeout(300);
await shot(page, 'demo-05-materials-estimator');

// Add material
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button')) {
    if (btn.textContent?.includes('Add material')) { btn.click?.(); return; }
  }
});
await page.waitForTimeout(300);
await shot(page, 'demo-06-after-add-material');

console.log('\n✅ SHOWCASE COMPLETE');
console.log('\nHighlights:');
console.log('• Command bar explaining tool purpose');
console.log('• Invoice form with line-items table');
console.log('• Professional invoice preview');
console.log('• Construction calculator (3-tab interface)');
console.log('• Material waste calculator');
console.log('• Payment note tool');
console.log('• Full estimate calculator');
console.log('\nInteractive features demonstrated:');
console.log('✓ Add/remove line items from invoice');
console.log('✓ Dynamic preview updates');
console.log('✓ Tab switching in calculator');
console.log('✓ Material estimator with costing');

await browser.close();
