# 고객 업로드 이미지 관리 서버

Next.js 16, Cloudflare Workers, D1, R2 기반 이미지 관리 서버입니다. `library`, `nakdong` 두 채널을 같은 D1/R2 리소스에서 category로 분리합니다.

## Requirements

- Node.js 22 이상 권장
- npm
- Cloudflare 계정
- Wrangler 인증: `npx wrangler login`

## Install

```bash
npm install
```

## Local Environment

로컬 Next 개발에는 `.env.local`, Wrangler 로컬 실행에는 `.dev.vars`를 사용합니다. 비밀값은 커밋하지 않습니다.

```env
APP_ENV=development
IMAGE_EXPIRE_DAYS=7
SESSION_SECRET=local-development-session-secret
UPLOAD_API_TOKEN=local-upload-token
LIBRARY_ADMIN_ID=library-admin
LIBRARY_ADMIN_PASSWORD=library-pass
NAKDONG_ADMIN_ID=nakdong-admin
NAKDONG_ADMIN_PASSWORD=nakdong-pass
```

Cloudflare production에서는 `wrangler secret put` 또는 Dashboard secrets로 `SESSION_SECRET`, `UPLOAD_API_TOKEN`, 관리자 계정 값을 설정합니다.

## Cloudflare Resources

```bash
npx wrangler d1 create user-image-management
npx wrangler r2 bucket create user-image-management-images
```

D1을 명시 생성한 경우 출력된 `database_id`를 `wrangler.jsonc`, `wrangler.cleanup.jsonc`의 `d1_databases` 항목에 추가합니다.

## D1 Migration

Local:

```bash
npx wrangler d1 migrations apply user-image-management --local
```

Remote:

```bash
npx wrangler d1 migrations apply user-image-management --remote
```

## Development

```bash
npm run dev
```

Local app:

- `http://127.0.0.1:3000/library/admin`
- `http://127.0.0.1:3000/nakdong/admin`

## Tests

```bash
npm test
npm run lint
npm run typecheck
npm run e2e
```

## Cloudflare Preview And Deploy

```bash
npm run preview
npm run deploy
```

The OpenNext Cloudflare adapter builds `.open-next/worker.js` and Wrangler serves or deploys that Worker.

## Cleanup Worker

Deploy:

```bash
npm run cleanup:deploy
```

Local scheduled handler test:

```bash
npm run cleanup:dev
```

Then open:

```bash
curl "http://localhost:8787/__scheduled"
```

The cron expression in `wrangler.cleanup.jsonc` is `0 16 * * *`, which runs at 01:00 KST on the following calendar day because Cloudflare Cron uses UTC.

## Upload API

```bash
curl -X POST "http://127.0.0.1:3000/api/library/images" \
  -H "x-upload-token: local-upload-token" \
  -F "file=@./photo.jpg"
```

Supported categories are `library` and `nakdong`.
