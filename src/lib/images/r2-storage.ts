import type { ImageStorage } from "./types";

export function createR2ImageStorage(bucket: R2Bucket): ImageStorage {
  return {
    async put(key, file) {
      await bucket.put(key, file);
    },
    async get(key) {
      const object = await bucket.get(key);
      if (!object) {
        return null;
      }
      return object.blob();
    },
    async delete(key) {
      await bucket.delete(key);
    },
  };
}
