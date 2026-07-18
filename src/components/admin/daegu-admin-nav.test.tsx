import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { DaeguAdminNav } from "./daegu-admin-nav";

describe("DaeguAdminNav", () => {
  test("renders all Daegu list links and marks the current category", () => {
    render(<DaeguAdminNav current="mbti" />);

    expect(
      screen.getByRole("link", { name: "나만의 학교 만들기" }),
    ).toHaveAttribute("href", "/school/admin");
    expect(
      screen.getByRole("link", { name: "나만의 음악 만들기" }),
    ).toHaveAttribute("href", "/music/admin");
    expect(screen.getByRole("link", { name: "MBTI" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
