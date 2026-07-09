# Image Management Counts Thumbnails Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 8-character image UIDs, stored thumbnails, upload count reporting, and original-image downloads to the Cloudflare image management app.

**Architecture:** Keep the existing Next.js App Router and pure handler pattern. Add narrow domain interfaces for thumbnails and usage counts, persist only count events in D1, store original and thumbnail objects in R2, and expose thumbnail/download/usage APIs through the existing category-scoped route structure.

**Tech Stack:** Next.js 16, TypeScript, React, Cloudflare Workers, OpenNext Cloudflare adapter, Cloudflare D1, Cloudflare R2, Cloudflare Images binding, Wrangler, Vitest, React Testing Library.

---

## Source Documents

- Design spec: `docs/superpowers/specs/2026-07-10-image-management-counts-thumbnails-download-design.md`
- Cloudflare Images binding docs: https://developers.cloudflare.com/images/optimization/binding/
- Existing upload plan: `docs/superpowers/plans/2026-07-09-upload-image-management-server-tdd.md`

## File Structure

- Modify: `src/lib/uid.ts` and `src/lib/uid.test.ts` - 8-char UID generation and thumbnail key helper.
- Modify: `src/lib/images/types.ts` - add `thumbnailKey`, `ThumbnailGenerator`, `UsageRepository`, usage summary types, and duplicate UID error type.
- Create: `src/lib/images/cloudflare-thumbnail-generator.ts` and test - Cloudflare Images binding adapter.
- Modify: `src/lib/images/service.ts` and test - thumbnail storage, deletion, cleanup, usage recording, usage summaries, and UID retry support.
- Modify: `src/lib/images/d1-repository.ts` and test - `thumbnailKey` persistence, schema self-heal, and usage count repository.
- Create: `migrations/0002_add_thumbnails_and_usage_records.sql` - D1 migration for thumbnail keys and upload-count records.
- Modify: `src/features/images/api.ts` and test - inject thumbnail/usage dependencies, add thumbnail/download/usage handlers, retry UID generation.
- Create: `src/app/api/[category]/images/[uid]/thumbnail/route.ts` - thumbnail streaming route.
- Create: `src/app/api/[category]/images/[uid]/download/route.ts` - original attachment route.
- Create: `src/app/api/[category]/usage/route.ts` - admin-gated usage summary API.
- Modify: `src/app/api/[category]/images/route.ts` - use expanded upload handler dependencies through environment.
- Modify: `src/components/admin/image-list.tsx` and test - link to usage page and use thumbnail URL.
- Create: `src/components/admin/usage-report.tsx` and test - period selector, total count, count table.
- Create: `src/app/[category]/admin/usage/page.tsx` - admin-gated server page for usage records.
- Modify: `src/components/viewer/image-viewer.tsx` and test - add download button.
- Modify: `src/types/cloudflare.ts`, `src/lib/cloudflare.ts`, `wrangler.jsonc`, `cloudflare-env.d.ts` - add Cloudflare Images binding.
- Modify: `src/workers/cleanup.test.ts` if type changes require thumbnail-aware fake rows.

## Task 1: UID Length And Thumbnail Key

**Files:**

- Modify: `src/lib/uid.test.ts`
- Modify: `src/lib/uid.ts`

- [ ] **Step 1: Write the failing UID and thumbnail key tests**

Replace or extend `src/lib/uid.test.ts` with assertions for 8-character UIDs and thumbnail keys:

```ts
import { describe, expect, test } from "vitest";
import { buildImageKey, buildThumbnailKey, createUid, sanitizeFilename } from "./uid";

describe("sanitizeFilename", () => {
  test("keeps safe ascii filenames", () => {
    expect(sanitizeFilename("photo-01.jpg")).toBe("photo-01.jpg");
  });

  test("falls back for non ascii filenames", () => {
    expect(sanitizeFilename("한국 사진.png")).toBe(".png");
  });
});

describe("buildImageKey", () => {
  test("builds category scoped image keys", () => {
    expect(buildImageKey("library", "abc12345", "photo.jpg")).toBe(
      "images/library/abc12345/photo.jpg",
    );
  });
});

describe("buildThumbnailKey", () => {
  test("builds a fixed thumbnail key for a category uid", () => {
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
```

- [ ] **Step 2: Run the focused UID tests and verify failure**

Run:

```bash
npm test -- src/lib/uid.test.ts
```

Expected: FAIL because `buildThumbnailKey` is not exported and `createUid()` still returns 24 hex characters.

- [ ] **Step 3: Implement UID and thumbnail key helpers**

Update `src/lib/uid.ts`:

```ts
import type { Category } from "./categories";

export function sanitizeFilename(filename: string): string {
  const ascii = filename
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-\./g, ".")
    .replace(/^-+|-+$/g, "");

  return ascii.length > 0 ? ascii : "image";
}

export function buildImageKey(
  category: Category,
  uid: string,
  filename: string,
): string {
  return `images/${category}/${uid}/${sanitizeFilename(filename)}`;
}

export function buildThumbnailKey(category: Category, uid: string): string {
  return `images/${category}/${uid}/thumbnail.webp`;
}

export function createUid(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
```

