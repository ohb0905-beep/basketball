# CLAUDE.md

이 파일은 이 저장소에서 작업하는 Claude를 위한 규칙입니다. 설치, 환경변수, 폴더 구조 전체 설명은 [README.md](README.md)에 있으니 여기서는 반복하지 않고, 실수하기 쉬운 규칙만 적습니다.

## 프로젝트

**로드 투 MVP**: 고교 벤치에서 NBA MVP까지 가는 한국어 농구 커리어 육성 시뮬레이션 웹 게임입니다.
Next.js 15 (App Router) + React 19 + TypeScript, Zustand(세이브는 브라우저 localStorage), Tailwind CSS 4, Bun, Supabase(피드백·익명 통계, 서버 전용).

## 소통 규칙

- 사용자와는 **항상 한국어**로 대화합니다. 게임 안 문구, 패치노트, 코드 주석도 한국어가 기본입니다.
- 사용자가 Supabase SQL 편집기에서 직접 SQL을 실행해야 할 때는 항상 아래 세 가지를 함께 줍니다.
  1. 쿼리 제목 (무엇을 하는 SQL인지 한 줄)
  2. 그대로 복사해 붙여 넣을 수 있는 **전체 SQL**
  3. 단계별 실행 방법 (어디를 눌러 어디에 붙여 넣고, 실행 후 무엇을 확인하는지)
- **사용자가 시키지 않은 일은 하기 전에 허락을 받습니다.** 요청 범위를 넘는 변경(안내 문구·UI 추가, 밸런스 수치 조정, 리팩터링, 기능 추가, 이름 변경, 삭제 등)은 먼저 무엇을 왜 하려는지와 영향을 짧게 설명하고 답을 받은 뒤 진행합니다. 질문할 때는 AskUserQuestion으로 선택지를 줍니다.
  - 예: 미국 고교 밸런스 방향만 정해 달라고 했는데 선수 만들기 화면 학교 탭에 난이도 안내 문구까지 넣은 것은 따로 허락을 받았어야 했습니다.
  - 허락 없이 해도 되는 것: 요청을 동작하게 하는 데 꼭 필요한 수정(타입 오류, 바뀐 데이터 개수에 맞춘 테스트 숫자)과 이 파일이 정한 절차(버전·패치노트, 테스트, 세이브 변환, 마이그레이션 안내). 이런 것도 끝난 뒤 보고에 적습니다.
  - 선택지를 제안할 때 요청 밖의 작업이 포함되면 그 부분을 선택지 설명에 분명히 따로 적습니다. 그래야 사용자가 고른 것이 그 작업까지 허락한 것인지 분명해집니다.

## 명령어

| 명령 | 용도 |
| --- | --- |
| `bun run dev` | 개발 서버 (환경변수 없이도 게임은 실행됨) |
| `bun run test` | 전체 테스트 (`bun test src`) |
| `bun run typecheck` | 타입 검사 |
| `bun run lint` | ESLint |
| `bun run balance:check` | 시드 고정 밸런스 회귀 검사 (약 50초) |
| `bun run balance:career` | 커리어 성장·은퇴 분포 분석 (결과는 커밋 제외 폴더 `balance-results/`) |

PR을 올리기 전에 CI(`.github/workflows/ci.yml`)와 같은 네 가지를 통과시킵니다.

```bash
bun run typecheck && bun run lint && bun run test && bun run balance:check
```

밸런스 값(`src/config/balanceConfig.ts`)을 바꿨는데 `balance:check`가 실패하면, 검사 기준을 고치기 전에 의도한 변화인지 먼저 확인합니다.

## 코드 지도

- `src/engine/`: 게임 로직 (시즌 시뮬레이션, 드래프트, 플레이오프, 성장, 은퇴, 이벤트). 순수 함수 위주이고 테스트가 여기 있습니다.
- `src/store/`: Zustand 커리어 스토어.
  - `useCareerStore.ts`는 조립과 저장(persist) 설정만 합니다. 새 액션은 `actions/` 아래 기능별 파일에 추가합니다.
  - 타입은 `careerStoreTypes.ts`, 여러 액션이 함께 쓰는 순수 함수는 `careerStoreHelpers.ts`.
  - 예전 세이브 변환은 `saveMigration.ts`.
