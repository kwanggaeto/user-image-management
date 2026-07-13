import { describe, expect, test, vi } from "vitest";
import type { CloudflareEnv } from "@/types/cloudflare";
import worker from "./cleanup";

describe("cleanup worker", () => {
  test("exports a scheduled handler", async () => {
    const controller = {
      cron: "0 16 * * *",
      scheduledTime: Date.parse("2026-07-09T16:00:00.000Z"),
      type: "scheduled",
      noRetry: vi.fn(),
    } as unknown as ScheduledController;
    const statement = {
      all: vi.fn().mockResolvedValue({ results: [] }),
    };
    const env = {
      DB: {
        prepare: vi.fn().mockReturnValue(statement),
      } as unknown as D1Database,
      IMAGES_BUCKET: {} as R2Bucket,
      IMAGES: {} as ImagesBinding,
      APP_ENV: "production",
      IMAGE_EXPIRE_DAYS: "7",
      SESSION_SECRET: "secret",
      UPLOAD_API_TOKEN: "token",
      LIBRARY_ADMIN_ID: "id",
      LIBRARY_ADMIN_PASSWORD: "password",
      NAKDONG_ADMIN_ID: "id",
      NAKDONG_ADMIN_PASSWORD: "password",
      DAEGU_ADMIN_ID: "daegu-admin",
      DAEGU_ADMIN_PASSWORD: "daegu-pass",
    } satisfies CloudflareEnv;
    await expect(worker.scheduled?.(controller, env)).resolves.toBeUndefined();
  });
});
