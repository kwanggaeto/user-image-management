/* eslint-disable @next/next/no-img-element */

import { CalendarClockIcon, DownloadIcon, Music2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ImageRecord } from "@/lib/images/types";

const EXPIRE_DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Seoul",
});

interface ImageViewerProps {
  image: ImageRecord;
}

function formatExpireAt(value: string): string {
  const DATE = new Date(value);
  return Number.isNaN(DATE.getTime())
    ? value
    : EXPIRE_DATE_FORMATTER.format(DATE);
}

export function ImageViewer({ image }: ImageViewerProps) {
  if (image.category === "nakdong") {
    return (
      <main className="min-h-dvh w-full bg-black">
        <img
          src={`/api/${image.category}/images/${image.uid}/file`}
          alt={image.filename}
          className="block h-auto w-full"
        />
      </main>
    );
  }

  if (image.category === "mbti") {
    return (
      <main className="min-h-dvh w-full bg-background text-foreground">
        <div className="w-full">
          <img
            src={`/api/mbti/images/${image.uid}/file`}
            alt={image.filename}
            className="block h-auto w-full"
          />
          <Button
            asChild
            className="h-18 w-full rounded-none bg-emerald-800 text-white hover:bg-emerald-900"
          >
            <a href={`/api/mbti/images/${image.uid}/download`}>
              <DownloadIcon data-icon="inline-start" />
              원본 다운로드
            </a>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/10 to-transparent"
      />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-5 sm:px-6 sm:py-8">
        <div className="space-y-5">
          {image.category === "music" ? (
            <div className="relative flex min-h-72 items-center overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-700 px-5 py-10 text-white shadow-lg shadow-black/10">
              <div
                aria-hidden="true"
                className="absolute -right-12 -top-12 size-44 rounded-full bg-white/10 blur-2xl"
              />
              <div className="relative w-full">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
                    <Music2Icon className="size-6" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium tracking-[0.16em] text-white/60 uppercase">
                      Music
                    </p>
                    <p className="mt-1 truncate text-base font-semibold">
                      {image.filename}
                    </p>
                  </div>
                </div>
                <audio
                  controls
                  preload="metadata"
                  src={`/api/music/images/${image.uid}/file`}
                  aria-label={`${image.filename} 재생`}
                  className="w-full"
                />
              </div>
            </div>
          ) : (
            <div className="flex justify-center overflow-hidden rounded-xl border border-border/70 bg-muted/50 p-1.5 shadow-lg shadow-black/10 sm:p-2">
              <img
                src={`/api/${image.category}/images/${image.uid}/file`}
                alt={image.filename}
                className="block max-h-[78dvh] w-full rounded-lg object-contain"
              />
            </div>
          )}

          <div className="space-y-4 px-1 pb-1">
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                콘텐츠 ID
              </p>
              <p className="mt-1 truncate text-base font-semibold text-foreground">
                {image.uid}
              </p>
            </div>

            <div className="flex items-center gap-3 border-t border-border/80 pt-4">
              <CalendarClockIcon
                className="size-5 shrink-0 text-primary"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">
                  만료 기간
                </p>
                <time
                  dateTime={image.expireAt}
                  className="mt-0.5 block text-sm font-semibold text-foreground"
                >
                  {formatExpireAt(image.expireAt)}
                </time>
              </div>
            </div>

            <Button
              asChild
              size="lg"
              className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
            >
              <a href={`/api/${image.category}/images/${image.uid}/download`}>
                <DownloadIcon className="size-5" data-icon="inline-start" />
                원본 다운로드
              </a>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
