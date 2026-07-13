# Music Audio Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change the `music` category from image handling to MP3/WAV upload, playback, and download while preserving the existing image behavior for `library`, `nakdong`, and `school`.

**Architecture:** Keep the shared image metadata table, R2 key layout, API routes, expiry, usage, deletion, and download service. Add category-aware upload validation at the API boundary, omit the optional thumbnail generator for `music`, and render category-specific audio controls in the existing admin list and public viewer components.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Cloudflare D1/R2/Images, Vitest, Testing Library, Playwright, Tailwind CSS, shadcn/ui, lucide-react

---

## File map

- `src/features/images/api.ts`: infer upload media MIME types, validate music files by extension and MIME, and prevent thumbnail generation for music.
- `src/features/images/api.test.ts`: prove MP3/WAV acceptance, MIME inference, invalid music rejection, original-only storage, and unchanged image behavior.
- `src/components/admin/image-list.tsx`: replace music thumbnails with a toggleable, single-open-row audio player.
- `src/components/admin/image-list.test.tsx`: verify music playback controls and preserve non-music thumbnails.
- `src/components/viewer/image-viewer.tsx`: render the music public page with audio playback, metadata, and download.
- `src/components/viewer/image-viewer.test.tsx`: verify the music-only audio branch and unchanged image branches.
- `README.md`: document the music upload contract and playback URLs.

### Task 1: Accept MP3/WAV music uploads without thumbnails

**Files:**
- Modify: `src/features/images/api.test.ts`
- Modify: `src/features/images/api.ts`

- [ ] **Step 1: Make the fake thumbnail generator observable**

Update the existing fake in `src/features/images/api.test.ts` so music tests can prove it was never invoked:

```ts
class FakeThumbnailGenerator implements ThumbnailGenerator {
  calls = 0;

  async generate(): Promise<Blob> {
    this.calls += 1;
    return new Response("thumb", {
      headers: { "Content-Type": "image/webp" },
    }).blob();
  }
}
```

- [ ] **Step 2: Write failing success tests for explicit and inferred music MIME types**

Add these tests inside `describe("handleImageUpload", ...)` in `src/features/images/api.test.ts`:

```ts
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
    expect(storage.objects.get(`images/music/music001/${filename}`)?.type).toBe(
      storedType,
    );
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
    expect(storage.objects.get(`images/music/music002/${filename}`)?.type).toBe(
      expectedType,
    );
  },
);
```

- [ ] **Step 3: Write failing rejection tests for images, other audio, and extension/MIME mismatches**

Add this parameterized test beside the music success cases:

```ts
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
```

Add `handleImageFile` to the import from `./api`, then add this shared-file-path regression test inside `describe("image file utilities", ...)`. It verifies that playback and download preserve the stored audio MIME and filename:

```ts
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
  expect(downloadResponse.headers.get("content-type")).toContain("audio/mpeg");
  expect(downloadResponse.headers.get("content-disposition")).toBe(
    'attachment; filename="track.mp3"',
  );
});
```

- [ ] **Step 4: Run the upload tests and confirm RED**

Run:

```bash
npm test -- src/features/images/api.test.ts
```

Expected: FAIL because `music` files are rejected by the current `image/*` check and octet-stream audio extensions are not inferred.

- [ ] **Step 5: Generalize MIME inference and add strict music validation**

In `src/features/images/api.ts`, rename `inferImageContentType` to `inferUploadContentType` at both call sites and replace its body with:

```ts
function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > -1 ? filename.slice(dot).toLowerCase() : "";
}

function inferUploadContentType(filename: string, contentType: string): string {
  if (contentType && contentType !== "application/octet-stream") {
    return contentType;
  }

  switch (fileExtension(filename)) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    default:
      return contentType;
  }
}

function isSupportedMusicFile(file: UploadedImageFile): boolean {
  const extension = fileExtension(file.name);
  if (extension === ".mp3") {
    return file.type === "audio/mpeg";
  }
  if (extension === ".wav") {
    return file.type === "audio/wav" || file.type === "audio/x-wav";
  }
  return false;
}
```

