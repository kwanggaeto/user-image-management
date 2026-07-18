# Daegu Admin Integration and MBTI Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add MBTI as a full image category and provide one `/daegu/admin` login, selection hub, and shared navigation/session for school, music, and MBTI administration.

**Architecture:** Keep the existing dynamic category pages and APIs, but introduce an explicit `AdminScope` that maps `school`, `music`, and `mbti` to one signed `daegu` session. A static Daegu admin page and auth endpoint own the unified login and hub, while small presentational components own the hub and category navigation. MBTI reuses the standard image pipeline and receives a new data-preserving D1 migration.

**Tech Stack:** Next.js 16 App Router, TypeScript 5.9, React 19, Cloudflare D1/R2/Images, Vitest, Testing Library, Playwright

---

## File map

- `src/lib/categories.ts`: five image categories, long labels, and the Daegu category group.
- `src/lib/auth.ts`: `AdminScope`, category-to-scope policy, session signing, and credential selection.
- `src/features/images/api.ts`: shared-scope login and protected category API authorization.
- `src/app/daegu/admin/page.tsx`: unified login gate and post-login category hub.
- `src/app/api/daegu/auth/login/route.ts`: static Daegu login endpoint.
- `src/app/api/daegu/auth/logout/route.ts`: static Daegu logout endpoint.
- `src/components/admin/login-form.tsx`: scope-aware endpoint and saved-ID key.
- `src/components/admin/daegu-admin-hub.tsx`: three category selection cards.
- `src/components/admin/daegu-admin-nav.tsx`: shared category switcher for Daegu list pages.
- `src/components/admin/image-list.tsx`: Daegu navigation and shared logout behavior.
- `src/app/[category]/admin/page.tsx`: group-session verification and unauthenticated redirect.
- `src/app/[category]/admin/usage/page.tsx`: the same group-session policy for usage pages.
- `src/lib/images/d1-repository.ts`: five-category bootstrap constraints.
- `migrations/0004_add_mbti_category.sql`: data-preserving category expansion.
- `src/app/mbti/[type]/route.ts`: remove the obsolete JSON echo route.
- Unit and E2E tests listed in each task: lock in RED/GREEN behavior and regressions.
- `README.md`: document the unified admin route and MBTI image contract.

### Task 1: Add the MBTI category and data migration

**Files:**
- Modify: `src/lib/categories.test.ts`
- Modify: `src/lib/categories.ts`
- Modify: `src/lib/uid.test.ts`
- Modify: `src/components/viewer/image-viewer.test.tsx`
- Modify: `src/features/images/api.test.ts`
- Modify: `src/lib/images/d1-repository.test.ts`
- Modify: `src/lib/images/d1-repository.ts`
- Create: `src/lib/images/mbti-category-migration.test.ts`
- Create: `migrations/0004_add_mbti_category.sql`

- [ ] **Step 1: Write failing category, key, viewer, schema, and migration tests**

Extend the category assertions in `src/lib/categories.test.ts`:

```ts
expect(parseCategory("mbti")).toBe("mbti");
expect(CATEGORY_LABELS.music).toBe("나만의 음악 만들기");
expect(CATEGORY_LABELS.school).toBe("나만의 학교 만들기");
expect(CATEGORY_LABELS.mbti).toBe("MBTI");
expect(DAEGU_CATEGORIES).toEqual(["school", "music", "mbti"]);
expect(isDaeguCategory("mbti")).toBe(true);
expect(isDaeguCategory("library")).toBe(false);
```

Add this key assertion to `src/lib/uid.test.ts`:

```ts
expect(buildImageKey("mbti", "intj01", "portrait.png")).toBe(
  "images/mbti/intj01/portrait.png",
);
```

Add this standard-viewer case to `src/components/viewer/image-viewer.test.tsx`:

