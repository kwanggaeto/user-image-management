# Nakdong Full-Width Image Viewer Design

## Goal

`nakdong` 공개 이미지 보기 페이지를 이미지 한 장만 보이는 전폭 레이아웃으로 바꾼다. `library` 공개 이미지 보기 페이지의 현재 내용과 스타일은 그대로 유지한다.

## Confirmed Behavior

- `nakdong`에서는 원본 이미지 표시 외의 화면 요소를 렌더링하지 않는다.
- 현재 화면에 표시되는 UID, 날짜(`createAt`), 원본 다운로드 버튼을 제거한다.
- 실제 `expireAt`은 현재 공개 뷰어에 표시되지 않으며 새로 추가하지 않는다.
- 이미지는 브라우저 가로폭을 모두 사용한다.
- 이미지 높이는 원본 종횡비에 따라 자동으로 정해진다.
- 세로로 긴 이미지는 페이지 스크롤로 이어서 본다.
- 좌우 여백, 최대 폭과 최대 높이, 둥근 모서리를 사용하지 않는다.
- `library`는 기존 UID, 날짜, 다운로드 버튼, 중앙 정렬, 크기 제한, 둥근 모서리를 모두 유지한다.
- 브라우저 탭의 전역 제목과 이미지 조회·다운로드 API는 변경하지 않는다.

## Approaches Considered

### Recommended: Category Branch Inside `ImageViewer`

`ImageViewer`가 받은 `image.category`가 `nakdong`이면 전폭 이미지 마크업을 조기 반환하고, 그 외에는 기존 `library` 마크업을 그대로 반환한다.

변경 범위가 한 컴포넌트로 제한되고 라우트나 데이터 모델을 건드리지 않는다. 두 레이아웃이 서로 다른 JSX 경로를 사용하므로 `library` 스타일에 조건부 클래스가 섞이지 않는 장점도 있다.

### Alternative: Separate Viewer Components

`NakdongImageViewer`와 `LibraryImageViewer`를 별도 파일로 만들고 라우트에서 선택할 수 있다. 경계는 가장 분명하지만 현재 레이아웃 규모에는 파일과 연결 코드가 불필요하게 늘어난다.

### Alternative: One Shared Tree With Conditional Classes

현재 마크업을 유지한 채 카테고리에 따라 클래스와 요소 표시 여부를 조건부로 바꿀 수 있다. 코드 줄 수는 적지만 `library` 클래스가 함께 바뀌거나 숨긴 메타데이터가 DOM에 남을 위험이 있어 사용하지 않는다.

## Component Design

공개 라우트 `src/app/[category]/[uid]/page.tsx`는 지금처럼 이미지를 조회해 `ImageViewer`에 전달한다. API, 저장소, 데이터 모델에는 변화가 없다.

`ImageViewer`의 `nakdong` 경로는 다음 속성을 가진 이미지 한 장만 렌더링한다.

- `src`: 기존 `/api/nakdong/images/{uid}/file`
- `alt`: 기존 원본 파일명
- 레이아웃: `display: block`, `width: 100%`, `height: auto`

전역 `body`의 `margin: 0`을 그대로 활용해 이미지가 화면 좌우 가장자리에 닿게 한다. `max-w-*`, `max-h-*`, `object-contain`, padding, border radius는 적용하지 않는다.

`library` 경로는 현재 컴포넌트의 기존 JSX와 클래스를 변경하지 않는다.

## Error Handling

카테고리 검증, 이미지 조회 실패, 만료 또는 누락 이미지의 404 처리는 기존 공개 라우트와 서비스가 담당한다. 이번 변경에서는 새로운 오류 상태를 추가하지 않는다.

## Testing

구현 전에 `src/components/viewer/image-viewer.test.tsx`에 실패 테스트를 추가한다.

- `nakdong` 이미지가 카테고리에 맞는 file URL과 전폭 자연 높이 클래스로 렌더링된다.
- `nakdong` 화면에는 UID, 날짜, 원본 다운로드 링크가 없다.
- `nakdong` 이미지에는 기존 최대 크기, 여백, 둥근 모서리 규칙이 적용되지 않는다.
- `library` 이미지에는 기존 UID, 날짜, 다운로드 링크와 기존 레이아웃 클래스가 그대로 남는다.

컴포넌트 테스트를 통과한 뒤 전체 단위 테스트, ESLint, TypeScript 검사, 프로덕션 빌드를 실행한다.

## Out of Scope

- 관리자 페이지 변경
- 이미지 file 또는 download API 변경·삭제
- 브라우저 탭 metadata 변경
- 이미지 확대, 축소, 제스처, 별도 로딩 UI
- `library` 공개 뷰어 디자인 변경
