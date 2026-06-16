import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const OUT = '/tmp/rivt-full-audit';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5173';

let idx = 0;
async function shot(page, name) {
  const file = path.join(OUT, `${String(idx++).padStart(3,'0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`✓ ${path.basename(file)}`);
}

async function navTo(page, text) {
  const ok = await page.evaluate((t) => {
    for (const el of document.querySelectorAll('.nav-item')) {
      if (el.textContent?.trim() === t) { el.click(); return true; }
    }
    return false;
  }, text);
  if (!ok) { console.warn(`  ⚠ nav-item "${text}"`); return false; }
  await page.waitForTimeout(600);
  return true;
}

async function accountNav(page, btnText) {
  await page.evaluate(() => { document.querySelector('.user-menu')?.click(); });
  await page.waitForTimeout(400);
  const ok = await page.evaluate((t) => {
    for (const el of document.querySelectorAll('.side-panel button, .quick-actions button')) {
      if (el.textContent?.trim() === t) { el.click(); return true; }
    }
    return false;
  }, btnText);
  if (!ok) { console.warn(`  ⚠ account panel btn "${btnText}"`); return false; }
  await page.waitForTimeout(600);
  return true;
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

// Mock auth
await page.route('**/api/**', route =>
  route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'offline' }) })
);
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
await page.waitForSelector('.topbar, .workspace, .nav-item', { timeout: 10000 }).catch(() => null);
await page.waitForTimeout(1000);

console.log('\n=== HOME ===');
await shot(page, 'home');

console.log('\n=== MARKETPLACE / WORK ===');
await navTo(page, 'Work');
await shot(page, 'marketplace-full');

// Click a job to see detail panel
await page.evaluate(() => {
  const jobs = document.querySelectorAll('.job-list-row, .data-row, .job-card, [role="button"]');
  for (const el of jobs) {
    if (el.textContent?.includes('Electrical')) { el.click?.(); return; }
  }
});
await page.waitForTimeout(500);
await shot(page, 'marketplace-job-detail');

// Test filters
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button, [role="button"]')) {
    if (btn.textContent?.includes('Filter') || btn.textContent?.includes('filter')) { btn.click?.(); return; }
  }
});
await page.waitForTimeout(400);
const hasFilter = await page.evaluate(() => {
  return document.querySelector('[class*="filter"], [role="dialog"]') !== null;
});
console.log(`Filter modal: ${hasFilter ? '✓' : '⚠ not found'}`);

// Post job modal
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button')) {
    if (btn.textContent?.includes('Post') && btn.textContent?.includes('job')) { btn.click?.(); return; }
  }
});
await page.waitForTimeout(600);
await shot(page, 'post-job-modal');

// Scroll to see quiz section
await page.evaluate(() => {
  const modal = document.querySelector('.post-modal, [role="dialog"]');
  if (modal) modal.scrollTop = 500;
});
await page.waitForTimeout(300);
await shot(page, 'post-job-quiz-section');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

console.log('\n=== SHOP TALK ===');
await navTo(page, 'Shop Talk');
await shot(page, 'shop-talk');

console.log('\n=== TOOLS ===');
await navTo(page, 'Tools');
await shot(page, 'tools');

console.log('\n=== CREW ===');
await navTo(page, 'Crew');
await shot(page, 'crew');

console.log('\n=== MESSAGES ===');
// Find the messages button in the topbar
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button')) {
    if (btn.getAttribute('aria-label') === 'Messages') { btn.click?.(); return; }
  }
});
await page.waitForTimeout(600);
await shot(page, 'messages');

console.log('\n=== TRUST & LEGAL ===');
await accountNav(page, 'Trust');
await shot(page, 'trust-legal');

console.log('\n=== RECORDS ===');
await accountNav(page, 'Records');
await shot(page, 'records');

console.log('\n=== SAFETY & TRAINING ===');
await accountNav(page, 'Training');
await shot(page, 'safety-training-overview');

// Test quiz taker
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button')) {
    if (btn.textContent?.includes('Ladder')) { btn.click?.(); return; }
  }
});
await page.waitForTimeout(500);
await shot(page, 'safety-quiz-start');

// Select and confirm answer
await page.evaluate(() => {
  const opts = document.querySelectorAll('.quiz-option:not(:disabled)');
  if (opts[1]) opts[1].click();
});
await page.waitForTimeout(150);
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button')) {
    if (btn.textContent?.trim() === 'Confirm answer') { btn.click?.(); return; }
  }
});
await page.waitForTimeout(300);
await shot(page, 'safety-quiz-explanation');

// Complete quiz by clicking through
for (let i = 0; i < 5; i++) {
  const nextBtn = await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button')) {
      if (btn.textContent?.includes('Next') || btn.textContent?.includes('See results')) { return true; }
    }
    return false;
  });
  if (!nextBtn) break;

  await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button')) {
      const t = btn.textContent?.trim();
      if (t === 'Next question' || t === 'See results') { btn.click?.(); return; }
    }
  });
  await page.waitForTimeout(150);

  const notDone = await page.evaluate(() => {
    return document.querySelector('.quiz-option:not(:disabled)') !== null;
  });
  if (!notDone) break;

  await page.evaluate(() => {
    const opts = document.querySelectorAll('.quiz-option:not(:disabled)');
    if (opts[1]) opts[1].click();
  });
  await page.waitForTimeout(100);

  await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button')) {
      if (btn.textContent?.trim() === 'Confirm answer') { btn.click?.(); return; }
    }
  });
  await page.waitForTimeout(100);
}

// Final next
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button')) {
    const t = btn.textContent?.trim();
    if (t === 'Next question' || t === 'See results') { btn.click?.(); return; }
  }
});
await page.waitForTimeout(500);
await shot(page, 'safety-quiz-results');

// Back to overview
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button')) {
    if (btn.textContent?.includes('Back')) { btn.click?.(); return; }
  }
});
await page.waitForTimeout(500);
await shot(page, 'safety-overview-after-attempt');

console.log('\n=== REVIEWS ===');
await accountNav(page, 'Reviews');
await shot(page, 'reviews');

console.log('\n=== SETTINGS ===');
await accountNav(page, 'Settings');
await shot(page, 'settings');

console.log('\n=== ACCOUNT PANEL ===');
await page.evaluate(() => { document.querySelector('.user-menu')?.click(); });
await page.waitForTimeout(500);
await shot(page, 'account-panel');

// Scroll down to see stat grid with safety certs
await page.evaluate(() => {
  const panel = document.querySelector('.side-panel');
  if (panel) panel.scrollTop = 0;
});
await page.waitForTimeout(200);
await shot(page, 'account-panel-stats');

// Scroll to see themes
await page.evaluate(() => {
  const panel = document.querySelector('.side-panel');
  if (panel) panel.scrollTop = 400;
});
await page.waitForTimeout(200);
await shot(page, 'account-panel-themes');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

console.log('\n=== NOTIFICATIONS ===');
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button')) {
    if (btn.getAttribute('aria-label') === 'Notifications') { btn.click?.(); return; }
  }
});
await page.waitForTimeout(600);
await shot(page, 'notifications-panel');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

console.log('\n=== HOME (FINAL) ===');
await navTo(page, 'Home');
await shot(page, 'home-final');

await browser.close();
console.log(`\n✅ Complete audit: ${idx} screenshots in ${OUT}`);
