import { describe, expect, test } from "vitest";
import {
  CATEGORY_LABELS,
  parseCategory,
  parsePage,
  parsePageSize,
} from "./categories";

describe("parseCategory", () => {
  test("accepts library and nakdong", () => {
    expect(parseCategory("library")).toBe("library");
    expect(parseCategory("nakdong")).toBe("nakdong");
  });

  test("rejects unknown category values", () => {
    expect(() => parseCategory("museum")).toThrow("Invalid category");
  });

  test("exposes Korean labels for admin UI headings", () => {
    expect(CATEGORY_LABELS.library).toBe("국립중앙도서관");
    expect(CATEGORY_LABELS.nakdong).toBe("낙동강");
  });
});

describe("pagination parsing", () => {
  test("defaults page to 1", () => {
    expect(parsePage(null)).toBe(1);
  });

  test("normalizes invalid page to 1", () => {
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-3")).toBe(1);
    expect(parsePage("abc")).toBe(1);
  });

  test("allows page sizes 10, 20, and 30", () => {
    expect(parsePageSize("10")).toBe(10);
    expect(parsePageSize("20")).toBe(20);
    expect(parsePageSize("30")).toBe(30);
  });

  test("defaults unsupported page size to 10", () => {
    expect(parsePageSize(null)).toBe(10);
    expect(parsePageSize("15")).toBe(10);
  });
});
