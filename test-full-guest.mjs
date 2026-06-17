import { chromium } from 'playwright';
import fs from 'fs';

const OUT = '/tmp/rivt-guest-full';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await ctx.newPage();

// Mock unauth
await page.route('**/api/**', r => r.fulfill({ status: 503, body: '{}' }));
await page.route('**/api/auth/providers', r => r.fulfill({ status: 200, contentType: 'application/json',
  body: JSON.stringify({ providers: { email: { ok: true } } }) }));
await page.route('**/api/auth/me', r => r.fulfill({ status: 401, body: '{"error":"not authenticated"}' }));

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(1500);

// 1. Login screen
console.log('1. Taking auth screen...');
await page.screenshot({ path: `${OUT}/01-auth-screen.png`, fullPage: false });

// 2. Click guest button
console.log('2. Clicking guest button...');
const guestBtn = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('guest'));
  if (btn) { btn.click(); return 'found'; }
  return 'not found';
});
await page.waitForTimeout(1500);

// 3. Home after guest login
console.log('3. Taking home screen...');
await page.screenshot({ path: `${OUT}/02-home-guest.png`, fullPage: false });

// 4. Navigate to Tools
console.log('4. Going to Tools...');
await page.evaluate(() => {
  for (const el of document.querySelectorAll('.nav-item')) {
    if (el.textContent?.includes('Tools')) { el.click(); return; }
  }
});
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/03-tools.png`, fullPage: false });

// 5. Scroll to calculator
console.log('5. Finding calculator...');
await page.evaluate(() => {
  const calc = document.querySelector('.construction-calculator');
  if (calc) calc.scrollIntoView({ block: 'start' });
});
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/04-calculator.png`, fullPage: false });

// 6. Test calculator - click buttons
console.log('6. Testing calculator buttons...');
await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('.calc-num'));
  const btn3 = btns.find(b => b.textContent?.trim() === '3');
  if (btn3) btn3.click();
});
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/05-calculator-3.png`, fullPage: false });

// 7. Sheet Optimizer tab
console.log('7. Clicking Sheet Optimizer tab...');
await page.evaluate(() => {
  const tabs = document.querySelectorAll('.calc-tab');
  for (const t of tabs) {
    if (t.textContent?.includes('Sheet')) { t.click(); return; }
  }
});
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/06-sheet-optimizer.png`, fullPage: false });

// 8. Scroll to sheet layout
await page.evaluate(() => {
  const svg = document.querySelector('.sheet-svg');
  if (svg) svg.scrollIntoView({ block: 'center' });
});
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/07-sheet-layout.png`, fullPage: false });

console.log(`✓ All screenshots saved to ${OUT}`);

await browser.close();
