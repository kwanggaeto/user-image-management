import { describe, expect, test } from "vitest";
import { buildImageKey, buildThumbnailKey, createUid, sanitizeFilename } from "./uid";

describe("sanitizeFilename", () => {
  test("keeps safe filename characters", () => {
    expect(sanitizeFilename("my-photo_01.jpg")).toBe("my-photo_01.jpg");
  });

  test("replaces unsafe filename characters", () => {
    expect(sanitizeFilename("한글 photo (1).jpg")).toBe("photo-1.jpg");
  });

  test("uses fallback for empty sanitized names", () => {
    expect(sanitizeFilename("한글")).toBe("image");
  });
});

describe("buildImageKey", () => {
  test("includes category uid and sanitized filename", () => {
    expect(buildImageKey("library", "abc123", "한글 photo.jpg")).toBe(
      "images/library/abc123/photo.jpg",
    );
    expect(buildImageKey("mbti", "intj01", "portrait.png")).toBe(
      "images/mbti/intj01/portrait.png",
    );
  });
});

describe("buildThumbnailKey", () => {
  test("builds a stable webp thumbnail key for the category uid", () => {
    expect(buildThumbnailKey("nakdong", "abcd1234")).toBe(
      "images/nakdong/abcd1234/thumbnail.webp",
    );
  });
});

describe("createUid", () => {
  test("returns an 8 character lowercase hex uid", () => {
    expect(createUid()).toMatch(/^[0-9a-f]{8}$/);
  });
});