The multipart and `FormData` paths must both call the renamed helper:

```ts
const type = inferUploadContentType(headers.filename, headers.contentType);
```

```ts
const type = inferUploadContentType(file.name, file.type);
```

- [ ] **Step 6: Branch upload validation and thumbnail creation by category**

Replace the single image validation in `handleImageUpload` with:

```ts
if (category === "music") {
  if (!isSupportedMusicFile(file)) {
    return error("Only MP3 and WAV uploads are supported", 415);
  }
} else if (!file.type.startsWith("image/")) {
  return error("Only image uploads are supported", 415);
}
```

Then change the `createImage` input so the Cloudflare thumbnail generator factory is not evaluated for music:

```ts
thumbnailGenerator:
  category === "music" ? undefined : thumbnailGeneratorFor(input),
```

Keep the current missing-file status, token check, UID retry, usage record, expiry, R2 key, and response body unchanged.

- [ ] **Step 7: Run focused and full unit tests and confirm GREEN**

Run:

```bash
npm test -- src/features/images/api.test.ts
npm test
```

Expected: the focused API test file passes, then all unit/component test files pass; the existing library thumbnail test still stores both original and `thumbnail.webp`.

- [ ] **Step 8: Commit the upload behavior**

```bash
git add src/features/images/api.ts src/features/images/api.test.ts
git commit -m "feat: support music audio uploads"
```

### Task 2: Replace music thumbnails with one inline admin audio player

**Files:**
- Modify: `src/components/admin/image-list.test.tsx`
- Modify: `src/components/admin/image-list.tsx`

- [ ] **Step 1: Write a failing admin-list interaction test**

Add this test to `src/components/admin/image-list.test.tsx`:

```tsx
test("shows one toggleable music player instead of thumbnails", async () => {
  render(
    <ImageList
      category="music"
      initialData={{
        items: [
          {
            id: 1,
            uid: "music01",
            category: "music",
            filename: "first.mp3",
            key: "images/music/music01/first.mp3",
            thumbnailKey: null,
            createAt: "2026-07-13T09:00:00.000+09:00",
            expireAt: "2026-07-20T09:00:00.000+09:00",
            thumbnailUrl: "/api/music/images/music01/thumbnail",
          },
          {
            id: 2,
            uid: "music02",
            category: "music",
            filename: "second.wav",
            key: "images/music/music02/second.wav",
            thumbnailKey: null,
            createAt: "2026-07-13T10:00:00.000+09:00",
            expireAt: "2026-07-20T10:00:00.000+09:00",
            thumbnailUrl: "/api/music/images/music02/thumbnail",
          },
        ],
        page: 1,
        pageSize: 10,
        total: 2,
        totalPages: 1,
      }}
    />,
  );

  const listenButtons = screen.getAllByRole("button", { name: "듣기" });
  expect(screen.getByRole("columnheader", { name: "듣기" })).toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("first.mp3 재생")).not.toBeInTheDocument();

  await userEvent.click(listenButtons[0]);
  expect(screen.getByLabelText("first.mp3 재생")).toHaveAttribute(
    "src",
    "/api/music/images/music01/file",
  );
  expect(screen.getByLabelText("first.mp3 재생")).toHaveAttribute("controls");
  expect(screen.getByLabelText("first.mp3 재생")).not.toHaveAttribute("autoplay");

  await userEvent.click(listenButtons[1]);
  expect(screen.queryByLabelText("first.mp3 재생")).not.toBeInTheDocument();
  expect(screen.getByLabelText("second.wav 재생")).toHaveAttribute(
    "src",
    "/api/music/images/music02/file",
  );

  await userEvent.click(listenButtons[1]);
  expect(screen.queryByLabelText("second.wav 재생")).not.toBeInTheDocument();
});
```

Leave the existing library test intact; it is the regression check for the thumbnail image and public-view link.

- [ ] **Step 2: Run the component test and confirm RED**

Run:

```bash
npm test -- src/components/admin/image-list.test.tsx
```

Expected: FAIL because the music table still renders the `썸네일` header and image elements and has no `듣기` buttons.

