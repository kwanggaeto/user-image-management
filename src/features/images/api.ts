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
import {
  createD1ImageRepository,
  createD1UsageRepository,
} from "@/lib/images/d1-repository";
import { createCloudflareThumbnailGenerator } from "@/lib/images/cloudflare-thumbnail-generator";
import { createR2ImageStorage } from "@/lib/images/r2-storage";
import {
  createImage,
  deleteImage,
  getImage,
  listImages,
  summarizeUsage,
} from "@/lib/images/service";
import type {
  ImageRepository,
  ImageStorage,
  ThumbnailGenerator,
  UsagePeriod,
  UsageRepository,
} from "@/lib/images/types";
import { DuplicateImageUidError } from "@/lib/images/types";
import { createUid as createRandomUid } from "@/lib/uid";
import type { CloudflareEnv } from "@/types/cloudflare";

interface HandlerBase {
  request: Request;
  env: CloudflareEnv;
  categoryValue: string;
  repository?: ImageRepository;
  storage?: ImageStorage;
  thumbnailGenerator?: ThumbnailGenerator;
  usageRepository?: UsageRepository;
}

interface UploadHandlerInput extends HandlerBase {
  createUid?: () => string;
  now?: () => Date;
}

interface UploadedImageFile {
  name: string;
  type: string;
  blob: Blob;
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

function thumbnailGeneratorFor(input: HandlerBase): ThumbnailGenerator {
  return (
    input.thumbnailGenerator ??
    createCloudflareThumbnailGenerator(input.env.IMAGES)
  );
}

function usageRepositoryFor(input: HandlerBase): UsageRepository {
  return input.usageRepository ?? createD1UsageRepository(input.env.DB);
}

function parseExpireDays(env: CloudflareEnv): number {
  const parsed = Number(env.IMAGE_EXPIRE_DAYS);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 7;
}

function parseUsagePeriod(value: string | null): UsagePeriod {
  return value === "month" || value === "year" ? value : "day";
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

function parseBoundary(contentType: string | null): string | null {
  const match = contentType?.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  return match?.[1] ?? match?.[2]?.trim() ?? null;
}

function indexOfBytes(
  source: Uint8Array,
  search: Uint8Array,
  from = 0,
): number {
  for (let index = from; index <= source.length - search.length; index += 1) {
    let matched = true;
    for (let offset = 0; offset < search.length; offset += 1) {
      if (source[index + offset] !== search[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) {
      return index;
    }
  }
  return -1;
}

function parsePartHeaders(value: string): {
  name: string | null;
  filename: string | null;
  contentType: string;
} {
  const headers = new Headers();
  for (const line of value.split("\r\n")) {
    const separator = line.indexOf(":");
    if (separator > -1) {
      headers.set(line.slice(0, separator), line.slice(separator + 1).trim());
    }
  }

  const disposition = headers.get("content-disposition") ?? "";
  const readDispositionValue = (key: string) => {
    const match = new RegExp(
      `(?:^|;\\s*)${key}=(?:"([^"]*)"|([^;\\r\\n]*))`,
    ).exec(disposition);
    return match?.[1] ?? match?.[2]?.trim() ?? null;
  };

  return {
    name: readDispositionValue("name"),
    filename: readDispositionValue("filename"),
    contentType: headers.get("content-type") ?? "application/octet-stream",
  };
}

function inferImageContentType(filename: string, contentType: string): string {
  if (contentType && contentType !== "application/octet-stream") {
    return contentType;
  }

  const extension = filename.toLowerCase().split(".").pop();
  if (extension === "jpg" || extension === "jpeg") {
    return "image/jpeg";
  }
  if (extension === "png") {
    return "image/png";
  }
  if (extension === "webp") {
    return "image/webp";
  }
  if (extension === "gif") {
    return "image/gif";
  }
  return contentType;
}

async function parseMultipartUploadFile(
  request: Request,
): Promise<UploadedImageFile | null> {
  const boundary = parseBoundary(request.headers.get("content-type"));
  if (!boundary) {
    return null;
  }

  const body = new Uint8Array(await request.arrayBuffer());
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const boundaryMarker = encoder.encode(`--${boundary}`);
  const nextBoundaryMarker = encoder.encode(`\r\n--${boundary}`);
  const headerSeparator = encoder.encode("\r\n\r\n");
  let partStart = indexOfBytes(body, boundaryMarker);

  while (partStart > -1) {
    let cursor = partStart + boundaryMarker.length;
    if (body[cursor] === 45 && body[cursor + 1] === 45) {
      return null;
    }
    if (body[cursor] === 13 && body[cursor + 1] === 10) {
      cursor += 2;
    }

    const headerEnd = indexOfBytes(body, headerSeparator, cursor);
    if (headerEnd === -1) {
      return null;
    }

    const contentStart = headerEnd + headerSeparator.length;
    const contentEnd = indexOfBytes(body, nextBoundaryMarker, contentStart);
    if (contentEnd === -1) {
      return null;
    }

    const headers = parsePartHeaders(
      decoder.decode(body.subarray(cursor, headerEnd)),
    );
    if (headers.name === "file" && headers.filename) {
      const type = inferImageContentType(headers.filename, headers.contentType);
      return {
        name: headers.filename,
        type,
        blob: new Blob([body.slice(contentStart, contentEnd)], { type }),
      };
    }

    partStart = contentEnd + 2;
  }

  return null;
}

async function readUploadFile(request: Request): Promise<UploadedImageFile | null> {
  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    return parseMultipartUploadFile(request);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!isUploadedFile(file)) {
    return null;
  }

  const type = inferImageContentType(file.name, file.type);
  return {
    name: file.name,
    type,
    blob: new Blob([await file.arrayBuffer()], { type }),
  };
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
    | { id?: string; password?: string; remember?: boolean }
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
        "Set-Cookie": createSessionCookie(
          session,
          input.env.APP_ENV,
          body.remember === true,
        ),
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

  const file = await readUploadFile(input.request);
  if (!file) {
    return error("Image file is required", 400);
  }

  if (!file.type.startsWith("image/")) {
    return error("Only image uploads are supported", 415);
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const image = await createImage({
        repository: repositoryFor(input),
        storage: storageFor(input),
        thumbnailGenerator: thumbnailGeneratorFor(input),
        usageRepository: usageRepositoryFor(input),
        category,
        uid: input.createUid?.() ?? createRandomUid(),
        filename: file.name,
        file: file.blob,
        now: input.now?.() ?? new Date(),
        expireDays: parseExpireDays(input.env),
      });

      const viewUrl = new URL(
        `/${category}/${image.uid}`,
        input.request.url,
      ).toString();

      return json({ image, viewUrl }, { status: 201 });
    } catch (error) {
      if (!(error instanceof DuplicateImageUidError) || attempt === 4) {
        throw error;
      }
    }
  }

  return error("Unable to allocate image uid", 500);
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

export async function handleImageThumbnail(
  input: HandlerBase & { uid: string },
): Promise<Response> {
  const category = parseCategory(input.categoryValue);
  const image = await getImage(repositoryFor(input), category, input.uid);
  if (!image) {
    return error("Image not found", 404);
  }

  const storage = storageFor(input);
  const blob =
    (image.thumbnailKey ? await storage.get(image.thumbnailKey) : null) ??
    (await storage.get(image.key));
  if (!blob) {
    return error("Image file not found", 404);
  }

  return new Response(blob, {
    headers: {
      "Content-Type": blob.type || "application/octet-stream",
      "Cache-Control": "private, max-age=300",
    },
  });
}

export async function handleImageDownload(
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
      "Content-Disposition": `attachment; filename="${image.filename}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}

export async function handleUsageSummary(input: HandlerBase): Promise<Response> {
  const category = parseCategory(input.categoryValue);
  if (!(await isAdminSession(input))) {
    return error("Authentication required", 401);
  }

  const url = new URL(input.request.url);
  const period = parseUsagePeriod(url.searchParams.get("period"));
  return json(await summarizeUsage(usageRepositoryFor(input), category, period));
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
