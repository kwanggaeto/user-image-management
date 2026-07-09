import { handleLogin } from "@/features/images/api";
import { getCloudflareEnv } from "@/lib/cloudflare";

interface RouteContext {
  params: Promise<{ category: string }> | { category: string };
}

export async function POST(request: Request, context: RouteContext) {
  const { category } = await context.params;
  return handleLogin({
    request,
    env: getCloudflareEnv(),
    categoryValue: category,
  });
}
