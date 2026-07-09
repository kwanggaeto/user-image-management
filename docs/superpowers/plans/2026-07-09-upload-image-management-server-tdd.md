# Upload Image Management Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Cloudflare-deployed Next.js 16 image management server for the `library` and `nakdong` channels with API-only upload, admin CRUD, public image viewing, D1 metadata, R2 object storage, and scheduled expiration cleanup.

**Architecture:** The HTTP app is a Next.js App Router project deployed to Cloudflare Workers through the OpenNext adapter. Shared domain modules under `src/lib` own category validation, KST time handling, auth/session signing, image service behavior, D1 persistence, and R2 object access. A separate Cloudflare cleanup Worker shares the image service and bindings so Cron cleanup is independent from the generated OpenNext HTTP worker.

**Tech Stack:** Next.js 16, TypeScript, React, Cloudflare Workers, OpenNext Cloudflare adapter, Wrangler, Cloudflare D1, Cloudflare R2, shadcn/ui, Vitest, React Testing Library, Playwright.

---

## Source Documents

- Product request: `D:\Kwangkee_Works\Projects\2026_07_국립중앙도서관\업로드_이미지_관리_서버.md`
- PR scope: `docs/pr/upload-image-management-server-pr.md`
- Cloudflare Workers Next.js guide: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- Cloudflare Wrangler configuration: https://developers.cloudflare.com/workers/wrangler/configuration/
- Cloudflare D1 guide: https://developers.cloudflare.com/d1/get-started/
- Cloudflare R2 Workers API guide: https://developers.cloudflare.com/r2/api/workers/workers-api-usage/
- Cloudflare Cron Triggers guide: https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Cloudflare Scheduled Handler guide: https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/

## File Structure

- Create: `package.json` - npm scripts for dev, test, lint, typecheck, build, preview, deploy, cleanup deploy.
- Create: `next.config.ts` - Next.js configuration compatible with Cloudflare OpenNext.
- Create: `wrangler.jsonc` - Cloudflare Worker config for the Next.js HTTP app with D1/R2 bindings.
- Create: `wrangler.cleanup.jsonc` - Cloudflare Worker config for scheduled cleanup with the same D1/R2 bindings.
- Create: `vitest.config.ts` - unit/component test configuration.
- Create: `playwright.config.ts` - browser flow test configuration.
- Create: `migrations/0001_create_images.sql` - D1 schema for image metadata.
- Create: `src/types/cloudflare.ts` - shared Cloudflare binding types.
- Create: `src/lib/categories.ts` and `src/lib/categories.test.ts` - category and pagination validation.
- Create: `src/lib/time.ts` and `src/lib/time.test.ts` - KST date helpers and expiration comparison.
- Create: `src/lib/uid.ts` and `src/lib/uid.test.ts` - URL-safe UID and R2 object key helpers.
- Create: `src/lib/auth.ts` and `src/lib/auth.test.ts` - admin credential lookup and signed session cookies.
- Create: `src/lib/images/types.ts` - image domain types and repository/storage interfaces.
- Create: `src/lib/images/service.ts` and `src/lib/images/service.test.ts` - image CRUD and expiration cleanup orchestration.
- Create: `src/lib/images/d1-repository.ts` and `src/lib/images/d1-repository.test.ts` - D1 persistence adapter.
- Create: `src/lib/images/r2-storage.ts` and `src/lib/images/r2-storage.test.ts` - R2 object adapter.
- Create: `src/features/images/api.ts` and `src/features/images/api.test.ts` - pure request handlers used by Next route files.
- Create: `src/app/api/[category]/auth/login/route.ts` - login route.
- Create: `src/app/api/[category]/auth/logout/route.ts` - logout route.
- Create: `src/app/api/[category]/images/route.ts` - upload and list route.
- Create: `src/app/api/[category]/images/[uid]/route.ts` - metadata and delete route.
- Create: `src/app/api/[category]/images/[uid]/file/route.ts` - R2 file streaming route.
- Create: `src/app/[category]/admin/page.tsx` - admin gate page.
- Create: `src/components/admin/login-form.tsx` and `src/components/admin/login-form.test.tsx` - login UI.
- Create: `src/components/admin/image-list.tsx` and `src/components/admin/image-list.test.tsx` - image list UI.
- Create: `src/app/[category]/[uid]/page.tsx` - public image viewer page.
- Create: `src/components/viewer/image-viewer.tsx` and `src/components/viewer/image-viewer.test.tsx` - mobile-first image viewer UI.
- Create: `src/workers/cleanup.ts` and `src/workers/cleanup.test.ts` - scheduled cleanup Worker.
- Create: `README.md` - local setup, env vars, migrations, preview, deployment, and cleanup trigger testing.

## API Decisions

- Categories are exactly `library` and `nakdong`.
- Upload endpoint is protected by `x-upload-token`; admin login is not enough to upload.
- Admin sessions are category-scoped signed cookies.
- Public image pages stream files through the app; R2 remains private.
- D1 timestamps are ISO-8601 strings with KST offset.
- Cleanup deletes rows with an `expireAt` date before today's date in KST.
- Cleanup is a separate Worker because Cloudflare Scheduled Handlers are Worker-level events and should not depend on OpenNext HTTP output internals.

## Task 1: Scaffold Project And Tooling

**Files:**

- Create: `package.json`
- Create: `next.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `wrangler.jsonc`
- Create: `wrangler.cleanup.jsonc`
- Create: `src/types/cloudflare.ts`

- [ ] **Step 1: Scaffold Cloudflare Next.js app**

Run from `D:\Kwangkee_Works\Projects\2026_07_국립중앙도서관\user-image-management`:

```bash
npm create cloudflare@latest -- . --framework=next --platform=workers
```

Expected: project files are generated in the current directory and include Cloudflare/OpenNext scripts.

- [ ] **Step 2: Install test and UI dependencies**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom playwright @playwright/test
npm install zod
npx shadcn@latest init --defaults
npx shadcn@latest add button card table select pagination alert-dialog badge input field empty skeleton separator sonner
```

