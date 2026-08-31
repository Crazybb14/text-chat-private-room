import { scenario, step, expect, type Page } from 'kliv-scenario';

async function onboard(page: Page, username: string) {
  await page.goto('/');
  await page.getByRole('heading', { name: 'Agreement Overview' }).press('End');
  await page.getByRole('button', { name: 'I AGREE' }).click();
  // Already signed-in accounts skip the login page and pick their chat username.
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByRole('button', { name: 'Save username' }).click();
  await expect(page.getByRole('heading', { name: `Hey, ${username}` })).toBeVisible();
}

scenario(
  'two users become friends and direct message each other',
  { setup: { users: { alex: {}, sam: {} } } },
  async ({ users }) => {
    await step('both users finish setting up', async () => {
      await onboard(users.alex.page, 'dmalex');
      await onboard(users.sam.page, 'dmsam');
    });

    await step('alex sends sam a friend request', async () => {
      await users.alex.page.getByRole('button', { name: 'Friends' }).click();
      await users.alex.page.getByPlaceholder('Search by name or username...').fill('dmsam');
      await users.alex.page.getByRole('button', { name: 'Add dmsam as a friend' }).click();
    });

    await step('sam accepts the request', async () => {
      await users.sam.page.getByRole('button', { name: 'Friends' }).click();
      await users.sam.page.getByRole('button', { name: /Requests/ }).click();
      await users.sam.page.getByRole('button', { name: 'Accept dmalex' }).click();
      await users.sam.page.getByRole('button', { name: 'Friends (1)' }).click();
      await expect(users.sam.page.getByRole('button', { name: 'Message dmalex' })).toBeVisible();
    });

    await step('alex messages sam', async () => {
      await users.alex.page.goto('/dm/dmsam');
      await users.alex.page.getByPlaceholder('Message').fill('secret hello from alex');
      await users.alex.page.getByPlaceholder('Message').press('Enter');
      await expect(users.alex.page.getByText('secret hello from alex').first()).toBeVisible();
    });

    await step('sam sees the message in their thread', async () => {
      await users.sam.page.goto('/dm/dmalex');
      await expect(users.sam.page.getByText('secret hello from alex').first()).toBeVisible();
    });
  }
);
