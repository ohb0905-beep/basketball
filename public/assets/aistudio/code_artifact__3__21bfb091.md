# 매치·시즌·이벤트·기록 엔진 코드 분석 및 문제점 보고서

본 보고서는 `match_engine_bundle.txt`에 새로 포함된 7개 영역(`seasonSimulator.ts`, `playoffEngine.ts`, `encounterEngine.ts`, `recordBookEngine.ts`, `LiveGameBroadcast.tsx`, `leagues.ts`, `types/game.ts`)을 정적 분석하여 도출한 **치명적 버그, 수식 불균형, UI/리플레이 오류, 데이터 무결성 문제**를 정리한 문서입니다.

> **참고 (번들 인코딩):** 업로드된 `match_engine_bundle.txt`의 한글 문자열이 CP949/UTF-8 혼선(Mojibake)으로 깨져 있으나 이는 텍스트 병합 과정의 인코딩 문제로 간주하고, 실제 코드 로직·수식·상태 흐름 결함에만 집중하여 분석했습니다.

## 요약 (Executive Summary)

| 심각도 | 건수 | 핵심 영향 영역 | 
| ----- | ----- | ----- | 
| **치명적 (Critical)** | 6건 | NBA 파이널 MVP 기준 폭주(라이브 중계 시 수상 불가), ±4점 클러치 1포제션 수학적 모순, 라이브 중계 -4점 구조적 핸디캡, 이벤트 보상 키 충돌 덮어쓰기, 깨는 것이 불가능한 리그 신기록 3종, 경기 스킵 버튼 리플레이 재실행 버그 | 
| **높음 (High)** | 8건 | 국제대회 조별리그 0승 3패 자동 8강 진출, 국제대회 선수 능력치 이중 반영, 1라운드 픽 MPG 절벽 점프, `PACE_CONSERVE` 체력 회복 버그, 기록부 HOF/활성 커리어 동기화 왜곡, DPOY 빅맨 자동 수상, 안전 선택지의 모순된 연쇄 스토리, 미니 하프코트 3점슛 좌표 이탈 | 
| **중간 (Medium)** | 7건 | 우승 드래프트 주가 보너스 데드코드, 라이벌 내러티브 고정 인덱스 및 우승 기록 미갱신, 성장/전성기 나이 불일치, 파울아웃 쿼터 풀스탯 지급, 클러치 수비 실점 시 `FOUL` 배지 오표시, 벤치 주인공으로 인한 강팀 1옵션 NPC 소멸, 단일 시즌 신기록 10경기 출전 컷오프 | 
| **낮음 / 구조 개선 (Low)** | 4건 | `LeagueConfig` 인터페이스 중복 및 `NCAA` LDR 역전, `TWO_WAY` 부상 면제, `BALANCED` 전성기 보너스 편향, `pendingChainEvent` 컨텍스트 미검증 | 

## 1. 치명적 문제 (Critical)

### 1-1. NBA 파이널 라이브 중계 시 파이널 MVP 수상 기준 폭주 버그

* **위치:** `src/engine/playoffEngine.ts` — `evaluateRealisticFinalsMvp()`

* **원인:** 라이브 결승전 종료 후 파이널 MVP 기준선을 다음과 같이 계산합니다.
  

  $$
  \text{teamAceGameBenchmark} = \max\big(31.0,\; 27.5 + (\text{teamRating} - 62) \times 1.12\big)
  $$

* **실제 수치 비교 (NBA 우승권 팀 `teamRating = 90` 기준):**

  * **라이브 중계 기준선:** $27.5 + (90 - 62) \times 1.12 = \mathbf{58.86}$

  * `simulateLiveQuarter()`에서 OVR 90 슈퍼스타(34분 출전)가 기록하는 최상급 활약을 **27득점 6리바운드 5어시스트 1스틸 1블록**으로 가정하면,
    

    $$
    \text{gameScore} = 27 + 6(1.2) + 5(1.5) + 2(2) = 45.7 \implies \text{effectiveGameImpact} \approx 47.76 < 58.86
    $$

  * 즉 **NBA 파이널에서 35득점 5리바운드 5어시스트를 기록해도 `gameScore`가 50 안팎이라 파이널 MVP에서 탈락**합니다.

  * 반면 경기를 스킵(Skip)하면 `seasonImpact` 분기가 실행되어 기준선이 \$14.0 + (90 - 58) \\times 0.76 = \\mathbf{38.32}$로 낮아지고, 평균 26점 6리바운드 5어시스트(`44.42`)로 손쉽게 파이널 MVP를 수상합니다.

