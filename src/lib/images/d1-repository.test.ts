import { describe, expect, test, vi } from "vitest";
import { DuplicateImageUidError } from "./types";
import {
  createD1ImageRepository,
  createD1UsageRepository,
} from "./d1-repository";

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
      thumbnailKey: "images/library/abc123/thumbnail.webp",
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
      "images/library/abc123/thumbnail.webp",
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
          thumbnailKey: "images/library/abc123/thumbnail.webp",
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
    expect(result.items[0]?.thumbnailKey).toBe(
      "images/library/abc123/thumbnail.webp",
    );
    expect(listStatement.bind).toHaveBeenCalledWith("library", 10, 0);
  });

  test("throws DuplicateImageUidError on category uid constraint failure", async () => {
    const statement = {
      bind: vi.fn().mockReturnThis(),
      run: vi
        .fn()
        .mockRejectedValue(
          new Error(
            "D1_ERROR: UNIQUE constraint failed: images.category, images.uid",
          ),
        ),
    };
    const db = {
      prepare: vi.fn().mockReturnValue(statement),
    } as unknown as D1Database;

    await expect(
      createD1ImageRepository(db).insert({
        uid: "abc12345",
        category: "library",
        filename: "photo.jpg",
        key: "images/library/abc12345/photo.jpg",
        thumbnailKey: "images/library/abc12345/thumbnail.webp",
        createAt: "2026-07-09T09:00:00.000+09:00",
        expireAt: "2026-07-16T09:00:00.000+09:00",
      }),
    ).rejects.toBeInstanceOf(DuplicateImageUidError);
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
        if (sql.includes("SELECT id, uid, category, filename, key, thumbnailKey, createAt, expireAt")) {
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
    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining(
        "CHECK (category IN ('library', 'nakdong', 'music', 'school', 'mbti'))",
      ),
    );
    expect(listAttempts).toBe(2);
  });

  test("adds thumbnailKey column and retries when the deployed schema is old", async () => {
    const missingColumnStatement = {
      bind: vi.fn().mockReturnThis(),
      all: vi
        .fn()
        .mockRejectedValue(new Error("D1_ERROR: no such column: thumbnailKey")),
    };
    const alterStatement = createStatement({ meta: {} });
    const listStatement = createStatement({ results: [] });
    const countStatement = createStatement({ total: 0 });
    let listAttempts = 0;
    const db = {
      prepare: vi.fn((sql: string) => {
        if (sql.includes("SELECT id, uid, category, filename, key, thumbnailKey, createAt, expireAt")) {
          listAttempts += 1;
          return listAttempts === 1 ? missingColumnStatement : listStatement;
        }
        if (sql.includes("SELECT COUNT(*) AS total")) {
          return countStatement;
        }
        if (sql.includes("ALTER TABLE images ADD COLUMN thumbnailKey")) {
          return alterStatement;
        }
        if (sql.includes("CREATE TABLE") || (sql.includes("CREATE") && sql.includes("INDEX"))) {
          return alterStatement;
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      }),
    } as unknown as D1Database;

    const result = await createD1ImageRepository(db).list("library", 1, 10);

    expect(result).toEqual({ items: [], total: 0 });
    expect(db.prepare).toHaveBeenCalledWith(
      "ALTER TABLE images ADD COLUMN thumbnailKey TEXT",
    );
    expect(listAttempts).toBe(2);
  });
});

describe("createD1UsageRepository", () => {
  test("inserts usage records and summarizes them by day", async () => {
    const insertStatement = createStatement({ meta: {} });
    const totalStatement = createStatement({ total: 3 });
    const bucketStatement = createStatement({
      results: [
        { bucket: "2026-07-09", count: 1 },
        { bucket: "2026-07-10", count: 2 },
      ],
    });
    const db = {
      prepare: vi
        .fn()
        .mockReturnValueOnce(insertStatement)
        .mockReturnValueOnce(totalStatement)
        .mockReturnValueOnce(bucketStatement),
    } as unknown as D1Database;
    const repository = createD1UsageRepository(db);

    await repository.insert({
      category: "library",
      createdAt: "2026-07-10T09:00:00.000+09:00",
    });
    const summary = await repository.summarize("library", "day");

    expect(insertStatement.bind).toHaveBeenCalledWith(
      "library",
      "2026-07-10T09:00:00.000+09:00",
    );
    expect(summary).toEqual({
      period: "day",
      total: 3,
      buckets: [
        { label: "2026-07-09", count: 1, cumulative: 1 },
        { label: "2026-07-10", count: 2, cumulative: 3 },
      ],
    });
  });

  test("uses month and year buckets for requested usage periods", async () => {
    const totalStatement = createStatement({ total: 0 });
    const bucketStatement = createStatement({ results: [] });
    const db = {
      prepare: vi
        .fn()
        .mockReturnValueOnce(totalStatement)
        .mockReturnValueOnce(bucketStatement),
    } as unknown as D1Database;
    const repository = createD1UsageRepository(db);

    await repository.summarize("nakdong", "month");

    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining("substr(createdAt, 1, 7) AS bucket"),
    );
  });
});
