# 플레이오프 밸런스 개편 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PO에서 선수 기여도를 정규시즌 수준으로 올리고, 시드가 구조적으로 의미를 갖게 하며, 선수 팀의 결승을 "시뮬 + 결정전마다 라이브" 시리즈로 바꾼다.

**Architecture:** 선수 PO 보너스와 시드 보정(체력·뎁스)은 순수 함수로 뽑아(`src/engine/playoffStrength.ts`) `simulateSingleSeries`가 경기 승률에 더한다. 결승 시리즈 진행·결정전 판정·라이브 결과 반영은 새 파일 `src/engine/finalsSeries.ts`가 맡고, 스토어(`seasonActions.ts`, `careerStoreHelpers.ts`)와 화면은 그 함수만 부른다. 측정은 `scripts/balance-sim.ts`에 시드 분포 섹션과 목표를 추가해 `balance:check`로 고정한다.

**Tech Stack:** Next.js 15, React 19, TypeScript, Zustand, Bun test(`node:test` + `node:assert/strict`).

**Spec:** `docs/superpowers/specs/2026-11-26-playoff-balance-design.md`

## Global Constraints

- 대상 버전 `1.4.0`. `src/config/appMeta.ts`의 `GAME_VERSION`과 `package.json`의 `version`을 함께 올린다.
- 패치노트는 `src/data/patchNotes.ts` 맨 앞에 추가한다. 요약 + 체감 방향형으로 쓰고 **정확한 수치는 적지 않는다**. `saveImpact`를 채운다.
- 새 밸런스 값은 모두 `src/config/balanceConfig.ts`에 둔다(엔진 파일에 숫자를 직접 쓰지 않는다).
- 시드 보정·홈 이점·체력은 선수 팀과 AI 팀에 똑같이 적용한다. 선수 보너스만 선수 팀 전용이다.
- 기존 `BALANCE_TARGETS` 범위는 바꾸거나 끄지 않는다. 튜닝 범위 안에서 맞출 수 없으면 멈추고 사용자에게 보고한다.
- 사용자에게 보이는 문구와 코드 주석은 한국어로 쓴다.
- 분석 이벤트 페이로드는 바꾸지 않는다(`NormalizedPlayoffResult` 값 그대로).
- 요청 밖 UI(안내 문구, 건너뛰기 버튼 등)는 추가하지 않는다. 이 계획에 적힌 버튼·문구만 바꾼다.
- 완료 전에 `bun run typecheck && bun run lint && bun run test && bun run balance:check`를 통과시킨다.

## Review Focus

1. **결승 라이브 중에 저장된 1.3.2 세이브**(시리즈 0-0, `liveGame.gameType === 'LEAGUE_FINALS'`): 경기가 끝나면 예전처럼 그 한 경기로 우승이 정해져야 한다. 시리즈가 0-1로 남아 대진이 멈추면 안 된다. → Task 4 `legacy` 테스트.
2. **결정전을 기다리는 중 "끝까지 시뮬"(`skipPlayoffsToEnd`)**: 남은 경기를 시뮬로 마치고 `pendingFinalsLiveGame`을 지워야 한다. 우승 기록·마일스톤도 정상으로 남아야 한다. → Task 5 Step 1 테스트.
3. **단판 결승(유로리그·고교·대학)**: 0-0이 곧 결정전이므로 시뮬 없이 바로 라이브 한 경기가 되어, 지금과 같게 동작해야 한다. → Task 4 테스트.
4. **결정전 라이브를 이겼지만 시리즈가 계속되는 경우**(예: 2-3에서 6차전 승리 → 3-3): 7차전 결정전에서 다시 멈춰야 한다. 화면은 오프시즌이 아니라 대진표로 돌아와야 한다. → Task 4·5 테스트.
5. **NBA 플레이인으로 올라온 9·10위 팀**: 시드 판정에서 `conferenceRank`가 9·10이어도 하위 시드로 분류되어야 하고, 오류가 나면 안 된다. → Task 2 테스트.

---

### Task 1: 선수 PO 보너스 함수 분리와 상향

