import { expect, test } from "@playwright/test";

test("GET /mbti/[type] returns the decoded type parameter unchanged", async ({
  request,
}) => {
  const response = await request.get("/mbti/INTJ%20custom");

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ type: "INTJ custom" });
});
