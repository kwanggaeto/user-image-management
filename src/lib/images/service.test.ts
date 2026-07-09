import { beforeEach, describe, expect, test } from "vitest";
import type { Category } from "@/lib/categories";
import type { ImageRecord, ImageRepository, ImageStorage } from "./types";
import {
  cleanupExpiredImages,
  createImage,
  deleteImage,
  getImage,
  listImages,
} from "./service";

class FakeRepository implements ImageRepository {
  rows: ImageRecord[] = [];

  async insert(record: Omit<ImageRecord, "id">): Promise<ImageRecord> {
    const row = { ...record, id: this.rows.length + 1 };
    this.rows.push(row);
    return row;
  }

  async list(category: Category, page: number, pageSize: number) {
    const filtered = this.rows.filter((row) => row.category === category);
    return {
      items: filtered.slice((page - 1) * pageSize, page * pageSize),
      total: filtered.length,
    };
  }

  async findByUid(category: Category, uid: string) {
    return (
      this.rows.find((row) => row.category === category && row.uid === uid) ??
      null
    );
  }

  async deleteByUid(category: Category, uid: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter(
      (row) => row.category !== category || row.uid !== uid,
    );
    return this.rows.length !== before;
  }

  async listExpiredBeforeToday(now: Date) {
    const today = now.toISOString().slice(0, 10);
    return this.rows.filter((row) => row.expireAt.slice(0, 10) < today);
  }
}

class FakeStorage implements ImageStorage {
  objects = new Map<string, Blob>();
  deleted: string[] = [];

  async put(key: string, file: Blob): Promise<void> {
    this.objects.set(key, file);
  }

  async get(key: string): Promise<Blob | null> {
    return this.objects.get(key) ?? null;
  }

  async delete(key: string): Promise<void> {
    this.deleted.push(key);
    this.objects.delete(key);
  }
}

let repository: FakeRepository;
let storage: FakeStorage;

beforeEach(() => {
  repository = new FakeRepository();
  storage = new FakeStorage();
});

describe("createImage", () => {
  test("stores the object and metadata for the selected category", async () => {
    const result = await createImage({
      repository,
      storage,
      category: "library",
      uid: "abc123",
      filename: "photo.jpg",
      file: new Blob(["image"], { type: "image/jpeg" }),
      now: new Date("2026-07-09T00:00:00.000Z"),
      expireDays: 7,
    });

    expect(result).toMatchObject({
      uid: "abc123",
      category: "library",
      filename: "photo.jpg",
      key: "images/library/abc123/photo.jpg",
      createAt: "2026-07-09T09:00:00.000+09:00",
      expireAt: "2026-07-16T09:00:00.000+09:00",
    });
    expect(storage.objects.has("images/library/abc123/photo.jpg")).toBe(true);
  });
});

describe("listImages", () => {
  test("returns only the requested category and pagination metadata", async () => {
    await repository.insert({
      uid: "library-1",
      category: "library",
      filename: "a.jpg",
      key: "images/library/library-1/a.jpg",
      createAt: "2026-07-09T09:00:00.000+09:00",
      expireAt: "2026-07-16T09:00:00.000+09:00",
    });
    await repository.insert({
      uid: "nakdong-1",
      category: "nakdong",
      filename: "b.jpg",
      key: "images/nakdong/nakdong-1/b.jpg",
      createAt: "2026-07-09T09:00:00.000+09:00",
      expireAt: "2026-07-16T09:00:00.000+09:00",
    });

    const result = await listImages(repository, "library", 1, 10);

    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.items[0]?.uid).toBe("library-1");
    expect(result.items[0]?.thumbnailUrl).toBe(
      "/api/library/images/library-1/file",
    );
  });
});

describe("getImage", () => {
  test("returns null when uid exists only in another category", async () => {
    await repository.insert({
      uid: "same",
      category: "nakdong",
      filename: "a.jpg",
      key: "images/nakdong/same/a.jpg",
      createAt: "2026-07-09T09:00:00.000+09:00",
      expireAt: "2026-07-16T09:00:00.000+09:00",
    });

    await expect(getImage(repository, "library", "same")).resolves.toBeNull();
  });
});

describe("deleteImage", () => {
  test("deletes object and row for an existing category uid", async () => {
    await repository.insert({
      uid: "abc123",
      category: "library",
      filename: "a.jpg",
      key: "images/library/abc123/a.jpg",
      createAt: "2026-07-09T09:00:00.000+09:00",
      expireAt: "2026-07-16T09:00:00.000+09:00",
    });

    const result = await deleteImage(repository, storage, "library", "abc123");

    expect(result).toBe(true);
    expect(storage.deleted).toEqual(["images/library/abc123/a.jpg"]);
    expect(await repository.findByUid("library", "abc123")).toBeNull();
  });

  test("returns false when the uid is not in the requested category", async () => {
    await repository.insert({
      uid: "same",
      category: "nakdong",
      filename: "a.jpg",
      key: "images/nakdong/same/a.jpg",
      createAt: "2026-07-09T09:00:00.000+09:00",
      expireAt: "2026-07-16T09:00:00.000+09:00",
    });

    await expect(
      deleteImage(repository, storage, "library", "same"),
    ).resolves.toBe(false);
  });
});

describe("cleanupExpiredImages", () => {
  test("deletes expired objects and rows while keeping active rows", async () => {
    await repository.insert({
      uid: "expired",
      category: "library",
      filename: "old.jpg",
      key: "images/library/expired/old.jpg",
      createAt: "2026-07-01T09:00:00.000+09:00",
      expireAt: "2026-07-08T09:00:00.000+09:00",
    });
    await repository.insert({
      uid: "active",
      category: "library",
      filename: "new.jpg",
      key: "images/library/active/new.jpg",
      createAt: "2026-07-09T09:00:00.000+09:00",
      expireAt: "2026-07-10T09:00:00.000+09:00",
    });

    const result = await cleanupExpiredImages({
      repository,
      storage,
      now: new Date("2026-07-09T00:00:00.000Z"),
    });

    expect(result).toEqual({ scanned: 1, deleted: 1, failed: 0 });
    expect(storage.deleted).toEqual(["images/library/expired/old.jpg"]);
    expect(await repository.findByUid("library", "expired")).toBeNull();
    expect(await repository.findByUid("library", "active")).not.toBeNull();
  });
});
