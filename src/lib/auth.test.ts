import { describe, expect, test } from "vitest";
import type { CloudflareEnv } from "@/types/cloudflare";
import {
  adminScopeForCategory,
  createSessionCookie,
  getAdminCredential,
  signSession,
  verifyCategorySession,
  verifySession,
} from "./auth";

const env: CloudflareEnv = {
  DB: {} as D1Database,
  IMAGES_BUCKET: {} as R2Bucket,
  IMAGES: {} as ImagesBinding,
  APP_ENV: "development",
  IMAGE_EXPIRE_DAYS: "7",
  SESSION_SECRET: "0123456789abcdef0123456789abcdef",
  UPLOAD_API_TOKEN: "upload-token",
  LIBRARY_ADMIN_ID: "library-admin",
  LIBRARY_ADMIN_PASSWORD: "library-pass",
  NAKDONG_ADMIN_ID: "nakdong-admin",
  NAKDONG_ADMIN_PASSWORD: "nakdong-pass",
  DAEGU_ADMIN_ID: "daegu-admin",
  DAEGU_ADMIN_PASSWORD: "daegu-pass",
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
    expect(getAdminCredential(env, "daegu")).toEqual({
      id: "daegu-admin",
      password: "daegu-pass",
    });
  });

  test("maps the three Daegu categories to one admin scope", () => {
    expect(adminScopeForCategory("library")).toBe("library");
    expect(adminScopeForCategory("nakdong")).toBe("nakdong");
    expect(adminScopeForCategory("school")).toBe("daegu");
    expect(adminScopeForCategory("music")).toBe("daegu");
    expect(adminScopeForCategory("mbti")).toBe("daegu");
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

  test("allows one Daegu session across school music and MBTI only", async () => {
    const cookie = await signSession(env, "daegu");

    await expect(verifyCategorySession(env, "school", cookie)).resolves.toBe(
      true,
    );
    await expect(verifyCategorySession(env, "music", cookie)).resolves.toBe(
      true,
    );
    await expect(verifyCategorySession(env, "mbti", cookie)).resolves.toBe(
      true,
    );
    await expect(verifyCategorySession(env, "library", cookie)).resolves.toBe(
      false,
    );
    await expect(verifyCategorySession(env, "nakdong", cookie)).resolves.toBe(
      false,
    );
  });

  test("rejects tampered session values", async () => {
    const cookie = await signSession(env, "library");
    await expect(verifySession(env, "library", `${cookie}x`)).resolves.toBe(
      false,
    );
  });

  test("creates a one day session cookie by default", () => {
    expect(createSessionCookie("session", "development")).toContain(
      "Max-Age=86400",
    );
  });

  test("creates a thirty day session cookie when remember login is enabled", () => {
    expect(createSessionCookie("session", "development", true)).toContain(
      "Max-Age=2592000",
    );
  });
});