- [ ] **Step 3: Add the single-open-row state and icon**

In `src/components/admin/image-list.tsx`, add `PlayIcon` to the `lucide-react` import and add the state beside the existing state variables:

```ts
const [playingUid, setPlayingUid] = useState<string | null>(null);
```

Use a single UID rather than one boolean per row so opening a second player always closes the first.

- [ ] **Step 4: Render music-specific header and first-column content**

Replace the first table header with:

```tsx
<TableHead>{category === "music" ? "듣기" : "썸네일"}</TableHead>
```

Replace the first `TableCell` in each row with this category branch:

```tsx
<TableCell>
  {category === "music" ? (
    <div className="flex min-w-[260px] flex-col items-start gap-2">
      <Button
        variant="outline"
        size="sm"
        aria-expanded={playingUid === image.uid}
        onClick={() =>
          setPlayingUid((current) =>
            current === image.uid ? null : image.uid,
          )
        }
      >
        <PlayIcon data-icon="inline-start" />
        듣기
      </Button>
      {playingUid === image.uid ? (
        <audio
          controls
          preload="metadata"
          src={`/api/music/images/${image.uid}/file`}
          aria-label={`${image.filename} 재생`}
          className="w-full"
        />
      ) : null}
    </div>
  ) : (
    <a
      href={`/${category}/${image.uid}`}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3"
    >
      <img
        src={image.thumbnailUrl}
        alt={image.filename}
        className="size-16 rounded-md border object-cover"
      />
      <ExternalLinkIcon data-icon="inline-end" />
    </a>
  )}
</TableCell>
```

Do not add `autoPlay`; playback must begin only after the user uses the browser controls.

- [ ] **Step 5: Run focused and related tests and confirm GREEN**

Run:

```bash
npm test -- src/components/admin/image-list.test.tsx
npm test -- src/components/admin
```

Expected: PASS; music renders no thumbnail, only one audio element can exist, and the library thumbnail regression test still passes.

- [ ] **Step 6: Commit the admin player**

```bash
git add src/components/admin/image-list.tsx src/components/admin/image-list.test.tsx
git commit -m "feat: add music playback to admin list"
```

### Task 3: Render audio playback and download on the public music page

**Files:**
- Modify: `src/components/viewer/image-viewer.test.tsx`
- Modify: `src/components/viewer/image-viewer.tsx`

- [ ] **Step 1: Replace the old shared music/school test with explicit music and school coverage**

In `src/components/viewer/image-viewer.test.tsx`, replace the existing `test.each(["music", "school"] ...)` block with:

```tsx
test("renders music as playable and downloadable audio", () => {
  render(
    <ImageViewer
      image={{
        id: 3,
        uid: "music01",
        category: "music",
        filename: "track.mp3",
        key: "images/music/music01/track.mp3",
        thumbnailKey: null,
        createAt: "2026-07-13T09:00:00.000+09:00",
        expireAt: "2026-07-20T09:00:00.000+09:00",
      }}
    />,
  );

  const player = screen.getByLabelText("track.mp3 재생");
  expect(player.tagName).toBe("AUDIO");
  expect(player).toHaveAttribute("controls");
  expect(player).toHaveAttribute("preload", "metadata");
  expect(player).not.toHaveAttribute("autoplay");
  expect(player).toHaveAttribute("src", "/api/music/images/music01/file");
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.getByText("music01")).toBeInTheDocument();
  expect(screen.getByText("2026-07-13T09:00:00.000+09:00")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "원본 다운로드" })).toHaveAttribute(
    "href",
    "/api/music/images/music01/download",
  );
});

test("keeps the standard image viewer for school", () => {
  render(
    <ImageViewer
      image={{
        id: 4,
        uid: "school01",
        category: "school",
        filename: "school.jpg",
        key: "images/school/school01/school.jpg",
        thumbnailKey: null,
        createAt: "2026-07-13T09:00:00.000+09:00",
        expireAt: "2026-07-20T09:00:00.000+09:00",
      }}
    />,
  );

  expect(screen.getByRole("main")).toHaveClass("bg-background");
  expect(screen.getByAltText("school.jpg")).toHaveAttribute(
    "src",
    "/api/school/images/school01/file",
  );
  expect(screen.getByRole("link", { name: "원본 다운로드" })).toHaveAttribute(
    "href",
    "/api/school/images/school01/download",
  );
});
```

