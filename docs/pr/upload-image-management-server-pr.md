# PR: 고객 업로드 이미지 관리 서버 구현

## Summary

Next.js 16 App Router와 Cloudflare Workers 기반으로 `library`, `nakdong` 두 채널을 분리 관리하는 고객 업로드 이미지 관리 서버를 구현한다.

앱은 Cloudflare D1을 이미지 메타데이터 저장소로, Cloudflare R2를 원본 이미지 저장소로 사용한다. 이미지는 API를 통해서만 업로드할 수 있으며, 관리자 페이지에서는 로그인 후 채널별 이미지 목록 조회, 페이지 크기 변경, 페이지네이션, 새 탭 이미지 확인, 개별 삭제를 제공한다. 만료일이 지난 이미지는 Cloudflare Cron Trigger가 실행하는 별도 cleanup Worker에서 D1/R2 양쪽을 정리한다.

## Source Spec

- 기준 문서: `D:\Kwangkee_Works\Projects\2026_07_국립중앙도서관\업로드_이미지_관리_서버.md`
- 프로젝트 경로: `D:\Kwangkee_Works\Projects\2026_07_국립중앙도서관\user-image-management`
- 현재 상태: 신규 Git 저장소, 앱 소스 미생성

## References

- Cloudflare Workers Next.js guide: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- Cloudflare Wrangler configuration: https://developers.cloudflare.com/workers/wrangler/configuration/
- Cloudflare D1 getting started: https://developers.cloudflare.com/d1/get-started/
- Cloudflare R2 Workers API usage: https://developers.cloudflare.com/r2/api/workers/workers-api-usage/
- Cloudflare Cron Triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Cloudflare Scheduled Handler: https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/
- Cloudflare local data with Miniflare: https://developers.cloudflare.com/workers/local-development/local-data/

## Implementation Scope

- Scaffold a TypeScript Next.js 16 application configured for Cloudflare Workers with the OpenNext adapter.
- Initialize shadcn/ui and add only the UI components required by the admin and viewer flows.
- Configure Cloudflare bindings for shared D1 and R2 resources.
- Add separate development and production environment variable handling.
- Implement category isolation for `library` and `nakdong` across routes, auth, API, DB queries, object keys, admin pages, and public viewer pages.
- Implement Korean Standard Time date helpers so `createAt`, `expireAt`, display labels, and cleanup comparison are consistent even though Workers and Cron operate in UTC.
- Implement image CRUD API with upload restricted to API endpoints.
- Implement admin login with env-managed credentials and signed HTTP-only session cookies.
- Implement channel-specific admin image list pages at `/library/admin` and `/nakdong/admin`.
- Implement public mobile-first image viewer pages at `/library/[uid]` and `/nakdong/[uid]`.
- Implement a scheduled cleanup Worker that deletes expired database rows and their R2 objects.
- Add automated tests before implementation for domain logic, API behavior, cleanup behavior, and critical UI flows.

## Out of Scope

- User self-service account management.
- Image editing, cropping, or server-side optimization.
- Multiple admin roles.
- Public upload HTML form; upload must remain API-only.
- CDN custom domain setup beyond documenting required Cloudflare deployment settings.

## Architecture

The Next.js app handles HTTP UI and API traffic. Shared domain modules under `src/lib` own category validation, KST date handling, authentication, D1 repository access, R2 object storage, image service orchestration, and API response shapes.

The cleanup job is a separate Cloudflare Worker entrypoint under `src/workers/cleanup.ts`. It shares the same `src/lib/images` service code and uses the same D1/R2 bindings as the Next.js app. This avoids coupling Cron behavior to the generated OpenNext HTTP worker while still keeping cleanup logic tested and reused.

