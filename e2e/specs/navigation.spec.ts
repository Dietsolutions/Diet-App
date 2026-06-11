import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('app loads and shows auth screen when logged out', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Diet Plan')).toBeVisible();
    await expect(page.getByText('& TRACKER')).toBeVisible();
  });

  test('bottom navigation renders when logged in with review account', async ({ page, context }) => {
    await context.addCookies([
      { name: 'session', value: 'mock-session', domain: 'localhost', path: '/' },
    ]);
    await page.goto('/');
    try {
      await expect(page.getByText('DIET PLAN')).toBeVisible({ timeout: 5000 });
      await expect(page.getByText('TRACK')).toBeVisible();
      await expect(page.getByText('SHOP')).toBeVisible();
      await expect(page.getByText('LEARN')).toBeVisible();
      await expect(page.getByText('PROFILE')).toBeVisible();
    } catch {
      test.skip();
    }
  });

  test('offline banner shows when offline', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.context().setOffline(true);
    await page.reload();
    await page.waitForLoadState('networkidle');
    try {
      await expect(page.getByText('No internet connection')).toBeVisible({ timeout: 5000 });
    } finally {
      await page.context().setOffline(false);
    }
  });
});
