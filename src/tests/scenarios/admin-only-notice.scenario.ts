import { scenario, step, expect } from 'kliv-scenario';

/**
 * Admin-only notices: when an update only changes the admin panel, the owner
 * posts it with "Admins only" ticked. A regular signed-up visitor must see
 * public notices in the What's-new widget but never the admin-only entry.
 */
scenario(
  'visitors see public updates but never admin-only update notes',
  {
    setup: {
      database: [
        {
          table: 'version_notices',
          rows: [
            {
              version: '2.2.0',
              title: 'Fresh look',
              body: 'The site now fits Chromebook screens and gets a color of the day.',
              posted_by: 'owner',
              posted_at: 1760000100,
            },
            {
              version: '2.2.1',
              title: 'Admin panel tools',
              body: 'SECRET_ADMIN_PANEL_NOTE added theme, online-now, and health tabs.',
              posted_by: 'owner',
              posted_at: 1760000200,
              audience: 'admin',
            },
          ],
        },
      ],
    },
  },
  async ({ kliv, page }) => {
    const username = kliv.unique('adm').replace(/[^a-z0-9_]/g, '').slice(0, 20);

    await step('signs up and reaches the main page', async () => {
      await page.goto('/terms');
      await expect(page.getByRole('heading', { name: 'Terms of Use' })).toBeVisible();
      await page.getByRole('heading', { name: 'Agreement Overview' }).press('End');
      await page.getByRole('button', { name: 'I AGREE' }).click();
      await page.getByRole('tab', { name: 'Sign up' }).click();
      await page.getByLabel('First name').fill('Nora');
      await page.getByLabel('Last name').fill('Notice');
      await page.getByLabel('Username', { exact: true }).fill(username);
      await page.getByLabel('Email address').fill(`${username}@example.com`);
      const password = `Zk9!${kliv.unique('pw')}qX`;
      await page.getByLabel('Choose a password').fill(password);
      await page.getByLabel('Confirm password').fill(password);
      await page.getByRole('button', { name: 'Create account' }).click();
      await expect(page.getByRole('heading', { name: `Hey, ${username}` })).toBeVisible();
    });

    await step("What's new shows the public update", async () => {
      await page.getByRole('button', { name: "What's new" }).click();
      await expect(page.getByRole('dialog').getByText('v2.2.0')).toBeVisible();
      await expect(
        page.getByText('The site now fits Chromebook screens and gets a color of the day.')
      ).toBeVisible();
    });

    await step('the admin-only update note is nowhere on the page', async () => {
      await expect(page.getByText('v2.2.1')).toBeHidden();
      await expect(page.getByText('SECRET_ADMIN_PANEL_NOTE', { exact: false })).toBeHidden();
    });
  }
);