* **개선 방안:** `teamAceGameBenchmark`의 기울기(`1.12`)를 `0.45~0.55` 수준으로 낮추거나, `simulateLiveQuarter()`의 실제 기대 `gameScore` 분포(NBA 스타 기준 35\~48)에 맞춰 기준선을 재보정해야 합니다.

### 1-2. ±4점 차 클러치 1포제션 발동의 수학적 모순 (승패 고정)

* **위치:** `src/config/balanceConfig.ts` (`clutchMaxPointGap: 4`) & `src/engine/playoffEngine.ts` (`simulateLiveQuarter`, `resolveClutchPossession`)

* **원인:** 4쿼터 종료 직전 점수 차가 `±4점 이내`일 때 마지막 1포제션 클러치 선택지가 발동되지만, `resolveClutchPossession()`의 모든 선택지는 최대 **3점**만 가감합니다(4점 플레이나 2포제션 파울 작전 없음).

* **파급 효과:**

  * **4점 열세(`96:100`) 시:** `ISO_WINNER`(+3점)나 `KICKOUT_ASSIST`(+3점)에 **성공해도 `99:100`으로 무조건 패배**합니다.

  * **4점 리드(`104:100`) 시:** `LOCKDOWN_STOP`에 **실패해 상대가 3점을 넣어도 `104:103`으로 무조건 승리**하며, `CLUTCH_FREE_THROWS`에서 자유투를 0/2로 모두 놓쳐도 `leadAfterFt <= 3` 조건이 거짓이므로 상대 슛 자체가 발생하지 않아 100% 승리합니다.

* **개선 방안:** `LIVE_GAME_CONFIG.clutchMaxPointGap`을 `3`으로 수정하거나, 4점 차일 때 전용 시퀀스(파울 작전 + 2포제션 전개)를 별도 구현해야 합니다.

### 1-3. 라이브 중계 내 플레이어 팀에 걸린 -4점/경기 구조적 핸디캡

* **위치:** `src/config/balanceConfig.ts` (`LEAGUE_BALANCE_META`) & `src/engine/playoffEngine.ts` (`simulateLiveQuarter`)

* **원인:**

  * `LEAGUE_BALANCE_META`에서 유로리그(`20 vs 20`)를 제외한 **8개 리그 모두 `liveOppQuarterBasePts`가 `liveQuarterBasePts`보다 +1점 높게 설정**되어 있습니다(예: NBA `25 vs 26`, KBL `19 vs 20`).

  * 반면 `simulateLiveQuarter()`는 이미 `getReplacementLevelQuarterImpact()`로 리그 평균 선수 기대치(`replacement.lift`, `replacement.stocks`)를 차감하는 대칭 보정을 적용했습니다.

* **파급 효과:** 대칭 보정 도입 이전의 잔재인 `+1점/쿼터`가 남아 있어, 동일 전력 구단 및 리그 평균 선수 기준으로 플레이어 팀이 **매 경기 평균 4점씩 불리한 상태**에서 라이브 경기를 치르게 됩니다.

* **개선 방안:** 모든 리그의 `liveOppQuarterBasePts`를 `liveQuarterBasePts`와 동일하게 맞추어야 합니다.

### 1-4. `encounterEngine.ts`의 객체 키 충돌로 인한 유료/전용 보상 능력치 반토막 버그

* **위치:** `src/engine/encounterEngine.ts` — `enrichSeedChoices()`

* **원인:** 3번째 특수 선택지를 생성할 때 계산된 프로퍼티 `[c1Primary]`가 기존 정적 키를 덮어씁니다.

  1. **사비 \$15,000 투자 선택지 (`LOAD_MANAGEMENT`, `OFF_COURT_BRAND`):**

     ```
     statChanges: { phy: 2, [c1Primary]: 1 }
     
     ```

     `c1Primary === 'phy'`인 5개 시나리오(`INJ_01`, `INJ_02`, `INJ_04`, `INJ_06`, `OFF_01`)에서 `{ phy: 2, phy: 1 }`이 `{ phy: 1 }`로 덮어씌워집니다. UI에는 `PHY +2`로 안내되지만, \$15,000를 지불하고 무료 안전 선택지(`PHY +2, 보조 +1`)보다 못한 `PHY +1`만 받게 됩니다.

  2. **패스(PLY) 74+ 전용 분기 (`TACTICAL_CLASH`, `ROLE_ADAPTATION`):**

     ```
     statChanges: { ply: 2, [c1Primary]: 1 }
     
     ```

     `c1Primary === 'ply'`인 6개 시나리오(`TAC_01`, `TAC_02`, `TAC_06`, `GRD_01`, `GRD_02`, `BIG_03`)에서 `{ ply: 1 }`로 축소됩니다.

  3. **라커룸 70+ 전용 분기 (`LOCKER_ROOM`):**
     `{ [c1Primary]: 1, def: 1 }`에서 `LCK_03`(`c1Primary === 'def'`)이 `{ def: 1 }`로 축소됩니다.

