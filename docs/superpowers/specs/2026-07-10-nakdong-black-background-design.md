# Nakdong Viewer Black Background Design

## Goal

`nakdong` 공개 이미지 보기 화면의 전체 배경을 검정색으로 표시한다. 이미지 표시 방식과 `library` 화면은 기존 동작을 유지한다.

## Confirmed Behavior

- `nakdong`의 이미지 주변 여백과 짧은 이미지 아래의 viewport 영역은 검정색이다.
- 검정 배경은 화면 높이를 채우도록 `min-h-dvh`를 사용한다.
- 이미지의 `block h-auto w-full` 자연 비율 표시와 세로 스크롤 동작은 유지한다.
- `library`의 기존 `min-h-dvh bg-background text-foreground` 레이아웃은 변경하지 않는다.
- 전역 `body` 스타일, 공용 CSS, API, 라우트, 데이터 모델은 변경하지 않는다.

## Approaches Considered

### Recommended: Nakdong `<main>` Classes

`ImageViewer`의 `nakdong` 전용 `<main>`에 `min-h-dvh bg-black`을 추가한다.

이 방식은 카테고리 분기 안에서만 적용되며 짧은 이미지와 긴 이미지 모두 배경 범위를 보장한다. 현재 Tailwind 클래스 중심 구조와도 일치한다.

### Alternative: Category-Specific Global Body Class

페이지 진입 시 body에 카테고리 클래스를 설정하고 전역 CSS에서 배경을 바꿀 수 있다. 하지만 서버·클라이언트 경계가 늘어나고 `library` 전역 스타일에 영향을 줄 가능성이 있어 범위가 과하다.

### Alternative: Separate Viewer CSS Selector

`nakdong` 전용 CSS selector를 추가할 수 있지만 한 줄의 Tailwind 클래스 변경을 위해 별도 CSS 파일과 selector를 관리해야 하므로 사용하지 않는다.

## Component Design

변경 파일은 `src/components/viewer/image-viewer.tsx`와 `src/components/viewer/image-viewer.test.tsx`로 제한한다.

`nakdong` 경로의 main 클래스는 다음과 같다.

```tsx
<main className="min-h-dvh w-full bg-black">
```

내부 이미지는 기존처럼 다음 클래스를 유지한다.

```tsx
className="block h-auto w-full"
```

`library` 경로의 JSX는 한 글자도 변경하지 않는다.

## Error Handling

카테고리 검증, 이미지 조회 실패, 404 처리는 기존 라우트와 서비스 로직을 그대로 사용한다. 새로운 오류 상태나 로딩 처리는 추가하지 않는다.

## Testing

구현 전에 `image-viewer.test.tsx`에 다음 회귀 조건을 추가한다.

- `nakdong` main이 `min-h-dvh`, `w-full`, `bg-black`을 가진다.
- `nakdong` 이미지가 기존 `block h-auto w-full` 클래스를 유지한다.
- `library` main이 기존 `min-h-dvh bg-background text-foreground`를 유지한다.

집중 테스트 후 전체 Vitest, ESLint, TypeScript 검사를 실행한다.

## Out of Scope

- 이미지 파일 자체의 색상·밝기·필터 변경
- `library` 배경 변경
- 전역 body 배경 변경
- API, 라우트, 데이터베이스, 관리자 화면 변경
