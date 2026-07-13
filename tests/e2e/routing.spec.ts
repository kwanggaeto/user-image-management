import { expect, test } from "@playwright/test";

test("GET /mbti/[type] returns the decoded type parameter unchanged", async ({
  request,
}) => {
  const response = await request.get("/mbti/INTJ%20custom");

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ type: "INTJ custom" });
});

test("GET / returns 404 without redirecting", async ({ request }) => {
  const response = await request.get("/", { maxRedirects: 0 });

  expect(response.status()).toBe(404);
  expect(response.headers().location).toBeUndefined();
});
