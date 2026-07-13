# Music, School and MBTI Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `music` and `school` as full image-management categories using shared Daegu admin credentials, add a parameter-echoing MBTI GET route, and make `/` return the existing 404 page.

**Architecture:** Extend the existing category union and dynamic category routes instead of duplicating pages or handlers. Keep credentials category-scoped by mapping both new categories to one environment credential pair while preserving the category inside signed sessions. Expand SQLite CHECK constraints through a data-preserving migration, and implement MBTI and root behavior as focused App Router entry points.

**Tech Stack:** Next.js 16 App Router, TypeScript, React 19, Cloudflare D1/R2, Vitest, Testing Library

---

## File map

- `src/lib/categories.ts`: supported category union, parsing, and centralized UI labels.
- `src/components/admin/image-list.tsx`: consume centralized labels for all category headings.
- `src/lib/auth.ts`: select library, nakdong, or shared Daegu admin credentials.
- `src/types/cloudflare.ts`: declare the new Daegu environment variables.
- `src/lib/cloudflare.ts`: provide local development defaults for Daegu credentials.
- `src/lib/images/d1-repository.ts`: use four-category CHECK constraints when bootstrapping missing tables.
- `migrations/0003_expand_categories.sql`: rebuild constrained tables while preserving existing rows and indexes.
- `src/app/mbti/[type]/route.ts`: unauthenticated GET endpoint returning the path parameter.
- `src/app/page.tsx`: invoke the existing Next.js not-found flow at `/`.
- `tests/e2e/routing.spec.ts`: verify MBTI and root behavior through real HTTP responses.
- `README.md`: document four categories, Daegu credentials, routes, and root behavior.

### Task 1: Extend the category catalog and admin headings

**Files:**
- Modify: `src/lib/categories.test.ts`
- Modify: `src/lib/categories.ts`
- Modify: `src/components/admin/image-list.test.tsx`
- Modify: `src/components/admin/image-list.tsx`
- Modify: `src/components/viewer/image-viewer.test.tsx`

- [ ] **Step 1: Write failing category and heading tests**

Replace the category acceptance and label assertions in `src/lib/categories.test.ts` with:

```ts
test("accepts every supported category", () => {
  expect(parseCategory("library")).toBe("library");
  expect(parseCategory("nakdong")).toBe("nakdong");
  expect(parseCategory("music")).toBe("music");
  expect(parseCategory("school")).toBe("school");
});

test("exposes admin UI headings for every category", () => {
  expect(CATEGORY_LABELS.library).toBe("국립중앙도서관");
  expect(CATEGORY_LABELS.nakdong).toBe("낙동강 개와 고양이 특별전");
  expect(CATEGORY_LABELS.music).toBe("음악");
  expect(CATEGORY_LABELS.school).toBe("학교");
});
```

Add this test to `src/components/admin/image-list.test.tsx`:

```tsx
test.each([
  ["music", "음악"],
  ["school", "학교"],
] as const)("renders the %s category heading", (category, heading) => {
  render(
    <ImageList
      category={category}
      initialData={{
        items: [],
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 1,
      }}
    />,
  );

  expect(screen.getByText(heading)).toBeInTheDocument();
});
```

Add this test to `src/components/viewer/image-viewer.test.tsx` to lock in the standard viewer for the two new categories:

```tsx
test.each(["music", "school"] as const)(
  "uses the standard viewer for %s images",
  (category) => {
    render(
      <ImageViewer
        image={{
          id: 3,
          uid: `${category}01`,
          category,
          filename: `${category}.jpg`,
          key: `images/${category}/${category}01/${category}.jpg`,
          thumbnailKey: null,
          createAt: "2026-07-13T09:00:00.000+09:00",
          expireAt: "2026-07-20T09:00:00.000+09:00",
        }}
      />,
    );

    expect(screen.getByRole("main")).toHaveClass("bg-background");
    expect(screen.getByRole("main")).not.toHaveClass("bg-black");
    expect(screen.getByRole("link", { name: "원본 다운로드" })).toHaveAttribute(
      "href",
      `/api/${category}/images/${category}01/download`,
    );
  },
);
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npm test -- src/lib/categories.test.ts src/components/admin/image-list.test.tsx src/components/viewer/image-viewer.test.tsx
npm run typecheck
```

