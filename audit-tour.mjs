import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const OUT = '/tmp/rivt-audit';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let idx = 0;
async function shot(page, name) {
  const file = path.join(OUT, `${String(idx++).padStart(3,'0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`✓ ${path.basename(file)}`);
}

const MOCK_USER = { id:'1', email:'rivttesting@gmail.com', provider:'email', display_name:'Ryan Mitchell', role:'contractor', organization:'Mitchell Contracting', location:'Jacksonville, FL' };

async function setupRoutes(page) {
  await page.route('**/api/**', r => r.fulfill({ status: 503, body: '{}' }));
  await page.route('**/api/auth/providers', r => r.fulfill({ status: 200, contentType:'application/json', body: JSON.stringify({ providers: { email: { ok:true, mode:'configured', missing:[], purpose:'Email' } } }) }));
  await page.route('**/api/auth/me', r => r.fulfill({ status: 200, contentType:'application/json', body: JSON.stringify({ user: MOCK_USER }) }));
}

async function navTo(page, text) {
  await page.evaluate((t) => {
    for (const el of document.querySelectorAll('.nav-item')) {
      if (el.textContent?.includes(t)) { el.click(); return true; }
    }
  }, text);
  await page.waitForTimeout(700);
}

async function clickBtn(page, text) {
  await page.evaluate((t) => {
    for (const el of document.querySelectorAll('button')) {
      if (el.textContent?.trim() === t) { el.click(); return true; }
    }
  }, text);
  await page.waitForTimeout(600);
}

const BASE = 'http://localhost:5173';

// ── PASS 1: Authenticated Contractor — Light Mode ─────────────────────────
{
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await setupRoutes(page);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.nav-item', { timeout: 10000 }).catch(() => null);
  await page.waitForTimeout(1000);

  await shot(page, 'auth-home-light');
  await navTo(page, 'Work');        await shot(page, 'auth-work-light');
  await navTo(page, 'Shop Talk');   await shot(page, 'auth-shoptalk-qa-light');

  // Shop Talk — Trade News tab
  await page.evaluate(() => { document.querySelector('.shop-talk-tabs button:last-child')?.click(); });
  await page.waitForTimeout(500);
  await shot(page, 'auth-shoptalk-news-light');

  await navTo(page, 'Tools');  await shot(page, 'auth-tools-light');
  await navTo(page, 'Crew');   await shot(page, 'auth-crew-light');

  // Messages (topbar icon)
  await page.evaluate(() => { document.querySelector('button[aria-label="Messages"]')?.click(); });
  await page.waitForTimeout(600);
  await shot(page, 'auth-messages-light');

  // Post Job modal
  await navTo(page, 'Work');
  await clickBtn(page, 'Post work');
  await shot(page, 'auth-postjob-modal-light');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // New Shop Talk post modal
  await navTo(page, 'Shop Talk');
  await clickBtn(page, 'New post');
  await shot(page, 'auth-shoptalk-newpost-modal-light');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // Account panel
  await page.evaluate(() => { document.querySelector('.user-menu')?.click(); });
  await page.waitForTimeout(500);
  await shot(page, 'auth-account-panel-light');
  // Scroll account panel
  await page.evaluate(() => { document.querySelector('.side-panel')?.scrollTo(0, 400); });
  await page.waitForTimeout(300);
  await shot(page, 'auth-account-panel-scrolled-light');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // Notifications panel
  await page.evaluate(() => { document.querySelector('button[aria-label="Notifications"], button[aria-label="Activity"]')?.click(); });
  await page.waitForTimeout(500);
  await shot(page, 'auth-notifications-light');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // Secondary views via account panel
  const accountNavs = [
    ['Trust', 'auth-trust-legal-light'],
    ['Training', 'auth-safety-training-light'],
    ['Reviews', 'auth-reviews-light'],
    ['Settings', 'auth-settings-light'],
  ];
  for (const [label, name] of accountNavs) {
    await page.evaluate(() => { document.querySelector('.user-menu')?.click(); });
    await page.waitForTimeout(400);
    await page.evaluate((t) => {
      for (const el of document.querySelectorAll('.side-panel button, .quick-actions button, .account-nav button')) {
        if (el.textContent?.trim().includes(t)) { el.click(); return; }
      }
    }, label);
    await page.waitForTimeout(700);
    await shot(page, name);
  }

  // Records (via notifications → Records tab)
  await page.evaluate(() => { document.querySelector('button[aria-label="Notifications"], button[aria-label="Activity"]')?.click(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button')) {
      if (btn.textContent?.trim() === 'Records') { btn.click(); return; }
    }
  });
  await page.waitForTimeout(700);
  await shot(page, 'auth-records-light');

  // Shop Talk — Rules expanded
  await navTo(page, 'Shop Talk');
  await page.evaluate(() => { document.querySelector('.rules-toggle')?.click(); });
  await page.waitForTimeout(400);
  await shot(page, 'auth-shoptalk-rules-expanded-light');

  // Sort tabs
  await page.evaluate(() => {
    const tabs = document.querySelectorAll('.shop-sort-tabs button');
    tabs[1]?.click(); // New
  });
  await page.waitForTimeout(300);
  await shot(page, 'auth-shoptalk-sort-new-light');

  await browser.close();
}

// ── PASS 2: Dark Mode ─────────────────────────────────────────────────────
{
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await setupRoutes(page);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.nav-item', { timeout: 10000 }).catch(() => null);
  await page.waitForTimeout(1000);

  // Toggle dark mode
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Dark mode') || b.textContent?.includes('Light mode'));
    btn?.click();
  });
  await page.waitForTimeout(500);

  await shot(page, 'auth-home-dark');
  await navTo(page, 'Work');       await shot(page, 'auth-work-dark');
  await navTo(page, 'Shop Talk');  await shot(page, 'auth-shoptalk-dark');
  await navTo(page, 'Tools');      await shot(page, 'auth-tools-dark');
  await navTo(page, 'Crew');       await shot(page, 'auth-crew-dark');

  await page.evaluate(() => { document.querySelector('button[aria-label="Messages"]')?.click(); });
  await page.waitForTimeout(600);
  await shot(page, 'auth-messages-dark');

  // Post job modal in dark
  await navTo(page, 'Work');
  await clickBtn(page, 'Post work');
  await shot(page, 'auth-postjob-modal-dark');
  await page.keyboard.press('Escape');

  await browser.close();
}

// ── PASS 3: Mobile viewport ───────────────────────────────────────────────
{
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); // iPhone 14
  const page = await ctx.newPage();
  await setupRoutes(page);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await shot(page, 'mobile-home');

  // Try mobile nav items
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('.nav-item, .mobile-nav button, .bottom-nav button')) {
      if (el.textContent?.includes('Work')) { el.click(); return; }
    }
  });
  await page.waitForTimeout(600);
  await shot(page, 'mobile-work');

  await page.evaluate(() => {
    for (const el of document.querySelectorAll('.nav-item, .mobile-nav button, .bottom-nav button')) {
      if (el.textContent?.includes('Shop Talk')) { el.click(); return; }
    }
  });
  await page.waitForTimeout(600);
  await shot(page, 'mobile-shoptalk');

  await browser.close();
}

// ── PASS 4: Guest Mode ────────────────────────────────────────────────────
{
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  // No auth mock — will show AuthGate
  await page.route('**/api/**', r => r.fulfill({ status: 503, body: '{}' }));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await shot(page, 'guest-authgate');

  // Click Browse as guest
  await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button')) {
      if (btn.textContent?.toLowerCase().includes('guest') || btn.textContent?.toLowerCase().includes('browse')) { btn.click(); return; }
    }
  });
  await page.waitForTimeout(700);
  await shot(page, 'guest-home');
  await navTo(page, 'Work');       await shot(page, 'guest-work');
  await navTo(page, 'Shop Talk');  await shot(page, 'guest-shoptalk');
  await navTo(page, 'Crew');       await shot(page, 'guest-crew');

  // Guest write-action gating (try to apply)
  await navTo(page, 'Work');
  await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button')) {
      if (btn.textContent?.includes('Apply') || btn.textContent?.includes('Post work')) { btn.click(); return; }
    }
  });
  await page.waitForTimeout(500);
  await shot(page, 'guest-gate-prompt');

  await browser.close();
}

console.log(`\n✓ Done — ${idx} screenshots in ${OUT}`);
