ALTER TABLE images ADD COLUMN thumbnailKey TEXT;

CREATE TABLE IF NOT EXISTS usage_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL CHECK (category IN ('library', 'nakdong')),
  createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS usage_records_category_createdAt_idx
  ON usage_records(category, createdAt);
