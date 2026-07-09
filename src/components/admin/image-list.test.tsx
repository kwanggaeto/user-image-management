import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
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
              thumbnailKey: null,
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
    expect(screen.getByRole("img", { name: "photo.jpg" })).toHaveAttribute(
      "src",
      "/api/library/images/abc123/file",
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
});