Expected: tests FAIL because `music` and `school` are rejected and their headings render as the nakdong fallback; type checking also rejects the new category props.

- [ ] **Step 3: Implement the four-category catalog**

Update `src/lib/categories.ts`:

```ts
export const CATEGORIES = ["library", "nakdong", "music", "school"] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  library: "국립중앙도서관",
  nakdong: "낙동강 개와 고양이 특별전",
  music: "음악",
  school: "학교",
};

export function isCategory(value: string): value is Category {
  return CATEGORIES.includes(value as Category);
}

export function parseCategory(value: string): Category {
  if (isCategory(value)) {
    return value;
  }

  throw new Error("Invalid category");
}
```

Keep `parsePage` and `parsePageSize` unchanged. In `src/components/admin/image-list.tsx`, remove `useMemo` from the React import, import `CATEGORY_LABELS`, and replace the conditional title with:

```ts
const title = CATEGORY_LABELS[category];
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```bash
npm test -- src/lib/categories.test.ts src/components/admin/image-list.test.tsx src/components/viewer/image-viewer.test.tsx
npm run typecheck
```

Expected: all three test files PASS and TypeScript reports no errors.

- [ ] **Step 5: Commit the category change**

```bash
git add src/lib/categories.ts src/lib/categories.test.ts src/components/admin/image-list.tsx src/components/admin/image-list.test.tsx src/components/viewer/image-viewer.test.tsx
git commit -m "feat: add music and school categories"
```

### Task 2: Add shared Daegu credentials and verify category-scoped API access

**Files:**
- Modify: `src/lib/auth.test.ts`
- Modify: `src/features/images/api.test.ts`
- Modify: `src/lib/auth.ts`
- Modify: `src/types/cloudflare.ts`
- Modify: `src/lib/cloudflare.ts`
- Modify: `src/workers/cleanup.test.ts`

- [ ] **Step 1: Write failing authentication tests**

Add these fields to the `CloudflareEnv` fixtures in `src/lib/auth.test.ts`, `src/features/images/api.test.ts`, and `src/workers/cleanup.test.ts`:

```ts
DAEGU_ADMIN_ID: "daegu-admin",
DAEGU_ADMIN_PASSWORD: "daegu-pass",
```

Add these assertions to the credential test in `src/lib/auth.test.ts`:

```ts
expect(getAdminCredential(env, "music")).toEqual({
  id: "daegu-admin",
  password: "daegu-pass",
});
expect(getAdminCredential(env, "school")).toEqual({
  id: "daegu-admin",
  password: "daegu-pass",
});
```

Add this session-isolation test:

```ts
test("keeps music and school sessions category scoped", async () => {
  const cookie = await signSession(env, "music");
  await expect(verifySession(env, "music", cookie)).resolves.toBe(true);
  await expect(verifySession(env, "school", cookie)).resolves.toBe(false);
});
```

Add this representative image API test under `handleLogin and session-gated list` in `src/features/images/api.test.ts`:

```ts
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
      body: JSON.stringify({ id: "daegu-admin", password: "daegu-pass" }),
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
  const body = (await response.json()) as { items: Array<{ uid: string }> };

  expect(login.status).toBe(200);
  expect(response.status).toBe(200);
  expect(body.items).toEqual([expect.objectContaining({ uid: "school01" })]);
});
```

- [ ] **Step 2: Run authentication tests and verify RED**

Run:

```bash
npm test -- src/lib/auth.test.ts src/features/images/api.test.ts
```

Expected: FAIL because the environment type and credential selector do not yet support `DAEGU_ADMIN_*`.

- [ ] **Step 3: Implement Daegu environment and credential selection**

Add to `CloudflareEnv` in `src/types/cloudflare.ts`:

```ts
DAEGU_ADMIN_ID: string;
DAEGU_ADMIN_PASSWORD: string;
```

Add to the local fallback object in `src/lib/cloudflare.ts`:

```ts
DAEGU_ADMIN_ID: process.env.DAEGU_ADMIN_ID ?? "daegu-admin",
DAEGU_ADMIN_PASSWORD: process.env.DAEGU_ADMIN_PASSWORD ?? "daegu-pass",
```

Extend the `Pick<CloudflareEnv, ...>` in `src/lib/auth.ts` with both Daegu keys, then implement explicit selection:

```ts
if (category === "library") {
  return {
    id: env.LIBRARY_ADMIN_ID,
    password: env.LIBRARY_ADMIN_PASSWORD,
  };
}

