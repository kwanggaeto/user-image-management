import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { DaeguAdminHub } from "./daegu-admin-hub";

describe("DaeguAdminHub", () => {
  test("offers links to all Daegu admin sections", () => {
    render(<DaeguAdminHub />);

    expect(
      screen.getByRole("heading", { name: "대구 관리자" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "나만의 학교 만들기" }),
    ).toHaveAttribute(
      "href",
      "/school/admin",
    );
    expect(
      screen.getByRole("link", { name: "나만의 음악 만들기" }),
    ).toHaveAttribute(
      "href",
      "/music/admin",
    );
    expect(screen.getByRole("link", { name: "MBTI" })).toHaveAttribute(
      "href",
      "/mbti/admin",
    );
  });
});
