import type { Category } from "./categories";

export function sanitizeFilename(filename: string): string {
  const ascii = filename
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-\./g, ".")
    .replace(/^-+|-+$/g, "");

  return ascii.length > 0 ? ascii : "image";
}

export function buildImageKey(
  category: Category,
  uid: string,
  filename: string,
): string {
  return `images/${category}/${uid}/${sanitizeFilename(filename)}`;
}

export function buildThumbnailKey(category: Category, uid: string): string {
  return `images/${category}/${uid}/thumbnail.webp`;
}

export function createUid(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
