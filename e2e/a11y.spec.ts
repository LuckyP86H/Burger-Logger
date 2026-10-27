import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./support";

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test("empty and filled journals have no WCAG A/AA violations", async ({ page }) => {
      const scan = async () =>
        new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze();

      await page.goto("/");
      expect((await scan()).violations).toEqual([]);

      for (const name of ["Accessible burger", "Eaten burger"]) {
        await page.getByLabel("Burger", { exact: true }).fill(name);
        await page.getByRole("button", { name: "Add to cravings" }).click();
        // Wait for the page swap to land before typing again, or it would replace the form.
        await expect(page.getByTestId("craving").filter({ hasText: name })).toBeVisible();
      }

      const eaten = page.getByTestId("craving").filter({ hasText: "Eaten burger" });
      await eaten.getByText("Devour it!").click();
      await eaten.getByRole("radio", { name: "4 out of 5" }).check();
      await eaten.getByLabel(/^Note/).fill("Nice");
      await eaten.getByRole("button", { name: "Log it" }).click();

      await page.getByTestId("craving").first().getByText("Devour it!").click();
      await page.getByText("Connect an AI agent").click();
      expect((await scan()).violations).toEqual([]);
    });
  });
}

test("fits a 320px screen without sideways scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
