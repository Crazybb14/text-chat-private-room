import { scenario, step, expect } from 'kliv-scenario';

// A staff admin the owner invited. password_hash is what the admin server
// stores: sha256(`${salt}:${password}`) for salt/password below.
const siteAdminRow = {
  username: 'siteadmin',
  password_hash: 'cccd69a1993ff60dfc005e70959f098dd64069f3c7b37f2f4c0c9160f15d633d',
  salt: 'aabbccdd00112233', // panel-pass-123
  permissions: JSON.stringify({ rooms: true, messages: true, files: true, live: true, dms: true, notifications: true }),
  is_active: 1,
  role: 'admin',
  status: 'active',
  invite_code: '',
};

scenario(
  'admin password gates the panel',
  { setup: { database: [{ table: 'admin_users', rows: [siteAdminRow] }] } },
  async ({ page }) => {
    await step('wrong password is rejected', async () => {
      await page.goto('/admin');
      await page.getByLabel('Admin username').fill('siteadmin');
      await page.getByLabel('Password').fill('not-the-password');
      await page.getByRole('button', { name: 'Sign in as admin' }).click();
      // still on the login form
      await expect(page.getByRole('button', { name: 'Sign in as admin' })).toBeVisible();
    });

    await step('correct password opens the panel', async () => {
      await page.getByLabel('Password').fill('panel-pass-123');
      await page.getByRole('button', { name: 'Sign in as admin' }).click();
      await expect(page.getByText('Admin Panel').first()).toBeVisible();
    });

    await step('data tabs ask for sign-in when not signed in', async () => {
      await page.getByRole('tab', { name: 'Rooms', exact: true }).click();
      await expect(page.getByText('Sign-in required').first()).toBeVisible();
    });

    await step('download tab is reserved for the owner', async () => {
      // The website ZIP contains the site's source, so a staff login never
      // sees it — only the signed-in owner does.
      await expect(page.getByRole('tab', { name: 'Download' })).toHaveCount(0);
    });
  }
);

scenario(
  'admin watches a room live and sends a message as someone else',
  {
    setup: {
      users: { admin: {} },
      database: [
        { table: 'admin_users', rows: [siteAdminRow] },
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

    await step('opens the admin panel with the staff sign-in', async () => {
      await page.goto('/admin');
      await page.getByLabel('Admin username').fill('siteadmin');
      await page.getByLabel('Password').fill('panel-pass-123');
      await page.getByRole('button', { name: 'Sign in as admin' }).click();
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