* **개선 방안:** 동일 키일 경우 값을 합산하거나 대체 보조 스탯을 선택하도록 병합 헬퍼를 작성하고, `effectSummary` 문구도 실제 `statChanges`에서 동적으로 생성해야 합니다.

### 1-5. 게임 시스템 상한과 충돌하여 수학적으로 경신 불가능한 리그 신기록 3종

* **위치:** `src/engine/recordBookEngine.ts` (`LEAGUE_BASELINE_RECORDS`) & `src/config/balanceConfig.ts` (`ROLE_MPG_CONFIG.ppg.maxPpg`)

* **불가능한 기록 목록:**

  1. **NBA 단일 시즌 평균 득점 (`SEASON_PPG`):** 기록부 기준은 **`34.0 PPG`**(마이클 조던)이지만, `ROLE_MPG_CONFIG.ppg.maxPpg` 하드 캡이 `32.5`로 고정되어 있어 **영원히 경신 불가능**합니다.

  2. **호주 NBL 통산 득점 (`CAREER_POINTS`):** 기록부 기준은 `18,908점`이지만, 게임 내 NBL은 시즌당 `29경기`입니다. 하드 캡인 `32.5 PPG`를 결장 0경기로 기록해도 연간 최대 $942.5$점이므로 **20.1시즌 연속 32.5 PPG**를 기록해야 경신할 수 있습니다(사실상 불가능).

  3. **한국 대학 U-리그 통산 득점 (`CAREER_POINTS`):** 기록부 기준은 `1,950점`이지만, 게임 내 U-리그는 최대 4시즌 $\times$ 16경기 $=$ **64경기**입니다. 4년 내내 결장 없이 **평균 30.5 PPG**를 유지해야 하는데, U-리그 `growthCap = 67` 및 `softCapStart = 22.8` 구조상 달성이 사실상 불가능합니다.

* **개선 방안:** `maxPpg` 상한을 상향(예: 36.0)하거나, 각 리그의 게임 내 경기 수와 득점 상한에 비례하도록 `LEAGUE_BASELINE_RECORDS` 기준치를 재조정해야 합니다.

### 1-6. `LiveGameBroadcast.tsx`의 `경기 스킵` 버튼이 리플레이를 강제 재실행하는 상태 버그

* **위치:** `src/components/live/LiveGameBroadcast.tsx` — `handleSkipEntireGame()`

* **원인:**

  ```
  const handleSkipEntireGame = () => {
    setReplayState({ key: replayKey, ..., finished: true });
    skipLiveGame();
  };
  
  ```

  * `setReplayState`에는 스킵 **이전** 쿼터의 `replayKey`(예: `1_7` 또는 `0_0`)가 저장됩니다.

  * 직후 `skipLiveGame()`이 상태를 4Q/OT 종료 상태로 바꾸면 `replayKey`가 `4_9` 등으로 변경됩니다.

  * 다음 렌더에서 `isNewKey = replayState.key !== replayKey`가 `true`가 되어 `isReplaying = true`로 전환되므로, **유저가 "경기 스킵"을 눌렀는데도 마지막 쿼터 전체 애니메이션 리플레이가 강제로 재생**됩니다.

* **개선 방안:** 별도의 `skipRequestedRef` 플래그를 두거나 `skipLiveGame()` 호출 시 `liveGame.isFinished` 전환 직후 리플레이를 건너뛰는 상태(또는 `liveGame.wasSkipped` 플래그)를 도입해야 합니다.

## 2. 높음 문제 (High)

### 2-1. 국제대회 조별리그 3전 전패 시에도 무조건 8강에 진출하는 버그

* **위치:** `src/engine/playoffEngine.ts` — `simulateInternationalTournament()`

* **원인:** 조별리그 3경기 결과를 `matches` 배열에 추가한 뒤 승패를 전혀 검사하지 않고 곧바로 `8강 토너먼트`를 실행합니다.

* **파급 효과:** 대한민국 대표팀이 조별리그에서 0승 3패로 전패해도 항상 8강에 진출해 메달 및 병역특례까지 획득할 수 있습니다.

* **개선 방안:** 조별리그 최소 1\~2승(또는 득실차 포함 조 2위 이내) 통과 조건을 추가하고, 탈락 시 `eliminatedStage: 'GROUP'` 결과를 반환하도록 분기해야 합니다.