## Routes

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/library/admin` | admin session | Library image admin list |
| `GET` | `/nakdong/admin` | admin session | Nakdong image admin list |
| `GET` | `/library/[uid]` | public | Library image viewer |
| `GET` | `/nakdong/[uid]` | public | Nakdong image viewer |
| `POST` | `/api/[category]/auth/login` | none | Create admin session for one category |
| `POST` | `/api/[category]/auth/logout` | admin session | Clear admin session |
| `POST` | `/api/[category]/images` | API key | Upload one image |
| `GET` | `/api/[category]/images` | admin session | Paginated image list |
| `GET` | `/api/[category]/images/[uid]` | admin session or public viewer path proxy | Image metadata |
| `GET` | `/api/[category]/images/[uid]/file` | public | Stream image from R2 |
| `DELETE` | `/api/[category]/images/[uid]` | admin session | Delete image metadata and R2 object |

## API Contract

### `POST /api/[category]/images`

Request:

- Header: `x-upload-token: <UPLOAD_API_TOKEN>`
- Body: `multipart/form-data`
- Field: `file` as one image file

Validation:

- `category` must be `library` or `nakdong`.
- Missing or invalid upload token returns `401`.
- Missing file returns `400`.
- Non-image MIME type returns `415`.
- Successful upload generates a URL-safe UID and stores the object at `images/{category}/{uid}/{sanitizedFilename}`.

Response `201`:

```json
{
  "image": {
    "uid": "abc123",
    "category": "library",
    "filename": "photo.jpg",
    "key": "images/library/abc123/photo.jpg",
    "createAt": "2026-07-09T12:00:00.000+09:00",
    "expireAt": "2026-07-16T12:00:00.000+09:00"
  }
}
```

### `GET /api/[category]/images?page=1&pageSize=10`

Validation:

- `category` must be `library` or `nakdong`.
- `page` defaults to `1`.
- `pageSize` must be one of `10`, `20`, `30`; default is `10`.

Response `200`:

```json
{
  "items": [
    {
      "uid": "abc123",
      "category": "library",
      "filename": "photo.jpg",
      "key": "images/library/abc123/photo.jpg",
      "createAt": "2026-07-09T12:00:00.000+09:00",
      "expireAt": "2026-07-16T12:00:00.000+09:00",
      "thumbnailUrl": "/api/library/images/abc123/file"
    }
  ],
  "page": 1,
  "pageSize": 10,
  "total": 1,
  "totalPages": 1
}
```

### `DELETE /api/[category]/images/[uid]`

Behavior:

- Deletes the R2 object first when the database row exists.
- Deletes the D1 row after R2 deletion succeeds or after R2 returns missing object.
- Returns `204` for an existing image deleted successfully.
- Returns `404` when no row exists for the category and UID.

## Database

Create D1 migration `migrations/0001_create_images.sql`:

```sql
CREATE TABLE IF NOT EXISTS images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('library', 'nakdong')),
  filename TEXT NOT NULL,
  key TEXT NOT NULL,
  createAt TEXT NOT NULL,
  expireAt TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS images_category_uid_idx
  ON images(category, uid);

CREATE INDEX IF NOT EXISTS images_category_createAt_idx
  ON images(category, createAt DESC);

CREATE INDEX IF NOT EXISTS images_expireAt_idx
  ON images(expireAt);
