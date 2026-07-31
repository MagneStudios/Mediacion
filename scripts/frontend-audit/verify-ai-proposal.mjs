// Read-only manual-verification helper: console errors, horizontal
// overflow, and nested-button DOM check across the negotiation screen at
// several widths. Never touches app code.
import { chromium } from 'playwright';

const BASE_URL = process.env.CAPTURE_BASE_URL ?? 'http://localhost:8081';
const widths = [320, 375, 390, 768, 1024, 1280, 1440];

const browser = await chromium.launch();
let anyProblem = false;

for (const width of widths) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, locale: 'es-AR' });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

  await page.goto(`${BASE_URL}/case/case-2/negotiation`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  const nestedButtons = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('[role="button"]'));
    return buttons.filter((b) => b.querySelector('[role="button"]')).length;
  });

  console.log(`width=${width} overflow=${overflow} nestedButtons=${nestedButtons} consoleErrors=${consoleErrors.length}`);
  if (overflow || nestedButtons > 0 || consoleErrors.length > 0) {
    anyProblem = true;
    for (const e of consoleErrors) console.log('  CONSOLE ERROR:', e);
  }
  await context.close();
}

await browser.close();
console.log(anyProblem ? 'RESULT: issues found (see above)' : 'RESULT: clean at all widths');
