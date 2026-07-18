import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CATEGORY_LABELS, DAEGU_CATEGORIES } from "@/lib/categories";

export function DaeguAdminHub() {
  return (
    <main className="min-h-dvh bg-muted/30 px-4 py-8 text-foreground">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">대구 관리자</h1>
          <p className="text-sm text-muted-foreground">
            관리할 목록을 선택하세요.
          </p>
        </header>
        <div className="grid gap-4 md:grid-cols-3">
          {DAEGU_CATEGORIES.map((category) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle>{CATEGORY_LABELS[category]}</CardTitle>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <a
                    href={`/${category}/admin`}
                    aria-label={CATEGORY_LABELS[category]}
                  >
                    목록 열기 <ArrowRightIcon data-icon="inline-end" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
