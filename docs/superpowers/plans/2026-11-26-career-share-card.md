# 은퇴 커리어 공유 카드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 은퇴한 커리어를 1080×1350 카드 이미지로 보여 주고, "이미지 저장하기"·"공유하기" 버튼과 공유 횟수 통계(`career_card_shared`)를 붙인다.

**Architecture:** `CareerRetrospective`를 카드 표시용 데이터로 바꾸는 순수 함수(`src/lib/careerCard.ts`)가 있고, 그 데이터를 그리는 고정 크기 React 카드가 있다. 카드 DOM은 `html-to-image`로 PNG Blob으로 캡처한다(`src/lib/careerCardExport.ts`). 외부 ESPN 로고는 `/_next/image`로 감싸 같은 출처로 만든다. 은퇴식/명예의 전당 다시 보기 화면에서 모달로 연다.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind 4, Bun test(`node:test` + `node:assert/strict` 스타일), `html-to-image`(새 의존성), Supabase 마이그레이션 SQL.

**Spec:** `docs/superpowers/specs/2026-11-26-career-share-card-design.md`

## Global Constraints

- 대상 버전 `1.3.0`. `src/config/appMeta.ts`의 `GAME_VERSION`과 `package.json`의 `version`을 함께 올린다.
- 카드 하단 문구는 게임 주소 `roadtomvp.vercel.app`만 넣는다. 홍보 문구("나도 MVP 도전하기" 등)는 넣지 않는다.
- 버튼은 정확히 두 개: `이미지 저장하기`, `공유하기`.
- 은퇴한 커리어만 대상으로 한다(은퇴식 + 명예의 전당 다시 보기).
- 공식 로고를 쓴다. 로고가 하나라도 실패하면 대체 엠블럼으로 바꾸지 않는다. 안내 + `다시 시도` 버튼을 보여 주고, 저장·공유 버튼을 잠근다.
- 기록: 전체 커리어 합계를 크게 보여 주고, `totals.nbaGp > 0`일 때만 NBA 줄을 추가한다.
- 카드 색은 테마(라이트/다크)와 관계없이 고정한다.
- 출력 PNG는 1080×1350이다.
- 세이브 구조를 바꾸지 않는다. 클라이언트에서 Supabase를 부르지 않는다.
- 기존 마이그레이션 파일 이름은 바꾸지 않는다. 새 파일은 `20261128_analytics_career_card_event.sql`이다.
- 사용자에게 보이는 문구와 코드 주석은 한국어로 쓴다.
- PR 전에 `bun run typecheck && bun run lint && bun run test && bun run balance:check`를 통과시킨다.

## Review Focus

1. 긴 선수 이름·긴 팀 이름(예: "울산 현대모비스 피버스"): 카드 폭을 넘지 않고 말줄임돼야 한다. 테스트는 Task 4 Step 3의 Playwright 확인 항목에 있다.
2. 소속 팀이 많은 커리어(8팀 이상): 팀 이력이 앞 3팀 + 마지막 1팀 + "+N"으로 줄어야 한다. 테스트는 Task 1의 `compressStints`.
3. NBA를 못 간 커리어: NBA 줄이 아예 없어야 한다(0으로 표시하지 않음). 테스트는 Task 1.
4. 버튼 연타: 캡처 중에는 두 버튼이 잠겨야 하고, 통계는 성공할 때마다 한 번만 보내야 한다. 테스트는 Task 4 Step 3.
5. 예전 명예의 전당 항목(fallback 회고, 팀 하나뿐·커리어 하이 일부 0): 카드가 깨지지 않고 0인 항목을 숨겨야 한다. 테스트는 Task 1의 fallback 케이스.

---

### Task 1: 카드 표시 데이터와 로고 주소 (순수 함수)

**Files:**
- Create: `src/lib/careerCard.ts`
- Test: `src/lib/careerCard.test.ts`

