import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await ctx.newPage();

// Hit the live site
await page.goto('https://rivt.pro', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(2000);

const screenshot = await page.screenshot({ path: '/tmp/rivt-live-auth.png', fullPage: false });

const state = await page.evaluate(() => {
  return {
    url: window.location.href,
    hasGuestButton: !!Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('guest')),
    allButtonText: Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(t => t),
    title: document.title,
    hasAuthGate: !!document.querySelector('main.auth-shell, [class*="auth"]'),
    bodyText: document.body.innerText.substring(0, 500),
  };
});

console.log('Live site state:');
console.log(JSON.stringify(state, null, 2));

await browser.close();
