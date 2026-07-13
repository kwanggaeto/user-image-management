# Music Admin Audio Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show audio-specific asset wording throughout the `music` admin list while preserving image wording for every other category.

**Architecture:** Keep the shared `ImageList` component and derive one category-aware asset label inside it. Reuse that label in the page heading, total count, empty-state title, and delete-confirmation title; no routing, API, data, or component-boundary changes are needed.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Vitest, Testing Library, shadcn/ui

---

## File map

- `src/components/admin/image-list.test.tsx`: verify all four music copy locations and the existing library wording.
- `src/components/admin/image-list.tsx`: derive and reuse the `오디오` or `이미지` asset label.

### Task 1: Make admin asset wording category-aware

**Files:**
- Modify: `src/components/admin/image-list.test.tsx`
- Modify: `src/components/admin/image-list.tsx`

- [ ] **Step 1: Add failing assertions for populated music and library lists**

In `src/components/admin/image-list.test.tsx`, add these assertions to the existing `renders thumbnails uid times and page size control` library test after `render(...)`:

```tsx
expect(
  screen.getByRole("heading", { name: "업로드 이미지" }),
).toBeInTheDocument();
expect(screen.getByText("총 1개 이미지")).toBeInTheDocument();
```

At the end of that library test, open the existing delete dialog and assert that the image wording remains unchanged:

```tsx
await userEvent.click(screen.getByRole("button", { name: "abc123 삭제" }));
expect(
  screen.getByRole("heading", { name: "이미지를 삭제할까요?" }),
).toBeInTheDocument();
```

Because this introduces `await`, change the test callback to `async () =>`.

In the existing `shows one toggleable music player instead of thumbnails` test, add these assertions after `render(...)` and before querying the listen buttons:

```tsx
expect(
  screen.getByRole("heading", { name: "업로드 오디오" }),
).toBeInTheDocument();
expect(screen.getByText("총 2개 오디오")).toBeInTheDocument();
```

At the end of that music test, open a delete dialog and assert its category-specific title:

```tsx
await userEvent.click(screen.getByRole("button", { name: "music01 삭제" }));
expect(
  screen.getByRole("heading", { name: "오디오를 삭제할까요?" }),
).toBeInTheDocument();
```

- [ ] **Step 2: Add a failing music empty-state test**

Add this test beside the existing library empty-state test:

```tsx
test("renders audio wording for an empty music list", () => {
  render(
    <ImageList
      category="music"
      initialData={{
        items: [],
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 1,
      }}
    />,
  );

  expect(
    screen.getByRole("heading", { name: "업로드 오디오" }),
  ).toBeInTheDocument();
  expect(screen.getByText("총 0개 오디오")).toBeInTheDocument();
  expect(screen.getByText("등록된 오디오가 없습니다.")).toBeInTheDocument();
  expect(screen.queryByText("등록된 이미지가 없습니다.")).not.toBeInTheDocument();
});
```

Keep the existing `renders an empty state when there are no images` library test as the regression test for `등록된 이미지가 없습니다.`.

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```bash
npm test -- src/components/admin/image-list.test.tsx
```

Expected: FAIL because the current shared component still renders `업로드 이미지`, `총 N개 이미지`, `등록된 이미지가 없습니다.`, and `이미지를 삭제할까요?` for music.

- [ ] **Step 4: Derive the asset label once**

In `src/components/admin/image-list.tsx`, add this constant immediately after the existing `title` constant:

```ts
const assetLabel = category === "music" ? "오디오" : "이미지";
```

This keeps all non-music categories on the current image wording without expanding the global category configuration.

- [ ] **Step 5: Reuse the label in all four visible strings**

Replace the page heading and total count with:

```tsx
<h1 className="text-2xl font-semibold">업로드 {assetLabel}</h1>
<p className="text-sm text-muted-foreground">
  총 {data.total}개 {assetLabel}
</p>
```

Replace the empty-state title with:

```tsx
<EmptyTitle>등록된 {assetLabel}가 없습니다.</EmptyTitle>
```

Replace the delete confirmation title with:

```tsx
<AlertDialogTitle>{assetLabel}를 삭제할까요?</AlertDialogTitle>
```

Do not change the shared empty-state description, delete behavior, audio player, API paths, or category headings.

- [ ] **Step 6: Run focused and full verification and confirm GREEN**

Run:

```bash
npm test -- src/components/admin/image-list.test.tsx
npm test
npm run typecheck
npm run lint
git diff --check
```

Expected: the focused file passes with music audio wording and library image wording; all 15 Vitest files pass; typecheck, lint, and whitespace checks exit 0.

- [ ] **Step 7: Inspect and commit the change**

Run:

```bash
git diff -- src/components/admin/image-list.tsx src/components/admin/image-list.test.tsx
git status --short
git add src/components/admin/image-list.tsx src/components/admin/image-list.test.tsx
git commit -m "fix: use audio wording in music admin"
```

Expected: only the two approved admin files are changed before the commit, and the worktree is clean after it.
