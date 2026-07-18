import { cookies } from "next/headers";
import { DaeguAdminHub } from "@/components/admin/daegu-admin-hub";
import { LoginForm } from "@/components/admin/login-form";
import { SESSION_COOKIE_NAME, verifySession } from "@/lib/auth";
import { getCloudflareEnv } from "@/lib/cloudflare";

export const dynamic = "force-dynamic";

export default async function DaeguAdminPage() {
  const env = getCloudflareEnv();
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const authenticated = await verifySession(env, "daegu", session);

  return authenticated ? <DaeguAdminHub /> : <LoginForm scope="daegu" />;
}
