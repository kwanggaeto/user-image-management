import { render, screen, within } from "@testing-library/react";
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

  test("renders thumbnails uid times and page size control", async () => {
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

    expect(
      screen.getByRole("heading", { name: "업로드 이미지" }),
    ).toBeInTheDocument();
    expect(screen.getByText("총 1개 이미지")).toBeInTheDocument();
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

    await userEvent.click(
      screen.getByRole("button", { name: "abc123 삭제" }),
    );
    expect(
      screen.getByRole("heading", { name: "이미지를 삭제할까요?" }),
    ).toBeInTheDocument();
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
    expect(
      screen.queryByText("등록된 이미지가 없습니다."),
    ).not.toBeInTheDocument();
  });

  test.each([
    ["music", "나만의 음악 만들기"],
    ["school", "나만의 학교 만들기"],
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

    expect(screen.getAllByText(heading).length).toBeGreaterThan(0);
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

    expect(
      screen.getByRole("heading", { name: "업로드 오디오" }),
    ).toBeInTheDocument();
    expect(screen.getByText("총 2개 오디오")).toBeInTheDocument();
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

    await userEvent.click(
      screen.getByRole("button", { name: "music01 삭제" }),
    );
    expect(
      screen.getByRole("heading", { name: "오디오를 삭제할까요?" }),
    ).toBeInTheDocument();
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

  test("logs out through the shared Daegu endpoint and returns to the hub", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ImageList
        category="mbti"
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

    expect(fetchMock).toHaveBeenCalledWith("/api/daegu/auth/logout", {
      method: "POST",
    });
    expect(window.location.assign).toHaveBeenCalledWith("/daegu/admin");
  });

  test("shows Daegu section navigation with the current category selected", () => {
    render(
      <ImageList
        category="mbti"
        initialData={{
          items: [],
          page: 1,
          pageSize: 10,
          total: 0,
          totalPages: 1,
        }}
      />,
    );

    const navigation = screen.getByRole("navigation", {
      name: "대구 관리자 섹션",
    });
    expect(
      within(navigation).getByRole("link", { name: "나만의 학교 만들기" }),
    ).toHaveAttribute("href", "/school/admin");
    expect(
      within(navigation).getByRole("link", { name: "나만의 음악 만들기" }),
    ).toHaveAttribute("href", "/music/admin");
    expect(
      within(navigation).getByRole("link", { name: "MBTI" }),
    ).toHaveAttribute("aria-current", "page");
  });
});
