import { scenario, step, expect } from 'kliv-scenario';

/**
 * Full signup-to-chat journey: a brand-new visitor accepts the terms, lands on
 * the login page, creates a real account (first name, last name, username,
 * email, password), then creates a room and sends a message.
 */
scenario(
  'visitor accepts terms, creates an account, and chats',
  { setup: {} },
  async ({ kliv, page }) => {
    await step('accepting the terms leads to the login page', async () => {
      // Landing straight on /terms — the "/" → terms redirect can take longer
      // than one step's time budget in a cold test environment.
      await page.goto('/terms');
      await expect(page.getByRole('heading', { name: 'Terms of Use' })).toBeVisible();
      await page.getByRole('heading', { name: 'Agreement Overview' }).press('End');
      await page.getByRole('button', { name: 'I AGREE' }).click();
      await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    });

    await step('creates an account with name, username, email and password', async () => {
      await page.getByRole('tab', { name: 'Sign up' }).click();
      await page.getByLabel('First name').fill('Journey');
      await page.getByLabel('Last name').fill('Tester');
      await page.getByLabel('Username', { exact: true }).fill('journeytester');
      await page.getByLabel('Email address').fill(`${kliv.unique('journey')}@example.com`);
      const password = `Zk9!${kliv.unique('pw')}qX`;
      await page.getByLabel('Choose a password').fill(password);
      await page.getByLabel('Confirm password').fill(password);
      await page.getByRole('button', { name: 'Create account' }).click();
      await expect(page.getByRole('heading', { name: 'Hey, journeytester' })).toBeVisible();
    });

    await step('creates a room', async () => {
      await page.getByRole('button', { name: 'New room' }).click();
      // Regular accounts can only make private rooms — public rooms are owner-only.
      await expect(
        page.getByText('Public rooms can only be created by the site owner')
      ).toBeVisible();
      await page.getByLabel('Room name').fill('Journey Test Room');
      await page.getByRole('button', { name: 'Create room' }).click();
      await expect(page.getByText('Journey Test Room').first()).toBeVisible();
    });

    await step('sends a message', async () => {
      await page.getByPlaceholder('Message').fill('hello from the journey test');
      await page.getByPlaceholder('Message').press('Enter');
      await expect(page.getByText('hello from the journey test').first()).toBeVisible();
    });

    await step('signing out returns to the login page', async () => {
      await page.getByRole('button', { name: 'Home' }).click();
      await page.getByRole('button', { name: 'Sign out' }).click();
      await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    });
  }
);
