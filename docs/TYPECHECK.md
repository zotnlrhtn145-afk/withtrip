# 타입 검사 (2026-09-12)

## 실행

```sh
npm run typecheck
```

- `typecheck:web`: `next typegen`으로 현재 라우트를 생성한 뒤 웹 전체 `tsc --noEmit --incremental false`.
- `typecheck:functions`: `scripts/check-edge-functions.mjs`가 실제 `supabase/functions/*/index.ts`를 찾아 Deno 2.9.6으로 검사. npm 임시 캐시의 고정 버전 도구 사용; 첫 실행은 네트워크가 필요할 수 있음.
- 검사만 하며 앱 빌드·배포·서버 실행·DB 접근·푸시 발송을 하지 않음.

## 남았던 26개 진단의 원인과 해결

1. Next 2개: `.next/types`는 `/_admin`, `/_buglist`, `.next/dev/types`는 `/%5Fadmin`, `/%5Fbuglist`를 생성해 전역 LayoutProps의 경로 타입이 충돌. 생성 파일은 직접 수정하지 않음. 웹 검사에서는 `.next/dev/**`를 제외하고 **현재 소스에서 새로 만든 일반 타입/validator** 하나로 모든 라우트를 검사. 관리자 URL/폴더는 그대로.
2. Deno 함수 24개: 웹 컴파일러가 Deno 전역과 HTTPS import를 알지 못해 모듈 미발견·Deno 미정의·추론 실패가 연쇄 발생. 웹 검사에서 functions 트리를 분리하고 Deno 엄격 검사에 반드시 포함.
3. `ignoreBuildErrors: true`를 false로 바꿔 향후 빌드에서 타입 오류를 무시하지 않게 함. 실제 빌드는 실행하지 않음.

Deno 검사 설정/잠금 파일은 `scripts/edge-typecheck/`에 두어 배포 함수의 설정 탐색이나 운영 런타임을 바꾸지 않음. 기존 함수 본문·원격 import는 수정하지 않았음. 현재 검사에서 esm.sh의 @supabase/supabase-js@2는 2.116.0으로 해석됨. 잠금 파일과 frozen 옵션으로 검사 의존성 변경을 감지.

## 검증 결과

- 전체 `npm run typecheck`: 종료0, 타입 진단0.
- chat/dm/notify 푸시 함수3개: Deno 2.9.6 통과. Deno 2.1.14도 별도 no-config/no-lock 검사 통과.
- Deno 의존성 그래프에서 Supabase의 실제 원격 타입 포함 확인(함수1개 기준57개 모듈).
- 오류 검출 검사: 임시 웹 페이지의 숫자 default export는 Next 라우트 validator에서 실패, 임시 Deno 함수의 잘못된 string 대입도 실패. 두 임시 파일 제거 후 전체 재검사 통과. 검사 명령에 no-check/오류 무시 옵션을 추가하지 않음.
- 실제 푸시 수신·웹훅 인증·DB 저장·모바일 런타임 검증은 이 타입 검사 결과와 별개임.

참고: [Supabase 개발환경](https://supabase.com/docs/guides/functions/development-environment), [Deno check](https://docs.deno.com/runtime/reference/cli/check/).
