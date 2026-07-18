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
    expect(
      screen.getByText("2026-07-13T09:00:00.000+09:00"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "원본 다운로드" }),
    ).toHaveAttribute("href", "/api/music/images/music01/download");
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
    expect(
      screen.getByRole("link", { name: "원본 다운로드" }),
    ).toHaveAttribute("href", "/api/school/images/school01/download");
  });

  test("keeps the standard image viewer for MBTI", () => {
    render(
      <ImageViewer
        image={{
          id: 5,
          uid: "intj01",
          category: "mbti",
          filename: "intj.png",
          key: "images/mbti/intj01/intj.png",
          thumbnailKey: "images/mbti/intj01/thumbnail.webp",
          createAt: "2026-07-19T09:00:00.000+09:00",
          expireAt: "2026-07-26T09:00:00.000+09:00",
        }}
      />,
    );

    expect(screen.getByAltText("intj.png")).toHaveAttribute(
      "src",
      "/api/mbti/images/intj01/file",
    );
    expect(
      screen.getByRole("link", { name: "원본 다운로드" }),
    ).toHaveAttribute("href", "/api/mbti/images/intj01/download");
  });
});
