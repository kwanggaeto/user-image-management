import { describe, expect, test, vi } from "vitest";
import { createR2ImageStorage } from "./r2-storage";

describe("createR2ImageStorage", () => {
  test("puts gets and deletes blobs using the R2 bucket", async () => {
    const bucket = {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue({
        blob: vi
          .fn()
          .mockResolvedValue(new Blob(["image"], { type: "image/jpeg" })),
      }),
      delete: vi.fn().mockResolvedValue(undefined),
    } as unknown as R2Bucket;
    const storage = createR2ImageStorage(bucket);
    const file = new Blob(["image"], { type: "image/jpeg" });

    await storage.put("key.jpg", file);
    const loaded = await storage.get("key.jpg");
    await storage.delete("key.jpg");

    expect(bucket.put).toHaveBeenCalledWith("key.jpg", file);
    expect(loaded).toBeInstanceOf(Blob);
    expect(bucket.delete).toHaveBeenCalledWith("key.jpg");
  });

  test("returns null when the object is missing", async () => {
    const bucket = {
      put: vi.fn(),
      get: vi.fn().mockResolvedValue(null),
      delete: vi.fn(),
    } as unknown as R2Bucket;

    await expect(createR2ImageStorage(bucket).get("missing")).resolves.toBeNull();
  });
});