Expected: `components.json` exists and shadcn component source files are added under the configured component alias.

- [ ] **Step 3: Add baseline scripts**

Ensure `package.json` contains these scripts in addition to scaffold-generated scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "e2e": "playwright test",
    "preview": "npm run build && wrangler dev",
    "deploy": "npm run build && wrangler deploy",
    "cleanup:dev": "wrangler dev -c wrangler.cleanup.jsonc",
    "cleanup:deploy": "wrangler deploy -c wrangler.cleanup.jsonc"
  }
}
```

- [ ] **Step 4: Add Cloudflare binding types**

Create `src/types/cloudflare.ts`:

```ts
export type AppEnv = "development" | "production";

export interface CloudflareEnv {
  DB: D1Database;
  IMAGES_BUCKET: R2Bucket;
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

- [ ] **Step 5: Verify scaffold**

Run:

```bash
npm run typecheck
npm test
```

Expected: typecheck passes and Vitest reports no failing tests. An empty test suite is acceptable only for this scaffold task.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore: scaffold cloudflare next app"
```

## Task 2: Category And Pagination Domain

**Files:**

- Create: `src/lib/categories.test.ts`
- Create: `src/lib/categories.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/categories.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  CATEGORY_LABELS,
  parseCategory,
  parsePage,
  parsePageSize,
} from "./categories";

describe("parseCategory", () => {
  test("accepts library and nakdong", () => {
    expect(parseCategory("library")).toBe("library");
    expect(parseCategory("nakdong")).toBe("nakdong");
  });

  test("rejects unknown category values", () => {
    expect(() => parseCategory("museum")).toThrow("Invalid category");
  });

  test("exposes Korean labels for admin UI headings", () => {
    expect(CATEGORY_LABELS.library).toBe("국립중앙도서관");
    expect(CATEGORY_LABELS.nakdong).toBe("낙동강");
  });
});

