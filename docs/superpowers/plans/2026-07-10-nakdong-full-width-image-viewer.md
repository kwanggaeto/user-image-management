# Nakdong Full-Width Image Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render only an edge-to-edge, natural-height image on `nakdong` public viewer pages while preserving the existing `library` viewer exactly.

**Architecture:** Keep the shared public route and `ImageViewer` component. Add an early `image.category === "nakdong"` render branch containing only the image; leave the existing JSX as the `library` path so API, persistence, and error handling remain unchanged.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Vitest, Testing Library

---

## File Structure

- Modify `src/components/viewer/image-viewer.test.tsx`: specify the new `nakdong` rendering contract and strengthen the existing `library` regression contract.
- Modify `src/components/viewer/image-viewer.tsx`: add the category-specific early return; retain the existing viewer markup for `library`.

No route, API, database, global CSS, or E2E fixture changes are required.

### Task 1: Add the Category-Specific Viewer Behavior

**Files:**
- Modify: `src/components/viewer/image-viewer.test.tsx`
- Modify: `src/components/viewer/image-viewer.tsx`

- [ ] **Step 1: Write the failing component tests**

Replace `src/components/viewer/image-viewer.test.tsx` with:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ImageViewer } from "./image-viewer";

describe("ImageViewer", () => {
  test("keeps the existing library image view", () => {
    render(
      <ImageViewer
        image={{
          id: 1,
          uid: "abc12345",
          category: "library",
          filename: "photo.jpg",
          key: "images/library/abc12345/photo.jpg",
          thumbnailKey: null,
          createAt: "2026-07-09T09:00:00.000+09:00",
          expireAt: "2026-07-16T09:00:00.000+09:00",
        }}
      />,
    );

    const image = screen.getByAltText("photo.jpg");

    expect(image).toHaveAttribute(
      "src",
      "/api/library/images/abc12345/file",
    );
    expect(image).toHaveClass(
      "max-h-[78dvh]",
      "w-full",
      "rounded-md",
      "object-contain",
    );
    expect(screen.getByText("abc12345")).toBeInTheDocument();
    expect(
      screen.getByText("2026-07-09T09:00:00.000+09:00"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "원본 다운로드" })).toHaveAttribute(
      "href",
      "/api/library/images/abc12345/download",
    );
  });

  test("renders only an edge-to-edge natural-height image for nakdong", () => {
    render(
      <ImageViewer
        image={{
          id: 2,
          uid: "nak12345",
          category: "nakdong",
          filename: "nakdong.jpg",
          key: "images/nakdong/nak12345/nakdong.jpg",
          thumbnailKey: null,
          createAt: "2026-07-10T09:00:00.000+09:00",
          expireAt: "2026-07-17T09:00:00.000+09:00",
        }}
      />,
    );

    const image = screen.getByAltText("nakdong.jpg");

    expect(image).toHaveAttribute(
      "src",
      "/api/nakdong/images/nak12345/file",
    );
    expect(image).toHaveClass("block", "h-auto", "w-full");
    expect(image).not.toHaveClass("max-h-[78dvh]");
    expect(image).not.toHaveClass("rounded-md");
    expect(image).not.toHaveClass("object-contain");
    expect(screen.getByRole("main").children).toHaveLength(1);
    expect(screen.getByRole("main").firstElementChild).toBe(image);
    expect(screen.queryByText("nak12345")).not.toBeInTheDocument();
    expect(
      screen.queryByText("2026-07-10T09:00:00.000+09:00"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "원본 다운로드" }),
    ).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm test -- src/components/viewer/image-viewer.test.tsx
```

Expected: FAIL in `renders only an edge-to-edge natural-height image for nakdong`; the current shared image lacks `block` and `h-auto` and still renders UID, date, and the download link.

- [ ] **Step 3: Add the minimal `nakdong` render branch**

In `src/components/viewer/image-viewer.tsx`, keep the imports and `ImageViewerProps` unchanged and replace the component function with:

```tsx
export function ImageViewer({ image }: ImageViewerProps) {
  if (image.category === "nakdong") {
    return (
      <main className="w-full">
        <img
          src={`/api/${image.category}/images/${image.uid}/file`}
          alt={image.filename}
          className="block h-auto w-full"
        />
      </main>
    );
  }

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

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
npm test -- src/components/viewer/image-viewer.test.tsx
```

Expected: both `ImageViewer` tests PASS with no warnings or errors.

- [ ] **Step 5: Review the focused diff**

Run:

```powershell
git diff --check
git diff -- src/components/viewer/image-viewer.tsx src/components/viewer/image-viewer.test.tsx
```

Expected: no whitespace errors; only the category branch and its behavior tests appear.

- [ ] **Step 6: Commit the behavior change**

Run:

```powershell
git add -- src/components/viewer/image-viewer.tsx src/components/viewer/image-viewer.test.tsx
git commit -m "feat: simplify nakdong image viewer"
```

Expected: one commit containing exactly the viewer component and its test.

### Task 2: Run Full Verification

**Files:**
- Verify only; no planned file modifications.

- [ ] **Step 1: Run the complete unit test suite**

Run:

```powershell
npm test
```

Expected: all Vitest files and tests PASS with exit code 0.

- [ ] **Step 2: Run ESLint**

Run:

```powershell
npm run lint
```

Expected: exit code 0 with no lint errors.

- [ ] **Step 3: Run TypeScript validation**

Run:

```powershell
npm run typecheck
```

Expected: exit code 0 with no TypeScript diagnostics.

- [ ] **Step 4: Run the Cloudflare production build**

Run:

```powershell
npm run cf:build
```

Expected: OpenNext completes successfully and produces the Cloudflare worker bundle with exit code 0.

- [ ] **Step 5: Confirm repository state**

Run:

```powershell
git status --short
git log -3 --oneline
```

Expected: no tracked implementation changes remain. The pre-existing untracked `.vscode/` entry may remain untouched, and the new documentation and implementation commits are visible in recent history.
