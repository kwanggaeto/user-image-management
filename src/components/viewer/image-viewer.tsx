/* eslint-disable @next/next/no-img-element */

import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ImageRecord } from "@/lib/images/types";

interface ImageViewerProps {
  image: ImageRecord;
}

export function ImageViewer({ image }: ImageViewerProps) {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 py-6">
        <img
          src={`/api/${image.category}/images/${image.uid}/file`}
          alt={image.filename}
          className="max-h-[78dvh] w-full rounded-md object-contain"
        />
        <div className="flex flex-col gap-3 text-sm text-muted-foreground">
          <div className="flex flex-col gap-1">
            <span className="font-medium text-foreground">{image.uid}</span>
            <span>{image.createAt}</span>
          </div>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/${image.category}/images/${image.uid}/download`}>
              <DownloadIcon data-icon="inline-start" />
              원본 다운로드
            </a>
          </Button>
        </div>
      </div>
    </main>
  );
}
