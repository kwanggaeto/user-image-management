# Nakdong Viewer Black Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give only the `nakdong` public image viewer a viewport-filling black background while preserving its image layout and the existing `library` viewer.

**Architecture:** Keep the current category branch inside `ImageViewer`. Add Tailwind background and minimum viewport-height classes to the existing `nakdong` main element; do not change routes, APIs, global CSS, data, or the `library` JSX.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Vitest, Testing Library

---

## File Structure

- Modify `src/components/viewer/image-viewer.test.tsx`: add category-specific background regression assertions.
- Modify `src/components/viewer/image-viewer.tsx`: add `min-h-dvh bg-black` to the existing `nakdong` main element.

No new files, global styles, routes, APIs, or data changes are required.

### Task 1: Add the Nakdong Black Background

**Files:**
- Modify: `src/components/viewer/image-viewer.test.tsx`
- Modify: `src/components/viewer/image-viewer.tsx`

- [ ] **Step 1: Write the failing component assertions**

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
    const main = screen.getByRole("main");

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
    expect(main).toHaveClass(
      "min-h-dvh",
      "bg-background",
      "text-foreground",
    );
    expect(main).not.toHaveClass("bg-black");
    expect(screen.getByText("abc12345")).toBeInTheDocument();
    expect(
      screen.getByText("2026-07-09T09:00:00.000+09:00"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "원본 다운로드" })).toHaveAttribute(
      "href",
      "/api/library/images/abc12345/download",
    );
  });

  test("renders the nakdong image on a viewport-filling black background", () => {
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
    const main = screen.getByRole("main");

    expect(image).toHaveAttribute(
      "src",
      "/api/nakdong/images/nak12345/file",
    );
    expect(image).toHaveClass("block", "h-auto", "w-full");
    expect(image).not.toHaveClass("max-h-[78dvh]");
    expect(image).not.toHaveClass("rounded-md");
    expect(image).not.toHaveClass("object-contain");
    expect(main).toHaveClass("min-h-dvh", "w-full", "bg-black");
    expect(main.children).toHaveLength(1);
    expect(main.firstElementChild).toBe(image);
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

Expected: the `library` test passes, and `renders the nakdong image on a viewport-filling black background` fails because the current `nakdong` main lacks `min-h-dvh` and `bg-black`.

- [ ] **Step 3: Add the minimal production classes**

In `src/components/viewer/image-viewer.tsx`, replace only the `nakdong` main opening tag:

```tsx
<main className="min-h-dvh w-full bg-black">
```

Keep the image and the entire `library` branch unchanged.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
npm test -- src/components/viewer/image-viewer.test.tsx
```

Expected: both `ImageViewer` tests pass with no warnings or errors.

- [ ] **Step 5: Review the focused diff**

Run:

```powershell
git diff --check
git diff -- src/components/viewer/image-viewer.tsx src/components/viewer/image-viewer.test.tsx
```

Expected: no whitespace errors; the production diff contains only the `nakdong` main class change, and the test diff contains only the background regression assertions and descriptive test name.

- [ ] **Step 6: Run complete verification**

Run:

```powershell
npm test
npm run lint
npm run typecheck
npm run cf:build
```

Expected: all commands exit 0. Vitest has no failing tests, ESLint has no errors, TypeScript has no diagnostics, and OpenNext reports a completed Cloudflare build.

- [ ] **Step 7: Commit the implementation**

Run:

```powershell
git add -- src/components/viewer/image-viewer.tsx src/components/viewer/image-viewer.test.tsx
git commit -m "style: add black background to nakdong viewer"
```

Expected: one commit containing exactly the viewer component and its test.