Keep the existing dedicated `library` and `nakdong` tests unchanged.

- [ ] **Step 2: Run the viewer test and confirm RED**

Run:

```bash
npm test -- src/components/viewer/image-viewer.test.tsx
```

Expected: FAIL because the current music branch renders an `<img>` and no labeled `<audio>` player.

- [ ] **Step 3: Add the music-only public viewer branch**

In `src/components/viewer/image-viewer.tsx`, add this branch before the existing `nakdong` branch:

```tsx
if (image.category === "music") {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 py-6">
        <audio
          controls
          preload="metadata"
          src={`/api/music/images/${image.uid}/file`}
          aria-label={`${image.filename} 재생`}
          className="w-full"
        />
        <div className="flex flex-col gap-3 text-sm text-muted-foreground">
          <div className="flex flex-col gap-1">
            <span className="font-medium text-foreground">{image.uid}</span>
            <span>{image.createAt}</span>
          </div>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/music/images/${image.uid}/download`}>
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

Do not add autoplay. The existing `nakdong` black full-width image branch and default `library`/`school` image branch remain after it.

- [ ] **Step 4: Run focused and full unit tests and confirm GREEN**

Run:

```bash
npm test -- src/components/viewer/image-viewer.test.tsx
npm test
```

Expected: PASS; music has an audio element and download link, while library, nakdong, and school retain their current image layouts.

- [ ] **Step 5: Commit the public music viewer**

```bash
git add src/components/viewer/image-viewer.tsx src/components/viewer/image-viewer.test.tsx
git commit -m "feat: add public music player"
```

### Task 4: Document and verify the complete music workflow

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document the category-specific upload rules and example**

In the `## Upload API` section of `README.md`, preserve the existing library example and supported-category sentence, then add:

~~~~markdown
`music` accepts only MP3 (`.mp3`, `audio/mpeg`) and WAV (`.wav`, `audio/wav` or `audio/x-wav`) files. Music uploads store only the original R2 object and do not generate a thumbnail.

```bash
curl -X POST "http://127.0.0.1:3000/api/music/images" \
  -H "x-upload-token: your-upload-token" \
  -F "file=@./track.mp3;type=audio/mpeg"
```

The music admin list exposes a `듣기` button, and `/music/{uid}` provides playback plus the original download.
~~~~

- [ ] **Step 2: Run static checks**

Run:

```bash
npm run typecheck
npm run lint
git diff --check
```

Expected: all three commands exit 0 with no TypeScript, ESLint, or whitespace errors.

- [ ] **Step 3: Run the production build and E2E suite**

Run:

```bash
npm run build
npm run e2e
```

Expected: the Next.js production build completes successfully and every Playwright test passes. If the managed sandbox blocks Wrangler or browser cache writes outside the worktree, rerun only the blocked command with the required permission approval; do not change application code to bypass the environment restriction.

- [ ] **Step 4: Run the final unit regression suite**

Run:

```bash
npm test
```

Expected: every Vitest file and test passes, including the original root 404, MBTI, category routing, image upload, admin list, and image viewer coverage.

- [ ] **Step 5: Inspect the completed diff and worktree**

Run:

```bash
git diff --stat 0e06d91
git status --short
```

Expected: the diff contains only the approved music audio implementation, tests, README, and this plan; status shows only the intended uncommitted README change before the final commit.

- [ ] **Step 6: Commit the documentation**

```bash
git add README.md
git commit -m "docs: document music audio workflow"
```

- [ ] **Step 7: Verify the final branch state**

Run:

```bash
git status --short
git log --oneline -5
```

Expected: the worktree is clean and the recent history contains the upload, admin player, public viewer, documentation, and implementation-plan commits.