**Files:**
- Create: `src/engine/playoffStrength.ts`
- Modify: `src/engine/playoffEngine.ts:978-1040` (`simulateSingleSeries` 안의 보너스 계산을 새 함수 호출로 바꿈)
- Modify: `src/config/balanceConfig.ts:189` (`PLAYOFF_SERIES_CONFIG`)
- Test: `src/engine/playoffBalance.test.ts` (새 파일)

**Interfaces:**
- Produces: `calculatePlayoffPlayerBonus(career: CareerState): number`. 레이팅 단위 보너스를 돌려준다. 지금 `simulateSingleSeries`에 있는 MPG·출장률·클러치·신체 부하 로직을 그대로 옮긴다(`estimateFallbackMpgByRole`도 함께 옮긴다).

- [ ] **Step 1: 실패하는 테스트 작성**

`test('PO 선수 보너스: 정규시즌 기여 수준')`. 키 192 SG, 6개 스탯을 모두 같게 둔 커리어를 쓰고, `seasonLogs`에는 같은 리그 로그 하나(`mpg`, `gp`=리그 경기 수, `injuredGamesMissed: 0`)를 넣는다.
- NBA, 스탯 92(OVR 93), mpg 34.5 → 보너스가 `5.4` 이상 `7.0` 이하.
- KBL, OVR 80, mpg 32.5 → `5.4` 이상 `8.0` 이하.
- NBA, OVR이 `playerBaselineOvr`(84)와 같음 → 절댓값이 `0.5` 이하.
- NBA OVR 99, mpg 38 → `maxPositivePlayerBonus` 이하(상한).
- 같은 조건에서 mpg 10과 mpg 34를 비교하면 mpg 34의 보너스가 더 크다.

- [ ] **Step 2: 실행해 실패 확인**

Run: `bun test src/engine/playoffBalance.test.ts`
Expected: FAIL (`calculatePlayoffPlayerBonus` 없음)

- [ ] **Step 3: 함수 구현 및 값 변경**

`PLAYOFF_SERIES_CONFIG.playerOvrSlope` 0.30 → `0.62`, `maxPositivePlayerBonus` 5.5 → `8.0`. 나머지 계산식은 바꾸지 않는다. `simulateSingleSeries`는 `calculatePlayoffPlayerBonus(career)` 결과를 쓴다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `bun test src/engine/playoffBalance.test.ts && bun run test`
Expected: PASS. 기존 테스트가 PO 승률 수치를 고정해 실패하면, 의도한 변화인지 확인하고 보고에 적는다.

- [ ] **Step 5: 커밋**

```bash
git add src/engine/playoffStrength.ts src/engine/playoffEngine.ts src/config/balanceConfig.ts src/engine/playoffBalance.test.ts
git commit -m "feat: PO 선수 기여도를 정규시즌 수준으로 상향"
```

### Task 2: 시드 구조 보정 (홈코트·누적 체력·하위 시드 뎁스)

**Files:**
- Modify: `src/engine/playoffStrength.ts`
- Modify: `src/engine/playoffEngine.ts` (`simulateSingleSeries`에 보정 인자 추가, `advancePlayoffRound`·`resolveConfFinalsGame7InBracket`에서 보정 계산해 전달)
- Modify: `src/config/balanceConfig.ts` (`PLAYOFF_SERIES_CONFIG.homeCourtRatingEdge`, 새 `PLAYOFF_SEED_CONFIG`)
- Test: `src/engine/playoffBalance.test.ts`

