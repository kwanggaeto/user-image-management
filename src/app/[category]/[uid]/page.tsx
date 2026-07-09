import { notFound } from "next/navigation";
import { ImageViewer } from "@/components/viewer/image-viewer";
import { parseCategory } from "@/lib/categories";
import { getCloudflareEnv } from "@/lib/cloudflare";
import { createD1ImageRepository } from "@/lib/images/d1-repository";
import { getImage } from "@/lib/images/service";

export const dynamic = "force-dynamic";

interface ViewerPageProps {
  params: Promise<{ category: string; uid: string }>;
}

export default async function ViewerPage({ params }: ViewerPageProps) {
  const { category: categoryValue, uid } = await params;
  let category;

  try {
    category = parseCategory(categoryValue);
  } catch {
    notFound();
  }

  const env = getCloudflareEnv();
  const image = await getImage(createD1ImageRepository(env.DB), category, uid);

  if (!image) {
    notFound();
  }

  return <ImageViewer image={image} />;
}
