# Image Management Counts, Thumbnails, and Download Design

## Goal

이미지 관리 서버에 다음 기능을 추가한다.

- 새 이미지 UID를 8자리로 생성한다.
- 이미지 업로드 시 원본과 별도의 썸네일 파일을 생성해 함께 관리한다.
- 이미지 삭제 시 원본과 썸네일을 함께 삭제한다.
- 업로드 횟수만 기록하는 `usage_records` 테이블을 추가한다.
- 관리자 화면에 일별, 월별, 연도별 업로드 횟수와 누적 횟수, 전체 총 횟수를 표시한다.
- 공개 이미지 페이지에서 원본 이미지 다운로드 버튼을 제공한다.

## Confirmed Decisions

- 이용 기록은 "이미지 업로드 횟수"만 의미한다.
- 이용 기록 테이블은 기존 D1 데이터베이스 안에 별도 테이블로 추가한다.
- 이용 기록에는 이미지 식별자, 파일명, 사용자 정보, IP, User-Agent, 파일 크기, MIME 타입을 저장하지 않는다.
- 이미지가 삭제되어도 이용 기록은 삭제하지 않는다.
- `library`와 `nakdong`을 따로 집계해야 하므로 `category`는 이용 기록에 저장한다.

## Approaches Considered

### Recommended: Event Count Table

`usage_records`에 업로드 1건당 1행을 저장한다. 컬럼은 `id`, `category`, `createdAt`만 둔다.

장점은 요구사항에 가장 가깝고, 개인정보성 로그를 남기지 않으며, 이미지 삭제와 완전히 분리된다는 점이다. 일별, 월별, 연도별 집계도 `createdAt`에서 날짜 단위를 추출해 계산할 수 있다.

### Alternative: Denormalized Counter Table

날짜별 카운터 테이블을 두고 업로드 때마다 해당 날짜의 숫자를 증가시킬 수도 있다. 조회는 빠르지만 일별, 월별, 연도별 누적 계산 로직과 동시성 처리가 더 복잡해진다. 현재 규모와 요구에는 과하다.

### Alternative: Rich Audit Log

이미지 UID, 파일명, 이벤트 타입, IP, User-Agent 등을 저장하는 감사 로그 방식도 가능하다. 나중에 추적성은 좋지만 현재 필요한 것은 횟수뿐이므로 데이터가 불필요하게 많고 개인정보성 로그 관리 부담이 생긴다.

## Data Model

### `images`

기존 이미지 테이블에 썸네일 경로를 추가한다.

```sql
ALTER TABLE images ADD COLUMN thumbnailKey TEXT;
```

신규 업로드부터는 `thumbnailKey`를 필수 값처럼 사용한다. 기존 행은 `thumbnailKey`가 없을 수 있으므로 목록 화면에서는 썸네일이 없으면 기존 원본 파일 URL로 fallback한다.

### `usage_records`

```sql
CREATE TABLE IF NOT EXISTS usage_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL CHECK (category IN ('library', 'nakdong')),
  createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_records_category_createdAt
ON usage_records(category, createdAt);
```

`createdAt`은 기존 이미지 생성 시간과 동일하게 KST 기준 ISO 문자열을 사용한다. 집계는 다음 방식으로 계산한다.

- 일별: `YYYY-MM-DD`
- 월별: `YYYY-MM`
- 연도별: `YYYY`

## Upload Flow

1. 업로드 토큰과 이미지 파일 유효성을 검증한다.
2. 8자리 UID를 생성한다.
3. 원본 파일 R2 key를 생성한다.
4. 썸네일 파일 R2 key를 생성한다.
5. 원본 이미지를 R2에 저장한다.
6. Cloudflare Images binding으로 작은 WebP 썸네일을 생성하고 R2에 저장한다.
7. `images` 테이블에 원본 key와 썸네일 key를 저장한다.
8. 이미지 등록 성공 후 `usage_records`에 `{ category, createdAt }` 한 행을 저장한다.
9. 업로드 응답은 기존처럼 생성된 이미지 메타데이터를 반환한다.

UID 충돌은 8자리로 줄어들면서 가능성이 올라가므로, `category + uid` 고유 제약 위반이 발생하면 제한된 횟수만큼 새 UID로 재시도한다.

## Thumbnail Read Flow

