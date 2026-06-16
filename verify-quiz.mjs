import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const OUT = '/tmp/rivt-quiz';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5173';

let idx = 0;
async function shot(page, name) {
  const file = path.join(OUT, `${String(idx++).padStart(2,'0')}-${name}.png`);
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
  if (!ok) console.warn(`  ⚠ no nav-item "${text}"`);
  await page.waitForTimeout(700);
}

async function accountNav(page, btnText) {
  await page.evaluate(() => { document.querySelector('.user-menu')?.click(); });
  await page.waitForTimeout(500);
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

// Safety & Training overview
await accountNav(page, 'Training');
await shot(page, 'safety-overview');

// Click first quiz (Ladder Safety)
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('.quiz-card-btn')) {
    if (btn.textContent?.includes('Ladder')) { btn.click(); return; }
  }
});
await page.waitForTimeout(500);
await shot(page, 'quiz-taker-start');

// Select an answer (option A = index 0)
await page.evaluate(() => {
  const opts = document.querySelectorAll('.quiz-option');
  if (opts[1]) opts[1].click();
});
await page.waitForTimeout(200);
await shot(page, 'quiz-option-selected');

// Confirm answer
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button')) {
    if (btn.textContent?.trim() === 'Confirm answer') { btn.click(); return; }
  }
});
await page.waitForTimeout(300);
await shot(page, 'quiz-explanation');

// Click through all remaining questions quickly
for (let i = 0; i < 5; i++) {
  // Click next
  await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button')) {
      const t = btn.textContent?.trim();
      if (t === 'Next question' || t === 'See results') { btn.click(); return; }
    }
  });
  await page.waitForTimeout(200);

  // Pick an option (correct one = index 1 for most)
  const picked = await page.evaluate(() => {
    const opts = document.querySelectorAll('.quiz-option:not(:disabled)');
    if (opts[1]) { opts[1].click(); return true; }
    return false;
  });
  if (!picked) break;
  await page.waitForTimeout(150);

  // Confirm
  await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button')) {
      if (btn.textContent?.trim() === 'Confirm answer') { btn.click(); return; }
    }
  });
  await page.waitForTimeout(200);
}

// See results
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button')) {
    const t = btn.textContent?.trim();
    if (t === 'See results' || t === 'Next question') { btn.click(); return; }
  }
});
await page.waitForTimeout(500);
await shot(page, 'quiz-result-screen');

// Back to overview
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button')) {
    if (btn.textContent?.trim().includes('Back')) { btn.click(); return; }
  }
});
await page.waitForTimeout(500);
await shot(page, 'safety-overview-after-quiz');

// Post Job modal with quiz requirements (switch to contractor role first via account panel)
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// Go to Work / Marketplace view
await navTo(page, 'Work');
await page.waitForTimeout(400);

// Click Post work
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button')) {
    if (btn.textContent?.trim().includes('Post')) { btn.click(); return; }
  }
});
await page.waitForTimeout(600);
await shot(page, 'post-job-modal-with-quizzes');

// Scroll down in modal to see quiz checklist
await page.evaluate(() => {
  const modal = document.querySelector('.post-modal');
  if (modal) modal.scrollTop = 400;
});
await page.waitForTimeout(300);
await shot(page, 'post-job-modal-quiz-section');

await page.keyboard.press('Escape');
await page.waitForTimeout(400);

await browser.close();
console.log(`\nDone — ${idx} screenshots in ${OUT}`);
