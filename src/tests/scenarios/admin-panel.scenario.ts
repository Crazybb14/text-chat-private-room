import { scenario, step, expect } from 'kliv-scenario';

scenario(
  'admin logs in and reaches the download tab',
  { setup: {} },
  async ({ page }) => {
    await step('wrong password is rejected', async () => {
      await page.goto('/admin');
      await page.getByPlaceholder('Enter password').fill('wrong-code');
      await page.getByRole('button', { name: 'Access Admin Panel' }).click();
      await expect(page.getByText('Invalid password')).toBeVisible();
    });

    await step('correct password opens the panel', async () => {
      await page.getByPlaceholder('Enter password').fill('qacgt5');
      await page.getByRole('button', { name: 'Access Admin Panel' }).click();
      await expect(page.getByText('Admin Panel').first()).toBeVisible();
    });

    await step('download tab offers the website zip', async () => {
      await page.getByRole('tab', { name: 'Download' }).click();
      await expect(page.getByText('Download website code')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Download Website' })).toBeEnabled();
    });
  }
);
