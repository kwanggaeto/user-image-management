import type { Category } from "@/lib/categories";
import { isExpiredBeforeTodayKst } from "@/lib/time";
import type { ImageRecord, ImageRepository } from "./types";

const IMAGE_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('library', 'nakdong')),
    filename TEXT NOT NULL,
    key TEXT NOT NULL,
    createAt TEXT NOT NULL,
    expireAt TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS images_category_uid_idx
    ON images(category, uid)`,
  `CREATE INDEX IF NOT EXISTS images_category_createAt_idx
    ON images(category, createAt DESC)`,
  `CREATE INDEX IF NOT EXISTS images_expireAt_idx
    ON images(expireAt)`,
];

function toImageRecord(row: unknown): ImageRecord {
  const value = row as ImageRecord;
  return {
    id: Number(value.id),
    uid: String(value.uid),
    category: value.category,
    filename: String(value.filename),
    key: String(value.key),
    thumbnailKey: value.thumbnailKey ? String(value.thumbnailKey) : null,
    createAt: String(value.createAt),
    expireAt: String(value.expireAt),
  };
}

function isMissingImagesTable(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("no such table: images")
  );
}

async function ensureImageSchema(db: D1Database): Promise<void> {
  for (const statement of IMAGE_SCHEMA_STATEMENTS) {
    await db.prepare(statement).run();
  }
}

async function retryWithImageSchema<T>(
  db: D1Database,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isMissingImagesTable(error)) {
      throw error;
    }

    await ensureImageSchema(db);
    return operation();
  }
}

export function createD1ImageRepository(db: D1Database): ImageRepository {
  return {
    async insert(record) {
      const result = await retryWithImageSchema(db, () =>
        db
          .prepare(
            `INSERT INTO images (uid, category, filename, key, createAt, expireAt)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            record.uid,
            record.category,
            record.filename,
            record.key,
            record.createAt,
            record.expireAt,
          )
          .run(),
      );

      return {
        ...record,
        id: Number(result.meta.last_row_id),
      };
    },

    async list(category: Category, page: number, pageSize: number) {
      const offset = (page - 1) * pageSize;
      const { rowsResult, count } = await retryWithImageSchema(db, async () => {
        const rows = await db
          .prepare(
            `SELECT id, uid, category, filename, key, createAt, expireAt
             FROM images
             WHERE category = ?
             ORDER BY createAt DESC
             LIMIT ? OFFSET ?`,
          )
          .bind(category, pageSize, offset)
          .all();
        const total = await db
          .prepare("SELECT COUNT(*) AS total FROM images WHERE category = ?")
          .bind(category)
          .first<{ total: number }>();

        return { rowsResult: rows, count: total };
      });

      return {
        items: rowsResult.results.map(toImageRecord),
        total: Number(count?.total ?? 0),
      };
    },

    async findByUid(category: Category, uid: string) {
      const row = await retryWithImageSchema(db, () =>
        db
          .prepare(
            `SELECT id, uid, category, filename, key, createAt, expireAt
             FROM images
             WHERE category = ? AND uid = ?`,
          )
          .bind(category, uid)
          .first(),
      );
      return row ? toImageRecord(row) : null;
    },

    async deleteByUid(category: Category, uid: string) {
      const result = await retryWithImageSchema(db, () =>
        db
          .prepare("DELETE FROM images WHERE category = ? AND uid = ?")
          .bind(category, uid)
          .run(),
      );
      return Number(result.meta.changes ?? 0) > 0;
    },

    async listExpiredBeforeToday(now: Date) {
      const result = await retryWithImageSchema(db, () =>
        db
          .prepare(
            `SELECT id, uid, category, filename, key, createAt, expireAt
             FROM images
             ORDER BY expireAt ASC`,
          )
          .all(),
      );
      return result.results
        .map(toImageRecord)
        .filter((row) => isExpiredBeforeTodayKst(row.expireAt, now));
    },
  };
}
