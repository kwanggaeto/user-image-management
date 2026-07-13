"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import {
  BarChart3Icon,
  ExternalLinkIcon,
  LogOutIcon,
  PlayIcon,
  Trash2Icon,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CATEGORY_LABELS, type Category } from "@/lib/categories";
import type { PaginatedImages } from "@/lib/images/types";

interface ImageListProps {
  category: Category;
  initialData: PaginatedImages;
}

export function ImageList({ category, initialData }: ImageListProps) {
  const [data, setData] = useState(initialData);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [playingUid, setPlayingUid] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const canGoPrev = data.page > 1;
  const canGoNext = data.page < data.totalPages;

  const title = CATEGORY_LABELS[category];

  async function loadPage(page: number, pageSize = data.pageSize) {
    const response = await fetch(
      `/api/${category}/images?page=${page}&pageSize=${pageSize}`,
    );
    if (response.ok) {
      setData((await response.json()) as PaginatedImages);
    }
  }

  async function deleteUid(uid: string) {
    setDeletingUid(uid);
    const response = await fetch(`/api/${category}/images/${uid}`, {
      method: "DELETE",
    });
    setDeletingUid(null);

    if (response.ok) {
      await loadPage(data.page);
    }
  }

  async function logout() {
    setLoggingOut(true);
    setLogoutError(null);

    try {
      const response = await fetch(`/api/${category}/auth/logout`, {
        method: "POST",
      });

      if (response.ok) {
        window.location.reload();
        return;
      }
    } catch {
      // Show the same message as non-OK responses.
    }

    setLoggingOut(false);
    setLogoutError("로그아웃에 실패했습니다.");
  }

  return (
    <main className="min-h-dvh bg-background px-4 py-6 text-foreground md:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <header className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2">
            <Badge variant="secondary">{title}</Badge>
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold">업로드 이미지</h1>
              <p className="text-sm text-muted-foreground">
                총 {data.total}개 이미지
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={`/${category}/admin/usage`}>
                  <BarChart3Icon data-icon="inline-start" />
                  이용 기록
                </a>
              </Button>
              <Select
                value={String(data.pageSize)}
                onValueChange={(value) => loadPage(1, Number(value))}
              >
                <SelectTrigger aria-label="페이지 크기" className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="10">10개</SelectItem>
                    <SelectItem value="20">20개</SelectItem>
                    <SelectItem value="30">30개</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={logout}
                disabled={loggingOut}
              >
                <LogOutIcon data-icon="inline-start" />
                로그아웃
              </Button>
            </div>
            {logoutError ? (
              <p className="text-sm text-destructive" role="alert">
                {logoutError}
              </p>
            ) : null}
          </div>
        </header>

        {data.items.length === 0 ? (
          <Empty className="min-h-[320px] border">
            <EmptyHeader>
              <EmptyTitle>등록된 이미지가 없습니다.</EmptyTitle>
              <EmptyDescription>
                API 업로드가 완료되면 이 목록에 표시됩니다.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent />
          </Empty>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {category === "music" ? "듣기" : "썸네일"}
                  </TableHead>
                  <TableHead>UID</TableHead>
                  <TableHead>생성시간</TableHead>
                  <TableHead>만료시간</TableHead>
                  <TableHead className="w-[88px] text-right">삭제</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((image) => (
                  <TableRow key={image.uid}>
                    <TableCell>
                      {category === "music" ? (
                        <div className="flex min-w-[260px] flex-col items-start gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            aria-expanded={playingUid === image.uid}
                            onClick={() =>
                              setPlayingUid((current) =>
                                current === image.uid ? null : image.uid,
                              )
                            }
                          >
                            <PlayIcon data-icon="inline-start" />
                            듣기
                          </Button>
                          {playingUid === image.uid ? (
                            <audio
                              controls
                              preload="metadata"
                              src={`/api/music/images/${image.uid}/file`}
                              aria-label={`${image.filename} 재생`}
                              className="w-full"
                            />
                          ) : null}
                        </div>
                      ) : (
                        <a
                          href={`/${category}/${image.uid}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-3"
                        >
                          <img
                            src={image.thumbnailUrl}
                            alt={image.filename}
                            className="size-16 rounded-md border object-cover"
                          />
                          <ExternalLinkIcon data-icon="inline-end" />
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {image.uid}
                    </TableCell>
                    <TableCell>{image.createAt}</TableCell>
                    <TableCell>{image.expireAt}</TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            aria-label={`${image.uid} 삭제`}
                          >
                            <Trash2Icon data-icon="inline-start" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>이미지를 삭제할까요?</AlertDialogTitle>
                            <AlertDialogDescription>
                              삭제하면 R2 파일과 D1 메타데이터가 함께 제거됩니다.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>취소</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteUid(image.uid)}
                              disabled={deletingUid === image.uid}
                            >
                              삭제
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <footer className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {data.page} / {data.totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!canGoPrev}
              onClick={() => loadPage(data.page - 1)}
            >
              이전
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canGoNext}
              onClick={() => loadPage(data.page + 1)}
            >
              다음
            </Button>
          </div>
        </footer>
      </div>
    </main>
  );
}
