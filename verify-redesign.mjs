import { chromium } from 'playwright';
import fs from 'fs';

const OUT = '/tmp/rivt-redesign';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
let i = 0;
const shot = async (page, name) => {
  const f = `${OUT}/${String(i++).padStart(2,'0')}-${name}.png`;
  await page.screenshot({ path: f });
  console.log(`✓ ${name}`);
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); // mobile
const page = await ctx.newPage();

await page.route('**/api/auth/providers', r => r.fulfill({ status: 200, contentType: 'application/json',
  body: JSON.stringify({ providers: { email: { ok: true } } }) }));
await page.route('**/api/auth/me', r => r.fulfill({ status: 200, contentType: 'application/json',
  body: JSON.stringify({ user: { id: '1', email: 'test@example.com', provider: 'email',
    display_name: 'Ryan Mitchell', role: 'tradesperson', organization: 'Mitchell Contracting', location: 'Jacksonville, FL' } }) }));
await page.route('**/api/**', r => r.fulfill({ status: 503, body: '{}' }));

await page.goto('http://localhost:5174', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(2000);
await shot(page, '01-home');

// Navigate to Shop Talk (mobile nav)
await page.evaluate(() => {
  for (const el of document.querySelectorAll('.nav-item, .mobile-nav-item, [class*="mobile-nav"] button')) {
    if (el.textContent?.trim().includes('Talk') || el.textContent?.trim().includes('Shop')) { el.click(); return; }
  }
  // try clicking by text content
  const all = document.querySelectorAll('button, a');
  for (const el of all) {
    if (el.textContent?.trim() === 'Talk' || el.textContent?.trim() === 'Shop Talk') { el.click(); return; }
  }
});
await page.waitForTimeout(1000);
await shot(page, '02-shop-talk-list');

// Click on "Trade News" tab
await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  const newsTab = btns.find(b => b.textContent?.includes('Trade News') || b.textContent?.includes('News'));
  if (newsTab) newsTab.click();
});
await page.waitForTimeout(600);
await shot(page, '03-news-list-with-thumbs');

// Click first news item
await page.evaluate(() => {
  const cards = document.querySelectorAll('.shop-news-card');
  if (cards[0]) cards[0].click();
});
await page.waitForTimeout(600);
await shot(page, '04-news-detail-mobile');

// Check back button visible
const hasBackBtn = await page.evaluate(() => {
  const btn = document.querySelector('.mobile-back-btn');
  return btn ? window.getComputedStyle(btn).display : 'not found';
});
console.log('Back button display:', hasBackBtn);

// Go back
await page.evaluate(() => {
  const btn = document.querySelector('.mobile-back-btn');
  if (btn) btn.click();
});
await page.waitForTimeout(500);
await shot(page, '05-back-to-news-list');

// Desktop view
await ctx.close();
const deskCtx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const deskPage = await deskCtx.newPage();
await deskPage.route('**/api/auth/providers', r => r.fulfill({ status: 200, contentType: 'application/json',
  body: JSON.stringify({ providers: { email: { ok: true } } }) }));
await deskPage.route('**/api/auth/me', r => r.fulfill({ status: 200, contentType: 'application/json',
  body: JSON.stringify({ user: { id: '1', email: 'test@example.com', provider: 'email',
    display_name: 'Ryan Mitchell', role: 'tradesperson', organization: 'Mitchell Contracting', location: 'Jacksonville, FL' } }) }));
await deskPage.route('**/api/**', r => r.fulfill({ status: 503, body: '{}' }));

await deskPage.goto('http://localhost:5174', { waitUntil: 'domcontentloaded', timeout: 15000 });
await deskPage.waitForTimeout(2000);
await deskPage.screenshot({ path: `${OUT}/${String(i++).padStart(2,'0')}-06-desktop-home.png` });
console.log('✓ desktop-home');

// Desktop shop talk
await deskPage.evaluate(() => {
  const all = document.querySelectorAll('button');
  for (const el of all) {
    if (el.textContent?.trim() === 'Talk' || el.textContent?.includes('Shop Talk')) { el.click(); return; }
  }
});
await deskPage.waitForTimeout(800);
await deskPage.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  const newsTab = btns.find(b => b.textContent?.includes('Trade News') || b.textContent?.includes('News'));
  if (newsTab) newsTab.click();
});
await deskPage.waitForTimeout(600);
await deskPage.screenshot({ path: `${OUT}/${String(i++).padStart(2,'0')}-07-desktop-news.png` });
console.log('✓ desktop-news');

await browser.close();
console.log(`\nScreenshots: ${OUT}`);
