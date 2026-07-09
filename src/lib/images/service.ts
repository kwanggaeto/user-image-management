import type { Category } from "@/lib/categories";
import { createImageTimestamps, isExpiredBeforeTodayKst } from "@/lib/time";
import { buildImageKey, sanitizeFilename } from "@/lib/uid";
import type {
  CleanupResult,
  ImageRecord,
  ImageRepository,
  ImageStorage,
  PaginatedImages,
} from "./types";

export async function createImage(input: {
  repository: ImageRepository;
  storage: ImageStorage;
  category: Category;
  uid: string;
  filename: string;
  file: Blob;
  now: Date;
  expireDays: number;
}): Promise<ImageRecord> {
  const filename = sanitizeFilename(input.filename);
  const key = buildImageKey(input.category, input.uid, filename);
  const timestamps = createImageTimestamps(input.now, input.expireDays);

  await input.storage.put(key, input.file);

  return input.repository.insert({
    uid: input.uid,
    category: input.category,
    filename,
    key,
    createAt: timestamps.createAt,
    expireAt: timestamps.expireAt,
  });
}

export async function listImages(
  repository: ImageRepository,
  category: Category,
  page: number,
  pageSize: number,
): Promise<PaginatedImages> {
  const result = await repository.list(category, page, pageSize);
  return {
    items: result.items.map((item) => ({
      ...item,
      thumbnailUrl: `/api/${category}/images/${item.uid}/file`,
    })),
    page,
    pageSize,
    total: result.total,
    totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
  };
}

export async function getImage(
  repository: ImageRepository,
  category: Category,
  uid: string,
): Promise<ImageRecord | null> {
  return repository.findByUid(category, uid);
}

export async function deleteImage(
  repository: ImageRepository,
  storage: ImageStorage,
  category: Category,
  uid: string,
): Promise<boolean> {
  const image = await repository.findByUid(category, uid);
  if (!image) {
    return false;
  }

  await storage.delete(image.key);
  await repository.deleteByUid(category, uid);
  return true;
}

export async function cleanupExpiredImages(input: {
  repository: ImageRepository;
  storage: ImageStorage;
  now: Date;
}): Promise<CleanupResult> {
  const candidates = await input.repository.listExpiredBeforeToday(input.now);
  let deleted = 0;
  let failed = 0;

  for (const image of candidates) {
    if (!isExpiredBeforeTodayKst(image.expireAt, input.now)) {
      continue;
    }

    try {
      await input.storage.delete(image.key);
      await input.repository.deleteByUid(image.category, image.uid);
      deleted += 1;
    } catch {
      failed += 1;
    }
  }

  return {
    scanned: candidates.length,
    deleted,
    failed,
  };
}
