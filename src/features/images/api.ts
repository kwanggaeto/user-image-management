import {
  createExpiredSessionCookie,
  createSessionCookie,
  readCookie,
  SESSION_COOKIE_NAME,
  signSession,
  verifyAdminCredential,
  verifySession,
} from "@/lib/auth";
import { parseCategory, parsePage, parsePageSize } from "@/lib/categories";
import { createD1ImageRepository } from "@/lib/images/d1-repository";
import { createR2ImageStorage } from "@/lib/images/r2-storage";
import {
  createImage,
  deleteImage,
  getImage,
  listImages,
} from "@/lib/images/service";
import type { ImageRepository, ImageStorage } from "@/lib/images/types";
import { createUid as createRandomUid } from "@/lib/uid";
import type { CloudflareEnv } from "@/types/cloudflare";

interface HandlerBase {
  request: Request;
  env: CloudflareEnv;
  categoryValue: string;
  repository?: ImageRepository;
  storage?: ImageStorage;
}

interface UploadHandlerInput extends HandlerBase {
  createUid?: () => string;
  now?: () => Date;
}

function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

function error(message: string, status: number): Response {
  return json({ error: message }, { status });
}

function repositoryFor(input: HandlerBase): ImageRepository {
  return input.repository ?? createD1ImageRepository(input.env.DB);
}

function storageFor(input: HandlerBase): ImageStorage {
  return input.storage ?? createR2ImageStorage(input.env.IMAGES_BUCKET);
}

function parseExpireDays(env: CloudflareEnv): number {
  const parsed = Number(env.IMAGE_EXPIRE_DAYS);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 7;
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof value.name === "string" &&
    "type" in value &&
    typeof value.type === "string" &&
    "arrayBuffer" in value &&
    typeof value.arrayBuffer === "function"
  );
}

async function isAdminSession(input: HandlerBase): Promise<boolean> {
  const category = parseCategory(input.categoryValue);
  const cookieValue = readCookie(
    input.request.headers.get("cookie"),
    SESSION_COOKIE_NAME,
  );
  return verifySession(input.env, category, cookieValue);
}

export async function handleLogin(input: HandlerBase): Promise<Response> {
  const category = parseCategory(input.categoryValue);
  const body = (await input.request.json().catch(() => null)) as
    | { id?: string; password?: string }
    | null;

  if (!body?.id || !body.password) {
    return error("아이디와 비밀번호를 입력하세요.", 400);
  }

  if (
    !verifyAdminCredential(input.env, category, body.id, body.password)
  ) {
    return error("로그인 정보가 올바르지 않습니다.", 401);
  }

  const session = await signSession(input.env, category);
  return json(
    { ok: true },
    {
      status: 200,
      headers: {
        "Set-Cookie": createSessionCookie(session, input.env.APP_ENV),
      },
    },
  );
}

export async function handleLogout(): Promise<Response> {
  return json(
    { ok: true },
    {
      status: 200,
      headers: {
        "Set-Cookie": createExpiredSessionCookie(),
      },
    },
  );
}

export async function handleImageUpload(
  input: UploadHandlerInput,
): Promise<Response> {
  const category = parseCategory(input.categoryValue);
  if (input.request.headers.get("x-upload-token") !== input.env.UPLOAD_API_TOKEN) {
    return error("Invalid upload token", 401);
  }

  const formData = await input.request.formData();
  const file = formData.get("file");
  if (!isUploadedFile(file)) {
    return error("Image file is required", 400);
  }

  if (!file.type.startsWith("image/")) {
    return error("Only image uploads are supported", 415);
  }

  const image = await createImage({
    repository: repositoryFor(input),
    storage: storageFor(input),
    category,
    uid: input.createUid?.() ?? createRandomUid(),
    filename: file.name,
    file,
    now: input.now?.() ?? new Date(),
    expireDays: parseExpireDays(input.env),
  });

  return json({ image }, { status: 201 });
}

export async function handleImageList(input: HandlerBase): Promise<Response> {
  const category = parseCategory(input.categoryValue);
  if (!(await isAdminSession(input))) {
    return error("Authentication required", 401);
  }

  const url = new URL(input.request.url);
  const page = parsePage(url.searchParams.get("page"));
  const pageSize = parsePageSize(url.searchParams.get("pageSize"));
  return json(await listImages(repositoryFor(input), category, page, pageSize));
}

export async function handleImageMetadata(
  input: HandlerBase & { uid: string; requireAdmin?: boolean },
): Promise<Response> {
  const category = parseCategory(input.categoryValue);
  if (input.requireAdmin && !(await isAdminSession(input))) {
    return error("Authentication required", 401);
  }

  const image = await getImage(repositoryFor(input), category, input.uid);
  if (!image) {
    return error("Image not found", 404);
  }
  return json({ image });
}

export async function handleImageFile(
  input: HandlerBase & { uid: string },
): Promise<Response> {
  const category = parseCategory(input.categoryValue);
  const image = await getImage(repositoryFor(input), category, input.uid);
  if (!image) {
    return error("Image not found", 404);
  }

  const blob = await storageFor(input).get(image.key);
  if (!blob) {
    return error("Image file not found", 404);
  }

  return new Response(blob, {
    headers: {
      "Content-Type": blob.type || "application/octet-stream",
      "Cache-Control": "private, max-age=60",
    },
  });
}

export async function handleImageDelete(
  input: HandlerBase & { uid: string },
): Promise<Response> {
  const category = parseCategory(input.categoryValue);
  if (!(await isAdminSession(input))) {
    return error("Authentication required", 401);
  }

  const deleted = await deleteImage(
    repositoryFor(input),
    storageFor(input),
    category,
    input.uid,
  );

  if (!deleted) {
    return error("Image not found", 404);
  }

  return new Response(null, { status: 204 });
}