**Interfaces:**
- Consumes: Task 1의 `calculatePlayoffPlayerBonus`.
- Produces:
  - `getPlayoffSeed(entry: StandingEntry, league: LeagueId): number`. NBA·G리그는 `conferenceRank`, 그 밖에는 `rank`.
  - `countExtraSeriesGames(bracket: PlayoffBracketState, teamId: string, beforeRound: number): number`. `roundNumber < beforeRound`이고 `isPlayIn`이 아닌 본선 시리즈에서, 이 팀이 치른 경기 수(`higherSeedWins + lowerSeedWins`)에서 `winsNeeded`를 뺀 값의 합.
  - `getSeriesSeedModifiers(bracket: PlayoffBracketState, series: PlayoffSeriesMatchup): { hi: number; lo: number }`. 레이팅 단위 보정값(0 이하).
  - `simulateSingleSeries(series, career, rng, pauseMode: SeriesPauseMode = 'NONE', mods: { hi: number; lo: number } = { hi: 0, lo: 0 })`를 export한다. `SeriesPauseMode = 'NONE' | 'CONF_FINALS_GAME7' | 'DECISIVE_GAME'`. 기존 `pauseAtGame7 = true` 호출은 `'CONF_FINALS_GAME7'`로 바꾼다. `'DECISIVE_GAME'`은 Task 4가 구현한다(이 Task에서는 타입만 둔다).

새 설정(`PLAYOFF_SEED_CONFIG`):

```ts
fatiguePerExtraGame: 0.35,
fatigueCap: 2.5,
lowSeedDepthPerRound: 0.9,     // 2라운드부터 (roundNumber - 1) × 값
lowSeedDepthStartByLeague: { NBA: 6, EUROLEAGUE: 6, B_LEAGUE: 6, GLEAGUE: 5, KBL: 5, NBL: 5 },
// 표에 없는 리그(고교·U리그·NCAA)는 뎁스 보정 없음
```

`homeCourtRatingEdge` 1.2 → `2.0`. 보정값 = `-min(fatigueCap, extraGames × fatiguePerExtraGame) - depth`.

- [ ] **Step 1: 실패하는 테스트 작성**

- `test('시드 판정')`: NBA 엔트리 `conferenceRank` 3 → 3. 유로리그 `rank` 7 → 7. NBA `conferenceRank` 10 → 10(오류 없음).
- `test('누적 체력')`: 1라운드 BO7에서 팀 A가 4-3(7경기), 팀 B가 4-0인 대진을 만든다. `countExtraSeriesGames(bracket, A, 2) === 3`, B는 `0`. 2라운드 A vs B 시리즈의 보정은 A가 `-1.05`, B가 `0`.
- `test('체력 상한')`: 추가 경기 10이면 `-2.5`.
- `test('하위 시드 뎁스')`: NBA 2라운드 6번 시드는 `-0.9`, 3라운드는 `-1.8`. 1라운드 6번 시드와 5번 시드는 `0`. NCAA 8강 7번 시드는 `0`.
- `test('보정은 AI에도 똑같이')`: 두 AI 팀 시리즈에 `getSeriesSeedModifiers`를 적용하면 선수 팀이 아니어도 같은 값이 나온다.

- [ ] **Step 2: 실행해 실패 확인**

Run: `bun test src/engine/playoffBalance.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

`simulateSingleSeries`에서 `hiEffective`와 `loEffective`에 각각 `mods.hi`와 `mods.lo`를 더한다. `advancePlayoffRound`는 각 시리즈마다 `getSeriesSeedModifiers(bracket, s)`를 계산해 넘긴다. 플레이인(`advancePlayInStage`, 대진 생성 시 즉시 시뮬)은 보정 없이 그대로 둔다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `bun test src/engine/playoffBalance.test.ts && bun run test`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/engine/playoffStrength.ts src/engine/playoffEngine.ts src/config/balanceConfig.ts src/engine/playoffBalance.test.ts
git commit -m "feat: PO 시드 구조 보정(홈코트·누적 체력·하위 시드 뎁스)"
```

### Task 3: 순위 운 축소와 시드 분포 측정·튜닝

**Files:**
- Modify: `src/config/balanceConfig.ts` (`REGULAR_SEASON_WIN_CONFIG.aiMinHalfSpread`, `aiMaxHalfSpread`)
- Modify: `scripts/balance-sim.ts` (4) 판도 섹션 옆에 "시드별 PO 성적" 섹션, `BALANCE_TARGETS` 추가)

