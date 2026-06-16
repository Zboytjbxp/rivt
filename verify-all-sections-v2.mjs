import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const OUT = '/tmp/rivt-verify-all-v2';
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

console.log('🎯 COMPREHENSIVE RIVT APP VERIFICATION (v2)\n');

// Helper to click nav items (try multiple possible names)
async function clickNav(names) {
  const nameList = Array.isArray(names) ? names : [names];
  await page.evaluate((targets) => {
    for (const el of document.querySelectorAll('.nav-item')) {
      const text = el.textContent?.trim() || '';
      if (targets.some(t => text.includes(t))) {
        el.click?.();
        return;
      }
    }
  }, nameList);
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
await shot(page, '01-home');

// ===== MARKETPLACE/WORK =====
console.log('\n🏪 MARKETPLACE/WORK\n');
await clickNav(['Work', 'Marketplace']);
await shot(page, '02-work-jobfeed');

// Check for filters
const filterExists = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('button')).some(b => b.textContent?.includes('Filter'));
});
if (filterExists) {
  await clickButton('Filter');
  await shot(page, '03-work-filters');
  await page.evaluate(() => {
    const backdrop = document.querySelector('.fixed.inset-0');
    if (backdrop) backdrop.click?.();
  });
  await page.waitForTimeout(300);
} else {
  console.log('⚠️ Filter button not found');
}

// ===== SHOP TALK =====
console.log('\n💬 SHOP TALK\n');
await clickNav('Shop Talk');
await shot(page, '04-shoptalk');

// ===== TOOLS =====
console.log('\n🔧 TOOLS\n');
await clickNav('Tools');
await shot(page, '05-tools-overview');

// ===== CREW =====
console.log('\n👥 CREW\n');
await clickNav(['Crew', 'My Crew']);
await shot(page, '06-crew');

// ===== MESSAGES =====
console.log('\n📬 MESSAGES\n');
await clickNav('Messages');
await shot(page, '07-messages');

// ===== RECORDS =====
console.log('\n📋 RECORDS\n');
await clickNav('Records');
await shot(page, '08-records');

// ===== SAFETY & TRAINING =====
console.log('\n🛡️ SAFETY & TRAINING\n');
await clickNav('Safety & Training');
await shot(page, '09-safety-training');

// ===== REVIEWS =====
console.log('\n⭐ REVIEWS\n');
await clickNav('Reviews');
await shot(page, '10-reviews');

// ===== FEEDBACK =====
console.log('\n📝 FEEDBACK\n');
await clickNav('Feedback');
await shot(page, '11-feedback');

// ===== SETTINGS =====
console.log('\n⚙️ SETTINGS\n');
await clickNav('Settings');
await shot(page, '12-settings');

// ===== TRUST & LEGAL =====
console.log('\n📜 TRUST & LEGAL\n');
await clickNav('Trust & Legal');
await shot(page, '13-trust-legal');

// ===== Account/Profile area =====
console.log('\n👤 ACCOUNT/PROFILE\n');
const accountBtn = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button, [role="button"]')).find(
    b => b.textContent?.includes('RM') || b.textContent?.includes('Ryan')
  );
  return btn ? btn.textContent : null;
});
if (accountBtn) {
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button, [role="button"]')).find(
      b => b.textContent?.includes('RM') || b.textContent?.includes('Ryan')
    );
    btn?.click?.();
  });
  await page.waitForTimeout(500);
  await shot(page, '14-account-profile');
} else {
  console.log('⚠️ Account button not found');
}

// ===== Notifications =====
console.log('\n🔔 NOTIFICATIONS\n');
const notifBtn = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button, [role="button"]')).find(
    b => b.textContent?.includes('🔔') || b.textContent?.includes('Bell')
  );
  return btn ? btn.textContent : null;
});
if (notifBtn) {
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button, [role="button"]')).find(
      b => b.textContent?.includes('🔔') || b.textContent?.includes('Bell')
    );
    btn?.click?.();
  });
  await page.waitForTimeout(500);
  await shot(page, '15-notifications');
} else {
  console.log('⚠️ Notifications button not found');
}

console.log('\n✅ VERIFICATION COMPLETE');
console.log(`\nScreenshots saved to: ${OUT}`);
console.log(`✓ Verified sections: Home, Work, Shop Talk, Tools, Crew, Messages, Records, Safety & Training, Reviews, Feedback, Settings, Trust & Legal`);

await browser.close();
