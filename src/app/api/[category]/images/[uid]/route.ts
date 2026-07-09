import { handleImageDelete, handleImageMetadata } from "@/features/images/api";
import { getCloudflareEnv } from "@/lib/cloudflare";

interface RouteContext {
  params:
    | Promise<{ category: string; uid: string }>
    | { category: string; uid: string };
}

export async function GET(request: Request, context: RouteContext) {
  const { category, uid } = await context.params;
  return handleImageMetadata({
    request,
    env: getCloudflareEnv(),
    categoryValue: category,
    uid,
    requireAdmin: true,
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  const { category, uid } = await context.params;
  return handleImageDelete({
    request,
    env: getCloudflareEnv(),
    categoryValue: category,
    uid,
  });
}
