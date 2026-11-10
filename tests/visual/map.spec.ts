import { expect, test } from '@playwright/test';

test('the Measurement map looks the same', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/atlas/measurement/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('figure.map svg.pm').first()).toHaveScreenshot('measurement-map.png');
});
