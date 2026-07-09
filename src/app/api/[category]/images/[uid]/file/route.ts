import { handleImageFile } from "@/features/images/api";
import { getCloudflareEnv } from "@/lib/cloudflare";

interface RouteContext {
  params:
    | Promise<{ category: string; uid: string }>
    | { category: string; uid: string };
}

export async function GET(request: Request, context: RouteContext) {
  const { category, uid } = await context.params;
  return handleImageFile({
    request,
    env: getCloudflareEnv(),
    categoryValue: category,
    uid,
  });
}