**Interfaces:**
- Produces:
  - `export const CAREER_CARD_SITE_LABEL = 'roadtomvp.vercel.app'`
  - `export const CAREER_CARD_WIDTH = 1080`, `export const CAREER_CARD_HEIGHT = 1350`
  - `export interface CareerCardStint { teamId: string; teamShortName: string; leagueShortName: string; seasons: number; logoTeam: TeamInfo }`
  - `export interface CareerCardHonor { label: string; count: number }` (label은 `'우승' | 'MVP' | '파이널 MVP' | '올스타'`)
  - `export interface CareerCardData { playerName; jerseyNumber; positionLabel: string /* 'PG' 또는 'PG/SG' */; heightCm; yearSpan: string /* '2026–2045' */; seasonsPlayed; finalAge; legacyTitle; legacyEmoji: string; legacyScore; averages: { ppg; rpg; apg }; peakOvr; honors: CareerCardHonor[] /* count>0만 */; nbaLine: string | null /* 예: 'NBA 812경기 · 우승 2 · MVP 1' */; stints: CareerCardStint[]; hiddenStintCount: number; careerHighPts: number | null /* retro.careerHighs.points, 0이면 null */; peakSeasonLabel: string | null /* 예: '2038 LAL · 31.2점' */ }`
  - `export function buildCareerCardData(retro: CareerRetrospective, legacyEmoji: string): CareerCardData`
  - `export function compressStints<T>(items: T[]): { shown: T[]; hidden: number }`: 길이 ≤ 4이면 그대로 둔다. 그 밖에는 앞 3개 + 마지막 1개를 보여 주고, hidden = 길이 − 4.
  - `export function resolveCardLogoSrc(team: Pick<TeamInfo, 'id' | 'league' | 'espnId' | 'logoUrl'>, espnLogos: Record<string, string>): string | null`: `TeamEmblem`과 같은 우선순위(`espnLogos[id]` → `espnLogos[prefix+espnId]` → `logoUrl`)를 쓴 뒤 `toSameOriginLogoUrl`을 거친다. 없으면 null.
  - `export function toSameOriginLogoUrl(url: string): string`: `/`로 시작하거나 `data:`면 그대로 둔다. `https://a.espncdn.com/`로 시작하면 `/_next/image?url=${encodeURIComponent(url)}&w=256&q=90`. 그 밖의 외부 주소도 같은 방식으로 감싼다.

- [ ] **Step 1: 실패하는 테스트 작성** (`src/lib/careerCard.test.ts`, `node:test` 스타일)
  - `compressStints`: 길이 3 → `{shown: 3개, hidden: 0}`. 길이 8 `[a..h]` → `shown` = `[a,b,c,h]`, `hidden` = 4.
  - `toSameOriginLogoUrl('/logos/KBL_SK.png')` === `'/logos/KBL_SK.png'`
  - `toSameOriginLogoUrl('https://a.espncdn.com/i/teamlogos/nba/500/lal.png')` === `'/_next/image?url=https%3A%2F%2Fa.espncdn.com%2Fi%2Fteamlogos%2Fnba%2F500%2Flal.png&w=256&q=90'`
  - `toSameOriginLogoUrl('data:image/svg+xml;...')`는 그대로 둔다.
  - `resolveCardLogoSrc`: `espnLogos`에 id가 있으면 그 값(감싼 결과)을 쓰고, 없으면 `logoUrl`을 쓰고, 둘 다 없으면 `null`.
  - `buildCardData`용 회고 픽스처는 `buildFallbackRetrospectiveFromHof`(`src/engine/retrospectiveEngine.ts`)에 만든 `HallOfFameEntry`를 넣어 만든다.
    - NBA 없는 항목(`nbaGp: 0`, `mvps: 0`, `championships: 2`): `nbaLine === null`. `honors`에 `{label:'우승',count:2}`만 있다. `MVP`는 없다.
    - NBA 항목(`nbaGp: 500`, `nbaChampionships: 1`, `nbaMvps: 1`): `nbaLine`이 `'NBA'`로 시작하고 `'우승 1'`과 `'MVP 1'`을 포함한다. 0인 NBA 항목은 문자열에 없다.
    - `careerHighPts`가 0이면 `null`이다.
    - fallback 항목(팀 하나): `stints.length === 1`, `hiddenStintCount === 0`.
