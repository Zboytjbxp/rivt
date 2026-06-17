import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';

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

console.log('🔍 Feature Verification\n');

// Test 1: Safety cert stat grid visible in account panel
console.log('1️⃣ Account panel stat grid with safety certs...');
await page.evaluate(() => { document.querySelector('.user-menu')?.click(); });
await page.waitForTimeout(400);
const hasStatGrid = await page.evaluate(() => {
  return document.querySelector('.account-stat-grid') !== null;
});
const hasSafetyCertStat = await page.evaluate(() => {
  const grid = document.querySelector('.account-stat-grid');
  return grid ? grid.textContent?.includes('Safety certs') : false;
});
console.log(`   ✓ Stat grid exists: ${hasStatGrid}`);
console.log(`   ✓ Safety cert stat: ${hasSafetyCertStat}`);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// Test 2: Post job modal has quiz requirements section
console.log('\n2️⃣ Post job modal quiz requirements...');
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button')) {
    if (btn.textContent?.includes('Work') || btn.textContent?.trim() === 'Work') {
      (btn.closest('[class*="nav"]') || btn).click?.();
      return;
    }
  }
});
await page.waitForTimeout(600);
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button')) {
    if (btn.textContent?.includes('Post')) { btn.click?.(); return; }
  }
});
await page.waitForTimeout(600);
const hasQuizSection = await page.evaluate(() => {
  return document.querySelector('.modal-quiz-section') !== null;
});
const hasQuizChecklist = await page.evaluate(() => {
  return document.querySelector('.modal-quiz-checklist') !== null;
});
console.log(`   ✓ Quiz section in modal: ${hasQuizSection}`);
console.log(`   ✓ Quiz checklist: ${hasQuizChecklist}`);
const quizCount = await page.evaluate(() => {
  return document.querySelectorAll('.modal-quiz-toggle').length;
});
console.log(`   ✓ Quiz options: ${quizCount}/6`);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// Test 3: Quiz taker works end-to-end
console.log('\n3️⃣ Quiz taker component...');
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button, [role="button"]')) {
    if (btn.textContent?.includes('Training') || btn.textContent?.includes('Safety')) {
      btn.click?.();
      return;
    }
  }
});
await page.waitForTimeout(700);
const hasOverview = await page.evaluate(() => {
  return document.querySelector('.quiz-overview-grid') !== null;
});
console.log(`   ✓ Quiz overview: ${hasOverview}`);

// Click a quiz
await page.evaluate(() => {
  const btns = document.querySelectorAll('.quiz-card-btn, [class*="quiz"]');
  if (btns[0]) btns[0].click?.();
});
await page.waitForTimeout(400);
const hasTaker = await page.evaluate(() => {
  return document.querySelector('.quiz-taker') !== null;
});
console.log(`   ✓ Quiz taker UI: ${hasTaker}`);

const hasProgress = await page.evaluate(() => {
  return document.querySelector('.quiz-progress') !== null;
});
console.log(`   ✓ Progress bar: ${hasProgress}`);

const hasOptions = await page.evaluate(() => {
  return document.querySelectorAll('.quiz-option').length > 0;
});
console.log(`   ✓ Answer options: ${hasOptions}`);

// Test 4: Quiz result screen
console.log('\n4️⃣ Quiz result screen...');
// Complete quiz by auto-selecting options
for (let i = 0; i < 6; i++) {
  await page.evaluate(() => {
    const opts = document.querySelectorAll('.quiz-option:not(:disabled)');
    if (opts[1]) opts[1].click?.();
  });
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button')) {
      if (btn.textContent?.trim() === 'Confirm answer') { btn.click?.(); return; }
    }
  });
  await page.waitForTimeout(100);

  const nextAvail = await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button')) {
      const t = btn.textContent?.trim();
      return t === 'Next question' || t === 'See results';
    }
    return false;
  });
  if (!nextAvail) break;

  await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button')) {
      const t = btn.textContent?.trim();
      if (t === 'Next question' || t === 'See results') { btn.click?.(); return; }
    }
  });
  await page.waitForTimeout(150);
}

const hasResultScreen = await page.evaluate(() => {
  return document.querySelector('.quiz-result-screen') !== null;
});
console.log(`   ✓ Result screen: ${hasResultScreen}`);

const hasScore = await page.evaluate(() => {
  return document.querySelector('.quiz-result-badge span') !== null;
});
console.log(`   ✓ Score display: ${hasScore}`);

const hasBadge = await page.evaluate(() => {
  return document.querySelector('.quiz-result-badge') !== null;
});
console.log(`   ✓ Pass/fail badge: ${hasBadge}`);

// Test 5: Cert persistence
console.log('\n5️⃣ Cert persistence...');
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button')) {
    if (btn.textContent?.includes('Back')) { btn.click?.(); return; }
  }
});
await page.waitForTimeout(500);

const certCardsAfter = await page.evaluate(() => {
  const cards = document.querySelectorAll('.quiz-overview-card.passed');
  return cards.length;
});
console.log(`   ✓ Passed certs shown: ${certCardsAfter >= 1 ? '✓ yes' : '⚠ no'}`);

// Test 6: Job detail cert requirement
console.log('\n6️⃣ Job detail cert requirement banner...');
// Go to marketplace to find a job
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button')) {
    if (btn.textContent?.includes('Work')) { btn.click?.(); return; }
  }
});
await page.waitForTimeout(600);

// Click a job
await page.evaluate(() => {
  const rows = document.querySelectorAll('[class*="row"], [role="button"]');
  if (rows[0]) rows[0].click?.();
});
await page.waitForTimeout(400);

// Note: cert requirement banner only shows if job has requiredQuizIds
// This would be set when a contractor posts a job requiring certs
const hasDetail = await page.evaluate(() => {
  return document.querySelector('.modern-detail-panel') !== null;
});
console.log(`   ✓ Job detail panel: ${hasDetail}`);

// Test 7: All nav items clickable
console.log('\n7️⃣ Navigation...');
const navItems = ['Home', 'Work', 'Shop Talk', 'Tools', 'My Crew'];
for (const item of navItems) {
  const found = await page.evaluate((label) => {
    for (const el of document.querySelectorAll('.nav-item')) {
      if (el.textContent?.includes(label)) { return true; }
    }
    return false;
  }, item);
  console.log(`   ✓ ${item}: ${found ? 'found' : '⚠ missing'}`);
}

// Test 8: Account panel quick-actions
console.log('\n8️⃣ Account panel quick-actions...');
await page.evaluate(() => { document.querySelector('.user-menu')?.click(); });
await page.waitForTimeout(400);
const quickActions = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('.quick-actions button')).map(b => b.textContent?.trim());
});
console.log(`   Available actions:`, quickActions);
console.log(`   ✓ Trust: ${quickActions.includes('Trust') ? '✓' : '⚠'}`);
console.log(`   ✓ Training: ${quickActions.includes('Training') ? '✓' : '⚠'}`);
console.log(`   ✓ Reviews: ${quickActions.includes('Reviews') ? '✓' : '⚠'}`);
console.log(`   ✓ Settings: ${quickActions.includes('Settings') ? '✓' : '⚠'}`);

await browser.close();
console.log('\n✅ Feature verification complete');
