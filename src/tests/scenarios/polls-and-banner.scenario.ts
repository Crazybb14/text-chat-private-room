import { scenario, step, expect } from 'kliv-scenario';

/**
 * A member signs up, sees the admin's poll on the home screen, votes once,
 * and sees both their vote and the earlier vote counted.
 */
scenario(
  'member votes in a poll and sees live results',
  {
    setup: {
      database: [
        {
          table: 'polls',
          rows: [
            {
              question: 'Pizza or tacos?',
              options: JSON.stringify(['Pizza', 'Tacos']),
              is_active: 1,
              created_by: 'owner',
              closed_at: null,
            },
          ],
        },
        {
          table: 'poll_votes',
          rows: [{ poll_id: 1, username: 'seedvoter', option_index: 0 }],
        },
      ],
    },
  },
  async ({ kliv, page }) => {
    await step('signs up and reaches the home screen', async () => {
      await page.goto('/terms');
      await expect(page.getByRole('heading', { name: 'Terms of Use' })).toBeVisible();
      await page.getByRole('heading', { name: 'Agreement Overview' }).press('End');
      await page.getByRole('button', { name: 'I AGREE' }).click();
      await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
      await page.getByRole('tab', { name: 'Sign up' }).click();
      await page.getByLabel('First name').fill('Poll');
      await page.getByLabel('Last name').fill('Voter');
      await page.getByLabel('Username', { exact: true }).fill('pollvoter');
      await page.getByLabel('Email address').fill(`${kliv.unique('poll')}@example.com`);
      const password = `Pv9!${kliv.unique('pw')}kT`;
      await page.getByLabel('Choose a password').fill(password);
      await page.getByLabel('Confirm password').fill(password);
      await page.getByRole('button', { name: 'Create account' }).click();
      await expect(page.getByRole('heading', { name: 'Hey, pollvoter' })).toBeVisible();
    });

    await step('votes in the poll', async () => {
      await expect(page.getByText('Pizza or tacos?')).toBeVisible();
      await page.getByRole('button', { name: /Tacos/ }).click();
      await expect(page.getByText('thanks for voting')).toBeVisible();
    });

    await step('sees both votes counted with percentages', async () => {
      await expect(page.getByText('2 votes')).toBeVisible();
      await expect(page.getByText('50% (1)').first()).toBeVisible();
    });
  }
);

/**
 * An important announcement shows as a big banner on every screen — even the
 * sign-out screens — until the reader dismisses it.
 */
scenario(
  'important announcement shows on every screen until dismissed',
  {
    setup: {
      database: [
        {
          table: 'important_notices',
          rows: [
            {
              title: 'Maintenance tonight',
              message: 'Short outage around 9pm.',
              is_active: 1,
              created_by: 'owner',
              deactivated_at: null,
            },
          ],
        },
      ],
    },
  },
  async ({ page }) => {
    await step('the banner appears on the terms screen', async () => {
      await page.goto('/terms');
      const banner = page.getByRole('alert', { name: 'Important announcement' });
      await expect(banner).toBeVisible();
      await expect(page.getByText('Maintenance tonight')).toBeVisible();
      await expect(page.getByText('Short outage around 9pm.')).toBeVisible();
    });

    await step('dismissing hides the banner', async () => {
      await page.getByRole('button', { name: 'Got it' }).click();
      await expect(page.getByText('Maintenance tonight')).toHaveCount(0);
    });

    await step('the banner stays gone on other screens', async () => {
      await page.goto('/login');
      await expect(page.getByText('Maintenance tonight')).toHaveCount(0);
    });
  }
);
