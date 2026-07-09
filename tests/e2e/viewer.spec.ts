import { expect, test } from "@playwright/test";

test("missing public image shows not found", async ({ page }) => {
  await page.goto("/library/missing");
  await expect(page.getByText(/not found|찾을 수 없습니다/i)).toBeVisible();
});
