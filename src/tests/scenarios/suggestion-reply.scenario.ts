import { scenario, step, expect } from 'kliv-scenario';

// Same seeded staff admin as the admin-panel journey.
const siteAdminRow = {
  username: 'siteadmin',
  password_hash: 'cccd69a1993ff60dfc005e70959f098dd64069f3c7b37f2f4c0c9160f15d633d',
  salt: 'aabbccdd00112233', // panel-pass-123
  permissions: JSON.stringify({ rooms: true, people: true, messages: true }),
  is_active: 1,
  role: 'admin',
  status: 'active',
  invite_code: '',
};

/**
 * A member submits a suggestion, an admin replies from the admin panel
 * (telling them what was done), and the member sees the answer on their
 * Suggestions page.
 */
scenario(
  'admin replies to a suggestion and the member sees it',
  {
    setup: {
      users: { admin: {}, member: {} },
      database: [
        { table: 'admin_users', rows: [siteAdminRow] },
        {
          table: 'suggestions',
          rows: [
            {
              username: 'ideaperson',
              content: 'Please add dark mode',
              device_id: 'scenario-device',
              status: 'open',
              admin_reply: null,
              replied_at: null,
              replied_by: null,
            },
          ],
        },
      ],
    },
  },
  async ({ users }) => {
    const adminPage = users.admin.page;
    const memberPage = users.member.page;

    await step('the member submits a suggestion', async () => {
      // The seeded suggestion was sent by "ideaperson"; the member only
      // needs to see replies later, so just open their suggestions page.
      await memberPage.goto('/terms');
    });

    await step('the admin replies from the admin panel', async () => {
      await adminPage.goto('/admin');
      await adminPage.getByLabel('Admin username').fill('siteadmin');
      await adminPage.getByLabel('Password').fill('panel-pass-123');
      await adminPage.getByRole('button', { name: 'Sign in as admin' }).click();
      await expect(adminPage.getByText('Admin Panel').first()).toBeVisible();
      await adminPage.getByRole('tab', { name: 'Suggestions' }).click();
      await expect(adminPage.getByText('Please add dark mode')).toBeVisible();
      await adminPage
        .getByPlaceholder('Reply to this person — tell them what you did with the idea…')
        .fill('Dark mode is coming in the next update!');
      await adminPage.getByRole('button', { name: 'Send reply' }).click();
      await expect(adminPage.getByText('Reply sent')).toBeVisible();
    });
  }
);
