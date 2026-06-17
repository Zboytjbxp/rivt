import { chromium } from 'playwright';
import fs from 'fs';

const OUT = '/tmp/rivt-audit';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
let i = 0;
const shot = async (page, name) => {
  const f = `${OUT}/${String(i++).padStart(2,'0')}-${name}.png`;
  await page.screenshot({ path: f, fullPage: false });
  console.log(`✓ ${name}`);
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();

await page.route('**/api/auth/providers', r => r.fulfill({ status: 200, contentType: 'application/json',
  body: JSON.stringify({ providers: { email: { ok: true } } }) }));
await page.route('**/api/auth/me', r => r.fulfill({ status: 200, contentType: 'application/json',
  body: JSON.stringify({ user: { id: '1', email: 'test@example.com', provider: 'email',
    display_name: 'Ryan Mitchell', role: 'tradesperson', organization: 'Mitchell Contracting', location: 'Jacksonville, FL' } }) }));
await page.route('**/api/**', r => r.fulfill({ status: 503, body: '{}' }));

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForSelector('.nav-item', { timeout: 8000 }).catch(() => null);
await page.waitForTimeout(1500);
await shot(page, 'home-top');

// Scroll home feed
await page.evaluate(() => window.scrollBy(0, 400));
await page.waitForTimeout(400);
await shot(page, 'home-scroll');

// Nav items
const navItems = await page.evaluate(() =>
  Array.from(document.querySelectorAll('.nav-item')).map(el => el.textContent?.trim())
);
console.log('Nav items:', navItems);

const navTo = async (label, name) => {
  await page.evaluate((lbl) => {
    for (const el of document.querySelectorAll('.nav-item')) {
      if (el.textContent?.includes(lbl)) { el.click(); return; }
    }
  }, label);
  await page.waitForTimeout(1000);
  await shot(page, name + '-top');
  await page.evaluate(() => window.scrollBy(0, 400));
  await page.waitForTimeout(300);
  await shot(page, name + '-scroll');
};

await navTo('Work', 'work');
await navTo('Tools', 'tools');
await page.evaluate(() => window.scrollBy(0, 600));
await page.waitForTimeout(300);
await shot(page, 'tools-scroll2');
await navTo('Crew', 'crew');
await navTo('Talk', 'shop-talk');
await navTo('Records', 'records');
await navTo('Messages', 'messages');

// Try to find more nav
const allNav = await page.evaluate(() =>
  Array.from(document.querySelectorAll('[class*="nav"], [class*="tab-bar"], [class*="bottom"]'))
    .map(el => ({ cls: el.className, text: el.textContent?.substring(0,100) }))
);
console.log('All nav elements:', JSON.stringify(allNav.slice(0,5)));

// Header
await shot(page, 'header-close');

await browser.close();
console.log(`\nDone: ${OUT}`);
