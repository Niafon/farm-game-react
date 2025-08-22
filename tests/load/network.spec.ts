import { test, expect } from '@playwright/test';

test.describe('network resilience', () => {
  test('handles offline mode', async ({ page }) => {
    await page.context().setOffline(true);
    await expect(page.goto('https://example.com')).rejects.toThrow();
  });

  test('handles slow network', async ({ page }) => {
    await page.context().setOffline(false);
    await page.route('**/*', route => route.continue({ delay: 1000 }));
    await page.goto('https://example.com');
    expect(await page.title()).toContain('Example');
  });
});
