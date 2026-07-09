import { createD1ImageRepository } from "@/lib/images/d1-repository";
import { createR2ImageStorage } from "@/lib/images/r2-storage";
import { cleanupExpiredImages } from "@/lib/images/service";
import type { CloudflareEnv } from "@/types/cloudflare";

export default {
  async scheduled(controller, env) {
    const repository = createD1ImageRepository(env.DB);
    const storage = createR2ImageStorage(env.IMAGES_BUCKET);
    const now = new Date(controller.scheduledTime);
    const result = await cleanupExpiredImages({ repository, storage, now });
    console.log(JSON.stringify({ event: "cleanupExpiredImages", result }));
  },
} satisfies ExportedHandler<CloudflareEnv>;
