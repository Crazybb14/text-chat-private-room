import { scenario, step, expect, type Page } from 'kliv-scenario';

/**
 * Full signup-to-chat journey: a brand-new visitor accepts the terms, picks a
 * username, creates a room, and sends a message that appears in the room.
 */
async function onboard(page: Page, username: string) {
  await step('lands on terms', async () => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Terms of Use' })).toBeVisible();
  });

  await step('scrolls and accepts terms', async () => {
    await page.getByRole('heading', { name: 'Agreement Overview' }).press('End');
    await page.getByRole('button', { name: 'I AGREE' }).click();
  });

  await step('picks a username', async () => {
    await page.getByLabel('Username', { exact: true }).fill(username);
    await page.getByRole('button', { name: 'Set Username Permanently' }).click();
    await expect(page.getByText(`Hey, ${username}`)).toBeVisible();
  });
}

scenario(
  'visitor signs up, creates a room, and chats',
  { setup: {} },
  async ({ page }) => {
    await onboard(page, 'journeytester');

    await step('creates a room', async () => {
      await page.getByRole('button', { name: 'New room' }).click();
      await page.getByLabel('Room name').fill('Journey Test Room');
      await page.getByRole('button', { name: 'Create room' }).click();
      await expect(page.getByText('Journey Test Room').first()).toBeVisible();
    });

    await step('sends a message', async () => {
      await page.getByPlaceholder('Message').fill('hello from the journey test');
      await page.getByPlaceholder('Message').press('Enter');
      await expect(page.getByText('hello from the journey test').first()).toBeVisible();
    });
  }
);
