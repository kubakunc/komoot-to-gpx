import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';

const email = process.env.KOMOOT_TEST_EMAIL;
const password = process.env.KOMOOT_TEST_PASSWORD;

test.skip(!email || !password, 'Set KOMOOT_TEST_EMAIL and KOMOOT_TEST_PASSWORD in .env.test');

test('login and download a GPX', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);

  await page.fill('input[type="email"]', email!);
  await page.fill('input[type="password"]', password!);
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('/');
  const firstTour = page.locator('.tours li').first();
  await expect(firstTour).toBeVisible({ timeout: 15_000 });

  const downloadPromise = page.waitForEvent('download');
  await firstTour.locator('button').click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  expect(existsSync(path!)).toBe(true);
  expect(download.suggestedFilename()).toMatch(/\.gpx$/);
});
