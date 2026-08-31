import { scenario, step, expect } from 'kliv-scenario';

scenario(
  'invited admin sets a password and sees only granted abilities',
  {
    setup: {
      users: { mod: {} },
      database: [
        {
          table: 'admin_users',
          rows: [
            {
              username: 'moderator',
              password_hash: '',
              salt: '',
              permissions: JSON.stringify({ rooms: true, messages: true }),
              is_active: 1,
              role: 'admin',
              status: 'invited',
              invite_code: 'TESTCODE',
              invited_at: 1000,
            },
          ],
        },
      ],
    },
  },
  async ({ users }) => {
    const { page } = users.mod;

    await step('signing in the first time asks for the invite code', async () => {
      await page.goto('/admin');
      await page.getByRole('tab', { name: 'Admin sign-in' }).click();
      await page.getByLabel('Admin username').fill('moderator');
      await page.getByLabel('Password').fill('anything');
      await page.getByRole('button', { name: 'Sign in as admin' }).click();
      await expect(page.getByText('Set your password')).toBeVisible();
    });

    await step('invite code and chosen password unlock the panel', async () => {
      await page.getByLabel('Invite code').fill('TESTCODE');
      await page.getByLabel('Your new password').fill('modpass123');
      await page.getByLabel('Confirm password').fill('modpass123');
      await page.getByRole('button', { name: 'Set password & enter' }).click();
      await expect(page.getByText('Admin Panel').first()).toBeVisible();
      await expect(page.getByText('admin: @moderator').first()).toBeVisible();
    });

    await step('only the granted tabs are visible', async () => {
      await expect(page.getByRole('tab', { name: 'Rooms' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Messages' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Settings' })).toHaveCount(0);
      await expect(page.getByRole('tab', { name: 'Direct Messages' })).toHaveCount(0);
      await expect(page.getByRole('tab', { name: 'Admins' })).toHaveCount(0);
    });

    await step('the password works on the next sign-in', async () => {
      await page.getByRole('button', { name: 'Sign out' }).click();
      await page.getByRole('tab', { name: 'Admin sign-in' }).click();
      await page.getByLabel('Admin username').fill('moderator');
      await page.getByLabel('Password').fill('modpass123');
      await page.getByRole('button', { name: 'Sign in as admin' }).click();
      await expect(page.getByText('Admin Panel').first()).toBeVisible();
    });
  }
);
