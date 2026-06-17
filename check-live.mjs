import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();

try {
  await page.goto('https://rivt.pro', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);

  const state = await page.evaluate(() => {
    return {
      url: window.location.href,
      hasGuestButton: !!Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('guest')),
      allButtonText: Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(t => t),
      title: document.title,
      bodyText: document.body.innerText.substring(0, 500),
    };
  });

  console.log(JSON.stringify(state, null, 2));
  await page.screenshot({ path: '/tmp/rivt-live-current.png', fullPage: false });
} catch (e) {
  console.error("Error:", e.message);
}

await browser.close();