### 2-2. 국제대회 라이브 경기에서 선수 OVR 이중 반영 및 NBA 48분 템포 오적용

* **위치:** `src/engine/playoffEngine.ts` — `createLiveFinalGame()`, `simulateLiveQuarter()`

* **원인:**

  1. **기량 이중 반영:** `createLiveFinalGame()`에서 대표팀 레이팅(`korRating`)에 이미 선수의 OVR 기반 `aceContribution`(최대 $+19.5$)을 합산했는데, `simulateLiveQuarter()`에서 선수 개인의 `playerCourtLift`와 `defSuppression`을 다시 별도로 가산합니다.

  2. **리그 템포 오염:** `simulateLiveQuarter()`가 국제대회에서도 `LEAGUE_BALANCE_META[career.league]`의 쿼터 기본 득점을 그대로 사용합니다. NBA 소속 선수가 FIBA 40분 국제대회 결승에 출전하면 NBA 48분 템포(`25/26점/Q`, 최종 점수 105:100대)로 시뮬레이션됩니다.

* **개선 방안:** 국제대회 전용 `liveQuarterBasePts`(예: 19점)와 `liveOvertimeBasePts`(9점)를 `INTERNATIONAL_TOURNAMENT_CONFIG`에서 참조하고, 라이브 경기 중에는 대표팀 기본 레이팅(`baseKorRating`)만 사용하도록 분리해야 합니다.

### 2-3. 1라운드 드래프트 유망주(`isFirstRoundPedigree`)의 출전시간(MPG) 절벽 점프 및 역전 버그

* **위치:** `src/engine/seasonSimulator.ts` — `calculateRoleAndMpg()`

* **원인:**

  * `roleIndex` 계산 시 이미 `pedigreeBonus`(최대 `+15.0`)를 더한 상태에서, 아래 분기로 시그모이드 보간을 덮어씁니다.

    ```
    if (isFirstRoundPedigree && roleIndex < 7 && rawOvrDiff < 2) {
      // 23.5~28.0 MPG (또는 20.0~25.5 MPG), basePer36 = 16.5 (또는 14.8)
    } else {
      // sigmoid((roleIndex + 1.2) / 4.3)
    }
    
    ```

* **실제 수치 왜곡:**

  * `roleIndex = 6.9`일 때 1라운드 픽은 `20.0~25.5 MPG` / `basePer36 = 14.8`로 묶입니다.

  * OVR이 단 1 올라 `roleIndex = 7.1`이 되면 `else`로 넘어가 `sigmoid(8.3 / 4.3) = 0.873` $\rightarrow$ `33.0 MPG` / `basePer36 = 21.8`로 한 번에 +8\~10분, `basePer36` +7.0이 폭등합니다.

  * 반대로 1라운드 15순위 선수가 `roleIndex = 6.0`일 때는 1라운드 보호 조항 때문에 오히려 비지명/2라운드 선수(`roleIndex = 6.0` $\rightarrow$ 31.9 MPG)보다 출전시간을 덜 받는 역전이 발생합니다.

* **개선 방안:** `if (isFirstRoundPedigree ...)`의 하드 오버라이드 대신, 시그모이드로 계산된 `mpg`와 `basePer36`에 대해 1라운드 픽 최소 보장 하한선(`Math.max(mpg, minPedigreeMpg)`)만 적용하도록 단순화해야 합니다.

### 2-4. `PACE_CONSERVE` 전술의 체력 회복(+6) 하드코딩으로 인한 지배 전략 심화

* **위치:** `src/engine/playoffEngine.ts` — `simulateLiveQuarter()`

* **원인:** 이전 보고서에서 지적한 `balanceConfig.ts`의 과도한 수치(`fgBonus: +0.03`, `defBonus: +1.15`, `staminaDrain: 8`, `foulRisk: 0.10`)에 더해, `simulateLiveQuarter()` 내부에 `+ (chosenTactic === 'PACE_CONSERVE' ? 6 : 0)`가 하드코딩되어 있습니다.

* **파급 효과:** 실제 체력 소모가 쿼터당 `0~2` 수준(철강왕·연장전에서는 오히려 체력 증가!)이 되면서, 1\~4쿼터 내내 `PACE_CONSERVE`만 고정 선택하는 것이 공수 효율·파울 관리·체력 보존 모든 면에서 최적 해가 됩니다.

* **개선 방안:** 하드코딩된 `+6` 회복과 `defBonus: +1.15` / `fgBonus: +0.03`을 동시에 하향 조정하여 전술 간 뚜렷한 트레이드오프를 만들어야 합니다.

