"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";
import { ExternalLinkIcon, Trash2Icon } from "lucide-react";
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
import type { Category } from "@/lib/categories";
import type { PaginatedImages } from "@/lib/images/types";

interface ImageListProps {
  category: Category;
  initialData: PaginatedImages;
}

export function ImageList({ category, initialData }: ImageListProps) {
  const [data, setData] = useState(initialData);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const canGoPrev = data.page > 1;
  const canGoNext = data.page < data.totalPages;

  const title = useMemo(
    () => (category === "library" ? "국립중앙도서관" : "낙동강"),
    [category],
  );

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
          <div className="flex items-center gap-2">
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
                  <TableHead>썸네일</TableHead>
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
