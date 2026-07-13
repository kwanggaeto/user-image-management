import type { CloudflareEnv } from "@/types/cloudflare";
import type { Category } from "./categories";

export const SESSION_COOKIE_NAME = "uim_admin_session";
const DEFAULT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;
const REMEMBER_SESSION_MAX_AGE_SECONDS = DEFAULT_SESSION_MAX_AGE_SECONDS * 30;

export interface AdminCredential {
  id: string;
  password: string;
}

export function getAdminCredential(
  env: Pick<
    CloudflareEnv,
    | "LIBRARY_ADMIN_ID"
    | "LIBRARY_ADMIN_PASSWORD"
    | "NAKDONG_ADMIN_ID"
    | "NAKDONG_ADMIN_PASSWORD"
    | "DAEGU_ADMIN_ID"
    | "DAEGU_ADMIN_PASSWORD"
  >,
  category: Category,
): AdminCredential {
  if (category === "library") {
    return {
      id: env.LIBRARY_ADMIN_ID,
      password: env.LIBRARY_ADMIN_PASSWORD,
    };
  }

  if (category === "nakdong") {
    return {
      id: env.NAKDONG_ADMIN_ID,
      password: env.NAKDONG_ADMIN_PASSWORD,
    };
  }

  return {
    id: env.DAEGU_ADMIN_ID,
    password: env.DAEGU_ADMIN_PASSWORD,
  };
}

export function verifyAdminCredential(
  env: Parameters<typeof getAdminCredential>[0],
  category: Category,
  id: string,
  password: string,
): boolean {
  const credential = getAdminCredential(env, category);
  return credential.id === id && credential.password === password;
}

function bytesToBase64Url(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return bytesToBase64Url(signature);
}

export async function signSession(
  env: Pick<CloudflareEnv, "SESSION_SECRET">,
  category: Category,
): Promise<string> {
  const payload = `${category}.${Date.now()}`;
  const signature = await hmac(env.SESSION_SECRET, payload);
  return `${payload}.${signature}`;
}

export async function verifySession(
  env: Pick<CloudflareEnv, "SESSION_SECRET">,
  category: Category,
  cookieValue: string | undefined,
): Promise<boolean> {
  if (!cookieValue) {
    return false;
  }

  const parts = cookieValue.split(".");
  if (parts.length !== 3) {
    return false;
  }

  const [cookieCategory, createdAt, signature] = parts;
  if (cookieCategory !== category) {
    return false;
  }

  const payload = `${cookieCategory}.${createdAt}`;
  const expected = await hmac(env.SESSION_SECRET, payload);
  return signature === expected;
}

export function readCookie(
  header: string | null | undefined,
  name: string,
): string | undefined {
  if (!header) {
    return undefined;
  }

  const cookies = header.split(";").map((part) => part.trim());
  const prefix = `${name}=`;
  const cookie = cookies.find((part) => part.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : undefined;
}

export function createSessionCookie(
  value: string,
  appEnv: CloudflareEnv["APP_ENV"],
  remember = false,
): string {
  const secure = appEnv === "production" ? "; Secure" : "";
  const maxAge = remember
    ? REMEMBER_SESSION_MAX_AGE_SECONDS
    : DEFAULT_SESSION_MAX_AGE_SECONDS;
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(
    value,
  )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function createExpiredSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