- [ ] **Step 2: 실패 확인**: `bun test src/lib/careerCard.test.ts`를 실행한다. 기대 결과: 모듈이 없어서 FAIL.
- [ ] **Step 3: `src/lib/careerCard.ts` 구현**
  - `nbaLine`은 `totals.nbaGp > 0`일 때만 만든다. 항목은 `NBA {nbaGp}경기`, `우승 n`, `MVP n` 순서이고, 0인 항목은 뺀다. 구분자는 ` · `다.
  - `honors`의 원천은 `totals.championships / mvps / finalsMvps / allStars`다.
  - `CareerCardStint.logoTeam`은 `RetirementCeremony.tsx`의 `TeamStintsTimeline`이 `TeamEmblem`에 넘기는 객체와 같은 방식으로 `TeamInfo`를 조립한다. `espnId`는 `src/data/teams.ts`의 팀 목록에서 `teamId`로 찾아 채운다.
- [ ] **Step 4: 통과 확인**: `bun test src/lib/careerCard.test.ts`를 실행한다. 기대 결과: PASS.
- [ ] **Step 5: 커밋**: `git commit -m "feat: 공유 카드 표시 데이터와 로고 주소 변환 추가"`

### Task 2: 공유 횟수 분석 이벤트 `career_card_shared`

**Files:**
- Modify: `src/lib/analyticsSchema.ts`
  - `ANALYTICS_EVENT_NAMES`(18-30행)
  - `AnalyticsEventPayloadMap`(254-264행)
  - `SESSION_EVENT_RULES`(559-569행)
- Modify: `src/lib/analytics.test.ts:296-299` (허용 목록을 확인하는 파일 경로를 새 마이그레이션으로 바꾼다)
- Create: `supabase/migrations/20261128_analytics_career_card_event.sql`
- Modify: `README.md` 마이그레이션 목록(47행 `20261127_admin_analytics_v4.sql` 바로 다음)
- Create: `src/lib/careerCardAnalytics.ts`
- Test: `src/lib/careerCardAnalytics.test.ts`

**Interfaces:**
- Produces:
  - `export interface CareerCardSharedPayload { action: 'save' | 'share'; legacyTierId: LegacyTierId; seasonsPlayed: number; reachedNba: boolean; isReplay: boolean }` (`analyticsSchema.ts`에 둔다)
  - `export function buildCareerCardSharedPayload(retro: CareerRetrospective, action: 'save' | 'share', isReplay: boolean): CareerCardSharedPayload` (`careerCardAnalytics.ts`). `reachedNba`는 `retro.totals.nbaGp > 0`.
  - `export function trackCareerCardShared(retro: CareerRetrospective, action: 'save' | 'share', isReplay: boolean): void`. `trackGameEvent('career_card_shared', payload)`를 dedupe 없이 부른다. 성공할 때마다 한 번씩 센다.

- [ ] **Step 1: 실패하는 테스트 작성**
  - `careerCardAnalytics.test.ts`: NBA 없는 회고 → `{action:'save', reachedNba:false, isReplay:true, seasonsPlayed: retro.seasonsPlayed, legacyTierId: retro.legacyTierId}`.
  - `careerCardAnalytics.test.ts`: `validateAnalyticsEventPayload`에 `event_name: 'career_card_shared'`와 이 payload를 넣으면 `ok === true`다. 다섯 키가 모두 남아 있어야 한다(PII 키 필터에 걸리지 않음).
  - `analytics.test.ts`의 허용 목록 검사가 `20261128_analytics_career_card_event.sql`을 읽게 바꾼다.
- [ ] **Step 2: 실패 확인**: `bun test src/lib/careerCardAnalytics.test.ts src/lib/analytics.test.ts`를 실행한다. 기대 결과: FAIL.
- [ ] **Step 3: 구현**
  - `ANALYTICS_EVENT_NAMES` 끝에 `// 1.3.0 커리어 카드 저장·공유` 주석과 `'career_card_shared'`를 추가한다.
  - 페이로드 맵에 추가한다.
  - 속도 제한은 `career_card_shared: { windowMs: 10 * 60 * 1000, maxCount: 20 }`.
  - 마이그레이션 SQL은 `20261125_analytics_survey_event.sql`과 같은 형식이다. 머리 주석은 `1.3.0 - 커리어 카드 저장·공유 이벤트 허용`이고, "1.3.0 배포 전에 실행하세요", "다시 실행해도 안전합니다"를 넣는다. 제약을 DROP한 뒤, 기존 9개 이벤트에 `'career_card_shared'`를 더해 다시 ADD한다. `COMMENT ON COLUMN`도 갱신한다.
  - (확인함: 제약을 정의한 마지막 파일은 `20261125_analytics_survey_event.sql`이다. 그 9개 목록을 기준으로 삼는다.)
  - README에 한 줄을 추가한다: `` `20261128_analytics_career_card_event.sql`: 커리어 카드 저장·공유 이벤트(`career_card_shared`) 허용. CHECK 제약만 교체 (1.3.0 배포 전 실행) ``
