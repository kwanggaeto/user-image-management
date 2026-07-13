import type { Category } from "@/lib/categories";
import { isExpiredBeforeTodayKst } from "@/lib/time";
import type {
  ImageRecord,
  ImageRepository,
  UsagePeriod,
  UsageRepository,
  UsageSummary,
} from "./types";
import { DuplicateImageUidError } from "./types";

const IMAGE_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('library', 'nakdong', 'music', 'school')),
    filename TEXT NOT NULL,
    key TEXT NOT NULL,
    thumbnailKey TEXT,
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

const USAGE_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS usage_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL CHECK (category IN ('library', 'nakdong', 'music', 'school')),
    createdAt TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS usage_records_category_createdAt_idx
    ON usage_records(category, createdAt)`,
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

function isMissingThumbnailKeyColumn(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("no such column: thumbnailKey")
  );
}

function isMissingUsageTable(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("no such table: usage_records")
  );
}

function isDuplicateImageUid(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("UNIQUE constraint failed") &&
    error.message.includes("images.category") &&
    error.message.includes("images.uid")
  );
}

async function ensureImageSchema(db: D1Database): Promise<void> {
  for (const statement of IMAGE_SCHEMA_STATEMENTS) {
    await db.prepare(statement).run();
  }
}

async function ensureThumbnailKeyColumn(db: D1Database): Promise<void> {
  await db.prepare("ALTER TABLE images ADD COLUMN thumbnailKey TEXT").run();
}

async function ensureUsageSchema(db: D1Database): Promise<void> {
  for (const statement of USAGE_SCHEMA_STATEMENTS) {
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
      if (!isMissingThumbnailKeyColumn(error)) {
        throw error;
      }

      await ensureThumbnailKeyColumn(db);
      return operation();
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
            `INSERT INTO images (uid, category, filename, key, thumbnailKey, createAt, expireAt)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            record.uid,
            record.category,
            record.filename,
            record.key,
            record.thumbnailKey,
            record.createAt,
            record.expireAt,
          )
          .run(),
      ).catch((error) => {
        if (isDuplicateImageUid(error)) {
          throw new DuplicateImageUidError();
        }
        throw error;
      });

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
            `SELECT id, uid, category, filename, key, thumbnailKey, createAt, expireAt
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
            `SELECT id, uid, category, filename, key, thumbnailKey, createAt, expireAt
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
            `SELECT id, uid, category, filename, key, thumbnailKey, createAt, expireAt
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

async function retryWithUsageSchema<T>(
  db: D1Database,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isMissingUsageTable(error)) {
      throw error;
    }

    await ensureUsageSchema(db);
    return operation();
  }
}

function periodExpression(period: UsagePeriod): string {
  if (period === "day") {
    return "substr(createdAt, 1, 10)";
  }
  if (period === "month") {
    return "substr(createdAt, 1, 7)";
  }
  return "substr(createdAt, 1, 4)";
}

function toUsageSummary(
  period: UsagePeriod,
  total: number,
  rows: Array<{ bucket: string; count: number }>,
): UsageSummary {
  let cumulative = 0;
  return {
    period,
    total,
    buckets: rows.map((row) => {
      const count = Number(row.count);
      cumulative += count;
      return {
        label: String(row.bucket),
        count,
        cumulative,
      };
    }),
  };
}

export function createD1UsageRepository(db: D1Database): UsageRepository {
  return {
    async insert(record) {
      await retryWithUsageSchema(db, () =>
        db
          .prepare(
            `INSERT INTO usage_records (category, createdAt)
             VALUES (?, ?)`,
          )
          .bind(record.category, record.createdAt)
          .run(),
      );
    },

    async summarize(category, period) {
      const expression = periodExpression(period);
      const { total, buckets } = await retryWithUsageSchema(db, async () => {
        const totalRow = await db
          .prepare(
            "SELECT COUNT(*) AS total FROM usage_records WHERE category = ?",
          )
          .bind(category)
          .first<{ total: number }>();
        const bucketRows = await db
          .prepare(
            `SELECT ${expression} AS bucket, COUNT(*) AS count
             FROM usage_records
             WHERE category = ?
             GROUP BY bucket
             ORDER BY bucket ASC`,
          )
          .bind(category)
          .all();

        return {
          total: Number(totalRow?.total ?? 0),
          buckets: bucketRows.results as Array<{
            bucket: string;
            count: number;
          }>,
        };
      });

      return toUsageSummary(period, total, buckets);
    },
  };
}