```tsx
test("keeps the standard image viewer for MBTI", () => {
  render(
    <ImageViewer
      image={{
        id: 5,
        uid: "intj01",
        category: "mbti",
        filename: "intj.png",
        key: "images/mbti/intj01/intj.png",
        thumbnailKey: "images/mbti/intj01/thumbnail.webp",
        createAt: "2026-07-19T09:00:00.000+09:00",
        expireAt: "2026-07-26T09:00:00.000+09:00",
      }}
    />,
  );

  expect(screen.getByAltText("intj.png")).toHaveAttribute(
    "src",
    "/api/mbti/images/intj01/file",
  );
  expect(screen.getByRole("link", { name: "원본 다운로드" })).toHaveAttribute(
    "href",
    "/api/mbti/images/intj01/download",
  );
});
```

Add this upload case to `src/features/images/api.test.ts` before `mbti` is added to the catalog:

```ts
test("uploads MBTI images through the standard image pipeline", async () => {
  const repository = new FakeRepository();
  const storage = new FakeStorage();
  const thumbnailGenerator = new FakeThumbnailGenerator();
  const response = await handleImageUpload({
    request: multipartRequest(
      "https://app.test/api/mbti/images",
      "intj.png",
      "image/png",
      "image",
    ),
    env,
    categoryValue: "mbti",
    repository,
    storage,
    thumbnailGenerator,
    usageRepository: new FakeUsageRepository(),
    createUid: () => "intj01",
    now: () => new Date("2026-07-19T00:00:00.000Z"),
  });
  const body = (await response.json()) as { viewUrl: string };

  expect(response.status).toBe(201);
  expect(body.viewUrl).toBe("https://app.test/mbti/intj01");
  expect(thumbnailGenerator.calls).toBe(1);
  expect(repository.rows[0]).toMatchObject({
    category: "mbti",
    key: "images/mbti/intj01/intj.png",
    thumbnailKey: "images/mbti/intj01/thumbnail.webp",
  });
});
```

Change the bootstrap constraint assertion in `src/lib/images/d1-repository.test.ts` to require:

```ts
"CHECK (category IN ('library', 'nakdong', 'music', 'school', 'mbti'))"
```

Create `src/lib/images/mbti-category-migration.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("MBTI category migration", () => {
  test("rebuilds both constrained tables while preserving rows and indexes", () => {
    const sql = readFileSync(
      path.resolve(process.cwd(), "migrations/0004_add_mbti_category.sql"),
      "utf8",
    );

    expect(
      sql.match(
        /CHECK \(category IN \('library', 'nakdong', 'music', 'school', 'mbti'\)\)/g,
      ),
    ).toHaveLength(2);
    expect(sql).toContain("INSERT INTO images_next");
    expect(sql).toContain(
      "SELECT id, uid, category, filename, key, thumbnailKey, createAt, expireAt",
    );
    expect(sql).toContain("INSERT INTO usage_records_next");
    expect(sql).toContain("SELECT id, category, createdAt");
    expect(sql).toContain("CREATE UNIQUE INDEX images_category_uid_idx");
    expect(sql).toContain("CREATE INDEX images_category_createAt_idx");
    expect(sql).toContain("CREATE INDEX images_expireAt_idx");
    expect(sql).toContain("CREATE INDEX usage_records_category_createdAt_idx");
  });
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npm test -- src/lib/categories.test.ts src/lib/uid.test.ts src/components/viewer/image-viewer.test.tsx src/features/images/api.test.ts src/lib/images/d1-repository.test.ts src/lib/images/mbti-category-migration.test.ts
```

Expected: FAIL because `mbti`, the Daegu group exports, the five-category schema, and migration do not exist; the upload test fails with `Invalid category`.

- [ ] **Step 3: Implement the category catalog and bootstrap constraints**

Set the catalog portion of `src/lib/categories.ts` to:

```ts
export const CATEGORIES = [
  "library",
  "nakdong",
  "music",
  "school",
  "mbti",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const DAEGU_CATEGORIES = ["school", "music", "mbti"] as const;
export type DaeguCategory = (typeof DAEGU_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  library: "국립중앙도서관",
  nakdong: "낙동강 개와 고양이 특별전",
  music: "나만의 음악 만들기",
  school: "나만의 학교 만들기",
  mbti: "MBTI",
};

export function isDaeguCategory(value: Category): value is DaeguCategory {
  return DAEGU_CATEGORIES.includes(value as DaeguCategory);
}
```

Keep the existing parsing and pagination functions. In both schema strings in `src/lib/images/d1-repository.ts`, use:

```sql
CHECK (category IN ('library', 'nakdong', 'music', 'school', 'mbti'))
```

- [ ] **Step 4: Add the data-preserving 0004 migration**

Create `migrations/0004_add_mbti_category.sql`:

```sql
CREATE TABLE images_next (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('library', 'nakdong', 'music', 'school', 'mbti')),
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
  category TEXT NOT NULL CHECK (category IN ('library', 'nakdong', 'music', 'school', 'mbti')),
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

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run the Step 2 command again.

Expected: all selected files PASS.

- [ ] **Step 6: Commit the MBTI catalog and schema**

```powershell
git add src/lib/categories.ts src/lib/categories.test.ts src/lib/uid.test.ts src/components/viewer/image-viewer.test.tsx src/features/images/api.test.ts src/lib/images/d1-repository.ts src/lib/images/d1-repository.test.ts src/lib/images/mbti-category-migration.test.ts migrations/0004_add_mbti_category.sql
git commit -m "feat: add MBTI image category"
```

### Task 2: Introduce a shared Daegu authentication scope

**Files:**
- Modify: `src/lib/auth.test.ts`
- Modify: `src/lib/auth.ts`
- Modify: `src/features/images/api.test.ts`
- Modify: `src/features/images/api.ts`
- Create: `src/app/api/daegu/auth/login/route.ts`
- Create: `src/app/api/daegu/auth/logout/route.ts`

- [ ] **Step 1: Write failing authentication and protected-API tests**

In `src/lib/auth.test.ts`, import `adminScopeForCategory` and `verifyCategorySession`, then replace the Daegu credential/session assertions with:

```ts
expect(getAdminCredential(env, "daegu")).toEqual({
  id: "daegu-admin",
  password: "daegu-pass",
});
expect(adminScopeForCategory("library")).toBe("library");
expect(adminScopeForCategory("nakdong")).toBe("nakdong");
expect(adminScopeForCategory("school")).toBe("daegu");
expect(adminScopeForCategory("music")).toBe("daegu");
expect(adminScopeForCategory("mbti")).toBe("daegu");
```

Add:

```ts
test("allows one Daegu session across school music and MBTI only", async () => {
  const cookie = await signSession(env, "daegu");

  await expect(verifyCategorySession(env, "school", cookie)).resolves.toBe(true);
  await expect(verifyCategorySession(env, "music", cookie)).resolves.toBe(true);
  await expect(verifyCategorySession(env, "mbti", cookie)).resolves.toBe(true);
  await expect(verifyCategorySession(env, "library", cookie)).resolves.toBe(false);
  await expect(verifyCategorySession(env, "nakdong", cookie)).resolves.toBe(false);
});
```

In `src/features/images/api.test.ts`, import `handleDaeguLogin` and add a test that logs in once, inserts an MBTI record, then lists it through the MBTI protected API:

```ts
test("uses one Daegu login for protected MBTI image listing", async () => {
  const repository = new FakeRepository();
  await repository.insert({
    uid: "intj01",
    category: "mbti",
    filename: "intj.png",
    key: "images/mbti/intj01/intj.png",
    thumbnailKey: "images/mbti/intj01/thumbnail.webp",
    createAt: "2026-07-19T09:00:00.000+09:00",
    expireAt: "2026-07-26T09:00:00.000+09:00",
  });
  const login = await handleDaeguLogin({
    request: new Request("https://app.test/api/daegu/auth/login", {
      method: "POST",
      body: JSON.stringify({ id: "daegu-admin", password: "daegu-pass" }),
    }),
    env,
  });
  const response = await handleImageList({
    request: new Request("https://app.test/api/mbti/images", {
      headers: { cookie: login.headers.get("set-cookie") ?? "" },
    }),
    env,
    categoryValue: "mbti",
    repository,
  });

  expect(login.status).toBe(200);
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    items: [expect.objectContaining({ uid: "intj01" })],
  });
});
```

- [ ] **Step 2: Run focused authentication tests and verify RED**

Run:

```powershell
npm test -- src/lib/auth.test.ts src/features/images/api.test.ts
```

Expected: FAIL because the Daegu scope policy and `handleDaeguLogin` do not exist.

- [ ] **Step 3: Implement the authentication policy**

Add to `src/lib/auth.ts`:

```ts
export type AdminScope = "library" | "nakdong" | "daegu";

