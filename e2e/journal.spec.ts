import type { Page } from "@playwright/test";
import { expect, test } from "./support";

async function addBurger(page: Page, name: string, place?: string) {
  await page.getByLabel("Burger", { exact: true }).fill(name);
  if (place) await page.getByLabel(/^Where/).fill(place);
  await page.getByRole("button", { name: "Add to cravings" }).click();
  await expect(page.getByTestId("craving").filter({ hasText: name })).toBeVisible();
}

async function devour(page: Page, name: string, rating: number, note?: string) {
  const item = page.getByTestId("craving").filter({ hasText: name });
  await item.getByText("Devour it!").click();
  await item.getByRole("radio", { name: `${rating} out of 5` }).check();
  if (note) await item.getByLabel(/^Note/).fill(note);
  await item.getByRole("button", { name: "Log it" }).click();
  await expect(page.getByTestId("devoured").filter({ hasText: name })).toBeVisible();
}

test("log a craving, devour it, and watch the stats move", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Burger Logger/);

  await addBurger(page, "Double smash", "Shake Shack");
  await expect(page.getByTestId("stat-cravings")).toHaveText("1");

  await devour(page, "Double smash", 4, "Great bun");
  await expect(page.getByTestId("stat-cravings")).toHaveText("0");
  await expect(page.getByTestId("stat-devoured")).toHaveText("1");
  await expect(page.getByTestId("stat-average")).toHaveText("4");
  await expect(page.getByTestId("stat-best")).toHaveText("Double smash");
  await expect(page.getByText("Great bun")).toBeVisible();
});

test("remembers the journal after a reload, and can undo and delete", async ({ page }) => {
  await page.goto("/");
  await addBurger(page, "Patty melt");
  await devour(page, "Patty melt", 3);
  await page.reload();
  await expect(page.getByTestId("devoured")).toContainText("Patty melt");

  await page.getByRole("button", { name: "Move Patty melt back to cravings" }).click();
  await expect(page.getByTestId("craving")).toContainText("Patty melt");
  await page.getByRole("button", { name: "Delete Patty melt" }).click();
  await expect(page.getByTestId("craving")).toHaveCount(0);
  await expect(page.getByText("Nothing queued")).toBeVisible();
});

test("navigation swaps the page in place instead of reloading it", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    (window as unknown as { marker: string }).marker = "still here";
  });
  await addBurger(page, "No reload");
  const marker = await page.evaluate(() => (window as unknown as { marker?: string }).marker);
  expect(marker, "htmx should swap the body without a full page load").toBe("still here");
});

test("shows a clear message when the input is rejected", async ({ page }) => {
  await page.goto("/");
  // The browser enforces maxlength, so send an over-long name past it, straight to the server.
  const response = await page.request.post("/burgers", {
    form: { name: "x".repeat(81) },
    headers: { origin: new URL(page.url()).origin },
  });
  expect(response.status()).toBe(422);
  expect(await response.text()).toContain('role="alert"');
});

test("an AI agent logs a burger through MCP and it appears in the browser", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByText("Connect an AI agent").click();
  const url = await page.getByTestId("mcp-url").inputValue();
  expect(url).toMatch(/\/mcp\/[A-Za-z0-9_-]{32}$/);

  const response = await request.post(url, {
    headers: { accept: "application/json, text/event-stream" },
    data: {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "add_burger", arguments: { name: "Agent special", place: "MCP Grill" } },
    },
  });
  expect(response.ok()).toBe(true);

  await page.reload();
  await expect(page.getByTestId("craving")).toContainText("Agent special");
});

test.describe("with JavaScript turned off", () => {
  test.use({ javaScriptEnabled: false });

  test("the whole lifecycle still works with plain forms", async ({ page }) => {
    await page.goto("/");
    await addBurger(page, "Plain HTML");
    await devour(page, "Plain HTML", 5, "No JS needed");
    await expect(page.getByTestId("stat-devoured")).toHaveText("1");
    await expect(page.getByText("No JS needed")).toBeVisible();
  });
});

test("today's burger: the daily card offers a pick and adds it to cravings in one tap", async ({
  page,
}) => {
  await page.goto("/");
  const card = page.getByTestId("today");
  await expect(card).toContainText("Today's burger");
  await expect(card.getByTestId("teaser")).not.toBeEmpty();
  await expect(card.getByTestId("match")).toHaveText(/\d+%\s*match/);

  const pick = (await card.getByRole("heading", { level: 2 }).textContent())?.trim() ?? "";
  await card.getByRole("button", { name: "Add today's pick to cravings" }).click();
  await expect(page.getByTestId("craving").filter({ hasText: pick })).toBeVisible();
  await expect(card.getByRole("link", { name: /devour it today/ })).toBeVisible();
});
