export const CATEGORIES = ["library", "nakdong"] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  library: "국립중앙도서관",
  nakdong: "낙동강",
};

export function parseCategory(value: string): Category {
  if (value === "library" || value === "nakdong") {
    return value;
  }

  throw new Error("Invalid category");
}

export function isCategory(value: string): value is Category {
  return value === "library" || value === "nakdong";
}

export function parsePage(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}

export function parsePageSize(value: string | null): 10 | 20 | 30 {
  if (value === "20") {
    return 20;
  }
  if (value === "30") {
    return 30;
  }
  return 10;
}
