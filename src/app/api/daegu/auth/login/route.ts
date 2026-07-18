import { handleDaeguLogin } from "@/features/images/api";
import { getCloudflareEnv } from "@/lib/cloudflare";

export async function POST(request: Request) {
  return handleDaeguLogin({
    request,
    env: getCloudflareEnv(),
  });
}
