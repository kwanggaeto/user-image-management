import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ImageList } from "./image-list";

function stubReload() {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { assign: vi.fn(), reload: vi.fn() },
  });
}

describe("ImageList", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    stubReload();
  });

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
              thumbnailKey: null,
              createAt: "2026-07-09T09:00:00.000+09:00",
              expireAt: "2026-07-16T09:00:00.000+09:00",
              thumbnailUrl: "/api/library/images/abc123/thumbnail",
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
    expect(screen.getByRole("link", { name: "이용 기록" })).toHaveAttribute(
      "href",
      "/library/admin/usage",
    );
    expect(screen.getByRole("img", { name: "photo.jpg" })).toHaveAttribute(
      "src",
      "/api/library/images/abc123/thumbnail",
    );
  });

  test("renders an empty state when there are no images", () => {
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
    expect(
      screen.getByRole("columnheader", { name: "듣기" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("first.mp3 재생")).not.toBeInTheDocument();

    await userEvent.click(listenButtons[0]);
    expect(screen.getByLabelText("first.mp3 재생")).toHaveAttribute(
      "src",
      "/api/music/images/music01/file",
    );
    expect(screen.getByLabelText("first.mp3 재생")).toHaveAttribute(
      "controls",
    );
    expect(screen.getByLabelText("first.mp3 재생")).not.toHaveAttribute(
      "autoplay",
    );

    await userEvent.click(listenButtons[1]);
    expect(screen.queryByLabelText("first.mp3 재생")).not.toBeInTheDocument();
    expect(screen.getByLabelText("second.wav 재생")).toHaveAttribute(
      "src",
      "/api/music/images/music02/file",
    );

    await userEvent.click(listenButtons[1]);
    expect(screen.queryByLabelText("second.wav 재생")).not.toBeInTheDocument();
  });

  test("logs out through the category scoped endpoint and reloads", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

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

    await userEvent.click(screen.getByRole("button", { name: "로그아웃" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/library/auth/logout", {
      method: "POST",
    });
    expect(window.location.reload).toHaveBeenCalled();
  });
});