if (category === "nakdong") {
  return {
    id: env.NAKDONG_ADMIN_ID,
    password: env.NAKDONG_ADMIN_PASSWORD,
  };
}

return {
  id: env.DAEGU_ADMIN_ID,
  password: env.DAEGU_ADMIN_PASSWORD,
};
```

- [ ] **Step 4: Run authentication tests and type checking**

Run:

```bash
npm test -- src/lib/auth.test.ts src/features/images/api.test.ts src/workers/cleanup.test.ts
npm run typecheck
```

Expected: all focused tests PASS and TypeScript reports no errors.

- [ ] **Step 5: Commit the credential change**

```bash
git add src/lib/auth.ts src/lib/auth.test.ts src/lib/cloudflare.ts src/types/cloudflare.ts src/features/images/api.test.ts src/workers/cleanup.test.ts
git commit -m "feat: share Daegu admin credentials"
```

### Task 3: Expand D1 category constraints without losing data

**Files:**
- Create: `src/lib/images/category-migration.test.ts`
- Create: `migrations/0003_expand_categories.sql`
- Modify: `src/lib/images/d1-repository.test.ts`
- Modify: `src/lib/images/d1-repository.ts`

- [ ] **Step 1: Write failing schema and migration tests**

In the existing missing-table test in `src/lib/images/d1-repository.test.ts`, add:

```ts
expect(db.prepare).toHaveBeenCalledWith(
  expect.stringContaining(
    "CHECK (category IN ('library', 'nakdong', 'music', 'school'))",
  ),
);
```

Create `src/lib/images/category-migration.test.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("category expansion migration", () => {
  test("preserves rows while rebuilding both constrained tables", () => {
    const migrationPath = path.resolve(
      process.cwd(),
      "migrations/0003_expand_categories.sql",
    );

    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, "utf8");
    expect(
      sql.match(
        /CHECK \(category IN \('library', 'nakdong', 'music', 'school'\)\)/g,
      ),
    ).toHaveLength(2);
    expect(sql).toContain("INSERT INTO images_next");
    expect(sql).toContain("SELECT id, uid, category, filename, key, thumbnailKey, createAt, expireAt");
    expect(sql).toContain("INSERT INTO usage_records_next");
    expect(sql).toContain("SELECT id, category, createdAt");
    expect(sql).toContain("CREATE UNIQUE INDEX images_category_uid_idx");
    expect(sql).toContain("CREATE INDEX usage_records_category_createdAt_idx");
  });
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npm test -- src/lib/images/d1-repository.test.ts src/lib/images/category-migration.test.ts
```

Expected: FAIL because the runtime schema has the old CHECK and migration 0003 does not exist.

- [ ] **Step 3: Update runtime bootstrap schema**

In both table definitions in `src/lib/images/d1-repository.ts`, replace the CHECK with:

```sql
CHECK (category IN ('library', 'nakdong', 'music', 'school'))
```

- [ ] **Step 4: Add the data-preserving D1 migration**

Create `migrations/0003_expand_categories.sql`:

```sql
CREATE TABLE images_next (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('library', 'nakdong', 'music', 'school')),
  filename TEXT NOT NULL,
  key TEXT NOT NULL,
  createAt TEXT NOT NULL,
  expireAt TEXT NOT NULL,
  thumbnailKey TEXT
);

INSERT INTO images_next (id, uid, category, filename, key, thumbnailKey, createAt, expireAt)
SELECT id, uid, category, filename, key, thumbnailKey, createAt, expireAt
FROM images;

DROP TABLE images;
ALTER TABLE images_next RENAME TO images;

CREATE UNIQUE INDEX images_category_uid_idx ON images(category, uid);
CREATE INDEX images_category_createAt_idx ON images(category, createAt DESC);
CREATE INDEX images_expireAt_idx ON images(expireAt);

CREATE TABLE usage_records_next (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL CHECK (category IN ('library', 'nakdong', 'music', 'school')),
  createdAt TEXT NOT NULL
);

INSERT INTO usage_records_next (id, category, createdAt)
SELECT id, category, createdAt
FROM usage_records;

DROP TABLE usage_records;
ALTER TABLE usage_records_next RENAME TO usage_records;

