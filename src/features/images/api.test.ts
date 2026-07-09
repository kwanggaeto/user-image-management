import { describe, expect, test } from "vitest";
import type { CloudflareEnv } from "@/types/cloudflare";
import type {
  ImageRecord,
  ImageRepository,
  ImageStorage,
} from "@/lib/images/types";
import {
  handleImageDelete,
  handleImageList,
  handleImageUpload,
  handleLogin,
} from "./api";

class FakeRepository implements ImageRepository {
  rows: ImageRecord[] = [];

  async insert(record: Omit<ImageRecord, "id">): Promise<ImageRecord> {
    const row = { ...record, id: this.rows.length + 1 };
    this.rows.push(row);
    return row;
  }

  async list(category: ImageRecord["category"], page: number, pageSize: number) {
    const items = this.rows.filter((row) => row.category === category);
    return {
      items: items.slice((page - 1) * pageSize, page * pageSize),
      total: items.length,
    };
  }

  async findByUid(category: ImageRecord["category"], uid: string) {
    return this.rows.find((row) => row.category === category && row.uid === uid) ?? null;
  }

  async deleteByUid(category: ImageRecord["category"], uid: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => row.category !== category || row.uid !== uid);
    return this.rows.length !== before;
  }

  async listExpiredBeforeToday() {
    return [];
  }
}

class FakeStorage implements ImageStorage {
  objects = new Map<string, Blob>();

  async put(key: string, file: Blob): Promise<void> {
    this.objects.set(key, file);
  }

  async get(key: string): Promise<Blob | null> {
    return this.objects.get(key) ?? null;
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }
}

const env = {
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
} satisfies CloudflareEnv;

function multipartRequest(
  url: string,
  filename: string,
  contentType: string,
  content: string,
): Request {
  const boundary = "----uim-test-boundary";
  const body = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    `Content-Type: ${contentType}`,
    "",
    content,
    `--${boundary}--`,
    "",
  ].join("\r\n");

  return new Request(url, {
    method: "POST",
    headers: {
      "x-upload-token": "upload-token",
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });
}

describe("handleImageUpload", () => {
  test("rejects upload without token", async () => {
    const request = new Request("https://app.test/api/library/images", {
      method: "POST",
      body: new FormData(),
    });

    const response = await handleImageUpload({
      request,
      env,
      categoryValue: "library",
      createUid: () => "abc123",
      now: () => new Date("2026-07-09T00:00:00.000Z"),
    });

    expect(response.status).toBe(401);
  });

  test("rejects non image upload", async () => {
    const request = multipartRequest(
      "https://app.test/api/library/images",
      "note.txt",
      "text/plain",
      "text",
    );

    const response = await handleImageUpload({
      request,
      env,
      categoryValue: "library",
      repository: new FakeRepository(),
      storage: new FakeStorage(),
      createUid: () => "abc123",
      now: () => new Date("2026-07-09T00:00:00.000Z"),
    });

    expect(response.status).toBe(415);
  });

  test("uploads image files through API token only", async () => {
    const repository = new FakeRepository();
    const storage = new FakeStorage();
    const request = multipartRequest(
      "https://app.test/api/library/images",
      "photo.jpg",
      "image/jpeg",
      "image",
    );

    const response = await handleImageUpload({
      request,
      env,
      categoryValue: "library",
      repository,
      storage,
      createUid: () => "abc123",
      now: () => new Date("2026-07-09T00:00:00.000Z"),
    });

    expect(response.status).toBe(201);
    expect(repository.rows[0]?.category).toBe("library");
    expect([...storage.objects.keys()]).toEqual([
      "images/library/abc123/photo.jpg",
    ]);
  });
});

describe("handleLogin and session-gated list", () => {
  test("creates category scoped session cookie for valid credentials", async () => {
    const response = await handleLogin({
      request: new Request("https://app.test/api/library/auth/login", {
        method: "POST",
        body: JSON.stringify({
          id: "library-admin",
          password: "library-pass",
        }),
      }),
      env,
      categoryValue: "library",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("uim_admin_session=");
  });

  test("lists images when the session cookie is valid", async () => {
    const repository = new FakeRepository();
    await repository.insert({
      uid: "abc123",
      category: "library",
      filename: "photo.jpg",
      key: "images/library/abc123/photo.jpg",
      createAt: "2026-07-09T09:00:00.000+09:00",
      expireAt: "2026-07-16T09:00:00.000+09:00",
    });
    const login = await handleLogin({
      request: new Request("https://app.test/api/library/auth/login", {
        method: "POST",
        body: JSON.stringify({
          id: "library-admin",
          password: "library-pass",
        }),
      }),
      env,
      categoryValue: "library",
    });
    const request = new Request(
      "https://app.test/api/library/images?page=1&pageSize=20",
      {
        headers: {
          cookie: login.headers.get("set-cookie") ?? "",
        },
      },
    );

    const response = await handleImageList({
      request,
      env,
      categoryValue: "library",
      repository,
    });
    const body = (await response.json()) as {
      pageSize: number;
      items: Array<{ uid: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.pageSize).toBe(20);
    expect(body.items[0].uid).toBe("abc123");
  });
});

describe("handleImageDelete", () => {
  test("returns 401 without admin session", async () => {
    const response = await handleImageDelete({
      request: new Request("https://app.test/api/library/images/missing", {
        method: "DELETE",
      }),
      env,
      categoryValue: "library",
      uid: "missing",
      repository: new FakeRepository(),
      storage: new FakeStorage(),
    });

    expect(response.status).toBe(401);
  });
});
