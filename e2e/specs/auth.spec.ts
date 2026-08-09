import { test, expect } from '@playwright/test';

test.describe('Auth', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('AuthScreen renders with logo and title', async ({ page }) => {
    await expect(page.getByText('Plan Your Plate')).toBeVisible();
    await expect(page.getByText('YOUR NUTRITION COMPANION')).toBeVisible();
  });

  test('login form shows when LOGIN tab is clicked', async ({ page }) => {
    await page.getByText('LOGIN').click();
    await expect(page.getByText('LOGIN').first()).toBeVisible();
    await expect(page.getByLabel('Log In')).toBeVisible();
    await expect(page.getByPlaceholder('yourname')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toHaveCount(1);
  });

  test('signup form shows by default', async ({ page }) => {
    await expect(page.getByText('SIGN UP').first()).toBeVisible();
    await expect(page.getByLabel('Create Account')).toBeVisible();
    await expect(page.getByPlaceholder('yourname')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toHaveCount(2);
  });

  test('invalid credentials show error message', async ({ page }) => {
    await page.getByText('LOGIN').click();
    await page.getByPlaceholder('yourname').fill('nonexistent_user');
    await page.getByPlaceholder('••••••••').fill('wrongpassword');
    await page.getByLabel('Log In').click();
    await expect(page.getByText('Invalid username or')).toBeVisible({ timeout: 15000 });
  });
});
