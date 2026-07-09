import type { Category } from "@/lib/categories";

export interface ImageRecord {
  id: number;
  uid: string;
  category: Category;
  filename: string;
  key: string;
  createAt: string;
  expireAt: string;
}

export interface ImageListResult {
  items: ImageRecord[];
  total: number;
}

export interface ImageRepository {
  insert(record: Omit<ImageRecord, "id">): Promise<ImageRecord>;
  list(category: Category, page: number, pageSize: number): Promise<ImageListResult>;
  findByUid(category: Category, uid: string): Promise<ImageRecord | null>;
  deleteByUid(category: Category, uid: string): Promise<boolean>;
  listExpiredBeforeToday(now: Date): Promise<ImageRecord[]>;
}

export interface ImageStorage {
  put(key: string, file: Blob): Promise<void>;
  get(key: string): Promise<Blob | null>;
  delete(key: string): Promise<void>;
}

export interface ImageListItem extends ImageRecord {
  thumbnailUrl: string;
}

export interface PaginatedImages {
  items: ImageListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CleanupResult {
  scanned: number;
  deleted: number;
  failed: number;
}