**Interfaces:**
- Consumes: Task 2의 `getPlayoffSeed`.
- Produces: `metrics`에 `nbaSeed1ChampPct`, `nbaSeed23ChampPct`, `nbaSeed45ChampPct`, `nbaSeed6PlusChampPct`, `nbaSeed1FirstRoundExitPct`, `nbaSeed45SecondRoundPassPct`, `nbaRankRatingRho`(스피어만), `nbaDefendingChampRepeatPct`(보고용, 목표 없음).

측정 방식: 기존 판도 섹션과 같은 방식(유령 관찰자 커리어, `simulateForNonPlayer: true`, `skipEntirePlayoffs`)으로 NBA 5회 × 20년을 돌린다. 시드는 `getPlayoffSeed`, 동·서부 1번 시드는 모두 "1번"으로 센다.

새 목표 (스펙의 실제 NBA 경향에서 정함):

| 지표 | 범위 |
|---|---|
| NBA 1번 시드 우승 점유(%) | 50~68 |
| NBA 2~3번 시드 우승 점유(%) | 20~40 |
| NBA 6번 이하 시드 우승 점유(%) | 0~4 |
| NBA 1번 시드 1라운드 탈락(%) | 0~12 |
| NBA 4~5번 시드 2라운드 통과(%) | 15~35 |
| NBA 순위-전력 상관 | 0.92~1 |

- [ ] **Step 1: 측정 섹션과 목표 추가, 현재 값 확인**

Run: `bun scripts/balance-sim.ts 200 20261121 --check`
Expected: 새 목표 일부가 FAIL이어야 한다(Task 1·2만으로는 1번 시드 점유가 모자람). 출력 값을 기록한다.

- [ ] **Step 2: 순위 운 축소**

시작 값은 `aiMinHalfSpread` 0.042 → `0.032`, `aiMaxHalfSpread` 0.062 → `0.042`이다.

- [ ] **Step 3: 튜닝 반복**

`bun run balance:check`를 돌려 새 목표와 기존 목표가 모두 PASS할 때까지 아래 범위 안에서만 값을 조정한다.
- `homeCourtRatingEdge` 1.6~2.6
- `fatiguePerExtraGame` 0.2~0.5
- `lowSeedDepthPerRound` 0.6~1.4
- `aiMaxHalfSpread` 0.036~0.050
- `playerOvrSlope`는 Task 1 테스트 범위를 지키는 선에서만 바꾼다.

범위 안에서 기존 목표(특히 `NBA 초기 하위50% 팀 우승 비율` 20~55, `NBA 최다 결승 진출팀 점유율` 0~26, `nba-path-sim` 검사)를 지킬 수 없으면 **여기서 멈추고** 측정 표를 들고 사용자에게 묻는다.

- [ ] **Step 4: 전체 검사**

Run: `bun run test && bun run balance:check`
Expected: 모두 PASS. 최종 값과 시드 분포 표를 보고에 적는다.

- [ ] **Step 5: 커밋**

```bash
git add src/config/balanceConfig.ts scripts/balance-sim.ts src/engine/playoffBalance.test.ts
git commit -m "balance: AI 순위 운 축소와 시드별 PO 성적 회귀 검사 추가"
```

### Task 4: 결승 시리즈 엔진 (시뮬 + 결정전 일시정지)

**Files:**
- Create: `src/engine/finalsSeries.ts`
- Modify: `src/engine/playoffEngine.ts` (`simulateSingleSeries`의 `'DECISIVE_GAME'` 처리)
- Modify: `src/types/game.ts:321` (`PlayoffBracketState`에 `pendingFinalsLiveGame?: boolean` 추가, 주석 한국어)
- Test: `src/engine/playoffBalance.test.ts`

