import { scenario, step, expect } from 'kliv-scenario';

scenario(
  'admin sends a notification to everyone',
  {
    setup: {
      users: { admin: {} },
      database: [
        {
          table: 'user_profiles',
          rows: [
            { user_id: 'u1', username: 'alice', display_name: 'Alice', bio: '', avatar_url: '', status: 'offline', last_seen: 0 },
            { user_id: 'u2', username: 'bob', display_name: 'Bob', bio: '', avatar_url: '', status: 'offline', last_seen: 0 },
          ],
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

    await step('composes a broadcast in the Notifications tab', async () => {
      await page.getByRole('tab', { name: 'Notifications' }).click();
      await page.getByLabel('Title', { exact: true }).fill('Maintenance tonight');
      await page.getByLabel('Message', { exact: true }).fill('The site restarts at 10pm for updates.');
      await page.getByRole('button', { name: 'Send to everyone' }).click();
      await expect(page.getByText('Notification sent').first()).toBeVisible();
    });

    await step('the broadcast shows up in the recent list', async () => {
      await expect(page.getByText('Maintenance tonight').first()).toBeVisible();
      await expect(page.getByText('The site restarts at 10pm for updates.').first()).toBeVisible();
    });
  }
);
