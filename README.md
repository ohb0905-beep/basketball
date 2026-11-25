# 벤치에서 MVP까지 (From Bench to MVP)

고교 농구 벤치 끝자리에서 시작해 U리그·NCAA, KBL·해외 리그, G리그를 거쳐 NBA MVP와 영구결번 레전드에 도전하는 농구 선수 커리어 육성 시뮬레이션 웹 게임입니다.

- **프레임워크:** Next.js 15 (App Router), React 19, TypeScript
- **상태 관리:** Zustand (게임 저장은 브라우저 localStorage)
- **스타일:** Tailwind CSS 4
- **런타임·패키지 매니저:** [Bun](https://bun.sh)
- **서버 저장소:** Supabase (피드백·익명 플레이 통계, 서버 API 라우트에서만 접근)

## 빠른 시작

```bash
bun install
cp .env.example .env.local   # 필요한 값만 채우면 됩니다 (아래 참고)
bun run dev                  # http://localhost:3000
```

게임 자체는 환경변수 없이도 실행됩니다. Supabase와 관리자 콘솔을 쓰려면 아래 환경변수를 설정하세요.

## 환경변수

모든 값은 **서버 전용**입니다. 절대 `NEXT_PUBLIC_` 접두사를 붙이지 마세요.

| 변수 | 필요한 기능 | 설명 |
| --- | --- | --- |
| `SUPABASE_URL` | 피드백 제출, 통계 수집, 관리자 콘솔 | Supabase 프로젝트 URL (`https://<project>.supabase.co`). 로컬 개발은 `http://localhost`도 허용 |
| `SUPABASE_SERVICE_ROLE_KEY` | 위와 동일 | Supabase service_role 키. 서버 API 라우트에서만 사용 |
| `ADMIN_PASSWORD` | 관리자 콘솔 | 관리자 로그인 비밀번호 |
| `ADMIN_SESSION_SECRET` | 관리자 콘솔 | 관리자 세션 쿠키 서명 키. `openssl rand -base64 32`로 생성 권장 |

Supabase 값이 없으면 피드백·통계 API가 설정 누락 오류를 돌려주고, 관리자 값이 없으면 관리자 로그인이 비활성화됩니다.

### Supabase 설정

1. Supabase에서 프로젝트를 만듭니다.
2. `supabase/migrations/`의 SQL을 순서대로 실행해 테이블을 만듭니다.
   - `20261124_create_feedbacks.sql`: 버그 제보·피드백 (`feedbacks`)
   - `20261124_create_analytics_events.sql`: 익명 플레이 통계 (`analytics_events`)
   - `20261125_admin_analytics_report.sql`: `/admin/analytics` 대시보드용 서버 집계 함수 (테이블은 변경하지 않음, service_role만 실행 가능). 2026-11-25 2차: 버전별 비교·난이도 설문·생성→드래프트 퍼널 추가 (다시 실행하면 교체됨)
   - `20261125_analytics_funnel_events.sql`: 1.0.1 퍼널 이벤트(`creation_started`, `draft_completed`) 허용. 1.0.1 배포 전에 실행
   - `20261125_analytics_retention.sql`: (사용 안 함) 예전 30일 보존안. `20261126_analytics_capacity.sql`로 대체되어 비워 둠
   - `20261125_analytics_survey_event.sql`: 1.1.2 난이도 설문 이벤트(`survey_response`) 허용. 1.1.2 배포 전에 실행
   - `20261125_analytics_drop_unused_index.sql`: 1.1.3 용량 절감. 거의 쓰지 않는 anonymous_id 인덱스 삭제 (배포 순서와 무관, 데이터 변경 없음)
   - `20261126_analytics_capacity.sql`: 용량 대비 1단계. 커리어·플레이어·일별 요약 테이블과 자동 갱신 트리거, `analytics_daily_maintenance(보존일수)` 정리 함수, 집계 함수 v3(요약 테이블 + 최근 원본, DB 용량 표시). 실행만으로는 아무것도 지우지 않음
   - `20261126_analytics_capacity_cron.sql`: 매일 04:00 KST에 `analytics_daily_maintenance(14)` 실행 예약 (pg_cron). 14일이 지난 원본 통계를 지움 (난이도 설문은 남김). 위 파일 다음에 실행
   - `20261127_admin_analytics_v4.sql`: 집계 함수 v4. 최근 24시간·오늘 시간별 추이, 미리보기를 뺀 정식 버전 필터(`release`). 테이블 데이터는 바꾸지 않음 (다시 실행하면 교체됨)
   - SQL 편집기에 붙여 넣거나, Supabase CLI로 `supabase db push`를 실행하면 됩니다.
3. 프로젝트 설정의 API 메뉴에서 URL과 service_role 키를 복사해 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`에 넣습니다.

### 관리자 콘솔

`ADMIN_PASSWORD`와 `ADMIN_SESSION_SECRET`을 설정한 뒤 아래 주소로 접속해 비밀번호로 로그인합니다.

- `/admin/feedback`: 피드백 목록 조회(제목·내용·메모 검색, 설문·버전 필터), 상태 변경, 관리자 메모
- `/admin/analytics`: 익명 플레이 통계 대시보드 (리그별 우승·MVP·FMVP, 포지션 밸런스, 리셋 병목, 밸런스 리포트 JSON 복사)

세션은 12시간 유지되고, 10분 동안 로그인을 8회 실패하면 잠시 차단됩니다.

## 버전과 패치노트

- 버전은 `src/config/appMeta.ts`의 `GAME_VERSION`과 `package.json`의 `version`을 함께 올립니다. 테스트가 둘이 같은지 확인합니다.
- 밸런스 수치, 분석 이벤트 페이로드, 세이브 구조 중 하나라도 바뀌면 버전을 올립니다. 통계가 `game_version`으로 패치 전후를 나누기 때문입니다.
  - 버그 수정·정비: PATCH (1.0.0 → 1.0.1)
  - 새 기능·밸런스 패치: MINOR (1.0.1 → 1.1.0)
- 버전을 올릴 때 `src/data/patchNotes.ts` 맨 앞에 노트를 추가합니다. 최신 노트 버전이 `GAME_VERSION`과 다르면 테스트가 실패합니다.
- 패치노트 작성 원칙: 새 기능은 플레이어가 체감하는 말로 3~5줄, 밸런스는 무엇이 어느 방향으로 왜 바뀌었는지만 (정확한 수치는 적지 않음), 버그 수정은 한 줄씩, 기존 세이브에 영향이 있으면 `saveImpact`에 따로 적습니다.
- 노트는 `/patch-notes`에 표시되고, 푸터의 패치노트 링크에 새 버전을 아직 안 본 플레이어에게 NEW 배지가 한 번 뜹니다.
- Vercel 미리보기(Preview) 배포에서 들어온 분석 이벤트는 `game_version`에 `-preview`가 붙어(예: `1.1.0-preview`) 정식 통계와 섞이지 않습니다. 관리자 대시보드에서 버전으로 골라 볼 수 있습니다.

## 국적과 미국 고교 (1.2.0)

- 국적 목록과 대한민국 국적 판별(`isKoreanNational`)은 `src/data/nationalities.ts`에 있습니다. 병역(상무), 국가대표 소집, 태극마크 아크, KBL 드래프트는 대한민국 국적에만 적용됩니다. 한국 고교도 대한민국 국적만 입학할 수 있습니다(외국 국적은 미국 고교로 시작).
- 미국 고교는 별도 리그 `US_HIGH_SCHOOL`이고 팀은 `US_HIGH_SCHOOL_TEAMS`(24개교)입니다. 고교 리그를 판별할 때는 `'HIGH_SCHOOL'`을 직접 비교하지 말고 `isHighSchoolLeague()`(`src/data/leagues.ts`)를 씁니다.
- 미국 고교 육성 보정(잠재력, 성장 속도)은 `balanceConfig.ts`의 `US_HIGH_SCHOOL_DEVELOPMENT_CONFIG`, 성장 상한은 `leagues.ts`의 `growthCap`입니다.
- 미국 고교 팀 전력 변동은 별도 난수를 씁니다(`evolveLeagueTeamRatings`). 공용 난수를 쓰면 시드 고정 밸런스 검사의 한국 경로 결과가 바뀝니다.
- 미국 고교 경로 분포: `bun scripts/nba-path-sim.ts 300 20261125 --policy=mixed --start=us [--nationality=KOR]` (`balance:check` 기준은 한국 경로용이라 미국 경로에는 적용하지 않습니다)

## 앱 설치 (PWA, 1.1.4)

- `app/manifest.ts`: 앱 이름·색·아이콘 정보. `app/icon.png`(탭 아이콘), `app/apple-icon.png`(아이폰 홈 화면)는 Next.js 규칙상 루트 `app/`에 둡니다.
- `public/icons/`: 설치용 아이콘 (192, 512, 안드로이드용 여백 버전). `node scripts/make-app-icons.js <폴더>`로 다시 만들 수 있습니다.
- `public/sw.js`: 오프라인 캐시. 화면은 네트워크 우선, 빌드 파일·아이콘·로고·글꼴은 저장본 우선, `/api`·`/admin`은 캐시하지 않습니다. 캐시 이름에 `GAME_VERSION`이 들어가 새 버전 배포 시 예전 캐시가 지워집니다. 개발 서버(`bun run dev`)에서는 등록하지 않습니다.
- 홈 화면 추가 안내는 휴대폰 브라우저 첫 화면에만 나오고, 닫으면 다시 안 보입니다. `session_start` 통계의 `displayMode`로 앱 실행 비율을 볼 수 있습니다.

## 명령어

| 명령 | 설명 |
| --- | --- |
| `bun run dev` | 개발 서버 |
| `bun run build` / `bun run start` | 프로덕션 빌드 및 실행 (`output: 'standalone'`) |
| `bun run typecheck` | TypeScript 타입 검사 (`tsc --noEmit`) |
| `bun run lint` | ESLint |
| `bun run test` | 전체 테스트 (`bun test src`) |
| `bun run balance` | 밸런스 시뮬레이션. 인자: `[커리어 수=200] [시드=20261121]` |
| `bun run balance:check` | 시드를 고정한 밸런스 회귀 검사. 목표 범위를 벗어나면 실패. 일반 지표(`balance-sim`)와 NBA 경로 지표(`nba-path-sim`)를 차례로 검사 |
| `bun scripts/nba-path-sim.ts [커리어 수] [시드] --policy=mixed` | NBA 진입 경로·루키 역할·우승 경험 분석. `mixed`는 캐주얼/적극 플레이어를 섞어 실제 유저 집단을 근사합니다 (끝까지 플레이한 커리어 기준이라 실제 전체 커리어 지표보다 높게 나옴) |
| `bun run balance:career` | 커리어 성장·은퇴 분포 분석. 인자: `[커리어 수=1000] [시드=20261122]`. 결과는 `balance-results/`에 저장(커밋 제외) |

## CI

`.github/workflows/ci.yml`이 `main` 푸시와 모든 PR에서 타입 검사, 린트, 테스트, 밸런스 검사를 실행합니다. 같은 검사를 로컬에서 돌리려면:

```bash
bun run typecheck && bun run lint && bun run test && bun run balance:check
```

## 폴더 구조

```
app/              Next.js 라우트 진입점 (src/app 페이지를 다시 내보냄)
src/app/          페이지와 API 라우트 (api/feedback, api/analytics, api/admin, api/league-sync)
src/engine/       게임 로직: 시즌 시뮬레이션, 드래프트, 플레이오프, 성장, 은퇴, 이벤트
src/store/        Zustand 스토어와 저장 데이터 마이그레이션
  useCareerStore.ts      스토어 조립 + 저장(persist) 설정
  careerStoreTypes.ts    스토어 상태·액션 타입
  careerStoreHelpers.ts  시즌 정산 등 액션이 함께 쓰는 순수 함수
  actions/               기능별 액션 (화면, 세이브, 커리어 시작·은퇴, 성장, 시즌, 이벤트, 오프시즌)
src/data/         팀, 리그, 이벤트, 헤드라인 데이터
src/config/       밸런스와 경제 설정값
src/components/   UI 컴포넌트
src/lib/          서버 유틸 (Supabase, 관리자 인증, 통계)
scripts/          밸런스·커리어 성장 시뮬레이터
supabase/         DB 마이그레이션 SQL
```