- [ ] **Step 4: Run focused tests and commit**

Run:

```bash
npm test -- src/lib/uid.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/lib/uid.ts src/lib/uid.test.ts
git commit -m "feat: shorten image uids"
```

## Task 2: Domain Types For Thumbnails And Usage Counts

**Files:**

- Modify: `src/lib/images/types.ts`
- Modify tests that construct `ImageRecord` objects after this task when type errors appear.

- [ ] **Step 1: Add failing type-driven expectations in service tests**

In `src/lib/images/service.test.ts`, update fake inserted records in the existing tests to include `thumbnailKey` and add these fake interfaces at the top after imports:

```ts
import type {
  CleanupResult,
  ImageRecord,
  ImageRepository,
  ImageStorage,
  ThumbnailGenerator,
  UsageRepository,
} from "./types";
```

Expected before implementation: TypeScript fails because `ThumbnailGenerator` and `UsageRepository` do not exist.

- [ ] **Step 2: Run typecheck and verify failure**

Run:

```bash
npm run typecheck
```

Expected: FAIL with missing exported members from `src/lib/images/types.ts`.

- [ ] **Step 3: Add the domain types**

Update `src/lib/images/types.ts` to include the new fields and interfaces:

```ts
import type { Category } from "@/lib/categories";

export interface ImageRecord {
  id: number;
  uid: string;
  category: Category;
  filename: string;
  key: string;
  thumbnailKey: string | null;
  createAt: string;
  expireAt: string;
}

export interface ImageListResult {
  items: ImageRecord[];
  total: number;
}

export interface ImageRepository {
  insert(record: Omit<ImageRecord, "id">): Promise<ImageRecord>;
  list(category: Category, page: number, pageSize: number): Promise<ImageListResult>;
  findByUid(category: Category, uid: string): Promise<ImageRecord | null>;
  deleteByUid(category: Category, uid: string): Promise<boolean>;
  listExpiredBeforeToday(now: Date): Promise<ImageRecord[]>;
}

export interface ImageStorage {
  put(key: string, file: Blob): Promise<void>;
  get(key: string): Promise<Blob | null>;
  delete(key: string): Promise<void>;
}

export interface ThumbnailGenerator {
  generate(input: Blob): Promise<Blob>;
}

export type UsagePeriod = "day" | "month" | "year";

export interface UsageRecordInput {
  category: Category;
  createdAt: string;
}

export interface UsageSummaryBucket {
  label: string;
  count: number;
  cumulative: number;
}

export interface UsageSummary {
  period: UsagePeriod;
  total: number;
  buckets: UsageSummaryBucket[];
}

export interface UsageRepository {
  insert(record: UsageRecordInput): Promise<void>;
  summarize(category: Category, period: UsagePeriod): Promise<UsageSummary>;
}

export class DuplicateImageUidError extends Error {
  constructor() {
    super("Duplicate image uid");
    this.name = "DuplicateImageUidError";
  }
}

export interface ImageListItem extends ImageRecord {
  thumbnailUrl: string;
}

export interface PaginatedImages {
  items: ImageListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CleanupResult {
  scanned: number;
  deleted: number;
  failed: number;
}
```

- [ ] **Step 4: Run typecheck and commit**

Run:

```bash
npm run typecheck
```

Expected: FAIL only in tests and code that have not yet added `thumbnailKey`; fix those constructors by adding `thumbnailKey: null` or the expected thumbnail key.

Then run:

```bash
npm test -- src/lib/images/service.test.ts src/components/viewer/image-viewer.test.tsx src/components/admin/image-list.test.tsx src/features/images/api.test.ts
```

Expected: PASS after the constructor updates.

Commit:

```bash
git add src/lib/images/types.ts src/lib/images/service.test.ts src/components/viewer/image-viewer.test.tsx src/components/admin/image-list.test.tsx src/features/images/api.test.ts
git commit -m "feat: add thumbnail and usage domain types"
```

## Task 3: Thumbnail Adapter And Cloudflare Binding Config

**Files:**

- Create: `src/lib/images/cloudflare-thumbnail-generator.ts`
- Create: `src/lib/images/cloudflare-thumbnail-generator.test.ts`
- Modify: `src/types/cloudflare.ts`
- Modify: `src/lib/cloudflare.ts`
- Modify: `wrangler.jsonc`
- Modify: `cloudflare-env.d.ts`

- [ ] **Step 1: Write failing tests for the thumbnail adapter**