- [ ] **Step 4: 통과 확인**: `bun test src/lib`를 실행한다. 기대 결과: PASS.
- [ ] **Step 5: 커밋**: `git commit -m "feat: 커리어 카드 공유 분석 이벤트 추가"`

### Task 3: PNG 캡처·저장·공유 헬퍼 + 설정

**Files:**
- Modify: `package.json` (`bun add html-to-image`)
- Modify: `next.config.ts`의 `images.remotePatterns`(기존 picsum 항목 옆)에 `{ protocol: 'https', hostname: 'a.espncdn.com', port: '', pathname: '/i/teamlogos/**' }`를 추가한다.
- Create: `src/lib/careerCardExport.ts`
- Test: `src/lib/careerCardExport.test.ts`

**Interfaces:**
- Produces:
  - `export function buildCardFileName(playerName: string): string`: `road-to-mvp-<이름>.png`. 파일 이름에 쓸 수 없는 문자(`\/:*?"<>|`와 공백)는 `-`로 바꾸고, 빈 이름은 `road-to-mvp-career.png`로 한다.
  - `export type ShareSupport = 'files' | 'none'`
  - `export function detectShareSupport(nav: Pick<Navigator, 'share' | 'canShare'> | undefined, file: File): ShareSupport`
  - `export async function renderCardToPngBlob(node: HTMLElement): Promise<Blob>`
    - 먼저 `document.fonts.ready`와 `node` 안 모든 `img.decode()`를 기다린다.
    - 그다음 warm-up 캡처를 1회 하고 결과를 버린다(iOS 첫 캡처 누락 대비).
    - 실제 캡처는 `toBlob(node, { width: 1080, height: 1350, pixelRatio: 1, cacheBust: false })`.
    - Pretendard가 빠지면 `fontEmbedCSS`를 넣는다. 이건 Task 4 수동 확인에서 결정한다.
  - `export function downloadBlob(blob: Blob, fileName: string): 'downloaded' | 'opened'`
    - `<a download>`로 내려받는다.
    - iOS 사파리(`/iP(hone|ad|od)/` + `!('download' in HTMLAnchorElement.prototype)`)에서는 `window.open(objectURL)`을 쓰고 `'opened'`를 돌려준다.
  - `export async function shareBlob(blob: Blob, fileName: string): Promise<'shared' | 'cancelled' | 'unsupported'>`
    - `detectShareSupport`가 `'none'`이면 `'unsupported'`.
    - `navigator.share({ files: [file] })`가 `AbortError`를 던지면 `'cancelled'`.
    - 그 밖의 오류는 다시 던진다.

- [ ] **Step 1: 실패하는 테스트 작성**
  - `buildCardFileName('홍 길동')` === `'road-to-mvp-홍-길동.png'`
  - `buildCardFileName('a/b')` === `'road-to-mvp-a-b.png'`
  - `buildCardFileName('')` === `'road-to-mvp-career.png'`
  - `detectShareSupport(undefined, f)` === `'none'`
  - `canShare`가 없으면 `'none'`.
  - `canShare: () => false`면 `'none'`.
  - `{ share: fn, canShare: () => true }`면 `'files'`.
  - 테스트의 `File`은 Bun 전역 `File`을 쓴다.
