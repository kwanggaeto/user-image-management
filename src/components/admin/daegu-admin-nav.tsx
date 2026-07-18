import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS, DAEGU_CATEGORIES, type DaeguCategory } from "@/lib/categories";

interface DaeguAdminNavProps {
  current: DaeguCategory;
}

export function DaeguAdminNav({ current }: DaeguAdminNavProps) {
  return (
    <nav aria-label="대구 관리자 섹션" className="border-b bg-muted/20">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap gap-2 px-4 py-3 md:px-8">
        {DAEGU_CATEGORIES.map((category) => (
          <Button
            key={category}
            asChild
            size="sm"
            variant={category === current ? "default" : "ghost"}
          >
            <a
              href={`/${category}/admin`}
              aria-current={category === current ? "page" : undefined}
            >
              {CATEGORY_LABELS[category]}
            </a>
          </Button>
        ))}
      </div>
    </nav>
  );
}