### 2-5. `recordBookEngine.ts`의 HOF 및 활성 커리어 동기화 왜곡 버그 2건

* **위치:** `src/engine/recordBookEngine.ts` — `syncRecordBookWithHof()`

* **버그 내용:**

  1. **타 리그 커리어 하이가 NBA 단일 경기 신기록을 경신:** `hof.iconicTeam.league === 'NBA'`이면 전체 리그 통합 기록인 `hof.careerHighPts`를 NBA 단일 경기 최다 득점(`62점`)과 비교합니다. 고교나 KBL에서 65점을 넣은 뒤 NBA에서 활약한 선수가 코비 브라이언트의 NBA 기록을 깨버립니다.

  2. **활성 커리어 동기화 시 달성 연도·구단 오기:** `for (const log of activeCareer.seasonLogs)` 루프 안에서 `checkAndApplyRecordBreaks(nextBook, activeCareer, log)`를 호출하는데, 내부의 `aggregateLeagueCareerStats(career, league)`는 `log` 시점이 아니라 **커리어 전체 누적값**을 합산합니다. 따라서 루프의 첫 번째 시즌(`log[0]`)에서 이미 최종 통산 득점이 반영되어 **신기록 달성 연도와 소속 구단이 데뷔 시즌(루키 구단)으로 기록**됩니다.

  3. **리그 누락:** HOF 동기화가 NBA와 KBL만 처리하며(KBL은 통산 득점·단일 경기 득점도 누락), 유로리그·B.리그·NBL·G리그·NCAA 등은 동기화 대상에서 완전히 제외됩니다.

* **개선 방안:** 활성 커리어 동기화 시 `seasonLogs.slice(0, idx + 1)`로 누적 시점을 슬라이스하여 처리하고, HOF 엔트리에는 리그별 단일 경기 최고 득점을 별도 저장하거나 `retrospective.seasons`에서 리그별로 정확히 집계해야 합니다.

### 2-6. DPOY(올해의 수비수) 수상 공식의 과도한 빅맨 편향 및 자동 수상 문제

* **위치:** `src/engine/seasonSimulator.ts` — `evaluateFluidSeasonAwards()`

* **원인:** MVP·올스타·올리그는 리그 전체 NPC 풀 경쟁으로 개편되었으나 DPOY·6MOY·MIP는 여전히 절대 점수 임계값 방식이며, DPOY 기준선이 지나치게 낮고 블록/리바운드 가중치가 큽니다.

  * **NBA 센터 예시 (`ldr = 84`, `def = 87`, `spg = 1.0`, `bpg = 2.0`, `rpg = 10.0`, `winRate = 0.52`):**
    

    $$
    \text{dpoyScore} = 87(0.55) + 1.0(7.5) + 2.0(8.5) + 10.0(0.8) + 0.52(15) = \mathbf{88.15}
    $$

    $$
    \text{dynamicDpoyBar} = 84(0.82) + 8.0 = \mathbf{76.88}
    $$

  * `def`가 `ldr + 3`을 넘고 팀 승률이 51% 이상인 주전 빅맨은 **거의 매 시즌 자동으로 DPOY를 싹쓸이**합니다. 고교(`ldr = 45`, 기준선 `44.9`)에서도 `def = 48` 이상이면 포지션 무관하게 대부분 DPOY를 수상합니다.

* **개선 방안:** DPOY 역시 `evaluateUnifiedLeagueAwards()`의 대칭 리그 풀 안에서 스틸·블록·수비 지표 1위를 가리는 경쟁 모델로 통합하거나, 포지션별 기대치 및 `dynamicDpoyBar` 기준을 대폭 상향해야 합니다.

### 2-7. `encounterEngine.ts`의 안전 선택지가 도전 선택지 전용 연쇄 스토리를 발동하는 모순

* **위치:** `src/engine/encounterEngine.ts` — `enrichSeedChoices()`, `CHAIN_FOLLOWUPS`

* **원인:** `safeChoice`(선택지 1)에도 `nextChainEvent: chainEntry ? chainEntry.successChain : undefined`를 일괄 연결했습니다.

* **서사 충돌 사례:**

  * `MED_01`: 선택지 1에서 *"감독과 동료 덕분"* 이라고 겸손하게 인터뷰했는데, 다음 시즌 *"지난 시즌 당당했던 인터뷰가 화제가 된 뒤 상대가 거칠게 견제"* 라는 연쇄 이벤트가 뜹니다.

  * `TAC_01`: 선택지 1에서 *"감독의 피드백을 수용"* 했는데, 다음 시즌 *"자신의 공격 철학을 데이터로 설득했던 태도를 높이 산 감독"* 이라는 이벤트가 뜹니다.

  * `TAC_04`: 선택지 1에서 *"미드레인지를 줄이고 3점과 림 어택으로 전환"* 했는데, 다음 시즌 *"지난 시즌 준비해 둔 미드레인지 카운터를 꺼낼 시점"* 이라는 이벤트가 뜹니다.