**Interfaces:**
- Consumes: Task 2의 `simulateSingleSeries`, `getSeriesSeedModifiers`.
- Produces (`src/engine/finalsSeries.ts`):
  - `type DecisiveGameKind = 'CLINCH' | 'ELIMINATION' | 'WINNER_TAKES_ALL'`
  - `getDecisiveGameContext(series: PlayoffSeriesMatchup, playerTeamId: string): { gameNo: number; playerWins: number; oppWins: number; kind: DecisiveGameKind } | null`. 어느 쪽이든 `winsNeeded - 1`승이면 결정전이다. 둘 다면 `WINNER_TAKES_ALL`, 선수 쪽만이면 `CLINCH`, 상대만이면 `ELIMINATION`. 시리즈가 끝났거나 결정전이 아니면 `null`.
  - `getPlayerFinalsSeries(bracket: PlayoffBracketState): PlayoffSeriesMatchup | null`. 마지막 라운드에서 `involvesPlayer`인 시리즈.
  - `simulateFinalsToDecisiveGame(bracket, career, rng?): PlayoffBracketState`. 선수 결승 시리즈를 한 경기씩 시뮬하다가 다음 경기가 결정전이면 멈추고 `pendingFinalsLiveGame: true`를 세운다. 단판은 바로 `true`가 된다.
  - `resolveFinalsLiveGameInBracket(bracket, career, standings, playerWon: boolean, scoreLine: string, rng?): { bracket: PlayoffBracketState; seriesFinished: boolean }`.
    - 결정전 상태면 한 경기를 반영한다(로그 `N차전 실시간 중계: …`). 시리즈가 끝나면 `championTeamId`, `playerEliminated`, `playoffResultLabel`(`'리그 우승'` 또는 `'파이널 준우승'`)을 정하고 `pendingFinalsLiveGame: false`로 둔다. 끝나지 않았으면 `simulateFinalsToDecisiveGame`으로 다음 결정전까지 진행한다.
    - **legacy**: 결정전 상태가 아닌데 호출되면(1.3.2에서 시작한 라이브) 예전처럼 그 경기 승자가 시리즈 승자가 되고, 패자는 `winsNeeded - 1`승으로 기록한다.

`simulateSingleSeries`의 `'DECISIVE_GAME'` 모드: `involvesPlayer` 시리즈에서 경기 전에 `getDecisiveGameContext`가 `null`이 아니면 승패를 바꾸지 않고 `winnerId: null`로 돌려준다.

- [ ] **Step 1: 실패하는 테스트 작성**

- `test('결정전 판정')`: BO7에서 선수 3-2면 `CLINCH`, gameNo 6. 2-3이면 `ELIMINATION`. 3-3이면 `WINNER_TAKES_ALL`, gameNo 7. 2-2면 `null`. BO1 0-0이면 `WINNER_TAKES_ALL`, gameNo 1.
- `test('결정전까지 시뮬')`: NBA 결승 0-0에서 `simulateFinalsToDecisiveGame`을 시드 고정 난수로 50번 돌린다. 매번 `pendingFinalsLiveGame === true`, `championTeamId === null`, 시리즈가 결정전 상태이고 어느 쪽도 4승이 아니어야 한다.
- `test('라이브 승리 후 시리즈 계속')`: 2-3에서 `playerWon: true`로 반영하면 3-3이 되고 `seriesFinished === false`, `pendingFinalsLiveGame === true`, gameNo 7.
- `test('라이브로 우승 확정')`: 3-2에서 승리하면 `championTeamId === career.team.id`, `playoffResultLabel === '리그 우승'`, `seriesFinished === true`.
- `test('라이브 패배로 탈락')`: 2-3에서 패배하면 상대가 우승하고 `playerEliminated === true`, 라벨은 `'파이널 준우승'`.
- `test('legacy 단판 결정')`: BO7 0-0에서 `pendingFinalsLiveGame` 없이 `playerWon: true`로 호출하면 즉시 우승하고, 패자는 3승으로 기록된다.
- `test('단판 결승')`: 유로리그 결승(BO1)에서 `simulateFinalsToDecisiveGame`은 경기를 시뮬하지 않고 0-0 그대로 `pendingFinalsLiveGame: true`가 된다.

- [ ] **Step 2: 실행해 실패 확인**