- [ ] **Step 2: 실패 확인**: `bun test src/lib/careerCardExport.test.ts`를 실행한다. 기대 결과: FAIL.
- [ ] **Step 3: 구현**: 위 시그니처대로 만든다. 의존성과 설정 변경도 같이 한다.
- [ ] **Step 4: 통과 확인**: `bun test src/lib/careerCardExport.test.ts && bun run typecheck`를 실행한다. 기대 결과: PASS.
- [ ] **Step 5: 커밋**: `git commit -m "feat: 커리어 카드 PNG 캡처·저장·공유 헬퍼 추가"`

### Task 4: 카드 화면, 모달, 은퇴식 연결

**Files:**
- Create: `src/components/retirement/CareerShareCard.tsx`
- Create: `src/components/retirement/CareerShareModal.tsx`
- Modify: `src/components/retirement/RetirementCeremony.tsx`의 하단 액션 영역(1113행 `{/* 하단 액션 */}`)

**Interfaces:**
- Consumes:
  - Task 1의 `buildCareerCardData`, `resolveCardLogoSrc`, `CAREER_CARD_*`
  - Task 2의 `trackCareerCardShared`
  - Task 3의 `renderCardToPngBlob`, `downloadBlob`, `shareBlob`, `buildCardFileName`
  - `Modal`(`src/components/common/Modal.tsx`: `open`, `title`, `subtitle?`, `onClose?`, `children`, `testId?`)
  - `useCareerStore((s) => s.espnLogos)`, `useCareerStore((s) => s.showToast)`
- Produces:
  - `CareerShareCard = forwardRef<HTMLDivElement, { data: CareerCardData; logoSrcs: Record<string, string | null>; onLogoStatus: (teamId: string, ok: boolean) => void }>`
    - 1080×1350 고정 크기다. 색은 고정 hex로 쓰고 `--t-*` 테마 변수는 쓰지 않는다.
    - 로고는 `<img crossOrigin="anonymous">`로 그리고 `onLoad`/`onError`로 상태를 알린다.
    - 로고 src가 `null`인 팀은 실패로 친다. 공식 로고가 없는 것이기 때문이다.
  - `CareerShareModal({ open, retro, legacyEmoji, isReplay, onClose })`
    - 미리보기는 컨테이너 폭에 맞춰 CSS `transform: scale()`로 줄여서 보여 준다. 캡처 대상은 scale이 없는 원본 노드다. 래퍼에 scale을 걸고 ref는 안쪽 카드에 단다.
    - 버튼은 `이미지 저장하기`(`data-testid="career-card-save"`)와 `공유하기`(`data-testid="career-card-share"`).
    - 상태는 `'loading-logos' | 'ready' | 'logo-failed' | 'capturing'`. `ready`일 때만 버튼이 켜진다.
    - `logo-failed`일 때는 문구 `일부 팀 로고를 불러오지 못했어요.`와 `다시 시도` 버튼을 보여 준다. 다시 시도는 img `key`에 시도 횟수를 붙여 다시 마운트한다.
    - 저장이 성공하면 `trackCareerCardShared(retro,'save',isReplay)`를 부른다. `'opened'`면 토스트 `이미지를 길게 눌러 저장해 주세요`도 띄운다.
    - 공유가 `'shared'`면 `trackCareerCardShared(retro,'share',isReplay)`를 부른다. `'unsupported'`면 토스트 `이 브라우저는 바로 공유를 지원하지 않아요`와 `이미지 저장하기 후 올려 주세요`를 띄운다. `'cancelled'`면 아무것도 하지 않는다.
    - 캡처 실패(예외)면 토스트 `이미지를 만들지 못했어요`와 `잠시 후 다시 시도해 주세요`를 띄운다.
  - `RetirementCeremony`: 하단 액션 맨 위에 `커리어 카드` 버튼(`className="t-cta-sub"`, `data-testid="open-career-card"`)을 추가한다. 은퇴식 모드와 다시 보기 모드 모두에 보인다. `legacyEmoji`는 다시 보기면 `replayEntry.legacyEmoji`, 은퇴식이면 `career.legacyEvaluation?.tierEmoji`(없으면 `evaluateCareerLegacy(career).tierEmoji`).

