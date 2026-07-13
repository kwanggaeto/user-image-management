import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("category expansion migration", () => {
  test("preserves rows while rebuilding both constrained tables", () => {
    const migrationPath = path.resolve(
      process.cwd(),
      "migrations/0003_expand_categories.sql",
    );

    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, "utf8");
    expect(
      sql.match(
        /CHECK \(category IN \('library', 'nakdong', 'music', 'school'\)\)/g,
      ),
    ).toHaveLength(2);
    expect(sql).toContain("INSERT INTO images_next");
    expect(sql).toContain(
      "SELECT id, uid, category, filename, key, thumbnailKey, createAt, expireAt",
    );
    expect(sql).toContain("INSERT INTO usage_records_next");
    expect(sql).toContain("SELECT id, category, createdAt");
    expect(sql).toContain("CREATE UNIQUE INDEX images_category_uid_idx");
    expect(sql).toContain(
      "CREATE INDEX usage_records_category_createdAt_idx",
    );
  });
});