export function adminScopeForCategory(category: Category): AdminScope {
  if (category === "library" || category === "nakdong") {
    return category;
  }
  return "daegu";
}
```

Change `getAdminCredential` and `verifyAdminCredential` to accept `AdminScope`:

```ts
export function getAdminCredential(
  env: Pick<
    CloudflareEnv,
    | "LIBRARY_ADMIN_ID"
    | "LIBRARY_ADMIN_PASSWORD"
    | "NAKDONG_ADMIN_ID"
    | "NAKDONG_ADMIN_PASSWORD"
    | "DAEGU_ADMIN_ID"
    | "DAEGU_ADMIN_PASSWORD"
  >,
  scope: AdminScope,
): AdminCredential {
  if (scope === "library") {
    return { id: env.LIBRARY_ADMIN_ID, password: env.LIBRARY_ADMIN_PASSWORD };
  }
  if (scope === "nakdong") {
    return { id: env.NAKDONG_ADMIN_ID, password: env.NAKDONG_ADMIN_PASSWORD };
  }
  return { id: env.DAEGU_ADMIN_ID, password: env.DAEGU_ADMIN_PASSWORD };
}

export function verifyAdminCredential(
  env: Parameters<typeof getAdminCredential>[0],
  scope: AdminScope,
  id: string,
  password: string,
): boolean {
  const credential = getAdminCredential(env, scope);
  return credential.id === id && credential.password === password;
}
```

Change `signSession` and `verifySession` to accept `AdminScope`, then add:

```ts
export function verifyCategorySession(
  env: Pick<CloudflareEnv, "SESSION_SECRET">,
  category: Category,
  cookieValue: string | undefined,
): Promise<boolean> {
  return verifySession(env, adminScopeForCategory(category), cookieValue);
}
```

- [ ] **Step 4: Reuse one login implementation for category and Daegu routes**

In `src/features/images/api.ts`, make `isAdminSession` call `verifyCategorySession`. Extract the current login body into:

```ts
interface AuthHandlerInput {
  request: Request;
  env: CloudflareEnv;
}

async function loginForScope(
  input: AuthHandlerInput,
  scope: AdminScope,
): Promise<Response> {
  const body = (await input.request.json().catch(() => null)) as
    | { id?: string; password?: string; remember?: boolean }
    | null;
  if (!body?.id || !body.password) {
    return error("아이디와 비밀번호를 입력하세요.", 400);
  }
  if (!verifyAdminCredential(input.env, scope, body.id, body.password)) {
    return error("로그인 정보가 올바르지 않습니다.", 401);
  }

  const session = await signSession(input.env, scope);
  return json(
    { ok: true },
    {
      status: 200,
      headers: {
        "Set-Cookie": createSessionCookie(
          session,
          input.env.APP_ENV,
          body.remember === true,
        ),
      },
    },
  );
}
```

Make `handleLogin` parse the category and call `loginForScope(input, adminScopeForCategory(category))`. Export:

```ts
export function handleDaeguLogin(input: AuthHandlerInput): Promise<Response> {
  return loginForScope(input, "daegu");
}
```

Create `src/app/api/daegu/auth/login/route.ts`:

```ts
import { handleDaeguLogin } from "@/features/images/api";
import { getCloudflareEnv } from "@/lib/cloudflare";