Create `src/lib/images/cloudflare-thumbnail-generator.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";
import { createCloudflareThumbnailGenerator } from "./cloudflare-thumbnail-generator";

describe("createCloudflareThumbnailGenerator", () => {
  test("uses the Images binding to create a 240px webp thumbnail", async () => {
    const source = new Blob(["source"], { type: "image/jpeg" });
    const output = new Blob(["thumb"], { type: "image/webp" });
    const response = new Response(output);
    const outputFn = vi.fn().mockReturnValue({ response: vi.fn().mockResolvedValue(response) });
    const transform = vi.fn().mockReturnValue({ output: outputFn });
    const input = vi.fn().mockReturnValue({ transform });
    const generator = createCloudflareThumbnailGenerator({
      input,
    } as unknown as ImagesBinding);

    const thumbnail = await generator.generate(source);

    expect(input).toHaveBeenCalledWith(source);
    expect(transform).toHaveBeenCalledWith({ width: 240, height: 240, fit: "cover" });
    expect(outputFn).toHaveBeenCalledWith({ format: "image/webp", quality: 82, anim: false });
    await expect(thumbnail.text()).resolves.toBe("thumb");
    expect(thumbnail.type).toBe("image/webp");
  });
});
```

- [ ] **Step 2: Run the focused adapter test and verify failure**

Run:

```bash
npm test -- src/lib/images/cloudflare-thumbnail-generator.test.ts
```

Expected: FAIL because `cloudflare-thumbnail-generator.ts` does not exist.

- [ ] **Step 3: Implement the adapter**

Create `src/lib/images/cloudflare-thumbnail-generator.ts`:

```ts
import type { ThumbnailGenerator } from "./types";

export function createCloudflareThumbnailGenerator(
  images: ImagesBinding,
): ThumbnailGenerator {
  return {
    async generate(input: Blob): Promise<Blob> {
      const response = await (
        await images
          .input(input)
          .transform({ width: 240, height: 240, fit: "cover" })
          .output({ format: "image/webp", quality: 82, anim: false })
      ).response();

      const blob = await response.blob();
      return new Blob([blob], { type: "image/webp" });
    },
  };
}
```

- [ ] **Step 4: Add the Images binding to app config and environment types**

Update `src/types/cloudflare.ts`:

```ts
export type AppEnv = "development" | "production";

export interface CloudflareEnv {
  DB: D1Database;
  IMAGES_BUCKET: R2Bucket;
  IMAGES: ImagesBinding;
  APP_ENV: AppEnv;
  IMAGE_EXPIRE_DAYS: string;
  SESSION_SECRET: string;
  UPLOAD_API_TOKEN: string;
  LIBRARY_ADMIN_ID: string;
  LIBRARY_ADMIN_PASSWORD: string;
  NAKDONG_ADMIN_ID: string;
  NAKDONG_ADMIN_PASSWORD: string;
}
```

Update fallback `src/lib/cloudflare.ts` by adding a throwing local binding:

```ts
function createUnavailableImagesBinding(): ImagesBinding {
  return {
    input() {
      throw new Error("Cloudflare Images binding is unavailable outside Wrangler.");
    },
  } as unknown as ImagesBinding;
}
```

and include `IMAGES: createUnavailableImagesBinding(),` in the fallback env object.

Update `wrangler.jsonc` by adding the official Images binding block:

```jsonc
  "images": {
    "binding": "IMAGES"
  },
```

Place it near the other binding declarations.

Run:

```bash
npm run cf-typegen
```

Expected: `cloudflare-env.d.ts` includes an `IMAGES` binding.

- [ ] **Step 5: Run focused tests and commit**

Run:

```bash
npm test -- src/lib/images/cloudflare-thumbnail-generator.test.ts
npm run typecheck
```

Expected: PASS.

Commit:

```bash
git add src/lib/images/cloudflare-thumbnail-generator.ts src/lib/images/cloudflare-thumbnail-generator.test.ts src/types/cloudflare.ts src/lib/cloudflare.ts wrangler.jsonc cloudflare-env.d.ts
git commit -m "feat: add cloudflare thumbnail generator"
```

## Task 4: Service Layer Thumbnail And Usage Behavior

**Files:**

- Modify: `src/lib/images/service.test.ts`
- Modify: `src/lib/images/service.ts`
- Modify: `src/workers/cleanup.test.ts`

- [ ] **Step 1: Write failing service tests**

In `src/lib/images/service.test.ts`, update `FakeRepository` records to include `thumbnailKey`. Add these fakes:

```ts
class FakeThumbnailGenerator implements ThumbnailGenerator {
  calls: Blob[] = [];

  async generate(file: Blob): Promise<Blob> {
    this.calls.push(file);
    return new Blob(["thumbnail"], { type: "image/webp" });
  }
}

class FakeUsageRepository implements UsageRepository {
  records: Array<{ category: Category; createdAt: string }> = [];

  async insert(record: { category: Category; createdAt: string }): Promise<void> {
    this.records.push(record);
  }

  async summarize() {
    return { period: "day", total: this.records.length, buckets: [] };
  }
}
```

Change the `createImage` test call to pass `thumbnailGenerator` and `usageRepository`, then assert:

```ts
expect(result.thumbnailKey).toBe("images/library/abc123/thumbnail.webp");
expect([...storage.objects.keys()]).toEqual([
  "images/library/abc123/photo.jpg",
  "images/library/abc123/thumbnail.webp",
]);
expect(await storage.objects.get("images/library/abc123/thumbnail.webp")?.text()).toBe("thumbnail");
expect(usageRepository.records).toEqual([
  { category: "library", createdAt: "2026-07-09T09:00:00.000+09:00" },
]);
```

Update `listImages` test expected thumbnail URL:

```ts
expect(result.items[0]?.thumbnailUrl).toBe(
  "/api/library/images/library-1/thumbnail",
);
```

Update `deleteImage` test record to include `thumbnailKey: "images/library/abc123/thumbnail.webp"` and expected deleted keys:

```ts
expect(storage.deleted).toEqual([
  "images/library/abc123/a.jpg",
  "images/library/abc123/thumbnail.webp",
]);
```

Add one test where `thumbnailKey: null` and assert only the original is deleted.

Update cleanup expected deleted keys to include both original and thumbnail for the expired image.

- [ ] **Step 2: Run focused service tests and verify failure**

Run:

```bash
npm test -- src/lib/images/service.test.ts
```

Expected: FAIL because `createImage` does not accept thumbnail/usage dependencies and deletes only the original key.

- [ ] **Step 3: Implement service behavior**

Update `src/lib/images/service.ts` imports:

```ts
import { buildImageKey, buildThumbnailKey, sanitizeFilename } from "@/lib/uid";
import type {
  CleanupResult,
  ImageRecord,
  ImageRepository,
  ImageStorage,
  PaginatedImages,
  ThumbnailGenerator,
  UsageRepository,
  UsageSummary,
  UsagePeriod,
} from "./types";
```

Update `createImage` input and body:

```ts
export async function createImage(input: {
  repository: ImageRepository;
  storage: ImageStorage;
  thumbnailGenerator: ThumbnailGenerator;
  usageRepository: UsageRepository;
  category: Category;
  uid: string;
  filename: string;
  file: Blob;
  now: Date;
  expireDays: number;
}): Promise<ImageRecord> {
  const filename = sanitizeFilename(input.filename);
  const key = buildImageKey(input.category, input.uid, filename);
  const thumbnailKey = buildThumbnailKey(input.category, input.uid);
  const timestamps = createImageTimestamps(input.now, input.expireDays);
  const thumbnail = await input.thumbnailGenerator.generate(input.file);

  await input.storage.put(key, input.file);
  await input.storage.put(thumbnailKey, thumbnail);

  const image = await input.repository.insert({
    uid: input.uid,
    category: input.category,
    filename,
    key,
    thumbnailKey,
    createAt: timestamps.createAt,
    expireAt: timestamps.expireAt,
  });

  await input.usageRepository.insert({
    category: input.category,
    createdAt: timestamps.createAt,
  });

  return image;
}
```

Update `listImages` mapping:

```ts
thumbnailUrl: `/api/${category}/images/${item.uid}/thumbnail`,
```

Update deletion helpers:

```ts
async function deleteStoredImage(storage: ImageStorage, image: ImageRecord): Promise<void> {
  await storage.delete(image.key);
  if (image.thumbnailKey) {
    await storage.delete(image.thumbnailKey);
  }
}
```

Use `deleteStoredImage()` in both `deleteImage` and `cleanupExpiredImages`.

Add usage summary function:

```ts
export async function summarizeUsage(
  repository: UsageRepository,
  category: Category,
  period: UsagePeriod,
): Promise<UsageSummary> {
  return repository.summarize(category, period);
}
```

- [ ] **Step 4: Run focused tests and commit**

Run:

```bash
npm test -- src/lib/images/service.test.ts src/workers/cleanup.test.ts
```

Expected: PASS after updating cleanup fake records with `thumbnailKey`.

Commit:

```bash
git add src/lib/images/service.ts src/lib/images/service.test.ts src/workers/cleanup.test.ts
git commit -m "feat: manage thumbnails with images"
```

## Task 5: D1 Schema, Image Repository, And Usage Repository

**Files:**

- Create: `migrations/0002_add_thumbnails_and_usage_records.sql`
- Modify: `src/lib/images/d1-repository.test.ts`
- Modify: `src/lib/images/d1-repository.ts`

- [ ] **Step 1: Add migration**

Create `migrations/0002_add_thumbnails_and_usage_records.sql`:

```sql
ALTER TABLE images ADD COLUMN thumbnailKey TEXT;

CREATE TABLE IF NOT EXISTS usage_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL CHECK (category IN ('library', 'nakdong')),
  createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS usage_records_category_createdAt_idx
  ON usage_records(category, createdAt);
```

- [ ] **Step 2: Write failing D1 tests**

In `src/lib/images/d1-repository.test.ts`, update the insert test to include `thumbnailKey` and assert bind order:

```ts
thumbnailKey: "images/library/abc123/thumbnail.webp",
```

Expected bind values:

