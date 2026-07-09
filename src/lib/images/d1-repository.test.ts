import { describe, expect, test, vi } from "vitest";
import { createD1ImageRepository } from "./d1-repository";

function createStatement(result: unknown) {
  return {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(result),
    all: vi.fn().mockResolvedValue(result),
    run: vi.fn().mockResolvedValue(result),
  };
}

describe("createD1ImageRepository", () => {
  test("inserts image metadata with all fields", async () => {
    const statement = createStatement({ meta: { last_row_id: 1 } });
    const db = {
      prepare: vi.fn().mockReturnValue(statement),
    } as unknown as D1Database;
    const repository = createD1ImageRepository(db);

    const row = await repository.insert({
      uid: "abc123",
      category: "library",
      filename: "photo.jpg",
      key: "images/library/abc123/photo.jpg",
      createAt: "2026-07-09T09:00:00.000+09:00",
      expireAt: "2026-07-16T09:00:00.000+09:00",
    });

    expect(row.id).toBe(1);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO images"));
    expect(statement.bind).toHaveBeenCalledWith(
      "abc123",
      "library",
      "photo.jpg",
      "images/library/abc123/photo.jpg",
      "2026-07-09T09:00:00.000+09:00",
      "2026-07-16T09:00:00.000+09:00",
    );
  });

  test("lists rows for a category with total count", async () => {
    const listStatement = createStatement({
      results: [
        {
          id: 1,
          uid: "abc123",
          category: "library",
          filename: "photo.jpg",
          key: "images/library/abc123/photo.jpg",
          createAt: "2026-07-09T09:00:00.000+09:00",
          expireAt: "2026-07-16T09:00:00.000+09:00",
        },
      ],
    });
    const countStatement = createStatement({ total: 1 });
    const db = {
      prepare: vi.fn().mockReturnValueOnce(listStatement).mockReturnValueOnce(countStatement),
    } as unknown as D1Database;

    const result = await createD1ImageRepository(db).list("library", 1, 10);

    expect(result.total).toBe(1);
    expect(result.items[0]?.uid).toBe("abc123");
    expect(listStatement.bind).toHaveBeenCalledWith("library", 10, 0);
  });
});
