CREATE TABLE IF NOT EXISTS images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('library', 'nakdong')),
  filename TEXT NOT NULL,
  key TEXT NOT NULL,
  createAt TEXT NOT NULL,
  expireAt TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS images_category_uid_idx
  ON images(category, uid);

CREATE INDEX IF NOT EXISTS images_category_createAt_idx
  ON images(category, createAt DESC);

CREATE INDEX IF NOT EXISTS images_expireAt_idx
  ON images(expireAt);
