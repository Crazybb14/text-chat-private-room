import { scenario, step, expect } from 'kliv-scenario';

scenario(
  'admin reads direct messages organized by conversation',
  {
    setup: {
      users: { admin: {} },
      database: [
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

    await step('opens the admin panel with the password', async () => {
      await page.goto('/admin');
      await page.getByPlaceholder('Enter password').fill('qacgt5555$');
      await page.getByRole('button', { name: 'Access Admin Panel' }).click();
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
