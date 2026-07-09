import type { Category } from "@/lib/categories";

export interface ImageRecord {
  id: number;
  uid: string;
  category: Category;
  filename: string;
  key: string;
  thumbnailKey: string | null;
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

export interface ThumbnailGenerator {
  generate(input: Blob): Promise<Blob>;
}

export type UsagePeriod = "day" | "month" | "year";

export interface UsageRecordInput {
  category: Category;
  createdAt: string;
}

export interface UsageSummaryBucket {
  label: string;
  count: number;
  cumulative: number;
}

export interface UsageSummary {
  period: UsagePeriod;
  total: number;
  buckets: UsageSummaryBucket[];
}

export interface UsageRepository {
  insert(record: UsageRecordInput): Promise<void>;
  summarize(category: Category, period: UsagePeriod): Promise<UsageSummary>;
}

export class DuplicateImageUidError extends Error {
  constructor() {
    super("Duplicate image uid");
    this.name = "DuplicateImageUidError";
  }
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
