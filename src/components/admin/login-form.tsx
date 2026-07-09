"use client";

import { useState, type FormEvent } from "react";
import { LogInIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Category } from "@/lib/categories";

interface LoginFormProps {
  category: Category;
}

function readSavedAdminId(key: string): string {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

export function LoginForm({ category }: LoginFormProps) {
  const savedIdStorageKey = `uim:${category}:saved-admin-id`;
  const [id, setId] = useState(() => readSavedAdminId(savedIdStorageKey));
  const [password, setPassword] = useState("");
  const [rememberLogin, setRememberLogin] = useState(false);
  const [saveId, setSaveId] = useState(() =>
    Boolean(readSavedAdminId(savedIdStorageKey)),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const response = await fetch(`/api/${category}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id, password, remember: rememberLogin }),
    });

    setPending(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(body?.error ?? "로그인에 실패했습니다.");
      return;
    }

    try {
      if (saveId && id.trim()) {
        window.localStorage.setItem(savedIdStorageKey, id.trim());
      } else {
        window.localStorage.removeItem(savedIdStorageKey);
      }
    } catch {
      // Storage errors should not block a successful login.
    }

    window.location.reload();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 px-4 py-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>관리자 로그인</CardTitle>
          <CardDescription>이미지 목록을 보려면 로그인하세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <FieldGroup>
              <Field data-invalid={!!error}>
                <FieldLabel htmlFor="admin-id">아이디</FieldLabel>
                <Input
                  id="admin-id"
                  value={id}
                  onChange={(event) => setId(event.target.value)}
                  autoComplete="username"
                  aria-invalid={!!error}
                />
              </Field>
              <Field data-invalid={!!error}>
                <FieldLabel htmlFor="admin-password">비밀번호</FieldLabel>
                <Input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  aria-invalid={!!error}
                />
                {error ? (
                  <FieldError>{error}</FieldError>
                ) : (
                  <FieldDescription>
                    채널별 환경변수로 설정된 계정을 사용합니다.
                  </FieldDescription>
                )}
              </Field>
              <div className="grid gap-3 rounded-md border bg-muted/20 p-3 text-sm">
                <label
                  htmlFor="remember-login"
                  className="flex cursor-pointer items-center gap-2"
                >
                  <input
                    id="remember-login"
                    type="checkbox"
                    checked={rememberLogin}
                    onChange={(event) =>
                      setRememberLogin(event.target.checked)
                    }
                    className="size-4 rounded border-input accent-primary"
                  />
                  <span>로그인 유지</span>
                </label>
                <label
                  htmlFor="save-admin-id"
                  className="flex cursor-pointer items-center gap-2"
                >
                  <input
                    id="save-admin-id"
                    type="checkbox"
                    checked={saveId}
                    onChange={(event) => setSaveId(event.target.checked)}
                    className="size-4 rounded border-input accent-primary"
                  />
                  <span>아이디 저장</span>
                </label>
              </div>
              <Button type="submit" disabled={pending}>
                <LogInIcon data-icon="inline-start" />
                로그인
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