```ts
expect(statement.bind).toHaveBeenCalledWith(
  "abc123",
  "library",
  "photo.jpg",
  "images/library/abc123/photo.jpg",
  "images/library/abc123/thumbnail.webp",
  "2026-07-09T09:00:00.000+09:00",
  "2026-07-16T09:00:00.000+09:00",
);
```

Update list and missing table tests to include `thumbnailKey` in selected rows.

Add duplicate UID test:

```ts
test("throws DuplicateImageUidError on category uid constraint failure", async () => {
  const statement = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockRejectedValue(new Error("D1_ERROR: UNIQUE constraint failed: images.category, images.uid")),
  };
  const db = { prepare: vi.fn().mockReturnValue(statement) } as unknown as D1Database;

  await expect(createD1ImageRepository(db).insert({
    uid: "abc12345",
    category: "library",
    filename: "photo.jpg",
    key: "images/library/abc12345/photo.jpg",
    thumbnailKey: "images/library/abc12345/thumbnail.webp",
    createAt: "2026-07-09T09:00:00.000+09:00",
    expireAt: "2026-07-16T09:00:00.000+09:00",
  })).rejects.toThrow("Duplicate image uid");
});
```

Add usage summary test:

```ts
test("summarizes usage records by day with cumulative totals", async () => {
  const insertStatement = createStatement({ meta: {} });
  const totalStatement = createStatement({ total: 3 });
  const bucketStatement = createStatement({
    results: [
      { bucket: "2026-07-09", count: 1 },
      { bucket: "2026-07-10", count: 2 },
    ],
  });
  const db = {
    prepare: vi
      .fn()
      .mockReturnValueOnce(insertStatement)
      .mockReturnValueOnce(totalStatement)
      .mockReturnValueOnce(bucketStatement),
  } as unknown as D1Database;
  const repository = createD1UsageRepository(db);

  await repository.insert({ category: "library", createdAt: "2026-07-10T09:00:00.000+09:00" });
  const summary = await repository.summarize("library", "day");

  expect(insertStatement.bind).toHaveBeenCalledWith("library", "2026-07-10T09:00:00.000+09:00");
  expect(summary).toEqual({
    period: "day",
    total: 3,
    buckets: [
      { label: "2026-07-09", count: 1, cumulative: 1 },
      { label: "2026-07-10", count: 2, cumulative: 3 },
    ],
  });
});
```

- [ ] **Step 3: Run D1 tests and verify failure**

Run:

```bash
npm test -- src/lib/images/d1-repository.test.ts
```

Expected: FAIL because repository SQL does not include `thumbnailKey`, `createD1UsageRepository` does not exist, and duplicate UID errors are not mapped.

- [ ] **Step 4: Implement D1 repository changes**

In `src/lib/images/d1-repository.ts`:

- Add `thumbnailKey TEXT` to `IMAGE_SCHEMA_STATEMENTS` create table.
- Add `ALTER TABLE images ADD COLUMN thumbnailKey TEXT` to schema healing, guarded so duplicate-column errors are ignored.
- Add `USAGE_SCHEMA_STATEMENTS` for `usage_records`.
- Extend `toImageRecord()` with `thumbnailKey: value.thumbnailKey ? String(value.thumbnailKey) : null`.
- Change image `INSERT` to include `thumbnailKey`.
- Change all image `SELECT` lists to include `thumbnailKey`.
- Map `UNIQUE constraint failed` on insert to `new DuplicateImageUidError()`.
- Export `createD1UsageRepository(db: D1Database): UsageRepository`.

Use this period expression helper:

```ts
function periodExpression(period: UsagePeriod): string {
  if (period === "day") return "substr(createdAt, 1, 10)";
  if (period === "month") return "substr(createdAt, 1, 7)";
  return "substr(createdAt, 1, 4)";
}
```

Use this cumulative mapper:

```ts
function toUsageSummary(
  period: UsagePeriod,
  total: number,
  rows: Array<{ bucket: string; count: number }>,
): UsageSummary {
  let cumulative = 0;
  return {
    period,
    total,
    buckets: rows.map((row) => {
      cumulative += Number(row.count);
      return {
        label: String(row.bucket),
        count: Number(row.count),
        cumulative,
      };
    }),
  };
}
```

The `summarize()` SQL shape:

```sql
SELECT ${periodExpression(period)} AS bucket, COUNT(*) AS count
FROM usage_records
WHERE category = ?
GROUP BY bucket
ORDER BY bucket ASC
```

- [ ] **Step 5: Run D1 tests and commit**

Run:

```bash
npm test -- src/lib/images/d1-repository.test.ts
```

Expected: PASS.

Commit:

```bash
git add migrations/0002_add_thumbnails_and_usage_records.sql src/lib/images/d1-repository.ts src/lib/images/d1-repository.test.ts
git commit -m "feat: persist thumbnails and usage counts"
```

## Task 6: API Handlers For Upload Retry, Thumbnail, Download, And Usage

**Files:**

- Modify: `src/features/images/api.test.ts`
- Modify: `src/features/images/api.ts`

