import { expect, test } from "@playwright/test";

test("admin login gate appears before image list", async ({ page }) => {
  await page.goto("/library/admin");
  await expect(page.getByLabel("아이디", { exact: true })).toBeVisible();
  await expect(page.getByLabel("비밀번호")).toBeVisible();
  await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
});
