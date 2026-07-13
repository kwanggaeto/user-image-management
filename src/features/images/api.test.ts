import { describe, expect, test } from "vitest";
import type { CloudflareEnv } from "@/types/cloudflare";
import type {
  ImageRecord,
  ImageRepository,
  ImageStorage,
  ThumbnailGenerator,
  UsagePeriod,
  UsageRepository,
  UsageSummary,
} from "@/lib/images/types";
import { DuplicateImageUidError as DuplicateUidError } from "@/lib/images/types";
import {
  handleImageDelete,
  handleImageDownload,
  handleImageFile,
  handleImageList,
  handleImageThumbnail,
  handleImageUpload,
  handleLogin,
  handleUsageSummary,
} from "./api";

class FakeRepository implements ImageRepository {
  rows: ImageRecord[] = [];
  failNextInsertWithDuplicate = false;

  async insert(record: Omit<ImageRecord, "id">): Promise<ImageRecord> {
    if (this.failNextInsertWithDuplicate) {
      this.failNextInsertWithDuplicate = false;
      throw new DuplicateUidError();
    }

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

class FakeThumbnailGenerator implements ThumbnailGenerator {
  calls = 0;

  async generate(): Promise<Blob> {
    this.calls += 1;
    return new Response("thumb", {
      headers: { "Content-Type": "image/webp" },
    }).blob();
  }
}

class FakeUsageRepository implements UsageRepository {
  records: Array<{ category: ImageRecord["category"]; createdAt: string }> = [];
  summary: UsageSummary = {
    period: "day",
    total: 0,
    buckets: [],
  };

  async insert(record: { category: ImageRecord["category"]; createdAt: string }) {
    this.records.push(record);
  }

  async summarize(
    category: ImageRecord["category"],
    period: UsagePeriod,
  ): Promise<UsageSummary> {
    return {
      ...this.summary,
      period,
      total: this.records.filter((record) => record.category === category).length || this.summary.total,
    };
  }
}

const env = {
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

function multipartRequestWithoutFormData(
  url: string,
  filename: string,
  contentType: string,
  content: string,
): Request {
  const request = multipartRequest(url, filename, contentType, content);
  Object.defineProperty(request, "formData", {
    value: async () => {
      throw new Error("formData unavailable");
    },
  });
  return request;
}

function unquotedMultipartRequestWithoutFormData(
  url: string,
  filename: string,
  contentType: string,
  content: string,
): Request {
  const boundary = "----uim-test-boundary";
  const body = [
    `--${boundary}`,
    `Content-Type: ${contentType}`,
    `Content-Disposition: form-data; name=file; filename=${filename}; filename*=utf-8''${filename}`,
    "",
    content,
    `--${boundary}--`,
    "",
  ].join("\r\n");
  const request = new Request(url, {
    method: "POST",
    headers: {
      "x-upload-token": "upload-token",
      "content-type": `multipart/form-data; boundary="${boundary}"`,
    },
    body,
  });
  Object.defineProperty(request, "formData", {
    value: async () => {
      throw new Error("formData unavailable");
    },
  });
  return request;
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

  test("uploads image files with thumbnail generation and usage count", async () => {
    const repository = new FakeRepository();
    const storage = new FakeStorage();
    const usageRepository = new FakeUsageRepository();
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
      thumbnailGenerator: new FakeThumbnailGenerator(),
      usageRepository,
      createUid: () => "abc12345",
      now: () => new Date("2026-07-09T00:00:00.000Z"),
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as { viewUrl: string };
    expect(body.viewUrl).toBe(
      "https://app.test/library/abc12345",
    );
    expect(repository.rows[0]?.category).toBe("library");
    expect([...storage.objects.keys()]).toEqual([
      "images/library/abc12345/photo.jpg",
      "images/library/abc12345/thumbnail.webp",
    ]);
    expect(usageRepository.records).toEqual([
      { category: "library", createdAt: "2026-07-09T09:00:00.000+09:00" },
    ]);
  });

  test.each([
    ["track.mp3", "audio/mpeg", "audio/mpeg"],
    ["track.wav", "audio/wav", "audio/wav"],
    ["track.wav", "audio/x-wav", "audio/x-wav"],
  ] as const)(
    "uploads %s music without creating a thumbnail",
    async (filename, requestType, storedType) => {
      const repository = new FakeRepository();
      const storage = new FakeStorage();
      const usageRepository = new FakeUsageRepository();
      const thumbnailGenerator = new FakeThumbnailGenerator();

      const response = await handleImageUpload({
        request: multipartRequest(
          "https://app.test/api/music/images",
          filename,
          requestType,
          "audio",
        ),
        env,
        categoryValue: "music",
        repository,
        storage,
        thumbnailGenerator,
        usageRepository,
        createUid: () => "music001",
        now: () => new Date("2026-07-13T00:00:00.000Z"),
      });

      expect(response.status).toBe(201);
      expect(repository.rows[0]).toMatchObject({
        uid: "music001",
        category: "music",
        filename,
        key: `images/music/music001/${filename}`,
        thumbnailKey: null,
      });
      expect([...storage.objects.keys()]).toEqual([
        `images/music/music001/${filename}`,
      ]);
      expect(
        storage.objects.get(`images/music/music001/${filename}`)?.type,
      ).toBe(storedType);
      expect(thumbnailGenerator.calls).toBe(0);
      expect(usageRepository.records).toEqual([
        { category: "music", createdAt: "2026-07-13T09:00:00.000+09:00" },
      ]);
    },
  );

  test.each([
    ["track.mp3", "application/octet-stream", "audio/mpeg"],
    ["track.wav", "application/octet-stream", "audio/wav"],
    ["track.mp3", "", "audio/mpeg"],
    ["track.wav", "", "audio/wav"],
  ] as const)(
    "infers %s MIME from the extension when multipart uses %s",
    async (filename, requestType, expectedType) => {
      const repository = new FakeRepository();
      const storage = new FakeStorage();

      const response = await handleImageUpload({
        request: multipartRequest(
          "https://app.test/api/music/images",
          filename,
          requestType,
          "audio",
        ),
        env,
        categoryValue: "music",
        repository,
        storage,
        thumbnailGenerator: new FakeThumbnailGenerator(),
        usageRepository: new FakeUsageRepository(),
        createUid: () => "music002",
        now: () => new Date("2026-07-13T00:00:00.000Z"),
      });

      expect(response.status).toBe(201);
      expect(
        storage.objects.get(`images/music/music002/${filename}`)?.type,
      ).toBe(expectedType);
    },
  );

  test.each([
    ["cover.jpg", "image/jpeg"],
    ["track.ogg", "audio/ogg"],
    ["track.mp3", "audio/wav"],
    ["track.wav", "audio/mpeg"],
  ] as const)(
    "rejects unsupported music upload %s with %s",
    async (filename, contentType) => {
      const repository = new FakeRepository();
      const storage = new FakeStorage();
      const thumbnailGenerator = new FakeThumbnailGenerator();

      const response = await handleImageUpload({
        request: multipartRequest(
          "https://app.test/api/music/images",
          filename,
          contentType,
          "content",
        ),
        env,
        categoryValue: "music",
        repository,
        storage,
        thumbnailGenerator,
        usageRepository: new FakeUsageRepository(),
        createUid: () => "music003",
        now: () => new Date("2026-07-13T00:00:00.000Z"),
      });

      expect(response.status).toBe(415);
      await expect(response.json()).resolves.toEqual({
        error: "Only MP3 and WAV uploads are supported",
      });
      expect(repository.rows).toEqual([]);
      expect(storage.objects.size).toBe(0);
      expect(thumbnailGenerator.calls).toBe(0);
    },
  );

  test("uploads multipart image files when request formData is unavailable", async () => {
    const repository = new FakeRepository();
    const storage = new FakeStorage();
    const request = multipartRequestWithoutFormData(
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
      thumbnailGenerator: new FakeThumbnailGenerator(),
      usageRepository: new FakeUsageRepository(),
      createUid: () => "abc12345",
      now: () => new Date("2026-07-09T00:00:00.000Z"),
    });

    expect(response.status).toBe(201);
    expect(repository.rows[0]).toMatchObject({
      filename: "photo.jpg",
      key: "images/library/abc12345/photo.jpg",
    });
    const stored = storage.objects.get("images/library/abc12345/photo.jpg");
    expect(stored?.type).toBe("image/jpeg");
    expect(stored?.size).toBe(5);
  });

  test("uploads multipart image files with unquoted disposition parameters", async () => {
    const repository = new FakeRepository();
    const request = unquotedMultipartRequestWithoutFormData(
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
      storage: new FakeStorage(),
      thumbnailGenerator: new FakeThumbnailGenerator(),
      usageRepository: new FakeUsageRepository(),
      createUid: () => "abc12345",
      now: () => new Date("2026-07-09T00:00:00.000Z"),
    });

    expect(response.status).toBe(201);
    expect(repository.rows[0]?.filename).toBe("photo.jpg");
  });

  test("retries uid generation when the repository reports a duplicate uid", async () => {
    const repository = new FakeRepository();
    repository.failNextInsertWithDuplicate = true;
    const request = multipartRequest(
      "https://app.test/api/library/images",
      "photo.jpg",
      "image/jpeg",
      "image",
    );
    const storage = new FakeStorage();
    const uids = ["dupe0001", "fresh001"];

    const response = await handleImageUpload({
      request,
      env,
      categoryValue: "library",
      repository,
      storage,
      thumbnailGenerator: new FakeThumbnailGenerator(),
      usageRepository: new FakeUsageRepository(),
      createUid: () => uids.shift() ?? "unused00",
      now: () => new Date("2026-07-09T00:00:00.000Z"),
    });

    expect(response.status).toBe(201);
    expect(repository.rows[0]?.uid).toBe("fresh001");
    expect([...storage.objects.keys()]).toEqual([
      "images/library/fresh001/photo.jpg",
      "images/library/fresh001/thumbnail.webp",
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

  test("extends the session cookie when remember login is requested", async () => {
    const response = await handleLogin({
      request: new Request("https://app.test/api/library/auth/login", {
        method: "POST",
        body: JSON.stringify({
          id: "library-admin",
          password: "library-pass",
          remember: true,
        }),
      }),
      env,
      categoryValue: "library",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=2592000");
  });

  test("lists images when the session cookie is valid", async () => {
    const repository = new FakeRepository();
    await repository.insert({
      uid: "abc123",
      category: "library",
      filename: "photo.jpg",
      key: "images/library/abc123/photo.jpg",
      thumbnailKey: null,
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

  test("lists school images after login with the shared Daegu credential", async () => {
    const repository = new FakeRepository();
    await repository.insert({
      uid: "school01",
      category: "school",
      filename: "class.jpg",
      key: "images/school/school01/class.jpg",
      thumbnailKey: null,
      createAt: "2026-07-13T09:00:00.000+09:00",
      expireAt: "2026-07-20T09:00:00.000+09:00",
    });
    const login = await handleLogin({
      request: new Request("https://app.test/api/school/auth/login", {
        method: "POST",
        body: JSON.stringify({
          id: "daegu-admin",
          password: "daegu-pass",
        }),
      }),
      env,
      categoryValue: "school",
    });
    const response = await handleImageList({
      request: new Request("https://app.test/api/school/images", {
        headers: { cookie: login.headers.get("set-cookie") ?? "" },
      }),
      env,
      categoryValue: "school",
      repository,
    });
    const body = (await response.json()) as {
      items: Array<{ uid: string }>;
    };

    expect(login.status).toBe(200);
    expect(response.status).toBe(200);
    expect(body.items).toEqual([
      expect.objectContaining({ uid: "school01" }),
    ]);
  });
});

describe("image file utilities", () => {
  test("streams and downloads the original music file", async () => {
    const repository = new FakeRepository();
    const storage = new FakeStorage();
    await repository.insert({
      uid: "music004",
      category: "music",
      filename: "track.mp3",
      key: "images/music/music004/track.mp3",
      thumbnailKey: null,
      createAt: "2026-07-13T09:00:00.000+09:00",
      expireAt: "2026-07-20T09:00:00.000+09:00",
    });
    await storage.put(
      "images/music/music004/track.mp3",
      new Blob(["audio"], { type: "audio/mpeg" }),
    );

    const fileResponse = await handleImageFile({
      request: new Request("https://app.test/api/music/images/music004/file"),
      env,
      categoryValue: "music",
      uid: "music004",
      repository,
      storage,
    });
    const downloadResponse = await handleImageDownload({
      request: new Request(
        "https://app.test/api/music/images/music004/download",
      ),
      env,
      categoryValue: "music",
      uid: "music004",
      repository,
      storage,
    });

    expect(fileResponse.status).toBe(200);
    expect(fileResponse.headers.get("content-type")).toContain("audio/mpeg");
    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.headers.get("content-type")).toContain(
      "audio/mpeg",
    );
    expect(downloadResponse.headers.get("content-disposition")).toBe(
      'attachment; filename="track.mp3"',
    );
  });

  test("serves the thumbnail blob when available", async () => {
    const repository = new FakeRepository();
    const storage = new FakeStorage();
    await repository.insert({
      uid: "abc12345",
      category: "library",
      filename: "photo.jpg",
      key: "images/library/abc12345/photo.jpg",
      thumbnailKey: "images/library/abc12345/thumbnail.webp",
      createAt: "2026-07-09T09:00:00.000+09:00",
      expireAt: "2026-07-16T09:00:00.000+09:00",
    });
    await storage.put(
      "images/library/abc12345/thumbnail.webp",
      await new Response("thumb", {
        headers: { "Content-Type": "image/webp" },
      }).blob(),
    );

    const response = await handleImageThumbnail({
      request: new Request("https://app.test/api/library/images/abc12345/thumbnail"),
      env,
      categoryValue: "library",
      uid: "abc12345",
      repository,
      storage,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/webp");
    await expect(response.text()).resolves.toBe("thumb");
  });

  test("falls back to the original file when a legacy thumbnail is missing", async () => {
    const repository = new FakeRepository();
    const storage = new FakeStorage();
    await repository.insert({
      uid: "legacy01",
      category: "library",
      filename: "photo.jpg",
      key: "images/library/legacy01/photo.jpg",
      thumbnailKey: null,
      createAt: "2026-07-09T09:00:00.000+09:00",
      expireAt: "2026-07-16T09:00:00.000+09:00",
    });
    await storage.put(
      "images/library/legacy01/photo.jpg",
      await new Response("original", {
        headers: { "Content-Type": "image/jpeg" },
      }).blob(),
    );

    const response = await handleImageThumbnail({
      request: new Request("https://app.test/api/library/images/legacy01/thumbnail"),
      env,
      categoryValue: "library",
      uid: "legacy01",
      repository,
      storage,
    });

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("original");
  });

  test("downloads the original image as an attachment", async () => {
    const repository = new FakeRepository();
    const storage = new FakeStorage();
    await repository.insert({
      uid: "abc12345",
      category: "library",
      filename: "photo.jpg",
      key: "images/library/abc12345/photo.jpg",
      thumbnailKey: "images/library/abc12345/thumbnail.webp",
      createAt: "2026-07-09T09:00:00.000+09:00",
      expireAt: "2026-07-16T09:00:00.000+09:00",
    });
    await storage.put(
      "images/library/abc12345/photo.jpg",
      await new Response("image", {
        headers: { "Content-Type": "image/jpeg" },
      }).blob(),
    );

    const response = await handleImageDownload({
      request: new Request("https://app.test/api/library/images/abc12345/download"),
      env,
      categoryValue: "library",
      uid: "abc12345",
      repository,
      storage,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="photo.jpg"',
    );
    await expect(response.text()).resolves.toBe("image");
  });
});

describe("handleUsageSummary", () => {
  test("requires an admin session", async () => {
    const response = await handleUsageSummary({
      request: new Request("https://app.test/api/library/usage?period=day"),
      env,
      categoryValue: "library",
      usageRepository: new FakeUsageRepository(),
    });

    expect(response.status).toBe(401);
  });

  test("returns usage summary for the selected period with a valid admin session", async () => {
    const usageRepository = new FakeUsageRepository();
    usageRepository.summary = {
      period: "month",
      total: 3,
      buckets: [{ label: "2026-07", count: 3, cumulative: 3 }],
    };
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

    const response = await handleUsageSummary({
      request: new Request("https://app.test/api/library/usage?period=month", {
        headers: { cookie: login.headers.get("set-cookie") ?? "" },
      }),
      env,
      categoryValue: "library",
      usageRepository,
    });
    const body = (await response.json()) as UsageSummary;

    expect(response.status).toBe(200);
    expect(body.period).toBe("month");
    expect(body.buckets).toEqual([
      { label: "2026-07", count: 3, cumulative: 3 },
    ]);
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
