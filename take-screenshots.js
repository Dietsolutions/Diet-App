/**
 * Store-ready screenshots for the Play Store (and App Store) listing.
 *
 * Rewritten for the Fresh Light UI (inline styles, no Tailwind class hooks,
 * bottom nav labelled PLAN/TRACK/RECIPES/SHOP/LEARN/PROFILE). Read-only: it
 * navigates and captures, and never taps Generate/Regenerate or toggles data,
 * so running it costs no AI quota and mutates nothing.
 *
 * Usage:
 *   1. Start the app locally:  npm run dev   (client on http://localhost:5173)
 *   2. Run against an account that HAS an active plan + some logged data,
 *      otherwise the Plan/Track tabs show empty states:
 *
 *      VITE_SCREENSHOT_USERNAME='user' VITE_SCREENSHOT_PASSWORD='pass' \
 *        node take-screenshots.js
 *
 *   With no credentials it captures the login screen only.
 *
 * Output: ./screenshots/{nn}-{name}.png  (portrait, ~1080×2340 @ dsf 3)
 */

import puppeteer from 'puppeteer';
import { setTimeout as sleep } from 'timers/promises';
import path from 'path';
import { mkdirSync, existsSync } from 'fs';

const DIR = './screenshots';
const BASE = process.env.SCREENSHOT_BASE || 'http://localhost:5173';
const USERNAME = process.env.VITE_SCREENSHOT_USERNAME;
const PASSWORD = process.env.VITE_SCREENSHOT_PASSWORD;
const HAS_CREDS = Boolean(USERNAME && PASSWORD);

let n = 1;
if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });

async function shot(page, name, waitMs = 600) {
  await sleep(waitMs);
  const file = path.join(DIR, `${String(n).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file });
  console.log(`  saved ${file}`);
  n++;
}

// The app scrolls the page (its column is min-height, not a fixed height), so
// reset by driving the window scroll. Fall back to any tall overflow container.
async function scrollTop(page) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelectorAll('*').forEach((el) => {
      const s = getComputedStyle(el);
      if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) el.scrollTop = 0;
    });
  });
}
async function scrollBottom(page) {
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
    document.querySelectorAll('*').forEach((el) => {
      const s = getComputedStyle(el);
      if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) el.scrollTop = el.scrollHeight;
    });
  });
}

// Click a bottom-nav tab by its visible label (PLAN, TRACK, RECIPES, …).
async function clickNav(page, label) {
  const ok = await page.evaluate((lbl) => {
    const btns = Array.from(document.querySelectorAll('nav button, button'));
    const target = btns.find((b) => b.textContent && b.textContent.trim().toUpperCase() === lbl);
    if (target) { target.click(); return true; }
    return false;
  }, label.toUpperCase());
  if (!ok) console.warn(`  ! nav button "${label}" not found`);
  return ok;
}

// Dismiss the green "Add to Home Screen" PWA banner so it doesn't sit atop
// the store screenshots.
async function dismissBanner(page) {
  await page.evaluate(() => {
    const label = Array.from(document.querySelectorAll('span'))
      .find((el) => (el.textContent || '').includes('Add to Home Screen'));
    if (!label) return;
    let banner = label.parentElement;
    for (let i = 0; i < 4 && banner; i++) {
      const x = Array.from(banner.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === '\u00d7');
      if (x) { x.click(); return; }
      banner = banner.parentElement;
    }
  });
}

async function tabShots(page, navLabel, baseName) {
  const found = await clickNav(page, navLabel);
  if (!found) return;
  await sleep(1400);
  await scrollTop(page);
  await shot(page, `${baseName}-top`);
  await scrollBottom(page);
  await shot(page, `${baseName}-bottom`);
}

(async () => {
  console.log(`Screenshots${HAS_CREDS ? ` (user: ${USERNAME})` : ' (no creds — login only)'} → ${DIR}/\n`);
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'], protocolTimeout: 60000 });
  const page = await browser.newPage();
  // 360×780 logical @ dsf 3 → 1080×2340, a standard Android phone size.
  await page.setViewport({ width: 360, height: 780, deviceScaleFactor: 3 });

  console.log('1. Login screen');
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(1400);
  await dismissBanner(page);
  await shot(page, 'login');

  if (!HAS_CREDS) {
    console.log('\nNo VITE_SCREENSHOT_USERNAME/PASSWORD — captured login only.');
    await browser.close();
    return;
  }

  console.log('2. Switch to Login and sign in');
  // The web app opens on the Sign Up tab — switch to Login first, or we'd fill
  // the signup form and never authenticate.
  await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll('button'))
      .find((b) => (b.textContent || '').trim().toUpperCase() === 'LOGIN');
    if (t) t.click();
  });
  await sleep(700);
  const uInput = await page.$('input:not([type="password"])');
  if (uInput) { await uInput.click({ clickCount: 3 }); await uInput.type(USERNAME, { delay: 20 }); }
  const pInput = await page.$('input[type="password"]');
  if (pInput) { await pInput.click(); await pInput.type(PASSWORD, { delay: 20 }); }
  await sleep(300);
  await page.evaluate(() => {
    const b = document.querySelector('form button[type="submit"]') ||
      document.querySelector('button[type="submit"]');
    if (b) b.click();
  });

  // Wait for the app shell (bottom nav) to appear.
  console.log('3. Waiting for app to load');
  try {
    await page.waitForFunction(
      () => Array.from(document.querySelectorAll('button')).some((b) => (b.textContent || '').trim().toUpperCase() === 'TRACK'),
      { timeout: 25000 },
    );
  } catch { console.warn('  ! app shell (bottom nav) not detected — login may have failed'); }
  await sleep(1500);

  await dismissBanner(page);
  console.log('4. Plan tab');
  await clickNav(page, 'PLAN');
  await sleep(1400);
  await scrollTop(page);
  await shot(page, 'plan-top');
  await scrollBottom(page);
  await shot(page, 'plan-bottom');

  console.log('5. Track tab');
  await tabShots(page, 'TRACK', 'track');

  console.log('6. Recipes tab');
  await tabShots(page, 'RECIPES', 'recipes');

  console.log('7. Shop tab');
  await tabShots(page, 'SHOP', 'shop');

  console.log('8. Learn tab');
  await tabShots(page, 'LEARN', 'learn');

  console.log('9. Profile tab');
  await tabShots(page, 'PROFILE', 'profile');

  console.log(`\nDone — ${n - 1} screenshots in ${DIR}/`);
  await browser.close();
})().catch((e) => { console.error('screenshot run failed:', e.message); process.exit(1); });