관리자 목록은 원본 파일 route 대신 썸네일 route를 사용한다.

```text
GET /api/{category}/images/{uid}/thumbnail
```

이 route는 이미지 row를 조회한 뒤 `thumbnailKey`가 있으면 썸네일 blob을 반환한다. 기존 데이터처럼 `thumbnailKey`가 없거나 썸네일 파일이 없는 경우에는 원본 파일 route와 동일한 원본 blob을 fallback으로 반환한다. 이 fallback은 기존 운영 데이터 호환을 위한 것이며, 신규 업로드는 항상 썸네일을 생성한다.

## Delete And Cleanup Flow

관리자 삭제와 만료 cleanup 모두 동일하게 동작한다.

1. 이미지 row를 조회한다.
2. 원본 key를 R2에서 삭제한다.
3. `thumbnailKey`가 있으면 썸네일 key도 R2에서 삭제한다.
4. `images` row를 삭제한다.
5. `usage_records`는 삭제하지 않는다.

R2 파일 삭제 중 일부가 실패하면 기존 cleanup 방식처럼 실패 카운트에 반영하고, 관리자 삭제는 오류 응답으로 처리한다.

## Public Download Flow

공개 이미지 페이지에 다운로드 버튼을 추가한다. 버튼은 새 API route로 연결한다.

```text
GET /api/{category}/images/{uid}/download
```

이 route는 이미지 row를 조회한 뒤 원본 파일을 R2에서 읽고 다음 헤더로 반환한다.

- `Content-Type`: 원본 blob type 또는 `application/octet-stream`
- `Content-Disposition`: `attachment; filename="<safe filename>"`
- `Cache-Control`: 기존 file route와 같은 짧은 private cache

기존 이미지 표시 route는 그대로 유지한다.

## Admin Usage Page

카테고리별 관리자 페이지 아래에 이용 기록 페이지를 추가한다.

```text
/{category}/admin/usage
```

관리자 세션이 없으면 기존 관리자 페이지와 동일하게 로그인으로 유도한다. 화면은 다음 정보를 제공한다.

- 기간 선택: 일별, 월별, 연도별
- 각 기간별 업로드 횟수
- 각 기간별 누적 업로드 횟수
- 전체 총 업로드 횟수

API는 다음 형태로 둔다.

```text
GET /api/{category}/usage?period=day|month|year
```

응답은 정렬된 bucket 목록과 전체 합계를 반환한다. 누적 횟수는 오래된 기간부터 합산한 값을 각 bucket에 포함한다.

## Runtime Compatibility

프로덕션 D1 migration 누락으로 테이블 오류가 발생했던 이력이 있으므로, 기존 self-heal 경로를 확장한다.

- `images` 테이블이 없으면 생성한다.
- `images.thumbnailKey` 컬럼이 없으면 추가한다.
- `usage_records` 테이블과 인덱스가 없으면 생성한다.

정상 배포 경로는 여전히 Wrangler D1 migration을 기준으로 한다. self-heal은 운영 장애 완화를 위한 보조 장치다.

## Testing

TDD 순서는 실패 테스트부터 작성한다.

- UID 생성 테스트: 8자리 hex 문자열을 반환한다.
- 업로드 서비스 테스트: 원본과 썸네일을 저장하고 이미지 row와 usage row를 생성한다.
- 삭제 서비스 테스트: 원본과 썸네일을 삭제하고 usage row는 삭제하지 않는다.
- cleanup 테스트: 만료 이미지의 원본과 썸네일을 함께 삭제한다.
- D1 repository 테스트: `thumbnailKey` 저장/조회와 `usage_records` 집계를 검증한다.
- API 테스트: 다운로드 route, 썸네일 route, usage route 인증과 응답을 검증한다.
- UI 테스트: 관리자 목록이 썸네일 URL을 사용하고, 공개 이미지 페이지에 다운로드 버튼이 보인다.

검증 명령은 최소 다음을 포함한다.

```bash
npm test
npm run lint
npm run typecheck
npm run cf:build
```

## Out Of Scope

- 업로드 외 조회수, 다운로드 수, 열람 수 기록
- IP/User-Agent 같은 방문자 추적
- 이미지별 상세 이용 내역
- 삭제된 이미지의 파일명 또는 UID 표시
- Cloudflare Analytics 기반 통계