- [ ] **Step 1: Write failing API tests**

Update `FakeRepository` rows to include `thumbnailKey`.

Add `FakeThumbnailGenerator` and `FakeUsageRepository` like the service tests.

Add tests:

```ts
test("uploads image with generated thumbnail and usage record", async () => {
  const repository = new FakeRepository();
  const storage = new FakeStorage();
  const usageRepository = new FakeUsageRepository();
  const request = multipartRequest("https://app.test/api/library/images", "photo.jpg", "image/jpeg", "image");

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
  expect([...storage.objects.keys()]).toEqual([
    "images/library/abc12345/photo.jpg",
    "images/library/abc12345/thumbnail.webp",
  ]);
  expect(usageRepository.records).toEqual([
    { category: "library", createdAt: "2026-07-09T09:00:00.000+09:00" },
  ]);
});
```

Add tests for `handleImageThumbnail`, `handleImageDownload`, and `handleUsageSummary`:

```ts
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
  await storage.put("images/library/abc12345/thumbnail.webp", new Blob(["thumb"], { type: "image/webp" }));

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
  await storage.put("images/library/abc12345/photo.jpg", new Blob(["image"], { type: "image/jpeg" }));

  const response = await handleImageDownload({
    request: new Request("https://app.test/api/library/images/abc12345/download"),
    env,
    categoryValue: "library",
    uid: "abc12345",
    repository,
    storage,
  });

  expect(response.status).toBe(200);
  expect(response.headers.get("content-disposition")).toBe('attachment; filename="photo.jpg"');
  await expect(response.text()).resolves.toBe("image");
});
```

For usage summary auth, reuse `handleLogin()` to get a cookie and assert `handleUsageSummary()` returns `{ period, total, buckets }`.

- [ ] **Step 2: Run API tests and verify failure**

Run:

```bash
npm test -- src/features/images/api.test.ts
```

Expected: FAIL because new handlers and injected dependencies are missing.

- [ ] **Step 3: Implement API changes**

Update `src/features/images/api.ts`:

- Import `createCloudflareThumbnailGenerator`, `createD1UsageRepository`, `DuplicateImageUidError`, `UsageRepository`, `ThumbnailGenerator`, and `UsagePeriod`.
- Extend `HandlerBase` with optional `usageRepository`, `thumbnailGenerator`.
- Add helpers:

```ts
function usageRepositoryFor(input: HandlerBase): UsageRepository {
  return input.usageRepository ?? createD1UsageRepository(input.env.DB);
}

function thumbnailGeneratorFor(input: HandlerBase): ThumbnailGenerator {
  return input.thumbnailGenerator ?? createCloudflareThumbnailGenerator(input.env.IMAGES);
}

function parseUsagePeriod(value: string | null): UsagePeriod {
  return value === "month" || value === "year" ? value : "day";
}
```

- Update `handleImageUpload()` to call `createImage()` with thumbnail and usage dependencies.
- Add retry loop around `createImage()`:

```ts
for (let attempt = 0; attempt < 5; attempt += 1) {
  try {
    const image = await createImage({ ... });
    return json({ image }, { status: 201 });
  } catch (error) {
    if (!(error instanceof DuplicateImageUidError) || attempt === 4) {
      throw error;
    }
  }
}
```

- Add `handleImageThumbnail()` that prefers `image.thumbnailKey`, falls back to `image.key`, and returns `Cache-Control: private, max-age=300`.
- Add `handleImageDownload()` that returns the original blob with attachment disposition.
- Add `handleUsageSummary()` that requires admin session and returns `summarizeUsage(usageRepositoryFor(input), category, parseUsagePeriod(...))`.

- [ ] **Step 4: Run API tests and commit**

Run:

```bash
npm test -- src/features/images/api.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/features/images/api.ts src/features/images/api.test.ts
git commit -m "feat: add image thumbnail download usage APIs"
```

## Task 7: Route Files

**Files:**

- Create: `src/app/api/[category]/images/[uid]/thumbnail/route.ts`
- Create: `src/app/api/[category]/images/[uid]/download/route.ts`
- Create: `src/app/api/[category]/usage/route.ts`

- [ ] **Step 1: Add route wrappers**

Create `src/app/api/[category]/images/[uid]/thumbnail/route.ts`:

```ts
import { handleImageThumbnail } from "@/features/images/api";
import { getCloudflareEnv } from "@/lib/cloudflare";

interface RouteContext {
  params:
    | Promise<{ category: string; uid: string }>
    | { category: string; uid: string };
}

export async function GET(request: Request, context: RouteContext) {
  const { category, uid } = await context.params;
  return handleImageThumbnail({
    request,
    env: getCloudflareEnv(),
    categoryValue: category,
    uid,
  });
}
```

Create `src/app/api/[category]/images/[uid]/download/route.ts` with `handleImageDownload`.

Create `src/app/api/[category]/usage/route.ts`:

