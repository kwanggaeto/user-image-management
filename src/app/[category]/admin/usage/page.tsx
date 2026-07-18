import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { LoginForm } from "@/components/admin/login-form";
import { UsageReport } from "@/components/admin/usage-report";
import { SESSION_COOKIE_NAME, verifyCategorySession } from "@/lib/auth";
import { parseCategory } from "@/lib/categories";
import { getCloudflareEnv } from "@/lib/cloudflare";
import { createD1UsageRepository } from "@/lib/images/d1-repository";
import { summarizeUsage } from "@/lib/images/service";

export const dynamic = "force-dynamic";

interface UsagePageProps {
  params: Promise<{ category: string }>;
}

export default async function UsagePage({ params }: UsagePageProps) {
  const { category: categoryValue } = await params;
  let category;

  try {
    category = parseCategory(categoryValue);
  } catch {
    notFound();
  }

  const env = getCloudflareEnv();
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const authenticated = await verifyCategorySession(env, category, session);

  if (!authenticated) {
    return <LoginForm category={category} />;
  }

  const summary = await summarizeUsage(
    createD1UsageRepository(env.DB),
    category,
    "day",
  );

  return <UsageReport category={category} initialSummary={summary} />;
}
