import { describe, expect, test } from "vitest";
import type { CloudflareEnv } from "@/types/cloudflare";
import { getAdminCredential, signSession, verifySession } from "./auth";

const env: CloudflareEnv = {
  DB: {} as D1Database,
  IMAGES_BUCKET: {} as R2Bucket,
  APP_ENV: "development",
  IMAGE_EXPIRE_DAYS: "7",
  SESSION_SECRET: "0123456789abcdef0123456789abcdef",
  UPLOAD_API_TOKEN: "upload-token",
  LIBRARY_ADMIN_ID: "library-admin",
  LIBRARY_ADMIN_PASSWORD: "library-pass",
  NAKDONG_ADMIN_ID: "nakdong-admin",
  NAKDONG_ADMIN_PASSWORD: "nakdong-pass",
};

describe("getAdminCredential", () => {
  test("returns credentials for the requested category", () => {
    expect(getAdminCredential(env, "library")).toEqual({
      id: "library-admin",
      password: "library-pass",
    });
    expect(getAdminCredential(env, "nakdong")).toEqual({
      id: "nakdong-admin",
      password: "nakdong-pass",
    });
  });
});

describe("sessions", () => {
  test("verifies a signed session for the same category", async () => {
    const cookie = await signSession(env, "library");
    await expect(verifySession(env, "library", cookie)).resolves.toBe(true);
  });

  test("rejects a signed session for a different category", async () => {
    const cookie = await signSession(env, "library");
    await expect(verifySession(env, "nakdong", cookie)).resolves.toBe(false);
  });

  test("rejects tampered session values", async () => {
    const cookie = await signSession(env, "library");
    await expect(verifySession(env, "library", `${cookie}x`)).resolves.toBe(
      false,
    );
  });
});
