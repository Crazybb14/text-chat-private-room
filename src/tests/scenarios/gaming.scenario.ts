import { scenario, step, expect } from "kliv-scenario";

const adminPasswordHash = "cccd69a1993ff60dfc005e70959f098dd64069f3c7b37f2f4c0c9160f15d633d"; // panel-pass-123
const adminSalt = "aabbccdd00112233";

function adminRow(username: string) {
  return {
    username,
    password_hash: adminPasswordHash,
    salt: adminSalt,
    permissions: JSON.stringify({ gaming: true }),
    is_active: 1,
    role: "admin",
    status: "active",
    invite_code: "",
  };
}

scenario(
  "admin plays tic tac toe against the AI and chats",
  { setup: { database: [{ table: "admin_users", rows: [adminRow("siteadmin")] }] } },
  async ({ page }) => {
    await step("opens the gaming tab", async () => {
      await page.goto("/admin");
      await page.getByLabel("Admin username").fill("siteadmin");
      await page.getByLabel("Password").fill("panel-pass-123");
      await page.getByRole("button", { name: "Sign in as admin" }).click();
      await expect(page.getByText("Admin Panel").first()).toBeVisible();
      await page.getByRole("tab", { name: "Gaming" }).click();
      await expect(page.getByText("Gaming lounge")).toBeVisible();
    });

    await step("starts a tic tac toe match vs the AI", async () => {
      await page.getByRole("button", { name: "New game" }).click();
      await page.getByRole("button", { name: "choose Tic Tac Toe" }).click();
      await page.getByRole("button", { name: "Create match" }).click();
      await expect(page.getByLabel("Tic tac toe board")).toBeVisible();
    });

    await step("moves and the AI answers", async () => {
      await page.getByLabel("square 1").click();
      await expect(page.getByLabel("square 1")).toContainText("X");
      // the AI's O shows up on some other square
      await expect(
        page.getByLabel("Tic tac toe board").getByRole("button").filter({ hasText: "O" }),
      ).toHaveCount(1);
    });

    await step("chats beside the game", async () => {
      await page.getByLabel("Game chat message").fill("good game");
      await page.getByRole("button", { name: "Send game chat" }).click();
      await expect(page.getByText("good game").first()).toBeVisible();
    });

    await step("the chat appears in the admin monitor", async () => {
      await page.getByRole("button", { name: "Back to games" }).click();
      await expect(page.getByText("Game chat monitor")).toBeVisible();
      await expect(page.getByText("good game").first()).toBeVisible();
    });
  },
);

scenario(
  "two admins play a multiplayer match",
  {
    setup: {
      database: [{ table: "admin_users", rows: [adminRow("ada"), adminRow("ben")] }],
    },
  },
  async ({ users }) => {
    const ada = users.ada.page;
    const ben = users.ben.page;

    await step("ada posts an open challenge", async () => {
      await ada.goto("/admin");
      await ada.getByLabel("Admin username").fill("ada");
      await ada.getByLabel("Password").fill("panel-pass-123");
      await ada.getByRole("button", { name: "Sign in as admin" }).click();
      await expect(ada.getByText("Admin Panel").first()).toBeVisible();
      await ada.getByRole("tab", { name: "Gaming" }).click();
      await ada.getByRole("button", { name: "New game" }).click();
      await ada.getByRole("button", { name: "choose Tic Tac Toe" }).click();
      await ada.getByRole("combobox", { name: "Opponent type" }).click();
      await ada.getByRole("option", { name: "Play a person" }).click();
      await ada.getByRole("button", { name: "Create match" }).click();
      await expect(ada.getByLabel("Tic tac toe board")).toBeVisible();
    });

    await step("ben joins and the board is live for both", async () => {
      await ben.goto("/admin");
      await ben.getByLabel("Admin username").fill("ben");
      await ben.getByLabel("Password").fill("panel-pass-123");
      await ben.getByRole("button", { name: "Sign in as admin" }).click();
      await expect(ben.getByText("Admin Panel").first()).toBeVisible();
      await ben.getByRole("tab", { name: "Gaming" }).click();
      await ben.getByRole("button", { name: "Join" }).click();
      await expect(ben.getByLabel("Tic tac toe board")).toBeVisible();
    });

    await step("ada moves and ben sees it, then answers", async () => {
      // ada's page only shows "Your turn" once it notices ben joined
      await expect(ada.getByText("Your turn").first()).toBeVisible();
      await ada.getByLabel("square 1").click();
      await expect(ada.getByLabel("square 1")).toContainText("X");
      await expect(ben.getByLabel("square 1")).toContainText("X");
      await ben.getByLabel("square 5").click();
      await expect(ada.getByLabel("square 5")).toContainText("O");
    });
  },
);