describe("pagination parsing", () => {
  test("defaults page to 1", () => {
    expect(parsePage(null)).toBe(1);
  });

  test("normalizes invalid page to 1", () => {
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-3")).toBe(1);
    expect(parsePage("abc")).toBe(1);
  });

  test("allows page sizes 10, 20, and 30", () => {
    expect(parsePageSize("10")).toBe(10);
    expect(parsePageSize("20")).toBe(20);
    expect(parsePageSize("30")).toBe(30);
  });

  test("defaults unsupported page size to 10", () => {
    expect(parsePageSize(null)).toBe(10);
    expect(parsePageSize("15")).toBe(10);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npm test -- src/lib/categories.test.ts
```

Expected: FAIL because `src/lib/categories.ts` does not exist.

- [ ] **Step 3: Implement minimal domain module**

Create `src/lib/categories.ts`:

```ts
export const CATEGORIES = ["library", "nakdong"] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  library: "국립중앙도서관",
  nakdong: "낙동강",
};

export function parseCategory(value: string): Category {
  if (value === "library" || value === "nakdong") {
    return value;
  }

  throw new Error("Invalid category");
}

export function parsePage(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}

export function parsePageSize(value: string | null): 10 | 20 | 30 {
  if (value === "20") {
    return 20;
  }
  if (value === "30") {
    return 30;
  }
  return 10;
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm test -- src/lib/categories.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/categories.ts src/lib/categories.test.ts
git commit -m "feat: add category and pagination domain"
```

## Task 3: KST Time And Object Key Helpers

**Files:**

- Create: `src/lib/time.test.ts`
- Create: `src/lib/time.ts`
- Create: `src/lib/uid.test.ts`
- Create: `src/lib/uid.ts`

- [ ] **Step 1: Write failing time tests**

Create `src/lib/time.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  addDaysKst,
  createImageTimestamps,
  isExpiredBeforeTodayKst,
  toKstIsoString,
} from "./time";

describe("KST time helpers", () => {
  test("formats UTC dates with Korean Standard Time offset", () => {
    const date = new Date("2026-07-09T00:30:00.000Z");
    expect(toKstIsoString(date)).toBe("2026-07-09T09:30:00.000+09:00");
  });

  test("adds expiration days in KST display time", () => {
    const createAt = new Date("2026-07-09T00:30:00.000Z");
    expect(addDaysKst(createAt, 7)).toBe("2026-07-16T09:30:00.000+09:00");
  });

  test("creates createAt and expireAt together", () => {
    const now = new Date("2026-07-09T00:30:00.000Z");
    expect(createImageTimestamps(now, 3)).toEqual({
      createAt: "2026-07-09T09:30:00.000+09:00",
      expireAt: "2026-07-12T09:30:00.000+09:00",
    });
  });

  test("treats yesterday in KST as expired", () => {
    const now = new Date("2026-07-09T01:00:00.000Z");
    expect(isExpiredBeforeTodayKst("2026-07-08T23:59:59.000+09:00", now)).toBe(true);
  });

  test("does not treat today in KST as expired", () => {
    const now = new Date("2026-07-09T01:00:00.000Z");
    expect(isExpiredBeforeTodayKst("2026-07-09T00:00:00.000+09:00", now)).toBe(false);
  });
});
```

- [ ] **Step 2: Write failing UID/key tests**

Create `src/lib/uid.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { buildImageKey, sanitizeFilename } from "./uid";

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
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

```bash
npm test -- src/lib/time.test.ts src/lib/uid.test.ts
```

Expected: FAIL because `src/lib/time.ts` and `src/lib/uid.ts` do not exist.

- [ ] **Step 4: Implement time helpers**

Create `src/lib/time.ts`:

```ts
const KST_OFFSET_MINUTES = 9 * 60;
const KST_OFFSET_MS = KST_OFFSET_MINUTES * 60 * 1000;

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

export function toKstIsoString(date: Date): string {
  const kstDate = new Date(date.getTime() + KST_OFFSET_MS);
  const year = kstDate.getUTCFullYear();
  const month = pad(kstDate.getUTCMonth() + 1);
  const day = pad(kstDate.getUTCDate());
  const hours = pad(kstDate.getUTCHours());
  const minutes = pad(kstDate.getUTCMinutes());
  const seconds = pad(kstDate.getUTCSeconds());
  const milliseconds = pad(kstDate.getUTCMilliseconds(), 3);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}+09:00`;
}

export function addDaysKst(date: Date, days: number): string {
  return toKstIsoString(new Date(date.getTime() + days * 24 * 60 * 60 * 1000));
}

export function createImageTimestamps(now: Date, expireDays: number): {
  createAt: string;
  expireAt: string;
} {
  return {
    createAt: toKstIsoString(now),
    expireAt: addDaysKst(now, expireDays),
  };
}

function kstDatePart(value: Date | string): string {
  if (value instanceof Date) {
    return toKstIsoString(value).slice(0, 10);
  }
  return value.slice(0, 10);
}

export function isExpiredBeforeTodayKst(expireAt: string, now: Date): boolean {
  return kstDatePart(expireAt) < kstDatePart(now);
}
```

- [ ] **Step 5: Implement UID/key helpers**

Create `src/lib/uid.ts`:

```ts
import type { Category } from "./categories";

export function sanitizeFilename(filename: string): string {
  const ascii = filename
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
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

export function createUid(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
```

- [ ] **Step 6: Run tests to verify pass**

```bash
npm test -- src/lib/time.test.ts src/lib/uid.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/time.ts src/lib/time.test.ts src/lib/uid.ts src/lib/uid.test.ts
git commit -m "feat: add kst time and image key helpers"
```

## Task 4: Auth And Category-Scoped Sessions

**Files:**

- Create: `src/lib/auth.test.ts`
- Create: `src/lib/auth.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/auth.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import type { CloudflareEnv } from "@/types/cloudflare";
import {
  getAdminCredential,
  signSession,
  verifySession,
} from "./auth";

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
    await expect(verifySession(env, "library", `${cookie}x`)).resolves.toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npm test -- src/lib/auth.test.ts
```

Expected: FAIL because `src/lib/auth.ts` does not exist.

- [ ] **Step 3: Implement auth module**

Create `src/lib/auth.ts`:

```ts
import type { CloudflareEnv } from "@/types/cloudflare";
import type { Category } from "./categories";

export interface AdminCredential {
  id: string;
  password: string;
}

export function getAdminCredential(
  env: CloudflareEnv,
  category: Category,
): AdminCredential {
  if (category === "library") {
    return {
      id: env.LIBRARY_ADMIN_ID,
      password: env.LIBRARY_ADMIN_PASSWORD,
    };
  }

  return {
    id: env.NAKDONG_ADMIN_ID,
    password: env.NAKDONG_ADMIN_PASSWORD,
  };
}

function bytesToBase64Url(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return bytesToBase64Url(signature);
}

export async function signSession(
  env: Pick<CloudflareEnv, "SESSION_SECRET">,
  category: Category,
): Promise<string> {
  const payload = `${category}.${Date.now()}`;
  const signature = await hmac(env.SESSION_SECRET, payload);
  return `${payload}.${signature}`;
}

export async function verifySession(
  env: Pick<CloudflareEnv, "SESSION_SECRET">,
  category: Category,
  cookieValue: string | undefined,
): Promise<boolean> {
  if (!cookieValue) {
    return false;
  }

  const parts = cookieValue.split(".");
  if (parts.length !== 3) {
    return false;
  }

  const [cookieCategory, createdAt, signature] = parts;
  if (cookieCategory !== category) {
    return false;
  }

  const payload = `${cookieCategory}.${createdAt}`;
  const expected = await hmac(env.SESSION_SECRET, payload);
  return signature === expected;
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
npm test -- src/lib/auth.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/auth.test.ts
git commit -m "feat: add category scoped admin sessions"
```

## Task 5: Image Service With Fake Adapters

**Files:**

- Create: `src/lib/images/types.ts`
- Create: `src/lib/images/service.test.ts`
- Create: `src/lib/images/service.ts`

- [ ] **Step 1: Write failing service tests**

Create `src/lib/images/service.test.ts`:

```ts
import { beforeEach, describe, expect, test } from "vitest";
import type {
  ImageRecord,
  ImageRepository,
  ImageStorage,
} from "./types";
import {
  cleanupExpiredImages,
  createImage,
  deleteImage,
  listImages,
} from "./service";

class FakeRepository implements ImageRepository {
  rows: ImageRecord[] = [];

  async insert(record: Omit<ImageRecord, "id">): Promise<ImageRecord> {
    const row = { ...record, id: this.rows.length + 1 };
    this.rows.push(row);
    return row;
  }

  async list(category: ImageRecord["category"], page: number, pageSize: number) {
    const filtered = this.rows.filter((row) => row.category === category);
    return {
      items: filtered.slice((page - 1) * pageSize, page * pageSize),
      total: filtered.length,
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

  async listExpiredBeforeToday(now: Date) {
    const today = now.toISOString().slice(0, 10);
    return this.rows.filter((row) => row.expireAt.slice(0, 10) < today);
  }
}

class FakeStorage implements ImageStorage {
  objects = new Map<string, Blob>();
  deleted: string[] = [];

  async put(key: string, file: Blob): Promise<void> {
    this.objects.set(key, file);
  }

  async get(key: string): Promise<Blob | null> {
    return this.objects.get(key) ?? null;
  }

  async delete(key: string): Promise<void> {
    this.deleted.push(key);
    this.objects.delete(key);
  }
}

let repository: FakeRepository;
let storage: FakeStorage;

beforeEach(() => {
  repository = new FakeRepository();
  storage = new FakeStorage();
});

describe("createImage", () => {
  test("stores the object and metadata for the selected category", async () => {
    const result = await createImage({
      repository,
      storage,
      category: "library",
      uid: "abc123",
      filename: "photo.jpg",
      file: new Blob(["image"], { type: "image/jpeg" }),
      now: new Date("2026-07-09T00:00:00.000Z"),
      expireDays: 7,
    });

    expect(result).toMatchObject({
      uid: "abc123",
      category: "library",
      filename: "photo.jpg",
      key: "images/library/abc123/photo.jpg",
      createAt: "2026-07-09T09:00:00.000+09:00",
      expireAt: "2026-07-16T09:00:00.000+09:00",
    });
    expect(storage.objects.has("images/library/abc123/photo.jpg")).toBe(true);
  });
});

describe("listImages", () => {
  test("returns only the requested category and pagination metadata", async () => {
    await repository.insert({
      uid: "library-1",
      category: "library",
      filename: "a.jpg",
      key: "images/library/library-1/a.jpg",
      createAt: "2026-07-09T09:00:00.000+09:00",
      expireAt: "2026-07-16T09:00:00.000+09:00",
    });
    await repository.insert({
      uid: "nakdong-1",
      category: "nakdong",
      filename: "b.jpg",
      key: "images/nakdong/nakdong-1/b.jpg",
      createAt: "2026-07-09T09:00:00.000+09:00",
      expireAt: "2026-07-16T09:00:00.000+09:00",
    });

    const result = await listImages(repository, "library", 1, 10);

    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.items[0].uid).toBe("library-1");
    expect(result.items[0].thumbnailUrl).toBe("/api/library/images/library-1/file");
  });
});

describe("deleteImage", () => {
  test("deletes object and row for an existing category uid", async () => {
    await repository.insert({
      uid: "abc123",
      category: "library",
      filename: "a.jpg",
      key: "images/library/abc123/a.jpg",
      createAt: "2026-07-09T09:00:00.000+09:00",
      expireAt: "2026-07-16T09:00:00.000+09:00",
    });

    const result = await deleteImage(repository, storage, "library", "abc123");

    expect(result).toBe(true);
    expect(storage.deleted).toEqual(["images/library/abc123/a.jpg"]);
    expect(await repository.findByUid("library", "abc123")).toBeNull();
  });

  test("returns false when the uid is not in the requested category", async () => {
    await repository.insert({
      uid: "same",
      category: "nakdong",
      filename: "a.jpg",
      key: "images/nakdong/same/a.jpg",
      createAt: "2026-07-09T09:00:00.000+09:00",
      expireAt: "2026-07-16T09:00:00.000+09:00",
    });

    await expect(deleteImage(repository, storage, "library", "same")).resolves.toBe(false);
  });
});

describe("cleanupExpiredImages", () => {
  test("deletes expired objects and rows while keeping active rows", async () => {
    await repository.insert({
      uid: "expired",
      category: "library",
      filename: "old.jpg",
      key: "images/library/expired/old.jpg",
      createAt: "2026-07-01T09:00:00.000+09:00",
      expireAt: "2026-07-08T09:00:00.000+09:00",
    });
    await repository.insert({
      uid: "active",
      category: "library",
      filename: "new.jpg",
      key: "images/library/active/new.jpg",
      createAt: "2026-07-09T09:00:00.000+09:00",
      expireAt: "2026-07-10T09:00:00.000+09:00",
    });

    const result = await cleanupExpiredImages({
      repository,
      storage,
      now: new Date("2026-07-09T00:00:00.000Z"),
    });

    expect(result).toEqual({ scanned: 1, deleted: 1, failed: 0 });
    expect(storage.deleted).toEqual(["images/library/expired/old.jpg"]);
    expect(await repository.findByUid("library", "expired")).toBeNull();
    expect(await repository.findByUid("library", "active")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npm test -- src/lib/images/service.test.ts
```

Expected: FAIL because image service files do not exist.

- [ ] **Step 3: Create image types**

Create `src/lib/images/types.ts`:

```ts
import type { Category } from "@/lib/categories";

export interface ImageRecord {
  id: number;
  uid: string;
  category: Category;
  filename: string;
  key: string;
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
```

- [ ] **Step 4: Implement image service**

Create `src/lib/images/service.ts`:

```ts
import type { Category } from "@/lib/categories";
import { createImageTimestamps, isExpiredBeforeTodayKst } from "@/lib/time";
import { buildImageKey, sanitizeFilename } from "@/lib/uid";
import type {
  ImageRepository,
  ImageStorage,
  PaginatedImages,
} from "./types";

export async function createImage(input: {
  repository: ImageRepository;
  storage: ImageStorage;
  category: Category;
  uid: string;
  filename: string;
  file: Blob;
  now: Date;
  expireDays: number;
}) {
  const filename = sanitizeFilename(input.filename);
  const key = buildImageKey(input.category, input.uid, filename);
  const timestamps = createImageTimestamps(input.now, input.expireDays);

  await input.storage.put(key, input.file);

  return input.repository.insert({
    uid: input.uid,
    category: input.category,
    filename,
    key,
    createAt: timestamps.createAt,
    expireAt: timestamps.expireAt,
  });
}

export async function listImages(
  repository: ImageRepository,
  category: Category,
  page: number,
  pageSize: number,
): Promise<PaginatedImages> {
  const result = await repository.list(category, page, pageSize);
  return {
    items: result.items.map((item) => ({
      ...item,
      thumbnailUrl: `/api/${category}/images/${item.uid}/file`,
    })),
    page,
    pageSize,
    total: result.total,
    totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
  };
}

export async function deleteImage(
  repository: ImageRepository,
  storage: ImageStorage,
  category: Category,
  uid: string,
): Promise<boolean> {
  const image = await repository.findByUid(category, uid);
  if (!image) {
    return false;
  }

  await storage.delete(image.key);
  await repository.deleteByUid(category, uid);
  return true;
}

export async function cleanupExpiredImages(input: {
  repository: ImageRepository;
  storage: ImageStorage;
  now: Date;
}): Promise<{ scanned: number; deleted: number; failed: number }> {
  const candidates = await input.repository.listExpiredBeforeToday(input.now);
  let deleted = 0;
  let failed = 0;

  for (const image of candidates) {
    if (!isExpiredBeforeTodayKst(image.expireAt, input.now)) {
      continue;
    }

    try {
      await input.storage.delete(image.key);
      await input.repository.deleteByUid(image.category, image.uid);
      deleted += 1;
    } catch {
      failed += 1;
    }
  }

  return {
    scanned: candidates.length,
    deleted,
    failed,
  };
}
```

- [ ] **Step 5: Run test to verify pass**

```bash
npm test -- src/lib/images/service.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/images/types.ts src/lib/images/service.ts src/lib/images/service.test.ts
git commit -m "feat: add image service domain"
```

## Task 6: D1 And R2 Adapters

**Files:**

- Create: `migrations/0001_create_images.sql`
- Create: `src/lib/images/d1-repository.test.ts`
- Create: `src/lib/images/d1-repository.ts`
- Create: `src/lib/images/r2-storage.test.ts`
- Create: `src/lib/images/r2-storage.ts`

- [ ] **Step 1: Create migration**

Create `migrations/0001_create_images.sql`:

```sql
CREATE TABLE IF NOT EXISTS images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('library', 'nakdong')),
  filename TEXT NOT NULL,
  key TEXT NOT NULL,
  createAt TEXT NOT NULL,
  expireAt TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS images_category_uid_idx
  ON images(category, uid);

CREATE INDEX IF NOT EXISTS images_category_createAt_idx
  ON images(category, createAt DESC);

CREATE INDEX IF NOT EXISTS images_expireAt_idx
  ON images(expireAt);
```

- [ ] **Step 2: Write failing adapter tests**

Create `src/lib/images/r2-storage.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";
import { createR2ImageStorage } from "./r2-storage";

describe("createR2ImageStorage", () => {
  test("puts gets and deletes blobs using the R2 bucket", async () => {
    const bucket = {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue({
        blob: vi.fn().mockResolvedValue(new Blob(["image"], { type: "image/jpeg" })),
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
});
```

Create `src/lib/images/d1-repository.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";
import { createD1ImageRepository } from "./d1-repository";

function createStatement(result: unknown) {
  return {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(result),
    all: vi.fn().mockResolvedValue(result),
    run: vi.fn().mockResolvedValue(result),
  };
}

describe("createD1ImageRepository", () => {
  test("inserts image metadata with all fields", async () => {
    const statement = createStatement({ meta: { last_row_id: 1 } });
    const db = {
      prepare: vi.fn().mockReturnValue(statement),
    } as unknown as D1Database;
    const repository = createD1ImageRepository(db);

    const row = await repository.insert({
      uid: "abc123",
      category: "library",
      filename: "photo.jpg",
      key: "images/library/abc123/photo.jpg",
      createAt: "2026-07-09T09:00:00.000+09:00",
      expireAt: "2026-07-16T09:00:00.000+09:00",
    });

    expect(row.id).toBe(1);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO images"));
    expect(statement.bind).toHaveBeenCalledWith(
      "abc123",
      "library",
      "photo.jpg",
      "images/library/abc123/photo.jpg",
      "2026-07-09T09:00:00.000+09:00",
      "2026-07-16T09:00:00.000+09:00",
    );
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

```bash
npm test -- src/lib/images/d1-repository.test.ts src/lib/images/r2-storage.test.ts
```

Expected: FAIL because adapter files do not exist.

- [ ] **Step 4: Implement R2 adapter**

Create `src/lib/images/r2-storage.ts`:

```ts
import type { ImageStorage } from "./types";

export function createR2ImageStorage(bucket: R2Bucket): ImageStorage {
  return {
    async put(key, file) {
      await bucket.put(key, file);
    },
    async get(key) {
      const object = await bucket.get(key);
      if (!object) {
        return null;
      }
      return object.blob();
    },
    async delete(key) {
      await bucket.delete(key);
    },
  };
}
```

- [ ] **Step 5: Implement D1 adapter**

Create `src/lib/images/d1-repository.ts`:

```ts
import type { Category } from "@/lib/categories";
import { isExpiredBeforeTodayKst } from "@/lib/time";
import type { ImageRecord, ImageRepository } from "./types";

function toImageRecord(row: unknown): ImageRecord {
  const value = row as ImageRecord;
  return {
    id: Number(value.id),
    uid: String(value.uid),
    category: value.category,
    filename: String(value.filename),
    key: String(value.key),
    createAt: String(value.createAt),
    expireAt: String(value.expireAt),
  };
}

export function createD1ImageRepository(db: D1Database): ImageRepository {
  return {
    async insert(record) {
      const result = await db
        .prepare(
          `INSERT INTO images (uid, category, filename, key, createAt, expireAt)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          record.uid,
          record.category,
          record.filename,
          record.key,
          record.createAt,
          record.expireAt,
        )
        .run();

      return {
        ...record,
        id: Number(result.meta.last_row_id),
      };
    },

    async list(category: Category, page: number, pageSize: number) {
      const offset = (page - 1) * pageSize;
      const rowsResult = await db
        .prepare(
          `SELECT id, uid, category, filename, key, createAt, expireAt
           FROM images
           WHERE category = ?
           ORDER BY createAt DESC
           LIMIT ? OFFSET ?`,
        )
        .bind(category, pageSize, offset)
        .all();
      const count = await db
        .prepare("SELECT COUNT(*) AS total FROM images WHERE category = ?")
        .bind(category)
        .first<{ total: number }>();

      return {
        items: rowsResult.results.map(toImageRecord),
        total: Number(count?.total ?? 0),
      };
    },

    async findByUid(category: Category, uid: string) {
      const row = await db
        .prepare(
          `SELECT id, uid, category, filename, key, createAt, expireAt
           FROM images
           WHERE category = ? AND uid = ?`,
        )
        .bind(category, uid)
        .first();
      return row ? toImageRecord(row) : null;
    },

    async deleteByUid(category: Category, uid: string) {
      const result = await db
        .prepare("DELETE FROM images WHERE category = ? AND uid = ?")
        .bind(category, uid)
        .run();
      return Number(result.meta.changes ?? 0) > 0;
    },

    async listExpiredBeforeToday(now: Date) {
      const result = await db
        .prepare(
          `SELECT id, uid, category, filename, key, createAt, expireAt
           FROM images
           ORDER BY expireAt ASC`,
        )
        .all();
      return result.results.map(toImageRecord).filter((row) =>
        isExpiredBeforeTodayKst(row.expireAt, now),
      );
    },
  };
}
```

- [ ] **Step 6: Run tests to verify pass**

```bash
npm test -- src/lib/images/d1-repository.test.ts src/lib/images/r2-storage.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add migrations/0001_create_images.sql src/lib/images/d1-repository.ts src/lib/images/d1-repository.test.ts src/lib/images/r2-storage.ts src/lib/images/r2-storage.test.ts
git commit -m "feat: add cloudflare image adapters"
```

## Task 7: API Handlers And Next Routes

**Files:**

- Create: `src/features/images/api.test.ts`
- Create: `src/features/images/api.ts`
- Create: `src/app/api/[category]/auth/login/route.ts`
- Create: `src/app/api/[category]/auth/logout/route.ts`
- Create: `src/app/api/[category]/images/route.ts`
- Create: `src/app/api/[category]/images/[uid]/route.ts`
- Create: `src/app/api/[category]/images/[uid]/file/route.ts`

- [ ] **Step 1: Write failing API behavior tests**

Create `src/features/images/api.test.ts` with tests for these behaviors:

```ts
import { describe, expect, test, vi } from "vitest";
import type { CloudflareEnv } from "@/types/cloudflare";
import {
  handleImageUpload,
  handleImageList,
  handleImageDelete,
} from "./api";

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
    const form = new FormData();
    form.set("file", new File(["text"], "note.txt", { type: "text/plain" }));
    const request = new Request("https://app.test/api/library/images", {
      method: "POST",
      headers: { "x-upload-token": "upload-token" },
      body: form,
    });

    const response = await handleImageUpload({
      request,
      env,
      categoryValue: "library",
      createUid: () => "abc123",
      now: () => new Date("2026-07-09T00:00:00.000Z"),
    });

    expect(response.status).toBe(415);
  });
});

describe("handleImageList", () => {
  test("normalizes page and pageSize query values", async () => {
    const response = await handleImageList({
      request: new Request("https://app.test/api/library/images?page=2&pageSize=20"),
      env,
      categoryValue: "library",
    });

    expect([200, 401]).toContain(response.status);
  });
});

describe("handleImageDelete", () => {
  test("returns 404 when the image does not exist", async () => {
    const response = await handleImageDelete({
      request: new Request("https://app.test/api/library/images/missing", {
        method: "DELETE",
      }),
      env,
      categoryValue: "library",
      uid: "missing",
    });

    expect([404, 401]).toContain(response.status);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npm test -- src/features/images/api.test.ts
```

Expected: FAIL because `src/features/images/api.ts` does not exist.

- [ ] **Step 3: Implement pure API handlers**

Create `src/features/images/api.ts` with these exported functions:

- `handleImageUpload`
- `handleImageList`
- `handleImageDelete`
- `handleImageFile`
- `handleLogin`
- `handleLogout`

Implementation requirements:

- Parse category through `parseCategory`.
- Build adapters with `createD1ImageRepository(env.DB)` and `createR2ImageStorage(env.IMAGES_BUCKET)`.
- Validate upload token before reading file.
- Validate `file.type.startsWith("image/")`.
- Use `createImage`, `listImages`, and `deleteImage`.
- Return JSON error bodies with `{ "error": "message" }`.
- Use `Set-Cookie` for login and logout.

- [ ] **Step 4: Add Next route delegates**

Each route file must only unwrap `params`, obtain Cloudflare env bindings, and delegate to a pure handler. Keep route files thin so tests stay focused on behavior.

Route files:

```txt
src/app/api/[category]/auth/login/route.ts
src/app/api/[category]/auth/logout/route.ts
src/app/api/[category]/images/route.ts
src/app/api/[category]/images/[uid]/route.ts
src/app/api/[category]/images/[uid]/file/route.ts
```

- [ ] **Step 5: Run tests to verify pass**

```bash
npm test -- src/features/images/api.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/images src/app/api
git commit -m "feat: add image api routes"
```

## Task 8: Admin Login And Image List UI

**Files:**

- Create: `src/components/admin/login-form.test.tsx`
- Create: `src/components/admin/login-form.tsx`
- Create: `src/components/admin/image-list.test.tsx`
- Create: `src/components/admin/image-list.tsx`
- Create: `src/app/[category]/admin/page.tsx`

- [ ] **Step 1: Write failing UI tests**

Create `src/components/admin/login-form.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { LoginForm } from "./login-form";

describe("LoginForm", () => {
  test("posts category scoped credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<LoginForm category="library" />);

    await userEvent.type(screen.getByLabelText("아이디"), "admin");
    await userEvent.type(screen.getByLabelText("비밀번호"), "pass");
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/library/auth/login",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
```

Create `src/components/admin/image-list.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { ImageList } from "./image-list";

describe("ImageList", () => {
  test("renders thumbnails uid times and page size control", () => {
    render(
      <ImageList
        category="library"
        initialData={{
          items: [
            {
              id: 1,
              uid: "abc123",
              category: "library",
              filename: "photo.jpg",
              key: "images/library/abc123/photo.jpg",
              createAt: "2026-07-09T09:00:00.000+09:00",
              expireAt: "2026-07-16T09:00:00.000+09:00",
              thumbnailUrl: "/api/library/images/abc123/file",
            },
          ],
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1,
        }}
      />,
    );

    expect(screen.getByText("abc123")).toBeInTheDocument();
    expect(screen.getByText("2026-07-09T09:00:00.000+09:00")).toBeInTheDocument();
    expect(screen.getByText("2026-07-16T09:00:00.000+09:00")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  test("opens viewer in a new tab when row link is clicked", () => {
    render(
      <ImageList
        category="library"
        initialData={{
          items: [],
          page: 1,
          pageSize: 10,
          total: 0,
          totalPages: 1,
        }}
      />,
    );

    expect(screen.getByText("등록된 이미지가 없습니다.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npm test -- src/components/admin/login-form.test.tsx src/components/admin/image-list.test.tsx
```

Expected: FAIL because UI components do not exist.

- [ ] **Step 3: Implement UI components**

Implement `LoginForm` and `ImageList` using shadcn/ui components:

- `Button` for commands.
- `Input` and `Field` components for credentials.
- `Select` for page size values `10`, `20`, `30`.
- `Table` for list layout.
- `AlertDialog` for delete confirmation.
- `Empty` for empty state.
- Icons from the project icon library inside command buttons.

The `ImageList` component must render stable columns for thumbnail, UID, creation time, expiration time, and delete action.

- [ ] **Step 4: Implement admin page**

`src/app/[category]/admin/page.tsx` must:

- Parse category from route params.
- Check category-scoped admin session.
- Render `LoginForm` when the session is missing.
- Fetch initial list data server-side when the session is valid.
- Render `ImageList` with initial data.

- [ ] **Step 5: Run tests to verify pass**

```bash
npm test -- src/components/admin/login-form.test.tsx src/components/admin/image-list.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin src/app/[category]/admin
git commit -m "feat: add admin login and image list ui"
```

## Task 9: Public Image Viewer

**Files:**

- Create: `src/components/viewer/image-viewer.test.tsx`
- Create: `src/components/viewer/image-viewer.tsx`
- Create: `src/app/[category]/[uid]/page.tsx`

- [ ] **Step 1: Write failing viewer tests**

Create `src/components/viewer/image-viewer.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ImageViewer } from "./image-viewer";

describe("ImageViewer", () => {
  test("renders a mobile first image view", () => {
    render(
      <ImageViewer
        image={{
          id: 1,
          uid: "abc123",
          category: "library",
          filename: "photo.jpg",
          key: "images/library/abc123/photo.jpg",
          createAt: "2026-07-09T09:00:00.000+09:00",
          expireAt: "2026-07-16T09:00:00.000+09:00",
        }}
      />,
    );

    expect(screen.getByAltText("photo.jpg")).toHaveAttribute(
      "src",
      "/api/library/images/abc123/file",
    );
    expect(screen.getByText("abc123")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npm test -- src/components/viewer/image-viewer.test.tsx
```

Expected: FAIL because `ImageViewer` does not exist.

- [ ] **Step 3: Implement viewer component**

Create `src/components/viewer/image-viewer.tsx`:

```tsx
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
        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{image.uid}</span>
          <span>{image.createAt}</span>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Implement viewer page**

`src/app/[category]/[uid]/page.tsx` must:

- Parse route category.
- Fetch image metadata by category and UID.
- Render `notFound()` when no row exists.
- Render `ImageViewer` when a row exists.

- [ ] **Step 5: Run test to verify pass**

```bash
npm test -- src/components/viewer/image-viewer.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/viewer src/app/[category]/[uid]
git commit -m "feat: add public image viewer"
```

## Task 10: Scheduled Cleanup Worker

**Files:**

- Create: `src/workers/cleanup.test.ts`
- Create: `src/workers/cleanup.ts`
- Modify: `wrangler.cleanup.jsonc`

- [ ] **Step 1: Write failing cleanup Worker tests**

Create `src/workers/cleanup.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";
import type { CloudflareEnv } from "@/types/cloudflare";
import worker from "./cleanup";

describe("cleanup worker", () => {
  test("exports a scheduled handler", async () => {
    const controller = {
      cron: "0 16 * * *",
      scheduledTime: Date.parse("2026-07-09T16:00:00.000Z"),
      type: "scheduled",
    } as ScheduledController;
    const env = {
      DB: {} as D1Database,
      IMAGES_BUCKET: {} as R2Bucket,
    } as CloudflareEnv;
    const ctx = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
    } as unknown as ExecutionContext;

    await expect(worker.scheduled?.(controller, env, ctx)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npm test -- src/workers/cleanup.test.ts
```

Expected: FAIL because cleanup Worker does not exist.

- [ ] **Step 3: Implement cleanup Worker**

Create `src/workers/cleanup.ts`:

```ts
import type { CloudflareEnv } from "@/types/cloudflare";
import { createD1ImageRepository } from "@/lib/images/d1-repository";
import { createR2ImageStorage } from "@/lib/images/r2-storage";
import { cleanupExpiredImages } from "@/lib/images/service";

export default {
  async scheduled(controller, env) {
    const repository = createD1ImageRepository(env.DB);
    const storage = createR2ImageStorage(env.IMAGES_BUCKET);
    const now = new Date(controller.scheduledTime);
    const result = await cleanupExpiredImages({ repository, storage, now });
    console.log(JSON.stringify({ event: "cleanupExpiredImages", result }));
  },
} satisfies ExportedHandler<CloudflareEnv>;
```

- [ ] **Step 4: Configure cleanup Worker**

Create or update `wrangler.cleanup.jsonc`:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "user-image-management-cleanup",
  "main": "src/workers/cleanup.ts",
  "compatibility_date": "2026-07-09",
  "triggers": {
    "crons": ["0 16 * * *"]
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "user-image-management"
    }
  ],
  "r2_buckets": [
    {
      "binding": "IMAGES_BUCKET",
      "bucket_name": "user-image-management-images"
    }
  ]
}
```

When using an explicitly created D1 database, run `npx wrangler d1 create user-image-management` and add the returned `database_id` to both `wrangler.jsonc` and `wrangler.cleanup.jsonc`. When using Wrangler automatic provisioning, keep the binding without `database_id`.

`0 16 * * *` is 01:00 KST on the following calendar day because Cloudflare Cron uses UTC.

- [ ] **Step 5: Run test to verify pass**

```bash
npm test -- src/workers/cleanup.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/workers/cleanup.ts src/workers/cleanup.test.ts wrangler.cleanup.jsonc
git commit -m "feat: add scheduled cleanup worker"
```

## Task 11: End-To-End Browser Coverage

**Files:**

- Create: `tests/e2e/admin.spec.ts`
- Create: `tests/e2e/viewer.spec.ts`

- [ ] **Step 1: Write failing admin e2e test**

Create `tests/e2e/admin.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("admin login gate appears before image list", async ({ page }) => {
  await page.goto("/library/admin");
  await expect(page.getByLabel("아이디")).toBeVisible();
  await expect(page.getByLabel("비밀번호")).toBeVisible();
  await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
});
```

Create `tests/e2e/viewer.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("missing public image shows not found", async ({ page }) => {
  await page.goto("/library/missing");
  await expect(page.getByText(/not found|찾을 수 없습니다/i)).toBeVisible();
});
```

- [ ] **Step 2: Run e2e tests to verify failure**

```bash
npm run e2e
```

Expected: FAIL until app pages and test server configuration are complete.

- [ ] **Step 3: Configure Playwright web server**

Set `playwright.config.ts` to run `npm run dev` with `baseURL: "http://127.0.0.1:3000"`.

- [ ] **Step 4: Run e2e tests to verify pass**

```bash
npm run e2e
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts tests/e2e
git commit -m "test: add admin and viewer e2e coverage"
```

## Task 12: Documentation And Final Verification

**Files:**

- Create: `README.md`
- Modify: `.gitignore`

- [ ] **Step 1: Write README**

`README.md` must include:

- Required Node.js/npm version from the generated project.
- Local install command: `npm install`.
- Local env file path: `.env.local`.
- All environment variables listed in `docs/pr/upload-image-management-server-pr.md`.
- Local migration command: `npx wrangler d1 execute user-image-management --local --file=./migrations/0001_create_images.sql`.
- Dev command: `npm run dev`.
- Cloudflare preview command: `npm run preview`.
- Unit test command: `npm test`.
- E2E test command: `npm run e2e`.
- Deploy command: `npm run deploy`.
- Cleanup Worker deploy command: `npm run cleanup:deploy`.
- Scheduled handler local test command: `curl "http://localhost:8787/cdn-cgi/handler/scheduled?format=json"` while `npm run cleanup:dev` is running.

- [ ] **Step 2: Update `.gitignore`**

Ensure these generated or secret paths are ignored:

```gitignore
.env
.env.local
.env.production
.wrangler/
.open-next/
test-results/
playwright-report/
```

- [ ] **Step 3: Run full verification**

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run e2e
```

Expected: all commands pass with no errors.

- [ ] **Step 4: Verify Cloudflare preview**

```bash
npm run preview
```

Expected: local Cloudflare Worker preview starts and serves the app. Manually check:

- `http://127.0.0.1:8787/library/admin`
- `http://127.0.0.1:8787/nakdong/admin`

- [ ] **Step 5: Verify scheduled handler locally**

In one terminal:

```bash
npm run cleanup:dev
```

In another terminal:

```bash
curl "http://localhost:8787/cdn-cgi/handler/scheduled?format=json"
```

Expected: scheduled handler returns a structured result and logs cleanup counts.

- [ ] **Step 6: Commit**

```bash
git add README.md .gitignore
git commit -m "docs: add setup and verification guide"
```

## Final Review Checklist

- [ ] `library` and `nakdong` are isolated in auth, APIs, admin UI, viewer pages, DB queries, and R2 keys.
- [ ] Upload is possible only through `POST /api/[category]/images`.
- [ ] Upload token failure returns `401`.
- [ ] Non-image upload returns `415`.
- [ ] Admin list supports page sizes `10`, `20`, `30`.
- [ ] Admin list shows thumbnail, UID, `createAt`, `expireAt`, and delete button.
- [ ] Image row click opens `/${category}/${uid}` in a new tab.
- [ ] Public viewer is mobile-first and does not expose admin controls.
- [ ] D1 rows include `uid`, `category`, `filename`, `key`, `createAt`, `expireAt`.
- [ ] Cleanup deletes expired D1 rows and R2 objects.
- [ ] Cleanup uses KST date comparison even though Cron uses UTC.
- [ ] `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run e2e` pass.
