/**
 * Store-ready screenshots for Play Store + App Store listings.
 *
 * Usage:
 *   VITE_SCREENSHOT_USERNAME=your_user VITE_SCREENSHOT_PASSWORD=your_pass \
 *     node take-screenshots.js
 *
 *   (or set them in .env — the script reads process.env directly)
 *
 * If no credentials are provided, the script captures only the login screen.
 * Requires the dev server running on http://localhost:5173.
 *
 * Output: ./screenshots/{nn}-{name}.png
 */

import puppeteer from 'puppeteer';
import { setTimeout as sleep } from 'timers/promises';
import path from 'path';
import { mkdirSync, existsSync } from 'fs';

const DIR = './screenshots';
const BASE = 'http://localhost:5173';
const USERNAME = process.env.VITE_SCREENSHOT_USERNAME;
const PASSWORD = process.env.VITE_SCREENSHOT_PASSWORD;
const HAS_CREDS = Boolean(USERNAME && PASSWORD);

let n = 1;

if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });

async function shot(page, name, waitMs = 500) {
  await sleep(waitMs);
  const file = path.join(DIR, `${String(n).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  saved ${file}`);
  n++;
}

async function scrollTo(page, y) {
  await page.evaluate((val) => {
    const el = document.querySelector('.overflow-y-auto') || document.documentElement;
    el.scrollTop = val;
  }, y);
}

async function scrollBottom(page) {
  await page.evaluate(() => {
    const el = document.querySelector('.overflow-y-auto');
    if (el) el.scrollTop = el.scrollHeight;
  });
}

function findButton(page, textMatch) {
  return page.evaluate((match) => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.find(b => b.textContent.trim().includes(match))?.textContent.trim() || null;
  }, textMatch);
}

function clickButton(page, textMatch) {
  return page.evaluate((match) => {
    const btns = Array.from(document.querySelectorAll('button'));
    const target = btns.find(b => b.textContent.trim().includes(match));
    if (target) { target.click(); return true; }
    return false;
  }, textMatch);
}

function clickBottomNav(page, tabName) {
  return page.evaluate((name) => {
    const allBtns = Array.from(document.querySelectorAll('button'));
    const bottomBtns = allBtns.filter(b => {
      const rect = b.getBoundingClientRect();
      return rect.top > window.innerHeight - 80;
    });
    const target = bottomBtns.reverse().find(b => b.textContent.includes(name));
    if (target) { target.click(); return true; }
    const fallback = allBtns.reverse().find(b => b.textContent.includes(name));
    if (fallback) { fallback.click(); return false; }
    return false;
  }, tabName);
}

async function setTextarea(page, text) {
  await page.evaluate((val) => {
    const ta = document.querySelector('textarea');
    if (!ta) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, val);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, text);
}

(async () => {
  console.log(`Starting screenshot capture${HAS_CREDS ? ` (user: ${USERNAME})` : ' (no credentials — login screen only)'}`);
  console.log(`Output: ${DIR}/\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
    protocolTimeout: 60000,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });

  // 1. Login screen
  console.log('1. Login screen');
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 });
  await shot(page, 'login-screen');

  if (!HAS_CREDS) {
    console.log('\nNo VITE_SCREENSHOT_USERNAME/PASSWORD set. Captured login screen only.');
    await browser.close();
    return;
  }

  // 2. Login form filled
  console.log('2. Login form filled');
  const usernameInput = await page.$('input[placeholder="harshit"], input[type="text"], input[name="username"]');
  if (usernameInput) {
    await usernameInput.click();
    await usernameInput.type(USERNAME, { delay: 15 });
  }
  const passwordInput = await page.$('input[type="password"]');
  if (passwordInput) {
    await passwordInput.click();
    await passwordInput.type(PASSWORD, { delay: 10 });
  }
  await shot(page, 'login-filled');

  // 3. Submit login
  console.log('3. Logging in...');
  await page.click('button[type="submit"]');
  await sleep(3000);

  // 4. Meals tab — Monday top
  console.log('4. Meals tab — Monday');
  await scrollTo(page, 0);
  await shot(page, 'meals-monday-top', 1000);

  // 5. Meals tab — Monday bottom (scroll)
  await scrollBottom(page);
  await shot(page, 'meals-monday-bottom');

  // 6. Meals tab — Tuesday
  await scrollTo(page, 0);
  await clickButton(page, 'Tue');
  await shot(page, 'meals-tuesday');

  // 7. Meals tab — toggle a meal eaten
  console.log('5. Meal interaction');
  await scrollTo(page, 0);
  await sleep(500);
  await page.evaluate(() => {
    const all = document.querySelectorAll('.rounded-full');
    for (const el of all) {
      const w = el.clientWidth;
      if (el.classList.contains('border') && w >= 20 && w <= 32) {
        el.click();
        break;
      }
    }
  });
  await shot(page, 'meal-eaten-toggled');

  // 8. Tracker tab
  console.log('6. Tracker tab');
  clickBottomNav(page, 'Tracker');
  await shot(page, 'tracker-tab', 1500);

  // 9. Tracker scrolled
  await scrollBottom(page);
  await shot(page, 'tracker-tab-bottom');

  // 10. Shopping tab
  console.log('7. Shopping tab');
  clickBottomNav(page, 'Shopping');
  await shot(page, 'shopping-tab', 1500);

  // 11. Shopping bottom
  await scrollBottom(page);
  await shot(page, 'shopping-tab-bottom');

  // 12. Tips tab
  console.log('8. Tips tab');
  clickBottomNav(page, 'Tips');
  await shot(page, 'tips-tab', 1500);

  // 13. Tips bottom
  await scrollBottom(page);
  await shot(page, 'tips-tab-bottom');

  // 14. Profile tab — top
  console.log('9. Profile tab');
  clickBottomNav(page, 'Profile');
  await sleep(1500);
  await scrollTo(page, 0);
  await shot(page, 'profile-top');

  // 15. Profile — stats section
  await scrollTo(page, 300);
  await shot(page, 'profile-stats');

  // 16. Profile — customiser empty
  await scrollTo(page, 600);
  await shot(page, 'profile-customiser');

  // 17. Profile — bottom (regen + logout)
  await scrollBottom(page);
  await shot(page, 'profile-bottom');

  // 18. Type custom instructions
  console.log('10. Custom instructions');
  await scrollTo(page, 550);
  await sleep(300);
  await setTextarea(page, 'Add more eggs to breakfast, include at least one soup every day');
  await shot(page, 'customiser-typed', 800);

  // 19. Click suggestion chip
  await clickButton(page, '+ Quick recipes');
  await shot(page, 'customiser-chip-added', 500);

  // 20. Show regenerate button
  await scrollBottom(page);
  await shot(page, 'customiser-regen-button');

  // 21. Confirmation dialog with instructions
  console.log('11. Confirmation dialogs');
  await clickButton(page, 'Regenerate with My Changes');
  await shot(page, 'confirm-with-instructions', 500);

  // 22. Cancel
  await clickButton(page, 'Cancel');
  await sleep(300);

  // 23. Clear and show no-instructions dialog
  await clickButton(page, 'Clear');
  await sleep(500);
  await scrollBottom(page);
  await shot(page, 'customiser-cleared');
  await clickButton(page, 'Regenerate Meal Plan');
  await shot(page, 'confirm-no-instructions', 500);

  console.log(`\nDone! ${n - 1} screenshots saved to ${DIR}/`);
  await browser.close();
})().catch(err => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
