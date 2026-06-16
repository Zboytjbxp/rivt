import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const OUT = '/tmp/rivt-verify-all';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5173';

let idx = 0;
async function shot(page, name) {
  const file = path.join(OUT, `${String(idx++).padStart(3,'0')}-${name}.png`);
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

console.log('🎯 COMPREHENSIVE RIVT APP VERIFICATION\n');

// Helper to click nav items
async function clickNav(text) {
  await page.evaluate((target) => {
    for (const el of document.querySelectorAll('.nav-item')) {
      if (el.textContent?.includes(target)) { el.click?.(); return; }
    }
  }, text);
  await page.waitForTimeout(600);
}

// Helper to click buttons
async function clickButton(text) {
  await page.evaluate((target) => {
    for (const btn of document.querySelectorAll('button')) {
      if (btn.textContent?.includes(target)) { btn.click?.(); return; }
    }
  }, text);
  await page.waitForTimeout(400);
}

// ===== HOME =====
console.log('\n📱 HOME\n');
await clickNav('Home');
await shot(page, '001-home');

// ===== MARKETPLACE/WORK =====
console.log('\n🏪 MARKETPLACE/WORK\n');
await clickNav('Marketplace');
await shot(page, '002-marketplace-jobfeed');

// Check for filters
await page.evaluate(() => {
  const filterBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Filter'));
  filterBtn?.click?.();
});
await page.waitForTimeout(400);
await shot(page, '003-marketplace-filters');

// Close filter if open
await page.evaluate(() => {
  const backdrop = document.querySelector('.fixed.inset-0');
  if (backdrop) backdrop.click?.();
});
await page.waitForTimeout(300);

// Try to find and click a job to see detail panel
await page.evaluate(() => {
  const jobCards = document.querySelectorAll('[class*="card"], [class*="job"]');
  if (jobCards.length > 0) jobCards[0].click?.();
});
await page.waitForTimeout(400);
await shot(page, '004-marketplace-jobdetail');

// Close and check post job modal
await page.evaluate(() => {
  const backdrop = document.querySelector('.fixed.inset-0');
  if (backdrop) backdrop.click?.();
});
await page.waitForTimeout(300);

await clickButton('Post a Job');
await shot(page, '005-marketplace-postjob');

// ===== SHOP TALK =====
console.log('\n💬 SHOP TALK\n');
await clickNav('Shop Talk');
await shot(page, '006-shoptalk');

// ===== TOOLS =====
console.log('\n🔧 TOOLS\n');
await clickNav('Tools');
await shot(page, '007-tools-overview');
await page.evaluate(() => window.scrollTo(0, 500));
await page.waitForTimeout(300);
await shot(page, '008-tools-scrolled');

// ===== CREW =====
console.log('\n👥 CREW\n');
await clickNav('Crew');
await shot(page, '009-crew');

// ===== MESSAGES =====
console.log('\n📬 MESSAGES\n');
await clickNav('Messages');
await shot(page, '010-messages');

// ===== RECORDS =====
console.log('\n📋 RECORDS\n');
await clickNav('Records');
await shot(page, '011-records');

// ===== SAFETY & TRAINING =====
console.log('\n🛡️ SAFETY & TRAINING\n');
await clickNav('Safety & Training');
await shot(page, '012-safety-training');

// Try to click into a quiz
await page.evaluate(() => {
  const quizCards = document.querySelectorAll('[class*="quiz"], button');
  for (const card of quizCards) {
    if (card.textContent?.toLowerCase().includes('quiz') || card.textContent?.toLowerCase().includes('start')) {
      card.click?.();
      return;
    }
  }
});
await page.waitForTimeout(500);
await shot(page, '013-safety-quiz-taker');

// ===== SETTINGS =====
console.log('\n⚙️ SETTINGS\n');
await page.evaluate(() => {
  const settingsBtn = Array.from(document.querySelectorAll('button, [role="button"]')).find(
    b => b.textContent?.includes('Settings') || b.textContent?.includes('⚙️')
  );
  settingsBtn?.click?.();
});
await page.waitForTimeout(500);
await shot(page, '014-settings');

// ===== NOTIFICATIONS =====
console.log('\n🔔 NOTIFICATIONS\n');
await page.evaluate(() => {
  const notifBtn = Array.from(document.querySelectorAll('button, [role="button"]')).find(
    b => b.textContent?.includes('🔔') || b.textContent?.includes('Notif')
  );
  notifBtn?.click?.();
});
await page.waitForTimeout(500);
await shot(page, '015-notifications');

// ===== ACCOUNT PANEL =====
console.log('\n👤 ACCOUNT PANEL\n');
await page.evaluate(() => {
  const accountBtn = Array.from(document.querySelectorAll('button, [role="button"]')).find(
    b => b.textContent?.includes('RM') || b.textContent?.includes('Profile') || b.textContent?.includes('Account')
  );
  accountBtn?.click?.();
});
await page.waitForTimeout(500);
await shot(page, '016-account-panel');

// ===== REVIEWS =====
console.log('\n⭐ REVIEWS\n');
await clickNav('Reviews');
await shot(page, '017-reviews');

// ===== TRUST & LEGAL =====
console.log('\n📜 TRUST & LEGAL\n');
await clickNav('Trust & Legal');
await shot(page, '018-trust-legal');

console.log('\n✅ VERIFICATION COMPLETE');
console.log(`\nScreenshots saved to: ${OUT}`);
console.log(`Total sections verified: 17+`);

await browser.close();