```

Timestamps are stored as ISO-8601 strings with KST offset for display consistency and lexical comparison. Cleanup calculates the current KST start/end boundary in code and deletes rows whose `expireAt` is before today's KST date.

## Environment Variables

Local development uses `.env.local`; Cloudflare production uses Worker variables/secrets.

| Name | Example | Purpose |
| --- | --- | --- |
| `APP_ENV` | `development` or `production` | Selects runtime behavior and cookie security |
| `IMAGE_EXPIRE_DAYS` | `7` | Number of days added to `createAt` |
| `SESSION_SECRET` | random 32+ byte string | Signs admin session cookies |
| `UPLOAD_API_TOKEN` | random token | Protects upload API |
| `LIBRARY_ADMIN_ID` | `library-admin` | Library admin ID |
| `LIBRARY_ADMIN_PASSWORD` | secret | Library admin password |
| `NAKDONG_ADMIN_ID` | `nakdong-admin` | Nakdong admin ID |
| `NAKDONG_ADMIN_PASSWORD` | secret | Nakdong admin password |

Cloudflare bindings:

| Binding | Resource |
| --- | --- |
| `DB` | Cloudflare D1 database |
| `IMAGES_BUCKET` | Cloudflare R2 bucket |

## Admin UI Requirements

- `/[category]/admin` first shows login when no valid session exists.
- Login is scoped to the requested category; a `library` session must not unlock `/nakdong/admin`.
- List page provides page size select options `10`, `20`, `30`.
- List page displays thumbnail, UID, create time, expire time, and delete button.
- Clicking a list item opens `/${category}/${uid}` in a new browser tab.
- Delete action asks for confirmation and refreshes the current page after success.
- Empty state is shown when no images exist.
- Loading and error states are visible for list fetch and delete operations.

## Viewer UI Requirements

- `/[category]/[uid]` renders the image in a mobile portrait-friendly layout.
- Missing UID or mismatched category returns a user-facing not-found state.
- The image is loaded through the file API so R2 remains private.
- The layout uses the provided reference page direction: single-image focus, compact metadata, no admin controls.

## Cleanup Requirements

- Cleanup Worker runs from Cloudflare Cron Trigger.
- Cron expressions execute in UTC, so the job must calculate KST "today" explicitly.
- The job deletes every image whose `expireAt` date is before today's KST date.
- Each expired item deletes both the R2 object and the D1 row.
- Cleanup returns/logs counts for scanned, deleted, and failed rows.
- Failures for one object do not prevent cleanup attempts for remaining rows.

## Acceptance Criteria

- `npm test` passes.
- `npm run lint` passes.
- `npm run typecheck` passes.
- `npm run build` passes.
- `npm run preview` serves the OpenNext Cloudflare build locally.
- `POST /api/library/images` with a valid token uploads an image to R2 and inserts one D1 row with `category='library'`.
- `POST /api/nakdong/images` with a valid token uploads independently with `category='nakdong'`.
- Upload without `x-upload-token` returns `401`.
- Uploading anything other than an image returns `415`.
- `/library/admin` and `/nakdong/admin` require their own env credentials.
- Admin list supports page sizes `10`, `20`, `30` and renders correct pagination metadata.
- Admin delete removes the database row and the R2 object.
- Public viewer `/library/[uid]` does not show `nakdong` images with the same UID.
- Public viewer is usable at mobile portrait width.
- Cleanup deletes expired rows and their R2 objects while leaving non-expired rows untouched.
- Cleanup comparison uses KST, not the Worker host timezone.

## Testing Strategy

- Unit tests: category parsing, KST time helpers, UID/key generation, auth/session signing, pagination parsing.
- Service tests: image creation, listing, lookup, deletion, expired cleanup with fake D1/R2 adapters.
- Route handler tests: upload auth, image MIME validation, admin auth, category isolation, delete behavior.
- UI tests: login gating, page size select, pagination, delete confirmation, viewer rendering.
- Worker tests: scheduled cleanup invokes the cleanup service and reports result counts.

## Deployment Notes

- Use Cloudflare Workers for the Next.js app as recommended by the Cloudflare Next.js guide.
- Use Wrangler config for D1/R2 bindings; D1 and R2 can be automatically provisioned by Wrangler or created explicitly and referenced by IDs.
- Use a separate `wrangler.cleanup.jsonc` for the scheduled cleanup Worker with the same D1/R2 bindings.
- Configure Cron in UTC and document the KST-equivalent intended run time.
- Run local D1 migrations with `npx wrangler d1 execute <database> --local --file=./migrations/0001_create_images.sql`.

## PR Checklist

- [ ] Next.js 16 Cloudflare app scaffolded.
- [ ] shadcn/ui initialized and required components added.
- [ ] Cloudflare D1/R2 bindings configured for development and production.
- [ ] D1 migration added.
- [ ] KST time helpers implemented and tested.
- [ ] Category isolation implemented and tested.
- [ ] Upload/list/detail/delete APIs implemented and tested.
- [ ] Admin login and list UI implemented and tested.
- [ ] Public image viewer implemented and tested.
- [ ] Cleanup Worker implemented and tested.
- [ ] README documents local setup, env vars, migrations, preview, deployment, and cleanup trigger testing.