```ts
import { handleUsageSummary } from "@/features/images/api";
import { getCloudflareEnv } from "@/lib/cloudflare";

interface RouteContext {
  params: Promise<{ category: string }> | { category: string };
}

export async function GET(request: Request, context: RouteContext) {
  const { category } = await context.params;
  return handleUsageSummary({
    request,
    env: getCloudflareEnv(),
    categoryValue: category,
  });
}
```

- [ ] **Step 2: Run typecheck and commit**

Run:

```bash
npm run typecheck
```

Expected: PASS.

Commit:

```bash
git add src/app/api/[category]/images/[uid]/thumbnail/route.ts src/app/api/[category]/images/[uid]/download/route.ts src/app/api/[category]/usage/route.ts
git commit -m "feat: add image utility routes"
```

## Task 8: Admin Usage UI

**Files:**

- Create: `src/components/admin/usage-report.tsx`
- Create: `src/components/admin/usage-report.test.tsx`
- Create: `src/app/[category]/admin/usage/page.tsx`
- Modify: `src/components/admin/image-list.tsx`
- Modify: `src/components/admin/image-list.test.tsx`

- [ ] **Step 1: Write failing usage report component tests**

Create `src/components/admin/usage-report.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { UsageReport } from "./usage-report";

describe("UsageReport", () => {
  test("renders total, period selector, and cumulative buckets", () => {
    render(
      <UsageReport
        category="library"
        initialSummary={{
          period: "day",
          total: 3,
          buckets: [
            { label: "2026-07-09", count: 1, cumulative: 1 },
            { label: "2026-07-10", count: 2, cumulative: 3 },
          ],
        }}
      />,
    );

    expect(screen.getByText("이용 기록")).toBeInTheDocument();
    expect(screen.getByText("전체 3회")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "집계 기간" })).toBeInTheDocument();
    expect(screen.getByText("2026-07-10")).toBeInTheDocument();
    expect(screen.getByText("2회")).toBeInTheDocument();
    expect(screen.getByText("3회")).toBeInTheDocument();
  });
});
```

Update `image-list.test.tsx` expected thumbnail URL to `/thumbnail` and assert usage link:

```ts
expect(screen.getByRole("link", { name: "이용 기록" })).toHaveAttribute(
  "href",
  "/library/admin/usage",
);
```

- [ ] **Step 2: Run component tests and verify failure**

Run:

```bash
npm test -- src/components/admin/usage-report.test.tsx src/components/admin/image-list.test.tsx
```

Expected: FAIL because `UsageReport` and usage link do not exist.

- [ ] **Step 3: Implement `UsageReport`**

Create `src/components/admin/usage-report.tsx`:

```tsx
"use client";

import { useState } from "react";
import { BarChart3Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Category } from "@/lib/categories";
import type { UsagePeriod, UsageSummary } from "@/lib/images/types";

interface UsageReportProps {
  category: Category;
  initialSummary: UsageSummary;
}

const PERIOD_LABELS: Record<UsagePeriod, string> = {
  day: "일별",
  month: "월별",
  year: "연도별",
};

export function UsageReport({ category, initialSummary }: UsageReportProps) {
  const [summary, setSummary] = useState(initialSummary);

  async function loadPeriod(period: UsagePeriod) {
    const response = await fetch(`/api/${category}/usage?period=${period}`);
    if (response.ok) {
      setSummary((await response.json()) as UsageSummary);
    }
  }

  return (
    <main className="min-h-dvh bg-background px-4 py-6 text-foreground md:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <header className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2">
            <Badge variant="secondary">{category}</Badge>
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold">이용 기록</h1>
              <p className="text-sm text-muted-foreground">전체 {summary.total}회</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`/${category}/admin`}>이미지 목록</a>
            </Button>
            <Select value={summary.period} onValueChange={(value) => loadPeriod(value as UsagePeriod)}>
              <SelectTrigger aria-label="집계 기간" className="w-[120px]">
                <BarChart3Icon data-icon="inline-start" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="day">일별</SelectItem>
                  <SelectItem value="month">월별</SelectItem>
                  <SelectItem value="year">연도별</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </header>

        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{PERIOD_LABELS[summary.period]}</TableHead>
                <TableHead>횟수</TableHead>
                <TableHead>누적</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.buckets.map((bucket) => (
                <TableRow key={bucket.label}>
                  <TableCell className="font-mono text-sm">{bucket.label}</TableCell>
                  <TableCell>{bucket.count}회</TableCell>
                  <TableCell>{bucket.cumulative}회</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Add usage page and image list link**

Create `src/app/[category]/admin/usage/page.tsx`:

```tsx
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { LoginForm } from "@/components/admin/login-form";
import { UsageReport } from "@/components/admin/usage-report";
import { SESSION_COOKIE_NAME, verifySession } from "@/lib/auth";
import { parseCategory } from "@/lib/categories";
import { getCloudflareEnv } from "@/lib/cloudflare";
import { createD1UsageRepository } from "@/lib/images/d1-repository";
import { summarizeUsage } from "@/lib/images/service";

