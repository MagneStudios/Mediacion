// Isolated, read-only validation script — screenshots the cases-list ("/")
// route at mobile and desktop viewports against whatever dev server is
// currently running at BASE_URL. Never touches app code; purely a capture
// tool for docs/frontend-redesign/implementation-validation/.
import { chromium } from 'playwright';
import path from 'node:path';

const BASE_URL = process.env.CAPTURE_BASE_URL ?? 'http://localhost:8081';
const outLabel = process.argv[2]; // e.g. "new" or "old"
if (!outLabel) {
  console.error('Usage: node capture-cases-list.mjs <label>');
  process.exit(1);
}

const outDir = path.resolve(
  '..', '..', 'docs', 'frontend-redesign', 'implementation-validation', 'cases-list'
);

const viewports = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1440, height: 900 },
};

const browser = await chromium.launch();
for (const [device, viewport] of Object.entries(viewports)) {
  const context = await browser.newContext({ viewport, locale: 'es-AR' });
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  // Give react-native-web fonts/layout a moment to settle after networkidle.
  await page.waitForTimeout(1500);
  const file = path.join(outDir, `${outLabel}-${device}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`saved ${file}`);
  await context.close();
}
await browser.close();
