export default function NotFoundPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
      <div className="flex w-full max-w-sm flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold">이미지를 찾을 수 없습니다.</h1>
        <p className="text-sm text-muted-foreground">
          링크가 잘못되었거나 이미지가 삭제되었을 수 있습니다.
        </p>
      </div>
    </main>
  );
}
