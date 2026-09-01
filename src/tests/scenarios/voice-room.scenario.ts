import { scenario, step, expect, type Page } from 'kliv-scenario';

async function onboard(page: Page, username: string) {
  await page.goto('/');
  await page.getByRole('heading', { name: 'Agreement Overview' }).press('End');
  await page.getByRole('button', { name: 'I AGREE' }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByRole('button', { name: 'Save username' }).click();
  await expect(page.getByRole('heading', { name: `Hey, ${username}` })).toBeVisible();
}

// @kliv-spec-derived — from user intent: "a public voice chat shows up on the
// main page as a different public room, and anyone can join the call"
scenario(
  'public voice room lists separately and anyone can open the call',
  {
    setup: {
      users: { casey: {} },
      database: [
        {
          table: 'rooms',
          rows: [
            { name: 'General Chat', code: null, type: 'public', is_voice: 0 },
            { name: 'Late Night Voice', code: null, type: 'public', is_voice: 1 },
          ],
        },
      ],
    },
  },
  async ({ users }) => {
    const { page } = users.casey;

    await step('casey finishes setting up', async () => {
      await onboard(page, 'voicecasey');
    });

    await step('the voice room appears in its own section, not the text list', async () => {
      await expect(page.getByRole('heading', { name: 'Public rooms' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Voice rooms' })).toBeVisible();
      await expect(page.getByText('General Chat').first()).toBeVisible();
      await expect(page.getByText('Late Night Voice').first()).toBeVisible();
      // Only voice cards carry this subtitle.
      await expect(page.getByText('Voice room — join to talk').first()).toBeVisible();
    });

    await step('a regular user can open the voice room and its call', async () => {
      await page.getByText('Late Night Voice').first().click();
      await expect(page.getByText('This is a voice room')).toBeVisible();
      await page.getByRole('button', { name: 'Start the call' }).click();
      // If the test browser blocks the mic/camera, fall back to listening only.
      const blocked = await page
        .getByText('Camera and microphone blocked')
        .isVisible()
        .catch(() => false);
      if (blocked) {
        await page.getByRole('button', { name: 'Join listening only' }).click();
      }
      await expect(page.getByText(/Late Night Voice — call|listening only/).first()).toBeVisible();
    });
  }
);