export function POST(request: Request) {
  return handleDaeguLogin({ request, env: getCloudflareEnv() });
}
```

Create `src/app/api/daegu/auth/logout/route.ts`:

```ts
import { handleLogout } from "@/features/images/api";

export function POST() {
  return handleLogout();
}
```

- [ ] **Step 5: Run focused tests and type checking**

```powershell
npm test -- src/lib/auth.test.ts src/features/images/api.test.ts
npm run typecheck
```

Expected: tests PASS and TypeScript reports no errors.

- [ ] **Step 6: Commit the Daegu authentication scope**

```powershell
git add src/lib/auth.ts src/lib/auth.test.ts src/features/images/api.ts src/features/images/api.test.ts src/app/api/daegu/auth/login/route.ts src/app/api/daegu/auth/logout/route.ts
git commit -m "feat: add shared Daegu admin session"
```

### Task 3: Build the unified login hub and list navigation

**Files:**
- Modify: `src/components/admin/login-form.test.tsx`
- Modify: `src/components/admin/login-form.tsx`
- Create: `src/components/admin/daegu-admin-hub.test.tsx`
- Create: `src/components/admin/daegu-admin-hub.tsx`
- Create: `src/components/admin/daegu-admin-nav.test.tsx`
- Create: `src/components/admin/daegu-admin-nav.tsx`
- Modify: `src/components/admin/image-list.test.tsx`
- Modify: `src/components/admin/image-list.tsx`

- [ ] **Step 1: Write failing login-scope, hub, navigation, and logout tests**

Change current login-form renders from `category="library"` to `scope="library"`. Add:

```tsx
test("posts Daegu credentials and stores one Daegu saved id", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetchMock);
  render(<LoginForm scope="daegu" />);

  await userEvent.type(screen.getByLabelText("아이디"), "daegu-admin");
  await userEvent.type(screen.getByLabelText("비밀번호"), "daegu-pass");
  await userEvent.click(screen.getByLabelText("아이디 저장"));
  await userEvent.click(screen.getByRole("button", { name: "로그인" }));

  expect(fetchMock).toHaveBeenCalledWith(
    "/api/daegu/auth/login",
    expect.objectContaining({ method: "POST" }),
  );
  expect(window.localStorage.getItem("uim:daegu:saved-admin-id")).toBe(
    "daegu-admin",
  );
});
```

Create `src/components/admin/daegu-admin-hub.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { DaeguAdminHub } from "./daegu-admin-hub";

describe("DaeguAdminHub", () => {
  test.each([
    ["나만의 학교 만들기", "/school/admin"],
    ["나만의 음악 만들기", "/music/admin"],
    ["MBTI", "/mbti/admin"],
  ])("links %s to its admin list", (name, href) => {
    render(<DaeguAdminHub />);
    expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
  });
});
```

Create `src/components/admin/daegu-admin-nav.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { DaeguAdminNav } from "./daegu-admin-nav";

