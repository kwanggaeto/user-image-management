import { expect, test } from "@playwright/test";

test("GET /mbti/[uid] uses the image viewer route instead of JSON echo", async ({
  request,
}) => {
  const response = await request.get("/mbti/missing-image");

  expect(response.status()).toBe(404);
  expect(response.headers()["content-type"]).toContain("text/html");
  expect(await response.text()).toContain("이미지를 찾을 수 없습니다.");
});

test("GET / returns 404 without redirecting", async ({ request }) => {
  const response = await request.get("/", { maxRedirects: 0 });

  expect(response.status()).toBe(404);
  expect(response.headers().location).toBeUndefined();
});
