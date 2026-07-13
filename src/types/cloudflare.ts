export type AppEnv = "development" | "production";

export interface CloudflareEnv {
  DB: D1Database;
  IMAGES_BUCKET: R2Bucket;
  IMAGES: ImagesBinding;
  APP_ENV: AppEnv;
  IMAGE_EXPIRE_DAYS: string;
  SESSION_SECRET: string;
  UPLOAD_API_TOKEN: string;
  LIBRARY_ADMIN_ID: string;
  LIBRARY_ADMIN_PASSWORD: string;
  NAKDONG_ADMIN_ID: string;
  NAKDONG_ADMIN_PASSWORD: string;
  DAEGU_ADMIN_ID: string;
  DAEGU_ADMIN_PASSWORD: string;
}
