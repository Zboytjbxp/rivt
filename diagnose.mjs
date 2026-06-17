import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const OUT = '/tmp/rivt-diagnose';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5173';

let idx = 0;
async function shot(page, name) {
  const file = path.join(OUT, `${String(idx++).padStart(2,'0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`✓ ${path.basename(file)}`);
  return file;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

// ===== 1. Auth screen (no mock) — see guest login =====
await page.route('**/api/auth/providers', route => route.fulfill({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({
    providers: { email: { ok: true, mode: 'configured', missing: [], purpose: 'Email/password sign-in' } },
  }),
}));
await page.route('**/api/auth/me', route => route.fulfill({
  status: 401,
  contentType: 'application/json',
  body: JSON.stringify({ error: 'not authenticated' }),
}));

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(2000);
await shot(page, '01-auth-screen-guest-login');

// ===== 2. Now log in with mock user =====
await page.route('**/api/auth/me', route => route.fulfill({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({
    user: {
      id: '1',
      email: 'rivttesting@gmail.com',
      provider: 'email',
      display_name: 'Ryan Mitchell',
      role: 'tradesperson',
      organization: 'Mitchell Contracting',
      location: 'Jacksonville, FL',
    }
  }),
}));
await page.route('**/api/**', route => {
  if (!route.request().url().includes('auth')) {
    route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'offline' }) });
  } else {
    route.continue();
  }
});

await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(2000);
await shot(page, '02-home');

// ===== 3. Tools section =====
await page.evaluate(() => {
  for (const el of document.querySelectorAll('.nav-item, button')) {
    if (el.textContent?.trim() === 'Tools') { el.click(); return; }
  }
});
await page.waitForTimeout(800);
await shot(page, '03-tools-top');

// Scroll down to see all tools content
await page.evaluate(() => window.scrollBy(0, 400));
await page.waitForTimeout(400);
await shot(page, '04-tools-scrolled-400');

await page.evaluate(() => window.scrollBy(0, 500));
await page.waitForTimeout(400);
await shot(page, '05-tools-scrolled-900');

await page.evaluate(() => window.scrollBy(0, 500));
await page.waitForTimeout(400);
await shot(page, '06-tools-scrolled-1400');

// ===== 4. Check what's actually rendered in Tools =====
const toolsHTML = await page.evaluate(() => {
  const main = document.querySelector('main, .workspace, [class*="content"]');
  return main ? main.innerHTML.substring(0, 5000) : 'no main found';
});
console.log('\n--- TOOLS HTML SNIPPET ---');
console.log(toolsHTML.substring(0, 2000));

// Check for specific elements
const checks = await page.evaluate(() => {
  return {
    invoiceTool: !!document.querySelector('.invoice-tool'),
    invoiceLineItems: !!document.querySelector('.invoice-line-items'),
    constructionCalc: !!document.querySelector('.construction-calculator'),
    calcTabs: !!document.querySelector('.calc-tab'),
    toolsGrid: !!document.querySelector('.tools-grid'),
    noWorkOrder: !!document.querySelector('*[class*="no-active"], *[class*="locked"]'),
    allText: document.body.innerText.substring(0, 500),
  };
});
console.log('\n--- ELEMENT CHECKS ---');
console.log(JSON.stringify(checks, null, 2));

await browser.close();
console.log(`\nScreenshots in: ${OUT}`);
