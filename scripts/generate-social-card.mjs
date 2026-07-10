import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve(import.meta.dirname, "..");
const logo = readFileSync(resolve(root, "public/brand/rivt-lockup-light-transparent.png")).toString("base64");
const output = resolve(root, "public/rivt-social-card.png");

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html>
    <html><head><style>
      * { box-sizing: border-box; }
      html, body { width: 1200px; height: 630px; margin: 0; overflow: hidden; }
      body {
        display: grid;
        align-items: center;
        padding: 78px 92px;
        background-color: #ff4b00;
        background-image:
          linear-gradient(rgba(11, 11, 11, .08) 1px, transparent 1px),
          linear-gradient(90deg, rgba(11, 11, 11, .08) 1px, transparent 1px);
        background-size: 56px 56px;
        color: #0b0b0b;
        font-family: Arial, sans-serif;
      }
      main { display: grid; gap: 46px; }
      img { display: block; width: 760px; height: auto; }
      h1 { max-width: 880px; margin: 0; font-size: 62px; line-height: .98; letter-spacing: 0; }
      p { margin: 0; font-size: 25px; line-height: 1.3; font-weight: 700; }
      .rule { width: 112px; height: 10px; background: #0b0b0b; }
    </style></head><body>
      <main>
        <img src="data:image/png;base64,${logo}" alt="RIVT - Where skilled trades connect" />
        <div class="rule"></div>
        <div>
          <h1>The professional network built for skilled trades.</h1>
          <p>Work. Crew. Shop Talk. Field tools.</p>
        </div>
      </main>
    </body></html>`);
  await page.screenshot({ path: output, type: "png" });
} finally {
  await browser.close();
}

process.stdout.write(`${output}\n`);