Run: `bun test src/engine/playoffBalance.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

- [ ] **Step 4: 테스트 통과 확인**

Run: `bun test src/engine/playoffBalance.test.ts && bun run typecheck`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/engine/finalsSeries.ts src/engine/playoffEngine.ts src/types/game.ts src/engine/playoffBalance.test.ts
git commit -m "feat: 결승 시리즈를 시뮬로 진행하고 결정전마다 멈추는 엔진 추가"
```

### Task 5: 스토어·라이브·화면 연결

**Files:**
- Modify: `src/store/careerStoreTypes.ts` (새 액션 `advanceFinalsToDecisiveGame: () => void`)
- Modify: `src/store/actions/seasonActions.ts` (`advanceFinalsToDecisiveGame` 추가, `startFinalsLiveBroadcast`, `closeLiveGameAndReturn`, `skipPlayoffsToEnd`)
- Modify: `src/store/careerStoreHelpers.ts:647-735` (`applyCompletedLiveGameOutcome`의 LEAGUE_FINALS 분기)
- Modify: `src/engine/liveGameEngine.ts:37-112` (`createLiveFinalGame` 옵션과 제목)
- Modify: `src/components/dashboard/SeasonTab.tsx:154-160,444-455`, `src/components/dashboard/season/PostseasonCard.tsx:60-80,140-150`
- Test: `src/engine/playoffBalance.test.ts` (스토어 흐름은 `useCareerStore`를 `balance-sim.ts`처럼 localStorage 대체로 불러 테스트)

**Interfaces:**
- Consumes: Task 4의 `getDecisiveGameContext`, `getPlayerFinalsSeries`, `simulateFinalsToDecisiveGame`, `resolveFinalsLiveGameInBracket`.
- Produces:
  - `createLiveFinalGame(career, opp, gameType, options?: { …기존, finalsContext?: { gameNo: number; playerWins: number; oppWins: number; kind: DecisiveGameKind } })`
  - 스토어 액션 `advanceFinalsToDecisiveGame()`: `playerReachedFinals`이고 `pendingFinalsLiveGame`이 아니며 우승팀이 없을 때 `simulateFinalsToDecisiveGame`을 부른다.

동작:
1. 결승 진출 직후 버튼은 `파이널 시리즈 시작`(`advanceFinalsToDecisiveGame`)이다. 결정전 대기 중이면 `파이널 {gameNo}차전 실시간 중계 입장`(`startFinalsLiveBroadcast`)이다. 컨퍼런스 파이널 7차전 버튼은 그대로 둔다. `canEnterHighStakesLive` 조건을 이 두 상태로 나눈다.
2. `startFinalsLiveBroadcast`는 결정전 문맥을 `finalsContext`로 넘긴다. 제목은 `{리그} 파이널 {gameNo}차전`에 꼬리말을 붙인다. `CLINCH`면 `(우승 매치포인트)`, `ELIMINATION`이면 `(벼랑 끝 승부)`, `WINNER_TAKES_ALL`이면 BO1은 기존 `챔피언십 파이널 결승전`, 나머지는 `(최종전)`이다. 부제는 `{팀} vs {상대} · 시리즈 {playerWins}승 {oppWins}패`이다. `finalsContext`가 없으면 지금 문구를 그대로 쓴다.
3. `applyCompletedLiveGameOutcome` LEAGUE_FINALS: `resolveFinalsLiveGameInBracket`을 부른다. `seriesFinished`일 때만 우승 집계, 마일스톤, 파이널 MVP(이 경기의 `outcome.wonFinalsMvp`), 시즌 로그 `wonChampionship`·`playoffResult`를 바꾼다. 끝나지 않았으면 커리어하이와 `narrativeLog`만 갱신한다.
4. `closeLiveGameAndReturn`: LEAGUE_FINALS가 끝났는데 `championTeamId`가 없으면 `seasonPhase: 'POSTSEASON_BRACKET'`으로 돌아가고 토스트를 띄운다. 제목은 `파이널 시리즈 계속`, 설명은 `시리즈 {a}승 {b}패 — {gameNo}차전 결정전이 기다리고 있습니다.`이다. 그 밖에는 지금처럼 시즌 정산으로 간다.
5. `skipPlayoffsToEnd`: 남은 경기를 끝까지 시뮬하고 `pendingFinalsLiveGame: false`로 둔다.

