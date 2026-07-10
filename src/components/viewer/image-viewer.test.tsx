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
    const main = screen.getByRole("main");

    expect(image).toHaveAttribute(
      "src",
      "/api/nakdong/images/nak12345/file",
    );
    expect(image).toHaveClass("block", "h-auto", "w-full");
    expect(image).not.toHaveClass("max-h-[78dvh]");
    expect(image).not.toHaveClass("rounded-md");
    expect(image).not.toHaveClass("object-contain");
    expect(main).toHaveClass("w-full");
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
