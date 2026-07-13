import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { CloudflareEnv } from "@/types/cloudflare";

function createUnavailableImagesBinding(): ImagesBinding {
  const unavailable = () => {
    throw new Error("Cloudflare Images binding is unavailable outside Wrangler.");
  };

  return {
    info: unavailable,
    input: unavailable,
    hosted: {
      image: unavailable,
      upload: unavailable,
      list: unavailable,
    },
  };
}

export function getCloudflareEnv(): CloudflareEnv {
  try {
    return getCloudflareContext().env as CloudflareEnv;
  } catch {
    return {
      DB: undefined as unknown as D1Database,
      IMAGES_BUCKET: undefined as unknown as R2Bucket,
      IMAGES: createUnavailableImagesBinding(),
      APP_ENV: process.env.APP_ENV === "production" ? "production" : "development",
      IMAGE_EXPIRE_DAYS: process.env.IMAGE_EXPIRE_DAYS ?? "7",
      SESSION_SECRET:
        process.env.SESSION_SECRET ?? "local-development-session-secret",
      UPLOAD_API_TOKEN: process.env.UPLOAD_API_TOKEN ?? "local-upload-token",
      LIBRARY_ADMIN_ID: process.env.LIBRARY_ADMIN_ID ?? "library-admin",
      LIBRARY_ADMIN_PASSWORD:
        process.env.LIBRARY_ADMIN_PASSWORD ?? "library-pass",
      NAKDONG_ADMIN_ID: process.env.NAKDONG_ADMIN_ID ?? "nakdong-admin",
      NAKDONG_ADMIN_PASSWORD:
        process.env.NAKDONG_ADMIN_PASSWORD ?? "nakdong-pass",
      DAEGU_ADMIN_ID: process.env.DAEGU_ADMIN_ID ?? "daegu-admin",
      DAEGU_ADMIN_PASSWORD:
        process.env.DAEGU_ADMIN_PASSWORD ?? "daegu-pass",
    };
  }
}
