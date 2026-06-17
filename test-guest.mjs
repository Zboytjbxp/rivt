import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const OUT = '/tmp/rivt-guest-test';
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
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await ctx.newPage();

// Set up as unauthenticated (shows login screen)
await page.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' }));
await page.route('**/api/auth/providers', route => route.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify({ providers: { email: { ok: true, mode: 'configured', missing: [], purpose: 'Email/password sign-in' } } }),
}));
await page.route('**/api/auth/me', route => route.fulfill({
  status: 401, contentType: 'application/json', body: '{"error":"not authenticated"}',
}));

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(2000);
await shot(page, '01-auth-screen');

// Click "Browse as guest"
const guestBtn = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('guest'));
  if (btn) { btn.click(); return btn.textContent; }
  return null;
});
console.log(`\nGuest button text: "${guestBtn}"`);
await page.waitForTimeout(1500);
await shot(page, '02-after-guest-click');

// Check what's showing
const state = await page.evaluate(() => ({
  url: window.location.href,
  hasNavItems: !!document.querySelector('.nav-item'),
  hasGuestBanner: !!document.querySelector('[class*="guest"]'),
  bodyText: document.body.innerText.substring(0, 300),
}));
console.log('\nState after guest click:');
console.log(JSON.stringify(state, null, 2));

// If we're in the app, take more shots
if (state.hasNavItems) {
  await shot(page, '03-guest-home');

  // Try navigating to Work
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('.nav-item')) {
      if (el.textContent?.includes('Work')) { el.click(); return; }
    }
  });
  await page.waitForTimeout(800);
  await shot(page, '04-guest-work-feed');

  // Try Tools
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('.nav-item')) {
      if (el.textContent?.includes('Tools')) { el.click(); return; }
    }
  });
  await page.waitForTimeout(800);
  await shot(page, '05-guest-tools');

  // Try Shop Talk
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('.nav-item')) {
      if (el.textContent?.includes('Talk')) { el.click(); return; }
    }
  });
  await page.waitForTimeout(800);
  await shot(page, '06-guest-shop-talk');
}

await browser.close();
console.log(`\nScreenshots in: ${OUT}`);
