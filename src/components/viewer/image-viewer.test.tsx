import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ImageViewer } from "./image-viewer";

describe("ImageViewer", () => {
  test("renders a mobile first image view", () => {
    render(
      <ImageViewer
        image={{
          id: 1,
          uid: "abc123",
          category: "library",
          filename: "photo.jpg",
          key: "images/library/abc123/photo.jpg",
          thumbnailKey: null,
          createAt: "2026-07-09T09:00:00.000+09:00",
          expireAt: "2026-07-16T09:00:00.000+09:00",
        }}
      />,
    );

    expect(screen.getByAltText("photo.jpg")).toHaveAttribute(
      "src",
      "/api/library/images/abc123/file",
    );
    expect(screen.getByText("abc123")).toBeInTheDocument();
  });
});