describe("DaeguAdminNav", () => {
  test("renders all Daegu list links and marks the current category", () => {
    render(<DaeguAdminNav current="mbti" />);

    expect(screen.getByRole("link", { name: "나만의 학교 만들기" })).toHaveAttribute(
      "href",
      "/school/admin",
    );
    expect(screen.getByRole("link", { name: "나만의 음악 만들기" })).toHaveAttribute(
      "href",
      "/music/admin",
    );
    expect(screen.getByRole("link", { name: "MBTI" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
```

Add an MBTI heading case to `image-list.test.tsx`, assert all three nav links for an MBTI list, and update the Daegu logout case to expect:

```ts
expect(fetchMock).toHaveBeenCalledWith("/api/daegu/auth/logout", {
  method: "POST",
});
expect(window.location.assign).toHaveBeenCalledWith("/daegu/admin");
```

Keep the library logout test expecting `/api/library/auth/logout` and reload.

- [ ] **Step 2: Run component tests and verify RED**

```powershell
npm test -- src/components/admin/login-form.test.tsx src/components/admin/daegu-admin-hub.test.tsx src/components/admin/daegu-admin-nav.test.tsx src/components/admin/image-list.test.tsx
```

Expected: FAIL because the new props/components/navigation and Daegu logout behavior do not exist.

- [ ] **Step 3: Make LoginForm scope-aware**

Change its public contract to:

```ts
interface LoginFormProps {
  scope: Category | "daegu";
}
```

Apply these exact replacements; the rest of the form is unchanged:

```diff
-export function LoginForm({ category }: LoginFormProps) {
-  const savedIdStorageKey = `uim:${category}:saved-admin-id`;
+export function LoginForm({ scope }: LoginFormProps) {
+  const savedIdStorageKey = `uim:${scope}:saved-admin-id`;
@@
-    const response = await fetch(`/api/${category}/auth/login`, {
+    const response = await fetch(`/api/${scope}/auth/login`, {
```

- [ ] **Step 4: Implement the hub and shared navigation**

Create `daegu-admin-hub.tsx`:

```tsx
import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CATEGORY_LABELS, DAEGU_CATEGORIES } from "@/lib/categories";

export function DaeguAdminHub() {
  return (
    <main className="min-h-dvh bg-muted/30 px-4 py-8 text-foreground">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">대구 관리자</h1>
          <p className="text-sm text-muted-foreground">관리할 목록을 선택하세요.</p>
        </header>
        <div className="grid gap-4 md:grid-cols-3">
          {DAEGU_CATEGORIES.map((category) => (
            <Card key={category}>
              <CardHeader><CardTitle>{CATEGORY_LABELS[category]}</CardTitle></CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <a href={`/${category}/admin`}>
                    목록 열기 <ArrowRightIcon data-icon="inline-end" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
```

Create `daegu-admin-nav.tsx` with:

```tsx
export function DaeguAdminNav({ current }: { current: DaeguCategory }) {
  return (
    <nav aria-label="대구 관리자 섹션" className="border-b bg-muted/20">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap gap-2 px-4 py-3 md:px-8">
        {DAEGU_CATEGORIES.map((category) => (
          <Button
            key={category}
            asChild
            size="sm"
            variant={category === current ? "default" : "ghost"}
          >
            <a
              href={`/${category}/admin`}
              aria-current={category === current ? "page" : undefined}
            >
              {CATEGORY_LABELS[category]}
            </a>
          </Button>
        ))}
      </div>
    </nav>
  );
}
```

- [ ] **Step 5: Integrate navigation and scope-aware logout into ImageList**

Add `DaeguAdminNav` and `isDaeguCategory` imports, define:

```ts
const daeguCategory = isDaeguCategory(category);
```

Replace `logout` with:

```ts
async function logout() {
  setLoggingOut(true);
  setLogoutError(null);
  try {
    const scope = daeguCategory ? "daegu" : category;
    const response = await fetch(`/api/${scope}/auth/logout`, { method: "POST" });
    if (response.ok) {
      if (daeguCategory) {
        window.location.assign("/daegu/admin");
      } else {
        window.location.reload();
      }
      return;
    }
  } catch {
    // Continue to the shared error state.
  }
  setLoggingOut(false);
  setLogoutError("로그아웃에 실패했습니다.");
}
```

Wrap the current main element with this fragment:

```diff
 return (
+  <>
+    {daeguCategory ? <DaeguAdminNav current={category} /> : null}
     <main className="min-h-dvh bg-background px-4 py-6 text-foreground md:px-8">
@@
     </main>
+  </>
 );
```

- [ ] **Step 6: Run component tests and verify GREEN**

Run the Step 2 command again.

Expected: all selected component tests PASS.

- [ ] **Step 7: Commit the unified admin components**

```powershell
git add src/components/admin/login-form.tsx src/components/admin/login-form.test.tsx src/components/admin/daegu-admin-hub.tsx src/components/admin/daegu-admin-hub.test.tsx src/components/admin/daegu-admin-nav.tsx src/components/admin/daegu-admin-nav.test.tsx src/components/admin/image-list.tsx src/components/admin/image-list.test.tsx
git commit -m "feat: add Daegu admin hub and navigation"
```

### Task 4: Wire the unified page and category redirects

**Files:**
- Create: `src/app/daegu/admin/page.tsx`
- Modify: `src/app/[category]/admin/page.tsx`
- Modify: `src/app/[category]/admin/usage/page.tsx`
- Modify: `src/components/admin/usage-report.test.tsx`
- Modify: `src/components/admin/usage-report.tsx`
- Modify: `tests/e2e/admin.spec.ts`
- Modify: `playwright.config.ts`

- [ ] **Step 1: Write the failing Daegu admin E2E flow**

Extend `tests/e2e/admin.spec.ts`:

```ts
test("Daegu admin logs in once selects a category and switches lists", async ({
  page,
}) => {
  await page.goto("/music/admin");
  await expect(page).toHaveURL(/\/daegu\/admin$/);

  await page.getByLabel("아이디", { exact: true }).fill("daegu-admin");
  await page.getByLabel("비밀번호").fill("daegu-pass");
  await page.getByRole("button", { name: "로그인" }).click();

  await expect(
    page.getByRole("link", { name: "나만의 학교 만들기" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "MBTI" }).click();
  await expect(page).toHaveURL(/\/mbti\/admin$/);
  await expect(
    page.getByRole("navigation", { name: "대구 관리자 섹션" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "나만의 음악 만들기" }).click();
  await expect(page).toHaveURL(/\/music\/admin$/);
});
```

Change Playwright's readiness URL to `/daegu/admin`.

- [ ] **Step 2: Run the focused E2E and verify RED**

```powershell
npm run e2e -- tests/e2e/admin.spec.ts
```

Expected: FAIL because `/daegu/admin` and grouped page authorization do not exist.

- [ ] **Step 3: Implement the unified server page**

Create `src/app/daegu/admin/page.tsx`:

```tsx
import { cookies } from "next/headers";
import { DaeguAdminHub } from "@/components/admin/daegu-admin-hub";
import { LoginForm } from "@/components/admin/login-form";
import { SESSION_COOKIE_NAME, verifySession } from "@/lib/auth";
import { getCloudflareEnv } from "@/lib/cloudflare";

export const dynamic = "force-dynamic";

export default async function DaeguAdminPage() {
  const env = getCloudflareEnv();
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const authenticated = await verifySession(env, "daegu", session);

  return authenticated ? <DaeguAdminHub /> : <LoginForm scope="daegu" />;
}
```

- [ ] **Step 4: Apply the same access policy to list and usage pages**

In both dynamic admin pages, replace `verifySession(env, category, session)` with:

```ts
const authenticated = await verifyCategorySession(env, category, session);
```

When unauthenticated, use:

```tsx
if (isDaeguCategory(category)) {
  redirect("/daegu/admin");
}
return <LoginForm scope={category} />;
```

Keep their existing data loading after authentication. Update `UsageReport` to show `DaeguAdminNav` for grouped categories, and add the corresponding component assertion to `usage-report.test.tsx`.

Add this unit case to `usage-report.test.tsx`:

```tsx
test("shows Daegu navigation on a grouped usage report", () => {
  render(
    <UsageReport
      category="mbti"
      initialSummary={{ period: "day", total: 0, buckets: [] }}
    />,
  );
  expect(
    screen.getByRole("navigation", { name: "대구 관리자 섹션" }),
  ).toBeInTheDocument();
});
```

Import `DaeguAdminNav` and `isDaeguCategory`, then wrap the current main element:

```diff
+const daeguCategory = isDaeguCategory(category);
 return (
+  <>
+    {daeguCategory ? <DaeguAdminNav current={category} /> : null}
     <main className="min-h-dvh bg-background px-4 py-6 text-foreground md:px-8">
@@
     </main>
+  </>
 );
```

- [ ] **Step 5: Run focused tests and verify GREEN**

```powershell
npm test -- src/components/admin/usage-report.test.tsx
npm run e2e -- tests/e2e/admin.spec.ts
npm run typecheck
```

Expected: unit/E2E tests PASS and type checking reports no errors.

- [ ] **Step 6: Commit page integration**

```powershell
git add src/app/daegu/admin/page.tsx src/app/[category]/admin/page.tsx src/app/[category]/admin/usage/page.tsx src/components/admin/usage-report.tsx src/components/admin/usage-report.test.tsx tests/e2e/admin.spec.ts playwright.config.ts
git commit -m "feat: unify Daegu admin entry"
```

### Task 5: Replace the MBTI echo route with image behavior

**Files:**
- Delete: `src/app/mbti/[type]/route.ts`
- Modify: `tests/e2e/routing.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Write the failing image-route E2E contract**

Replace the first routing E2E with:

```ts
test("GET /mbti/[uid] uses the image viewer route instead of JSON echo", async ({
  request,
}) => {
  const response = await request.get("/mbti/missing-image");

  expect(response.status()).toBe(404);
  expect(response.headers()["content-type"]).toContain("text/html");
  expect(await response.text()).toContain("이미지를 찾을 수 없습니다.");
});
```

- [ ] **Step 2: Run the routing E2E and verify RED**

```powershell
npm run e2e -- tests/e2e/routing.spec.ts
```

Expected: FAIL because the existing static MBTI route still returns HTTP 200 JSON.

- [ ] **Step 3: Remove the obsolete route**

Delete `src/app/mbti/[type]/route.ts`, allowing the dynamic `src/app/[category]/[uid]/page.tsx` route to own `/mbti/[uid]`.

- [ ] **Step 4: Run the routing E2E and verify GREEN**

```powershell
npm run e2e -- tests/e2e/routing.spec.ts
```

Expected: both MBTI viewer routing and root 404 tests PASS.

- [ ] **Step 5: Update README**

Document five categories, `POST /api/mbti/images`, `/mbti/{uid}`, `/daegu/admin`, the shared Daegu login/session, category switching, and the removal of the MBTI echo response. Preserve all current library, nakdong, music audio, cleanup, and deployment documentation.

- [ ] **Step 6: Commit MBTI route and documentation changes**

```powershell
git add tests/e2e/routing.spec.ts README.md
git rm -- src/app/mbti/[type]/route.ts
git commit -m "feat: serve MBTI images"
```

### Task 6: Full verification and worktree audit

**Files:**
- Verify all source, test, migration, and documentation changes from Tasks 1-5.

- [ ] **Step 1: Run the complete unit suite**

```powershell
npm test
```

Expected: all Vitest files PASS with zero failures.

- [ ] **Step 2: Run static checks**

```powershell
npm run typecheck
npm run lint
```

Expected: both commands exit 0 with no errors.

- [ ] **Step 3: Run the production build**

```powershell
npm run build
```

Expected: Next.js production build completes successfully and lists `/daegu/admin` plus the static Daegu auth routes.

- [ ] **Step 4: Run all E2E tests**

```powershell
npm run e2e
```

Expected: all Playwright tests PASS.

- [ ] **Step 5: Audit the final diff without disturbing user changes**

```powershell
git status --short
git diff --check
git log --oneline -6
```

Expected: `git diff --check` is silent. The pre-existing `.vscode/` remains untracked. The user's long-label change is included in the intended category commit, and no unrelated file is staged or modified.
