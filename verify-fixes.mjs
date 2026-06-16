import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT = '/tmp/rivt-verify';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let idx = 0;
async function shot(page, name) {
  const file = path.join(OUT, `${String(idx++).padStart(2,'0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`✓ ${path.basename(file)}`);
}

const MOCK_USER = {
  id: '1', email: 'rivttesting@gmail.com', provider: 'email',
  display_name: 'Ryan Mitchell', role: 'contractor',
  organization: 'Mitchell Contracting', location: 'Jacksonville, FL',
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

await page.route('**/api/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'offline' }) }));
await page.route('**/api/auth/providers', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ providers: { email: { ok: true, mode: 'configured', missing: [], purpose: 'Email/password sign-in' } } }) }));
await page.route('**/api/auth/me', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: MOCK_USER }) }));

await page.goto('http://localhost:5174', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForSelector('.nav-item', { timeout: 10000 }).catch(() => null);
await page.waitForTimeout(800);

// ── Home (no modal open)
await shot(page, 'home-clean');

// ── Open Post Job modal, then navigate — modal should close
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button')) {
    if (btn.textContent?.trim().includes('Post')) { btn.click(); return; }
  }
});
await page.waitForTimeout(500);
await shot(page, 'post-modal-open');

// Click Account panel — should close post modal
await page.evaluate(() => { document.querySelector('.user-menu')?.click(); });
await page.waitForTimeout(500);
await shot(page, 'account-opens-modal-gone');

// Navigate to Trust via account quick-actions — both should close
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('.quick-actions button')) {
    if (btn.textContent?.trim() === 'Trust') { btn.click(); return; }
  }
});
await page.waitForTimeout(700);
await shot(page, 'trust-after-account-nav');

// ── Marketplace
await page.evaluate(() => {
  for (const el of document.querySelectorAll('.nav-item')) {
    if (el.textContent?.trim() === 'Work') { el.click(); return; }
  }
});
await page.waitForTimeout(500);
await shot(page, 'marketplace');

// ── Messages
await page.evaluate(() => {
  for (const el of document.querySelectorAll('.nav-item')) {
    if (el.textContent?.trim() === 'Messages') { el.click(); return; }
  }
});
await page.waitForTimeout(500);
await shot(page, 'messages');

// ── Tools
await page.evaluate(() => {
  for (const el of document.querySelectorAll('.nav-item')) {
    if (el.textContent?.trim() === 'Tools') { el.click(); return; }
  }
});
await page.waitForTimeout(500);
await shot(page, 'tools');

// ── Sidebar profile (check no concatenation)
await page.evaluate(() => {
  for (const el of document.querySelectorAll('.nav-item')) {
    if (el.textContent?.trim() === 'Home') { el.click(); return; }
  }
});
await page.waitForTimeout(400);
await shot(page, 'sidebar-profile-check');

// ── Crew (consent status badge check)
await page.evaluate(() => {
  for (const el of document.querySelectorAll('.nav-item')) {
    if (el.textContent?.trim() === 'Crew') { el.click(); return; }
  }
});
await page.waitForTimeout(400);
await shot(page, 'crew-consent-badge');

await browser.close();
console.log(`\nDone — ${idx} screenshots in ${OUT}`);
