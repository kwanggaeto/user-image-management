/* eslint-disable @next/next/no-img-element */

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
        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{image.uid}</span>
          <span>{image.createAt}</span>
        </div>
      </div>
    </main>
  );
}
