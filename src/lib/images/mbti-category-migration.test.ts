import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("MBTI category migration", () => {
  test("rebuilds both constrained tables while preserving rows and indexes", () => {
    const migrationPath = path.resolve(
      process.cwd(),
      "migrations/0004_add_mbti_category.sql",
    );

    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, "utf8");
    expect(
      sql.match(
        /CHECK \(category IN \('library', 'nakdong', 'music', 'school', 'mbti'\)\)/g,
      ),
    ).toHaveLength(2);
    expect(sql).toContain("INSERT INTO images_next");
    expect(sql).toContain(
      "SELECT id, uid, category, filename, key, thumbnailKey, createAt, expireAt",
    );
    expect(sql).toContain("INSERT INTO usage_records_next");
    expect(sql).toContain("SELECT id, category, createdAt");
    expect(sql).toContain("CREATE UNIQUE INDEX images_category_uid_idx");
    expect(sql).toContain("CREATE INDEX images_category_createAt_idx");
    expect(sql).toContain("CREATE INDEX images_expireAt_idx");
    expect(sql).toContain(
      "CREATE INDEX usage_records_category_createdAt_idx",
    );
  });
});
