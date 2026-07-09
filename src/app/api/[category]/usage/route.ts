import { handleUsageSummary } from "@/features/images/api";
import { getCloudflareEnv } from "@/lib/cloudflare";

interface RouteContext {
  params: Promise<{ category: string }> | { category: string };
}

export async function GET(request: Request, context: RouteContext) {
  const { category } = await context.params;
  return handleUsageSummary({
    request,
    env: getCloudflareEnv(),
    categoryValue: category,
  });
}
