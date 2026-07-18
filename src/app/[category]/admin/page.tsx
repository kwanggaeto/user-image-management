import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/login-form";
import { ImageList } from "@/components/admin/image-list";
import { SESSION_COOKIE_NAME, verifyCategorySession } from "@/lib/auth";
import {
  isDaeguCategory,
  parseCategory,
  parsePage,
  parsePageSize,
} from "@/lib/categories";
import { getCloudflareEnv } from "@/lib/cloudflare";
import { createD1ImageRepository } from "@/lib/images/d1-repository";
import { listImages } from "@/lib/images/service";

export const dynamic = "force-dynamic";

interface AdminPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}

export default async function AdminPage({
  params,
  searchParams,
}: AdminPageProps) {
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
    if (isDaeguCategory(category)) {
      redirect("/daegu/admin");
    }
    return <LoginForm scope={category} />;
  }

  const resolvedSearchParams = await searchParams;
  const page = parsePage(resolvedSearchParams.page ?? null);
  const pageSize = parsePageSize(resolvedSearchParams.pageSize ?? null);
  const data = await listImages(
    createD1ImageRepository(env.DB),
    category,
    page,
    pageSize,
  );

  return <ImageList category={category} initialData={data} />;
}