- [ ] **Step 1: 컴포넌트 구현**: 스펙의 카드 스케치 배치를 따른다.
  - 위: 레거시 이모지·제목·점수
  - 이름 / #등번호 / 포지션·키
  - 연도·시즌·은퇴 나이
  - 평균 3종 + 최고 OVR
  - 수상 줄, NBA 줄
  - 팀 이력(로고 + 약칭, `+N`)
  - 커리어 하이·피크 시즌
  - 맨 아래 `CAREER_CARD_SITE_LABEL`
  - 이름과 팀 이름에는 `truncate`를 건다.
- [ ] **Step 2: 정적 검사**: `bun run typecheck && bun run lint`를 실행한다. 기대 결과: 오류 0.
- [ ] **Step 3: Playwright 수동 확인**: `bun run dev` 후 명예의 전당 다시 보기 → `커리어 카드`. 데스크톱 1280폭과 `devices['iPhone 13']` 두 환경에서 확인한다.
  - (a) `career-card-save`를 누르면 다운로드가 일어나고, PNG 크기가 1080×1350이며, 로고·Pretendard 글꼴이 들어가 있다. 저장된 파일을 Read로 열어 눈으로 확인한다.
  - (b) ESPN 로고가 있는 NBA 팀 커리어에서 로고가 저장 이미지에 들어 있다. 이 작업 환경은 ESPN 접속이 막혀 있다. 막히면 `logo-failed` 화면과 버튼 잠금이 나오는지만 확인하고, 실제 로고 확인은 Vercel 미리보기 배포에서 한다.
  - (c) 저장 버튼을 빠르게 두 번 눌러도 다운로드와 분석 요청(`/api/analytics` 네트워크)이 한 번씩만 일어난다.
  - (d) 선수 이름이 12자, 팀 8개인 커리어에서 글자가 카드 밖으로 넘치지 않고 `+4`가 보인다.
  - (e) 다크 테마에서도 카드 색이 같다.
  - (f) 데스크톱 Chromium에서 `공유하기`를 누르면 미지원 안내 토스트가 뜨거나 공유 창이 열린다.
  - 확인에 필요한 긴 이름·다팀 명예의 전당 항목은 콘솔에서 store에 주입하고, 커밋하지 않는다.
  - Pretendard가 빠지면 Task 3의 `fontEmbedCSS` 처리를 여기서 추가한다.
- [ ] **Step 4: 커밋**: `git commit -m "feat: 은퇴식·명예의 전당에 커리어 카드 저장·공유 추가"`

### Task 5: 버전 1.3.0, 패치노트, 전체 검사

**Files:**
- Modify: `src/config/appMeta.ts:4` (`GAME_VERSION = '1.3.0'`)
- Modify: `package.json` (`"version": "1.3.0"`)
- Modify: `src/data/patchNotes.ts` (`PATCH_NOTES` 맨 앞)

- [ ] **Step 1: 버전과 노트 추가**
  - 노트: `version: '1.3.0'`, `date: '2026-11-26'`, title `은퇴한 커리어를 카드 한 장으로 자랑할 수 있습니다`.
  - highlights 3~4줄:
    - 은퇴식과 명예의 전당에서 커리어 카드를 열 수 있음
    - 이미지 저장하기
    - 공유하기로 인스타·카톡 등에 바로 보내기
    - 공식 팀 로고와 통산·NBA 기록 표시
  - `saveImpact`는 넣지 않는다.
- [ ] **Step 2: 전체 검사**: `bun run typecheck && bun run lint && bun run test && bun run balance:check`를 실행한다. 기대 결과: 모두 통과. balance 결과는 바뀌지 않아야 한다(게임 로직 변경 없음).
- [ ] **Step 3: 커밋 후 푸시**: `git commit -m "chore: 1.3.0 버전과 패치노트"`, 그다음 `git push -u origin claude/fervent-fermi-cvupp0`.
- [ ] **Step 4: 사용자에게 보고**: CLAUDE.md 형식으로 보고한다.
  - 쿼리 제목, `20261128_analytics_career_card_event.sql` 전체 SQL, Supabase SQL 편집기 실행 방법을 준다. 실행 후 확인 쿼리는 `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'analytics_events_event_name_check';`이고, 결과에 `career_card_shared`가 있어야 한다.
  - 미리보기 배포에서 ESPN 로고 저장을 확인한 결과를 보고한다. 로고가 안 되면 그대로 보고한다.
