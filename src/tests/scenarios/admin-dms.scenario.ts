import { scenario, step, expect } from 'kliv-scenario';

scenario(
  'admin reads direct messages organized by conversation',
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
              salt: 'aabbccdd00112233', // panel-pass-123
              permissions: JSON.stringify({ rooms: true, dms: true, notifications: true }),
              is_active: 1,
              role: 'admin',
              status: 'active',
              invite_code: '',
            },
          ],
        },
        {
          table: 'direct_messages',
          rows: [
            { sender_username: 'alice', recipient_username: 'bob', content: 'did you finish the project?', is_read: 1 },
            { sender_username: 'bob', recipient_username: 'alice', content: 'almost done!', is_read: 0 },
            { sender_username: 'carol', recipient_username: 'dave', content: 'lunch tomorrow?', is_read: 0 },
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

    await step('the Direct Messages tab lists one folder per conversation', async () => {
      await page.getByRole('tab', { name: 'Direct Messages' }).click();
      await expect(page.getByText('alice ↔ bob').first()).toBeVisible();
      await expect(page.getByText('carol ↔ dave').first()).toBeVisible();
    });

    await step('opening a folder shows both sides of the thread', async () => {
      await page.getByText('alice ↔ bob').first().click();
      await expect(page.getByText('did you finish the project?').first()).toBeVisible();
      await expect(page.getByText('almost done!').first()).toBeVisible();
    });

    await step('search narrows the folder list', async () => {
      await page.getByPlaceholder('Search by username or message text…').fill('lunch');
      await expect(page.getByText('carol ↔ dave').first()).toBeVisible();
      await expect(page.getByText('alice ↔ bob')).toHaveCount(0);
    });
  }
);
