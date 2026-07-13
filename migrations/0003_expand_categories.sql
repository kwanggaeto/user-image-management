CREATE TABLE images_next (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('library', 'nakdong', 'music', 'school')),
  filename TEXT NOT NULL,
  key TEXT NOT NULL,
  createAt TEXT NOT NULL,
  expireAt TEXT NOT NULL,
  thumbnailKey TEXT
);

INSERT INTO images_next (id, uid, category, filename, key, thumbnailKey, createAt, expireAt)
SELECT id, uid, category, filename, key, thumbnailKey, createAt, expireAt
FROM images;

DROP TABLE images;
ALTER TABLE images_next RENAME TO images;

CREATE UNIQUE INDEX images_category_uid_idx ON images(category, uid);
CREATE INDEX images_category_createAt_idx ON images(category, createAt DESC);
CREATE INDEX images_expireAt_idx ON images(expireAt);

CREATE TABLE usage_records_next (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL CHECK (category IN ('library', 'nakdong', 'music', 'school')),
  createdAt TEXT NOT NULL
);

INSERT INTO usage_records_next (id, category, createdAt)
SELECT id, category, createdAt
FROM usage_records;

DROP TABLE usage_records;
ALTER TABLE usage_records_next RENAME TO usage_records;

CREATE INDEX usage_records_category_createdAt_idx
  ON usage_records(category, createdAt);