CREATE INDEX usage_records_category_createdAt_idx
  ON usage_records(category, createdAt);
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
npm test -- src/lib/images/d1-repository.test.ts src/lib/images/category-migration.test.ts
```

Expected: both test files PASS.

- [ ] **Step 6: Commit the database change**

```bash
git add src/lib/images/d1-repository.ts src/lib/images/d1-repository.test.ts src/lib/images/category-migration.test.ts migrations/0003_expand_categories.sql
git commit -m "feat: expand database category constraints"
```

### Task 4: Add the MBTI GET route

**Files:**
- Create: `tests/e2e/routing.spec.ts`
- Create: `src/app/mbti/[type]/route.ts`

- [ ] **Step 1: Write the failing route test**

Create `tests/e2e/routing.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("GET /mbti/[type] returns the decoded type parameter unchanged", async ({
  request,
}) => {
  const response = await request.get("/mbti/INTJ%20custom");

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ type: "INTJ custom" });
});
```

- [ ] **Step 2: Run the route test and verify RED**

Run:

```bash
npm run e2e -- tests/e2e/routing.spec.ts
```

Expected: FAIL with HTTP 404 because the MBTI route does not exist.

- [ ] **Step 3: Implement the GET handler**

Create `src/app/mbti/[type]/route.ts`:

```ts
interface RouteContext {
  params: Promise<{ type: string }> | { type: string };
}

export async function GET(_request: Request, context: RouteContext) {
  const { type } = await context.params;
  return Response.json({ type });
}
```

- [ ] **Step 4: Run the route test and verify GREEN**

Run:

```bash
npm run e2e -- tests/e2e/routing.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the MBTI route**

```bash
git add "src/app/mbti/[type]/route.ts" tests/e2e/routing.spec.ts
git commit -m "feat: add MBTI type GET route"
```

### Task 5: Return 404 from the root URL

**Files:**
- Modify: `tests/e2e/routing.spec.ts`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Write the failing root-page test**

Add to `tests/e2e/routing.spec.ts`:

```ts
test("GET / returns 404 without redirecting", async ({ request }) => {
  const response = await request.get("/", { maxRedirects: 0 });

  expect(response.status()).toBe(404);
  expect(response.headers().location).toBeUndefined();
});
```

- [ ] **Step 2: Run the root-page test and verify RED**

Run:

```bash
npm run e2e -- tests/e2e/routing.spec.ts
```

Expected: the MBTI test PASSes and the root test FAILs because `/` returns a redirect response.

- [ ] **Step 3: Implement root not-found behavior**

Replace `src/app/page.tsx` with:

```tsx
import { notFound } from "next/navigation";

export default function HomePage() {
  notFound();
}
```

- [ ] **Step 4: Run the root-page test and verify GREEN**

Run:

```bash
npm run e2e -- tests/e2e/routing.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the root behavior**

```bash
git add src/app/page.tsx tests/e2e/routing.spec.ts
git commit -m "feat: return not found from root route"
```

### Task 6: Update documentation and run full verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update documented environment and routes**

In `README.md`:

- Change the introduction and supported-category text to list `library`, `nakdong`, `music`, and `school`.
- Add these local environment examples:

```env
DAEGU_ADMIN_ID=daegu-admin
DAEGU_ADMIN_PASSWORD=daegu-pass
```

- Add `/music/admin` and `/school/admin` to the local app URL list.
- State that `music` and `school` share the Daegu credential but retain category-scoped sessions.
- Document `GET /mbti/[type]` with the example response `{ "type": "INTJ" }`.
- State that `/` returns the existing 404 page.

- [ ] **Step 2: Run the complete verification suite**

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run e2e
```

Expected: all unit and end-to-end tests PASS, type checking and lint report no errors, and the production build completes successfully.

- [ ] **Step 3: Inspect the final diff**

Run:

```bash
git status --short
git diff --check
git diff --stat main...HEAD
```

Expected: only the planned source, test, migration, and README files are changed; `git diff --check` prints nothing.

- [ ] **Step 4: Commit documentation**

```bash
git add README.md
git commit -m "docs: document new categories and routes"
```

- [ ] **Step 5: Re-run post-commit smoke verification**

Run:

```bash
npm test
npm run typecheck
```

Expected: all tests PASS and TypeScript reports no errors with a clean tracked worktree.
