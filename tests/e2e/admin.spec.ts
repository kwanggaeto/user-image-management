import { expect, test } from "@playwright/test";

test("admin login gate appears before image list", async ({ page }) => {
  await page.goto("/library/admin");
  await expect(page.getByLabel("아이디", { exact: true })).toBeVisible();
  await expect(page.getByLabel("비밀번호")).toBeVisible();
  await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
});

test("Daegu admin logs in once selects a category and switches lists", async ({
  page,
}) => {
  await page.goto("/music/admin");
  await expect(page).toHaveURL(/\/daegu\/admin$/);

  await page.getByLabel("아이디", { exact: true }).fill("daegu-admin");
  await page.getByLabel("비밀번호").fill("daegu-pass");
  await page.getByRole("button", { name: "로그인" }).click();

  await expect(
    page.getByRole("link", { name: "나만의 학교 만들기" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "MBTI" }).click();
  await expect(page).toHaveURL(/\/mbti\/admin$/);
  await expect(
    page.getByRole("navigation", { name: "대구 관리자 섹션" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "나만의 음악 만들기" }).click();
  await expect(page).toHaveURL(/\/music\/admin$/);
});