* **개선 방안:** `safeChoice`에서 `nextChainEvent` 연결을 제거하거나, 선택지 1에 맞는 별도의 연쇄 이벤트를 정의해야 합니다.

### 2-8. `MiniHalfCourt` SVG의 모든 3점슛 좌표가 3점 라인 안쪽(2점 구역)에 렌더링되는 버그

* **위치:** `src/engine/playoffEngine.ts` (`THREE_PT_SPOTS`) & `src/components/live/LiveGameBroadcast.tsx` (`MiniHalfCourt`)

* **원인:** `MiniHalfCourt`의 3점 라인은 좌우 코너 직선 `x = 32`, `x = 288` 및 중심 `(160, 62)`, 반지름 `(128, 118)`의 호(정점 `y = 180`)로 그려집니다. 반면 `THREE_PT_SPOTS`의 정규화 좌표를 `toSvgX/toSvgY`로 변환하면 다음과 같습니다.

  * 좌/우 코너 `[11, 20]`, `[89, 20]` $\rightarrow$ `x = 47.7`, `272.3` (코너 3점 라인 **안쪽 15.7px**)

  * 좌/우 윙 `[18, 52]`, `[82, 52]` $\rightarrow$ `(67.8, 113.8)` (3점 아크 경계 `y = 143.9` **안쪽 30.1px**)

  * 탑 오브 더 키 `[50, 66]` $\rightarrow$ `(160.0, 140.7)` (3점 아크 정점 `y = 180.0` **안쪽 39.3px**)

* **파급 효과:** 모든 `+3` 3점슛 애니메이션이 시각적으로 미드레인지 2점 구역에서 발사됩니다. 자유투 지점 `[50, 38]`(`y = 87`) 역시 자유투 라인(`y = 102`) 안쪽 페인트존에 찍힙니다.

* **개선 방안:** `THREE_PT_SPOTS` 좌표를 `[[3, 20], [97, 20], [10, 72], [90, 72], [50, 91]]` 등으로 보정하고, 자유투 지점을 `[50, 46]`으로 맞추어야 합니다.

## 3. 중간 문제 (Medium)

### 3-1. `simulateSeason()`의 우승 드래프트 주가 보너스 데드코드

* **위치:** `src/engine/seasonSimulator.ts` — `simulateSeason()`

* **원인:** 정규시즌 시뮬레이션 단계에서 `stockBoost`에 `(awards.wonChampionship ? 10 : 0)`을 계산하지만, 포스트시즌이 아직 진행되지 않아 `awards.wonChampionship`은 항상 `false`입니다.

* **개선 방안:** 포스트시즌 종료 후 우승 확정 시점에 드래프트 주가(`+10`)를 별도 가산하도록 이관해야 합니다.

### 3-2. 라이벌 매치업 내러티브의 첫 번째 인덱스 고정 및 우승 경력 미갱신

* **위치:** `src/engine/seasonSimulator.ts` — `simulateRivalsSeason()`

* **원인:**

  1. `if (idx === 0 && sameLeague)` 조건 때문에, KBL에서 먼저 라이벌(`idx 0, 1`)이 생성된 뒤 NBA로 진출해 새 라이벌(`idx 2, 3`)을 만나면 **NBA 라이벌 매치업 내러티브가 영원히 출력되지 않습니다**(`if (!rivalNarrative && sameLeague)`로 수정 필요).

  2. `RivalPlayer.championships` 필드는 생성 시 `0`으로 초기화된 이후 어느 엔진(`seasonSimulator.ts`, `playoffEngine.ts`)에서도 갱신되지 않아 모든 라이벌의 통산 우승이 항상 0회로 남습니다.

### 3-3. 성장기/전성기 나이 경계의 엔진 간 1년 불일치 및 조숙형 에이징 공백

* **위치:** `src/engine/seasonSimulator.ts` (`calculateSeasonStatGrowth`) vs `src/engine/retirementEngine.ts` (`getAgingPhaseInfo`)

