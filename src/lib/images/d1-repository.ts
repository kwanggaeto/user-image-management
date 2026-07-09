import type { Category } from "@/lib/categories";
import { isExpiredBeforeTodayKst } from "@/lib/time";
import type { ImageRecord, ImageRepository } from "./types";

function toImageRecord(row: unknown): ImageRecord {
  const value = row as ImageRecord;
  return {
    id: Number(value.id),
    uid: String(value.uid),
    category: value.category,
    filename: String(value.filename),
    key: String(value.key),
    createAt: String(value.createAt),
    expireAt: String(value.expireAt),
  };
}

export function createD1ImageRepository(db: D1Database): ImageRepository {
  return {
    async insert(record) {
      const result = await db
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
        .run();

      return {
        ...record,
        id: Number(result.meta.last_row_id),
      };
    },

    async list(category: Category, page: number, pageSize: number) {
      const offset = (page - 1) * pageSize;
      const rowsResult = await db
        .prepare(
          `SELECT id, uid, category, filename, key, createAt, expireAt
           FROM images
           WHERE category = ?
           ORDER BY createAt DESC
           LIMIT ? OFFSET ?`,
        )
        .bind(category, pageSize, offset)
        .all();
      const count = await db
        .prepare("SELECT COUNT(*) AS total FROM images WHERE category = ?")
        .bind(category)
        .first<{ total: number }>();

      return {
        items: rowsResult.results.map(toImageRecord),
        total: Number(count?.total ?? 0),
      };
    },

    async findByUid(category: Category, uid: string) {
      const row = await db
        .prepare(
          `SELECT id, uid, category, filename, key, createAt, expireAt
           FROM images
           WHERE category = ? AND uid = ?`,
        )
        .bind(category, uid)
        .first();
      return row ? toImageRecord(row) : null;
    },

    async deleteByUid(category: Category, uid: string) {
      const result = await db
        .prepare("DELETE FROM images WHERE category = ? AND uid = ?")
        .bind(category, uid)
        .run();
      return Number(result.meta.changes ?? 0) > 0;
    },

    async listExpiredBeforeToday(now: Date) {
      const result = await db
        .prepare(
          `SELECT id, uid, category, filename, key, createAt, expireAt
           FROM images
           ORDER BY expireAt ASC`,
        )
        .all();
      return result.results
        .map(toImageRecord)
        .filter((row) => isExpiredBeforeTodayKst(row.expireAt, now));
    },
  };
}
