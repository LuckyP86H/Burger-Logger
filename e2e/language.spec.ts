import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./support";

test("switches to Chinese, keeps it on reload, and stays accessible", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "中文" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "🍔 汉堡记录" })).toBeVisible();
  await expect(page.getByRole("button", { name: "加入想吃清单", exact: true })).toBeVisible();

  await page.getByLabel("汉堡", { exact: true }).fill("测试汉堡");
  await page.getByRole("button", { name: "加入想吃清单", exact: true }).click();
  await expect(page.getByTestId("craving").filter({ hasText: "测试汉堡" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "🍔 汉堡记录" })).toBeVisible();

  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(scan.violations).toEqual([]);

  await page.getByRole("link", { name: "English" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "🍔 Burger Logger" })).toBeVisible();
});