* **원인:**

  * `calculateSeasonStatGrowth()`의 `maxGrowthAge`는 `STANDARD: 27, EARLY_BLOOMER: 26, LATE_BLOOMER: 29, IRONMAN: 28`이며 `SLOW_STARTER` 특성을 반영합니다.

  * 반면 UI에 표시되는 `getAgingPhaseInfo()`는 `STANDARD: 26, EARLY_BLOOMER: 25, LATE_BLOOMER: 28, IRONMAN: 27`로 **모든 DNA가 1년씩 어긋나며 `SLOW_STARTER` 특성을 무시**합니다.

  * 또한 `EARLY_BLOOMER`는 `primeEndAge = 28`이라 만 29세부터 `applyAgingCurve()`가 호출되는데, 고마일리지 시 `onsetAge`가 27.0까지 내려가 있어 만 28세까지 멀쩡하다가 만 29세에 갑자기 `agingYears = 2.0` 하락 폭탄을 맞습니다.

* **개선 방안:** 성장기·전성기·노쇠기 경계 연령 계산 함수를 단일 모듈(SSOT)로 통합해야 합니다.

### 3-4. 파울아웃 당한 쿼터에도 100% 풀스탯이 지급되는 문제

* **위치:** `src/engine/playoffEngine.ts` — `simulateLiveQuarter()`

* **원인:** `fouledOutNow = true`가 해당 쿼터의 모든 개인 스탯(`qFga`, `qPts`, `qReb`, `qAst`, `qStl`, `qBlk`) 계산이 끝난 **맨 마지막에** 판정됩니다. 중계 문구는 `"3Q 중반 5반칙 퇴장"`이라고 출력하지만 실제로는 해당 쿼터 풀타임 생산성을 전부 획득하며, 연장전에서도 자유투 트립(`ftTrips`)에 `isOvertime` 시간 축소가 적용되지 않습니다.

### 3-5. 클러치 수비 실패 시 코트에 `FOUL` 배지 오표시 및 0점 어시스트 림 이펙트

* **위치:** `src/engine/playoffEngine.ts` (`resolveClutchPossession`) & `src/components/live/LiveGameBroadcast.tsx` (`MiniHalfCourt`)

* **원인:**

  * `LOCKDOWN_STOP` 실패로 상대가 2점/3점 슛을 성공(`oppDelta > 0`)시켰을 때 `clutchBadge`가 `'FOUL'`로 설정되어 실제 문자 중계(버저비터 허용)와 불일치합니다.

  * `MiniHalfCourt`의 `isScoredPlay`가 `(shotPoints ?? 0) > 0 || type === 'ASSIST'`로 판정되어, `shotPoints === 0`인 폴백 어시스트에도 림 득점 파동 애니메이션이 재생됩니다.

### 3-6. 벤치 신분 주인공이 소속 강팀의 1옵션 NPC 스타 생성을 막는 문제

* **위치:** `src/engine/seasonSimulator.ts` — `buildSymmetricLeaguePlayerPool()`, `generateLeagueNpcStarPool()`

* **원인:** 주인공의 출전시간·역할과 무관하게 `teamOccupiedSlots.set(boxScore.teamId, 1)`을 설정합니다. 이로 인해 주인공이 6분 뛰는 벤치 루키여도 소속 강팀(예: 보스턴)의 `starTier = 0`(1옵션 에이스) 슬롯을 차지해 버려, 해당 우승 후보 팀에서 리그 MVP/올스타급 1옵션 NPC가 생성되지 않습니다.

* **개선 방안:** 주인공이 주전/에이스(`mpg >= 25`)일 때만 1옵션 슬롯을 점유하고, 벤치 신분일 때는 소속팀의 1옵션 NPC가 정상 생성되도록 분리해야 합니다.

### 3-7. 단일 시즌 리그 신기록 최소 출전 경기 수(`gp >= 10`)의 리그 규모 미반영

* **위치:** `src/engine/recordBookEngine.ts` — `aggregateLeagueCareerStats()`, `checkAndApplyRecordBreaks()`

* **원인:** 단일 시즌 평균 기록(`SEASON_PPG/RPG/APG`) 자격 조건이 모든 리그 공통 `gp >= 10`으로 하드코딩되어 있습니다. 82경기 NBA에서 부상으로 72경기를 결장하고 10경기만 뛴 선수가 단일 시즌 평균 득점/리바운드/어시스트 역대 신기록을 경신할 수 있습니다.

* **개선 방안:** `LEAGUE_BALANCE_META[league].minAttendanceRatio * LEAGUE_CONFIG[league].games` 기준으로 통일해야 합니다.

## 4. 낮음 및 구조 개선 과제 (Low & Maintainability)

