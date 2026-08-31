import { scenario, step, expect } from 'kliv-scenario';

scenario(
  'admin password gates the panel',
  { setup: {} },
  async ({ page }) => {
    await step('wrong password is rejected', async () => {
      await page.goto('/admin');
      await page.getByPlaceholder('Enter password').fill('wrong-code');
      await page.getByRole('button', { name: 'Access Admin Panel' }).click();
      await expect(page.getByText('Invalid password')).toBeVisible();
    });

    await step('correct password opens the panel', async () => {
      await page.getByPlaceholder('Enter password').fill('qacgt5555$');
      await page.getByRole('button', { name: 'Access Admin Panel' }).click();
      await expect(page.getByText('Admin Panel').first()).toBeVisible();
    });

    await step('data tabs ask for sign-in when not signed in', async () => {
      await page.getByRole('tab', { name: 'Rooms' }).click();
      await expect(page.getByText('Sign-in required').first()).toBeVisible();
    });

    await step('download tab offers the website zip', async () => {
      await page.getByRole('tab', { name: 'Download' }).click();
      await expect(page.getByText('Download website code')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Download Website' })).toBeEnabled();
    });
  }
);

scenario(
  'admin watches a room live and sends a message as someone else',
  {
    setup: {
      users: { admin: {} },
      database: [
        {
          table: 'rooms',
          rows: [{ name: 'Monitor Room', code: null, type: 'public' }],
        },
        {
          table: 'messages',
          rows: [{ room_id: 1, sender_name: 'victim', content: 'original message', is_ai: 0 }],
        },
      ],
    },
  },
  async ({ users }) => {
    const { page } = users.admin;

    await step('opens the admin panel with the password', async () => {
      await page.goto('/admin');
      await page.getByPlaceholder('Enter password').fill('qacgt5555$');
      await page.getByRole('button', { name: 'Access Admin Panel' }).click();
      await expect(page.getByText('Admin Panel').first()).toBeVisible();
    });

    await step('sees the room message in the live monitor', async () => {
      await page.getByRole('tab', { name: 'Live' }).click();
      await expect(page.getByText('original message').first()).toBeVisible();
    });

    await step('sends a message that appears as another person', async () => {
      await page.getByLabel('Send as (username)').fill('victim');
      await page.getByLabel('Their message').fill('impersonated hello');
      await page.getByRole('button', { name: 'Send as @victim' }).click();
      await expect(page.getByText('impersonated hello').first()).toBeVisible();
    });
  }
);
