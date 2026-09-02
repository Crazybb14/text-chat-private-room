import { scenario, step, expect, type Page } from 'kliv-scenario';

async function onboard(page: Page, username: string) {
  await page.goto('/');
  await page.getByRole('heading', { name: 'Agreement Overview' }).press('End');
  await page.getByRole('button', { name: 'I AGREE' }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByRole('button', { name: 'Save username' }).click();
  await expect(page.getByRole('heading', { name: `Hey, ${username}` })).toBeVisible();
}

scenario(
  'every shared file waits for admin approval',
  {
    setup: {
      users: { alex: {}, sam: {}, boss: {} },
      database: [
        {
          table: 'admin_users',
          rows: [
            {
              username: 'reviewboss',
              password_hash: '77fd4acbaf8108f54272a50923f8c5cec51f06a7aae58fde3c396fbd30869cda',
              salt: '1122334455667788', // review-pass-777
              permissions: JSON.stringify({ rooms: true, messages: true, files: true, dms: true }),
              is_active: 1,
              role: 'admin',
              status: 'active',
              invite_code: '',
            },
          ],
        },
        { table: 'rooms', rows: [{ name: 'File Room', code: null, type: 'public' }] },
        {
          table: 'messages',
          rows: [
            {
              room_id: 1,
              sender_name: 'filealex',
              content: '',
              is_ai: 0,
              device_id: null,
              file_path: '/content/chat_files/1/waiting-note.txt',
              file_name: 'waiting-note.txt',
              file_size: 12,
              mime_type: 'text/plain',
              file_status: 'pending',
            },
            {
              room_id: 1,
              sender_name: 'filealex',
              content: '',
              is_ai: 0,
              device_id: null,
              file_path: '/content/chat_files/1/live-note.txt',
              file_name: 'live-note.txt',
              file_size: 12,
              mime_type: 'text/plain',
              file_status: 'approved',
            },
          ],
        },
        {
          table: 'dm_files',
          rows: [
            {
              sender_username: 'filealex',
              recipient_username: 'filesam',
              file_path: '/content/dm_files/waiting-dm.txt',
              file_name: 'waiting-dm.txt',
              file_size: 10,
              mime_type: 'text/plain',
              status: 'pending',
            },
            {
              sender_username: 'filealex',
              recipient_username: 'filesam',
              file_path: '/content/dm_files/live-dm.txt',
              file_name: 'live-dm.txt',
              file_size: 10,
              mime_type: 'text/plain',
              status: 'approved',
            },
          ],
        },
      ],
    },
  },
  async ({ users }) => {
    const alex = users.alex.page;
    const sam = users.sam.page;
    const boss = users.boss.page;

    await step('both chatters finish setting up', async () => {
      await onboard(alex, 'filealex');
      await onboard(sam, 'filesam');
    });

    await step('a room hides the unapproved file from everyone but the sender', async () => {
      await sam.goto('/chat/1');
      await expect(sam.getByText('live-note.txt')).toBeVisible();
      await expect(sam.getByText('waiting-note.txt')).toHaveCount(0);
    });

    await step('the sender sees a waiting note on their own file', async () => {
      await alex.goto('/chat/1');
      await expect(alex.getByText('waiting-note.txt')).toBeVisible();
      await expect(alex.getByText(/waiting for admin approval/i).first()).toBeVisible();
    });

    await step('the two become friends so they can private message', async () => {
      await alex.getByRole('button', { name: 'Friends and direct messages' }).click();
      await alex.getByPlaceholder('Search by name or username...').fill('filesam');
      await alex.getByRole('button', { name: 'Add filesam as a friend' }).click();
      await sam.getByRole('button', { name: 'Friends and direct messages' }).click();
      await sam.getByRole('button', { name: /Requests/ }).click();
      await sam.getByRole('button', { name: 'Accept filealex' }).click();
    });

    await step('a private chat hides its unapproved file too', async () => {
      await sam.goto('/dm/filealex');
      await expect(sam.getByText('live-dm.txt')).toBeVisible();
      await expect(sam.getByText('waiting-dm.txt')).toHaveCount(0);
    });

    await step('the admin sees both waiting files in the review tab', async () => {
      await boss.goto('/admin');
      await boss.getByLabel('Admin username').fill('reviewboss');
      await boss.getByLabel('Password').fill('review-pass-777');
      await boss.getByRole('button', { name: 'Sign in as admin' }).click();
      await boss.getByRole('tab', { name: 'Files' }).click();
      await expect(boss.getByText('waiting-note.txt')).toBeVisible();
      await expect(boss.getByText('waiting-dm.txt')).toBeVisible();
    });

    await step('approving the private file makes it appear for the recipient', async () => {
      await boss.getByRole('button', { name: 'Approve waiting-dm.txt' }).click();
      await expect(sam.getByText('waiting-dm.txt')).toBeVisible();
    });

    await step('deleting the room file removes it everywhere', async () => {
      await boss.getByRole('button', { name: 'Remove waiting-note.txt' }).click();
      await boss.getByRole('button', { name: 'Confirm remove waiting-note.txt' }).click();
      await expect(boss.getByText('waiting-note.txt')).toHaveCount(0);
      await alex.goto('/chat/1');
      await expect(alex.getByText('waiting-note.txt')).toHaveCount(0);
    });
  }
);
