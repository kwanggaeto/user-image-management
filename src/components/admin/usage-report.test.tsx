import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { UsageReport } from "./usage-report";

describe("UsageReport", () => {
  test("renders total, period selector, and cumulative buckets", () => {
    render(
      <UsageReport
        category="library"
        initialSummary={{
          period: "day",
          total: 3,
          buckets: [
            { label: "2026-07-09", count: 1, cumulative: 1 },
            { label: "2026-07-10", count: 2, cumulative: 3 },
          ],
        }}
      />,
    );

    expect(screen.getByText("이용 기록")).toBeInTheDocument();
    expect(screen.getByText("전체 3회")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "집계 기간" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "이미지 목록" })).toHaveAttribute(
      "href",
      "/library/admin",
    );
    expect(screen.getByText("2026-07-10")).toBeInTheDocument();
    expect(screen.getByText("2회")).toBeInTheDocument();
    expect(screen.getAllByText("3회").length).toBeGreaterThan(0);
  });
});