export const dynamic = "force-dynamic";

interface UsagePageProps {
  params: Promise<{ category: string }>;
}

export default async function UsagePage({ params }: UsagePageProps) {
  const { category: categoryValue } = await params;
  let category;

  try {
    category = parseCategory(categoryValue);
  } catch {
    notFound();
  }

  const env = getCloudflareEnv();
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const authenticated = await verifySession(env, category, session);

  if (!authenticated) {
    return <LoginForm category={category} />;
  }

  const summary = await summarizeUsage(
    createD1UsageRepository(env.DB),
    category,
    "day",
  );

  return <UsageReport category={category} initialSummary={summary} />;
}
```

In `src/components/admin/image-list.tsx`, import `BarChart3Icon`, then add:

```tsx
<Button asChild variant="outline" size="sm">
  <a href={`/${category}/admin/usage`}>
    <BarChart3Icon data-icon="inline-start" />
    이용 기록
  </a>
</Button>
```

beside the page-size select.

- [ ] **Step 5: Run component tests and commit**

Run:

```bash
npm test -- src/components/admin/usage-report.test.tsx src/components/admin/image-list.test.tsx
```

Expected: PASS.

Commit:

```bash
git add src/components/admin/usage-report.tsx src/components/admin/usage-report.test.tsx src/app/[category]/admin/usage/page.tsx src/components/admin/image-list.tsx src/components/admin/image-list.test.tsx
git commit -m "feat: add usage records page"
```

## Task 9: Viewer Download Button

**Files:**

- Modify: `src/components/viewer/image-viewer.test.tsx`
- Modify: `src/components/viewer/image-viewer.tsx`

- [ ] **Step 1: Write failing viewer test**

Update `src/components/viewer/image-viewer.test.tsx` expected image object to include `thumbnailKey`. Add:

```ts
expect(screen.getByRole("link", { name: "원본 다운로드" })).toHaveAttribute(
  "href",
  "/api/library/images/abc12345/download",
);
```

Use UID `abc12345` in the test record.

- [ ] **Step 2: Run viewer test and verify failure**

Run:

```bash
npm test -- src/components/viewer/image-viewer.test.tsx
```

Expected: FAIL because the download link is missing.

- [ ] **Step 3: Add download button**

Update `src/components/viewer/image-viewer.tsx`:

```tsx
/* eslint-disable @next/next/no-img-element */

import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ImageRecord } from "@/lib/images/types";

interface ImageViewerProps {
  image: ImageRecord;
}

export function ImageViewer({ image }: ImageViewerProps) {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 py-6">
        <img
          src={`/api/${image.category}/images/${image.uid}/file`}
          alt={image.filename}
          className="max-h-[78dvh] w-full rounded-md object-contain"
        />
        <div className="flex flex-col gap-3 text-sm text-muted-foreground">
          <div className="flex flex-col gap-1">
            <span className="font-medium text-foreground">{image.uid}</span>
            <span>{image.createAt}</span>
          </div>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/${image.category}/images/${image.uid}/download`}>
              <DownloadIcon data-icon="inline-start" />
              원본 다운로드
            </a>
          </Button>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run viewer test and commit**

Run:

```bash
npm test -- src/components/viewer/image-viewer.test.tsx
```

Expected: PASS.

Commit:

```bash
git add src/components/viewer/image-viewer.tsx src/components/viewer/image-viewer.test.tsx
git commit -m "feat: add original image download button"
```

## Task 10: Full Verification And Deploy Readiness

**Files:**

- Modify only files needed to resolve verification failures.

- [ ] **Step 1: Run unit and component tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run Cloudflare build**

Run:

```bash
npm run cf:build
```

Expected: PASS and `.open-next/worker.js` is generated.

- [ ] **Step 5: Run Wrangler dry-run if authenticated**

Run:

```bash
npx wrangler deploy --dry-run --keep-vars
```

Expected: PASS if Wrangler is authenticated. If authentication is expired, record the auth failure and do not change code for it.

- [ ] **Step 6: Confirm final git status**

Run:

```bash
git status --short
```

Expected: no uncommitted implementation changes remain except the existing unrelated `.vscode/`. If a verification command fails, stop this task, inspect the failing output, make the smallest targeted fix in the files named by the failure, rerun the failing command, rerun the full verification sequence, and commit those exact fixed files with a message that describes the verified fix.

## Self-Review

- Spec coverage: UID length is Task 1; thumbnails are Tasks 3-7; usage count table and report are Tasks 5, 6, and 8; download button is Tasks 6, 7, and 9; verification is Task 10.
- Placeholder scan: no unresolved placeholder instructions or unspecified test steps remain.
- Type consistency: `thumbnailKey`, `ThumbnailGenerator`, `UsageRepository`, `UsagePeriod`, `UsageSummary`, `createD1UsageRepository`, `handleImageThumbnail`, `handleImageDownload`, and `handleUsageSummary` use the same names across tasks.
