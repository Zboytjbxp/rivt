import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const OUT = '/tmp/rivt-tour';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5177';

let idx = 0;
async function shot(page, name) {
  const file = path.join(OUT, `${String(idx++).padStart(2,'0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`✓ ${path.basename(file)}`);
}

// Click nav-item by sidebar text
async function navTo(page, text) {
  const ok = await page.evaluate((t) => {
    for (const el of document.querySelectorAll('.nav-item')) {
      if (el.textContent?.trim() === t) { el.click(); return true; }
    }
    return false;
  }, text);
  if (!ok) console.warn(`  ⚠ no nav-item "${text}"`);
  await page.waitForTimeout(700);
}

// Click any button by exact text
async function clickText(page, text) {
  const ok = await page.evaluate((t) => {
    for (const el of document.querySelectorAll('button, a')) {
      if (el.textContent?.trim() === t) { el.click(); return true; }
    }
    return false;
  }, text);
  if (!ok) console.warn(`  ⚠ no button "${text}"`);
  await page.waitForTimeout(700);
}

// Open account panel, click a quick-action which auto-closes panel and navigates
async function accountNav(page, btnText) {
  // Open account panel
  await page.evaluate(() => { document.querySelector('.user-menu')?.click(); });
  await page.waitForTimeout(500);
  // Click the nav button inside the panel
  const ok = await page.evaluate((t) => {
    for (const el of document.querySelectorAll('.side-panel button, .quick-actions button')) {
      if (el.textContent?.trim() === t) { el.click(); return true; }
    }
    return false;
  }, btnText);
  if (!ok) console.warn(`  ⚠ account panel btn "${btnText}"`);
  await page.waitForTimeout(700);
}

const MOCK_USER = {
  id: '1',
  email: 'rivttesting@gmail.com',
  provider: 'email',
  display_name: 'Ryan Mitchell',
  role: 'contractor',
  organization: 'Mitchell Contracting',
  location: 'Jacksonville, FL',
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

// Playwright routes fire LIFO — catch-all registered FIRST is tried LAST
await page.route('**/api/**', route =>
  route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'offline' }) })
);
// Specific auth routes registered LAST are tried FIRST (override the catch-all)
await page.route('**/api/auth/providers', route => route.fulfill({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({
    providers: {
      google: { ok: false, mode: 'setup_required', missing: ['GOOGLE_CLIENT_ID'], purpose: 'Google sign-in' },
      facebook: { ok: false, mode: 'setup_required', missing: ['FACEBOOK_APP_ID'], purpose: 'Facebook sign-in' },
      apple: { ok: false, mode: 'setup_required', missing: ['APPLE_CLIENT_ID'], purpose: 'Apple sign-in' },
      email: { ok: true, mode: 'configured', missing: [], purpose: 'Email/password sign-in' },
    },
  }),
}));
await page.route('**/api/auth/me', route => route.fulfill({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ user: MOCK_USER }),
}));

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
// Wait for auth hydration to complete — workspace appears after /api/auth/me resolves
await page.waitForSelector('.topbar, .workspace, .nav-item', { timeout: 10000 }).catch(() => null);
await page.waitForTimeout(1000);

// ── Home ────────────────────────────────────────────────────
await shot(page, 'home');

// ── Work / Marketplace ──────────────────────────────────────
await navTo(page, 'Work');
await shot(page, 'marketplace');

// ── Expand a job to see detail ─────────────────────────────
// (click Post job to see modal)
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button')) {
    if (btn.textContent?.trim().includes('Post')) { btn.click(); return; }
  }
});
await page.waitForTimeout(600);
await shot(page, 'post-job-modal');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// ── Shop Talk ───────────────────────────────────────────────
await navTo(page, 'Shop Talk');
await shot(page, 'shop-talk');

// ── Tools ───────────────────────────────────────────────────
await navTo(page, 'Tools');
await shot(page, 'tools');

// ── Crew ───────────────────────────────────────────────────
await navTo(page, 'Crew');
await shot(page, 'crew');

// ── Messages ───────────────────────────────────────────────
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button')) {
    if (btn.getAttribute('aria-label') === 'Messages') { btn.click(); return; }
  }
});
await page.waitForTimeout(700);
await shot(page, 'messages');

// ── Trust & Legal (via account panel) ──────────────────────
await accountNav(page, 'Trust');
await shot(page, 'trust-legal');

// ── Safety & Training ──────────────────────────────────────
await accountNav(page, 'Training');
await shot(page, 'safety-training');

// ── Reviews ────────────────────────────────────────────────
await accountNav(page, 'Reviews');
await shot(page, 'reviews');

// ── Settings ───────────────────────────────────────────────
await accountNav(page, 'Settings');
await shot(page, 'settings');

// ── Records (via notifications panel) ──────────────────────
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button')) {
    if (btn.getAttribute('aria-label') === 'Notifications') { btn.click(); return; }
  }
});
await page.waitForTimeout(500);
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('.quick-actions button')) {
    if (btn.textContent?.trim() === 'Records') { btn.click(); return; }
  }
});
await page.waitForTimeout(700);
await shot(page, 'records');

// ── Notifications panel (full view) ────────────────────────
await navTo(page, 'Home');
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button')) {
    if (btn.getAttribute('aria-label') === 'Notifications') { btn.click(); return; }
  }
});
await page.waitForTimeout(500);
await shot(page, 'notifications');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// ── Account panel ──────────────────────────────────────────
await page.evaluate(() => { document.querySelector('.user-menu')?.click(); });
await page.waitForTimeout(500);
await shot(page, 'account-panel');
// Scroll account panel down to see themes/palette section
await page.evaluate(() => {
  const panel = document.querySelector('.side-panel');
  if (panel) panel.scrollTop = 400;
});
await page.waitForTimeout(300);
await shot(page, 'account-panel-themes');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// ── Post Job modal (full) ───────────────────────────────────
await navTo(page, 'Work');
await page.waitForTimeout(400);
// Click the "Post job" CTA (in MarketplaceView command bar)
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button')) {
    if (btn.textContent?.trim().includes('Post')) { btn.click(); return; }
  }
});
await page.waitForTimeout(600);
// Scroll modal if needed
await page.evaluate(() => {
  const modal = document.querySelector('.post-modal');
  if (modal) modal.scrollTop = 0;
});
await shot(page, 'post-job-modal-full');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// ── Home (final overview) ───────────────────────────────────
await navTo(page, 'Home');
await shot(page, 'home-final');

await browser.close();
console.log(`\nDone — ${idx} screenshots in ${OUT}`);
