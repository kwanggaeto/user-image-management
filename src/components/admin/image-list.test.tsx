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