* **`LeagueConfig` 인터페이스 중복 및 리그 난이도 역전 (`types/game.ts`, `data/leagues.ts`):**

  * `types/game.ts`와 `data/leagues.ts`에 `LeagueConfig`가 서로 다른 필드로 중복 선언되어 있고, `data/leagues.ts`만 절대경로(`@/src/types/game`)를 혼용합니다.

  * 또한 `NCAA`의 수비 저항(`ldr: 74`)과 위상(`prestige: 1.00`)이 프로 리그인 `G리그(73 / 0.85)`, `NBL(72 / 0.83)`, 심지어 `유로리그(prestige: 0.94)`보다 높게 설정되어 스카우팅 리그 환산 시 대학 선수가 프로 선수보다 과대평가될 여지가 있습니다.

* **`TWO_WAY` 계약 선수의 부상 및 로드매니지먼트 완전 면제 (`seasonSimulator.ts`):**

  * `calculateRoleAndMpg()`에서 `TWO_WAY` 분기가 조기 반환되어 유리몸(`GLASS_BODY`)이나 고령 투웨이 선수가 부상 확률 0%가 됩니다.

* **`BALANCED` 훈련 시 전성기 보너스 편향 (`seasonSimulator.ts`):**

  * `calculateSeasonStatGrowth()` 전성기 구간에서 `trainingFocus === 'BALANCED'`일 때 `bonusKey`가 기본값 `'ins'`로 떨어져 매 시즌 인사이드 능력치만 편중 상승합니다(또한 `secondaryKey === bonusKey`일 때 1/6 확률로 동일 능력치 `+2` 발생).

* **`pendingChainEvent` 컨텍스트 미검증 및 아마추어 `CONTRACT_YEAR` 오태깅 (`encounterEngine.ts`):**

  * `rollCombinatorialEncounter()`는 `pendingChainEvent`를 리그·팀 이동·상무 입대 여부 검사 없이 무조건 반환합니다.

  * `extractCareerContextTags()`에서 `contractYearsLeft <= 1` 조건이 아마추어(고3·대4)에게도 `CONTRACT_YEAR` 태그를 부여합니다.

  * `LiveGameBroadcast.tsx`는 마지막 쿼터의 중계 로그만 보여주며, 이전 쿼터별 스코어 요약(1Q\~4Q 박스)을 표시하지 않습니다.

## 5. 우선순위별 수정 로드맵

1. **즉시 수정 (P0 — 체감 치명 버그):**

   * `playoffEngine.ts`: `evaluateRealisticFinalsMvp()`의 `teamAceGameBenchmark` 기울기 하향, `clutchMaxPointGap` 3점 조정(또는 4점 차 전용 시퀀스), `LEAGUE_BALANCE_META`의 `liveOppQuarterBasePts === liveQuarterBasePts` 대칭화

   * `encounterEngine.ts`: `enrichSeedChoices()`의 `{ phy: 2, [c1Primary]: 1 }` / `{ ply: 2, [c1Primary]: 1 }` 키 충돌 수정

   * `LiveGameBroadcast.tsx`: `handleSkipEntireGame()`의 `replayKey` 불일치로 인한 스킵 후 리플레이 재실행 수정

   * `recordBookEngine.ts` / `balanceConfig.ts`: NBA `SEASON_PPG(34.0)` vs `maxPpg(32.5)`, NBL/U-리그 통산 득점 기록 현실화

2. **단기 수정 (P1 — 핵심 로직 정합성):**

   * `playoffEngine.ts`: 국제대회 조별리그 탈락 조건 추가, 국제대회 라이브 경기 NBA 템포 및 OVR 이중 반영 제거, `PACE_CONSERVE` 체력 `+6` 하드코딩 제거, `THREE_PT_SPOTS` 좌표 교정

   * `seasonSimulator.ts`: 1라운드 픽 `roleIndex` MPG 절벽 제거, DPOY 경쟁 풀 통합/기준 상향, 라이벌 내러티브 인덱스(`!rivalNarrative`) 수정

   * `recordBookEngine.ts`: `syncRecordBookWithHof()`의 HOF 리그별 커리어 하이 분리 및 활성 커리어 시점별 슬라이스 동기화, `gp >= 10`을 리그 최소 출장 비율로 교체

3. **중기 폴리싱 (P2 — 서사 및 유지보수성):**

   * `encounterEngine.ts`: 안전 선택지의 모순된 연쇄 이벤트 연결 해제 및 `pendingChainEvent` 컨텍스트 검사 추가

   * `seasonSimulator.ts` / `retirementEngine.ts`: 성장기·전성기·에이징 경계 연령 계산 함수 단일화 및 `RivalPlayer.championships` 갱신 연동