- [ ] **Step 1: 실패하는 테스트 작성**

- `test('createLiveFinalGame 결정전 제목')`: NBA `finalsContext` `{ gameNo: 6, playerWins: 3, oppWins: 2, kind: 'CLINCH' }` → 제목에 `파이널 6차전`과 `우승 매치포인트`가 들어가고, 부제에 `시리즈 3승 2패`가 들어간다.
- `test('스토어: 결승 시리즈 흐름')`: 결승에 오른 상태의 커리어(`playerReachedFinals: true`, 결승 시리즈 0-0)를 스토어에 넣는다. `advanceFinalsToDecisiveGame` → `pendingFinalsLiveGame` true. `startFinalsLiveBroadcast` → `seasonPhase === 'LIVE_FINAL_BROADCAST'`. `skipLiveGame` → `closeLiveGameAndReturn`을 시리즈가 끝날 때까지 반복(최대 4회). 각 회차에서 우승팀이 없으면 `seasonPhase === 'POSTSEASON_BRACKET'`이다. 끝나면 `totals.championships`가 우승 여부와 맞는다(우승 시 +1, 준우승 시 그대로).
- `test('스토어: 결정전 대기 중 끝까지 시뮬')`: `pendingFinalsLiveGame` true 상태에서 `skipPlayoffsToEnd` → `championTeamId`가 있고 `pendingFinalsLiveGame`은 false.

- [ ] **Step 2: 실행해 실패 확인**

Run: `bun test src/engine/playoffBalance.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

- [ ] **Step 4: 테스트 통과와 화면 확인**

Run: `bun run typecheck && bun run lint && bun run test`
Expected: PASS

`bun run dev`로 띄운 뒤 결승에 오른 세이브를 만든다(개발 콘솔에서 스토어 상태 주입 가능). Playwright로 다음을 확인한다. `파이널 시리즈 시작` → 대진표에 시리즈 점수 표시 → `파이널 N차전 실시간 중계 입장` → 경기 종료 후 대진표 복귀(시리즈가 끝나지 않았을 때). 스크린숏은 deviceScaleFactor 1로 찍는다.

- [ ] **Step 5: 커밋**

```bash
git add src/store src/engine/liveGameEngine.ts src/components/dashboard src/engine/playoffBalance.test.ts
git commit -m "feat: 결승을 시리즈로 진행하고 결정전마다 라이브 중계"
```

### Task 6: 버전·패치노트·최종 검증

**Files:**
- Modify: `src/config/appMeta.ts:4` (`'1.4.0'`), `package.json` (`"version": "1.4.0"`)
- Modify: `src/data/patchNotes.ts` (맨 앞에 1.4.0)

- [ ] **Step 1: 패치노트 작성**

수치 없이 요약 + 체감 방향형으로 쓴다. 들어갈 내용:
- 새 기능 (3~5줄): 결승이 시리즈로 진행되고, 우승 직전·탈락 직전 경기를 직접 뛴다.
- 밸런스: PO에서 에이스 기여가 정규시즌만큼 커졌다. 정규시즌 상위 시드가 홈코트와 체력에서 유리해졌다. 하위 시드는 깊은 라운드에서 힘이 떨어진다. AI 순위가 실제 전력을 더 잘 반영한다. 각각 "왜"를 한 구절씩 붙인다.
- `saveImpact`: 진행 중이던 결승은 새 시리즈 방식으로 이어서 진행된다. 이전 버전에서 이미 입장한 결승 라이브 경기는 예전처럼 그 한 경기로 우승이 정해진다.

- [ ] **Step 2: 전체 검사**

Run: `bun run typecheck && bun run lint && bun run test && bun run balance:check`
Expected: 모두 PASS

- [ ] **Step 3: 커밋**

```bash
git add src/config/appMeta.ts package.json src/data/patchNotes.ts
git commit -m "chore: 1.4.0 플레이오프 개편 패치노트"
```
