import { handleImageList, handleImageUpload } from "@/features/images/api";
import { getCloudflareEnv } from "@/lib/cloudflare";

interface RouteContext {
  params: Promise<{ category: string }> | { category: string };
}

export async function GET(request: Request, context: RouteContext) {
  const { category } = await context.params;
  return handleImageList({
    request,
    env: getCloudflareEnv(),
    categoryValue: category,
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { category } = await context.params;
  return handleImageUpload({
    request,
    env: getCloudflareEnv(),
    categoryValue: category,
  });
}