- `src/config/`: `appMeta.ts`(버전), `balanceConfig.ts`(밸런스·경제 값).
- `src/lib/`: 서버 유틸 (분석 이벤트 스키마, 피드백, 설문, 관리자 인증, Supabase 접근).
- `src/data/patchNotes.ts`: 플레이어용 패치노트 (최신이 맨 앞).
- `src/lib/domainMove.ts`: 예전 주소(roadtomvp.vercel.app) → 새 주소(www.roadtomvp.com) 세이브 이사. 새 localStorage 값을 만들면 옮길 값인지 보고 `CARRIED_STORAGE_KEYS`에 넣습니다.
- 루트 `app/`은 `src/app/` 페이지를 다시 내보내기만 합니다. 실제 페이지는 `src/app/`에 작성합니다.
- `supabase/migrations/`: DB 마이그레이션 SQL.

## 버전과 패치노트

- 게임플레이, 밸런스 수치, 분석 이벤트 페이로드, 세이브 구조 중 하나라도 바뀌면 버전을 올립니다. 통계가 `game_version`으로 패치 전후를 나누기 때문입니다.
  - 버그 수정·정비: PATCH, 새 기능·밸런스 패치: MINOR.
  - `src/config/appMeta.ts`의 `GAME_VERSION`과 `package.json`의 `version`을 **함께** 올립니다 (테스트가 확인함).
- 버전을 올리면 `src/data/patchNotes.ts` 맨 앞에 노트를 추가합니다 (최신 노트 버전이 `GAME_VERSION`과 다르면 테스트 실패).
- 패치노트 문체는 **요약 + 체감 방향형**입니다.
  - 새 기능은 플레이어가 체감하는 말로 3~5줄.
  - 밸런스는 무엇이 어느 방향으로, 왜 바뀌었는지만 적고 **정확한 수치는 적지 않습니다**.
  - 버그 수정은 한 줄씩.
  - 기존 세이브에 영향이 있으면 `saveImpact`에 따로 적습니다.

## 분석 이벤트와 Supabase

- Supabase는 서버 API 라우트에서만 service_role 키로 접근합니다. 클라이언트 코드에서 Supabase를 부르거나 환경변수에 `NEXT_PUBLIC_`을 붙이지 않습니다.
- Vercel 미리보기 배포에서 들어온 이벤트는 `game_version`에 `-preview`가 붙습니다 (`tagPreviewGameVersion`). 정식 통계를 볼 때는 이 버전을 빼고 봅니다.
- 새 분석 이벤트를 추가할 때:
  1. `src/lib/analyticsSchema.ts`의 `ANALYTICS_EVENT_NAMES`와 검증 로직을 고칩니다.
  2. `analytics_events_event_name_check` CHECK 제약을 바꾸는 마이그레이션을 새로 만듭니다 (예: `20261125_analytics_survey_event.sql`).
  3. README의 마이그레이션 목록에 추가하고, 사용자에게 위 소통 규칙 형식으로 **배포 전에** 실행을 요청합니다. 제약이 먼저 바뀌지 않으면 새 이벤트는 운영에서 거부됩니다.
- **마이그레이션 파일 이름을 함부로 바꾸지 않습니다.** `20261124_*` 두 파일이 같은 버전 번호를 써서 Supabase GitHub 자동 배포가 실패하고 있는데, 이 실패 덕분에 승인 안 된 마이그레이션이 운영에 자동 적용되지 않고 있습니다. 이름 변경은 자동 배포 설정을 정리한 뒤 사용자의 확인을 받고 합니다.

## 하지 말 것

- 기존 세이브를 깨는 변경을 `saveMigration.ts` 변환과 테스트 없이 넣지 않습니다.
- 밸런스 검사를 통과시키려고 테스트나 검사 기준을 끄거나 느슨하게 만들지 않습니다.
- 비밀 값(.env 파일, service_role 키, 관리자 비밀번호)을 커밋하거나 대화·로그에 남기지 않습니다.
