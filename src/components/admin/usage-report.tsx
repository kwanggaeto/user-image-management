"use client";

import { useState } from "react";
import { BarChart3Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { UsagePeriod, UsageSummary } from "@/lib/images/types";

interface UsageReportProps {
  category: Category;
  initialSummary: UsageSummary;
}

const PERIOD_LABELS: Record<UsagePeriod, string> = {
  day: "일별",
  month: "월별",
  year: "연도별",
};

export function UsageReport({ category, initialSummary }: UsageReportProps) {
  const [summary, setSummary] = useState(initialSummary);

  async function loadPeriod(period: UsagePeriod) {
    const response = await fetch(`/api/${category}/usage?period=${period}`);
    if (response.ok) {
      setSummary((await response.json()) as UsageSummary);
    }
  }

  return (
    <main className="min-h-dvh bg-background px-4 py-6 text-foreground md:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <header className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2">
            <Badge variant="secondary">{category}</Badge>
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold">이용 기록</h1>
              <p className="text-sm text-muted-foreground">
                전체 {summary.total}회
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`/${category}/admin`}>이미지 목록</a>
            </Button>
            <Select
              value={summary.period}
              onValueChange={(value) => loadPeriod(value as UsagePeriod)}
            >
              <SelectTrigger aria-label="집계 기간" className="w-[120px]">
                <BarChart3Icon data-icon="inline-start" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="day">일별</SelectItem>
                  <SelectItem value="month">월별</SelectItem>
                  <SelectItem value="year">연도별</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </header>

        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{PERIOD_LABELS[summary.period]}</TableHead>
                <TableHead>횟수</TableHead>
                <TableHead>누적</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.buckets.map((bucket) => (
                <TableRow key={bucket.label}>
                  <TableCell className="font-mono text-sm">
                    {bucket.label}
                  </TableCell>
                  <TableCell>{bucket.count}회</TableCell>
                  <TableCell>{bucket.cumulative}회</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </main>
  );
}
