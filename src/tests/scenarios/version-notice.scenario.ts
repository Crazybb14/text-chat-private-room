import { scenario, step, expect } from 'kliv-scenario';

/**
 * The update-experience journey: a visitor signs up, lands on the main page,
 * and sees (1) the live site stats + feedback form, (2) the owner's "reload
 * now" banner, and (3) the What's-new widget with the posted version notice.
 */
scenario(
  'visitor sees site stats, the reload banner, and posted version notices',
  {
    setup: {
      database: [
        {
          table: 'version_notices',
          rows: [
            {
              version: '2.1.0',
              title: 'Voice rooms',
              body: 'Voice rooms and site stats are here.',
              posted_by: 'owner',
              posted_at: 1760000000,
            },
          ],
        },
        {
          table: 'admin_settings',
          rows: [
            // A reload flag dated in the future reads as "newer than this page load".
            { setting_key: 'reload_required_at', setting_value: '4102444800000', setting_type: 'number' },
            { setting_key: 'reload_required_message', setting_value: 'New version is live', setting_type: 'text' },
          ],
        },
      ],
    },
  },
  async ({ kliv, page }) => {
    // Usernames are lowercase letters/numbers/underscores, max 20 chars.
    const username = kliv.unique('upd').replace(/[^a-z0-9_]/g, '').slice(0, 20);

    await step('signs up and lands on the main page', async () => {
      // Landing straight on /terms — the "/" → terms redirect can take longer
      // than one step's time budget in a cold test environment.
      await page.goto('/terms');
      await expect(page.getByRole('heading', { name: 'Terms of Use' })).toBeVisible();
      await page.getByRole('heading', { name: 'Agreement Overview' }).press('End');
      await page.getByRole('button', { name: 'I AGREE' }).click();
      await page.getByRole('tab', { name: 'Sign up' }).click();
      await page.getByLabel('First name').fill('Update');
      await page.getByLabel('Last name').fill('Checker');
      await page.getByLabel('Username', { exact: true }).fill(username);
      await page.getByLabel('Email address').fill(`${username}@example.com`);
      const password = `Zk9!${kliv.unique('pw')}qX`;
      await page.getByLabel('Choose a password').fill(password);
      await page.getByLabel('Confirm password').fill(password);
      await page.getByRole('button', { name: 'Create account' }).click();
      await expect(page.getByRole('heading', { name: `Hey, ${username}` })).toBeVisible();
    });

    await step('the site stats section shows real numbers', async () => {
      await expect(page.getByRole('heading', { name: 'Site activity' })).toBeVisible();
      await expect(page.getByText('online right now')).toBeVisible();
      await expect(page.getByText('messages sent')).toBeVisible();
    });

    await step('the feedback form sends a suggestion', async () => {
      await page.getByPlaceholder('What should be added or improved?').fill('more emoji please');
      await page.getByRole('button', { name: 'Send' }).click();
      await expect(page.getByText('1 suggestion sent in so far')).toBeVisible();
    });

    await step("the owner's reload banner asks for a reload", async () => {
      await expect(
        page.getByText('A new version of ChatRooms was just released')
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Reload now' })).toBeVisible();
    });

    await step("the What's-new widget shows the posted notice", async () => {
      await page.getByRole('button', { name: "What's new" }).click();
      await expect(page.getByRole('dialog').getByText('v2.1.0')).toBeVisible();
      await expect(page.getByText('Voice rooms and site stats are here.')).toBeVisible();
    });
  }
);
