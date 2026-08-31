import { scenario, step, expect } from 'kliv-scenario';

scenario(
  'admin sends a notification to everyone',
  {
    setup: {
      users: { admin: {} },
      database: [
        {
          table: 'admin_users',
          rows: [
            {
              username: 'siteadmin',
              password_hash: 'cccd69a1993ff60dfc005e70959f098dd64069f3c7b37f2f4c0c9160f15d633d',
              salt: 'aabbccdd00112233',
              permissions: JSON.stringify({ rooms: true, notifications: true, dms: true }),
              is_active: 1,
              role: 'admin',
              status: 'active',
              invite_code: '',
            },
          ],
        },
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

    await step('opens the admin panel with the staff sign-in', async () => {
      await page.goto('/admin');
      await page.getByLabel('Admin username').fill('siteadmin');
      await page.getByLabel('Password').fill('panel-pass-123');
      await page.getByRole('button', { name: 'Sign in as admin' }).click();
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
