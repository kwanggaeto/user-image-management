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

  test("creates schema and retries when the images table is missing", async () => {
    const missingTableStatement = {
      bind: vi.fn().mockReturnThis(),
      all: vi
        .fn()
        .mockRejectedValue(new Error("D1_ERROR: no such table: images: SQLITE_ERROR")),
    };
    const schemaStatement = createStatement({ meta: {} });
    const listStatement = createStatement({ results: [] });
    const countStatement = createStatement({ total: 0 });
    let listAttempts = 0;
    const db = {
      prepare: vi.fn((sql: string) => {
        if (sql.includes("SELECT id, uid, category, filename, key, createAt, expireAt")) {
          listAttempts += 1;
          return listAttempts === 1 ? missingTableStatement : listStatement;
        }
        if (sql.includes("SELECT COUNT(*) AS total")) {
          return countStatement;
        }
        if (sql.includes("CREATE TABLE") || (sql.includes("CREATE") && sql.includes("INDEX"))) {
          return schemaStatement;
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      }),
    } as unknown as D1Database;

    const result = await createD1ImageRepository(db).list("library", 1, 10);

    expect(result).toEqual({ items: [], total: 0 });
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining("CREATE TABLE IF NOT EXISTS images"));
    expect(listAttempts).toBe(2);
  });
});
