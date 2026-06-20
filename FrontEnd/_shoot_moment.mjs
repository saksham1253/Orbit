import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const errs = [];
// Reduced-motion => static "still" reveal: deterministic capture of the CARD.
const page = await b.newPage({ viewport: { width: 900, height: 760 }, reducedMotion: 'reduce' });
page.on('pageerror', (e) => errs.push(e.message));
for (const v of ['up', 'down', 'quasar']) {
  await page.goto(`http://localhost:5199/_verify_moment.html?v=${v}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `_moment_${v}.png` });
}
console.log('errors:', errs.length ? errs.slice(0, 3) : 'none');
await b.close();
