# 스토어·스토리·회고·데이터 계층 코드 분석 및 문제점 보고서

본 보고서는 `bundle_store_engines.txt`와 `bundle_data_utils.txt`에 새로 포함된 9개 핵심 모듈(`useCareerStore.ts`, `saveMigration.ts`, `storyArcEngine.ts`, `retrospectiveEngine.ts`, `teams.ts`, `archetypes.ts`, `events.ts`, `headlines.ts`, `formatters.ts`)을 정밀 분석하여 도출한 **치명적 진행/콘텐츠 차단 버그, 상태 동기화 오류, 데이터 왜곡, 데드코드**를 정리한 문서입니다.

## 요약 (Executive Summary)

| 심각도 | 건수 | 핵심 영향 영역 | 
| ----- | ----- | ----- | 
| **치명적 (Critical)** | 7건 | 국제대회 매년 차출로 인한 스토리/이벤트 100% 기아(Starvation), 베테랑 스타일 진화 보상 증발, 투웨이 2년 차 잔여 계약 0년 고착, G리그·NCAA 전 구단 `CONTENDER` 고정 및 레이팅 폭주, 드래프트 컴바인 철회 무한 스탯 파밍, `getTeamById()` 경복고 침묵 폴백, PO 탈락 시 우승팀·라이벌 우승 누락 | 
| **높음 (High)** | 8건 | 라이브 파이널 최다득점 신기록 누락, 전 구단 `BALANCED` 고정(전술 스카우팅 전멸), 이적/입대 시 관계도·역할 미갱신 및 대시보드 트레이드 가드 부재, 스토리 아크 타 리그 라이벌·상무 발동, 회고록 PO 우선순위 문자열 불일치, Zustand `onRehydrateStorage` 직접 변이, 재활 케어 문구(70%) vs 실수치 괴리, 포지션 이벤트 10종 데드코드 | 
| **중간 (Medium)** | 7건 | 동명이인 커리어 신기록 오귀속, HOF 회고/기록부 현실 연도(`2026`) 오용, PO 우승 드래프트 주가(+10) 누락, 마이그레이션 `leagueName` 및 구단 메타 불일치, 스토리 아크 `coachTrust`/31세+ 잠재력 보상 불일치, 헤드라인 템플릿 데드코드 및 "생애 첫 MVP" 오기, `formatCashDelta(0)` `-$0` 출력 | 
| **낮음 / 구조 개선 (Low)** | 4건 | 아마추어 미드시즌 잠재력(+1) 우회, `events.ts` 파일 중간 `import`, `archetypes.ts` 신장 범위 중복, `isProLeague` 중복 및 주석 수치 불일치 | 

## 1. 치명적 문제 (Critical)

### 1-1. 국제대회 매년 차출로 인한 스토리 아크·연쇄 스토리·48종 인카운터 완전 기아(Starvation) 버그

* **위치:** `src/data/events.ts` — `rollSeasonEvent()` & `src/config/balanceConfig.ts` — `getInternationalTournamentByYear()`

* **원인:**

  * `getInternationalTournamentByYear(year)`는 `year % 4`의 모든 나머지(`0, 1, 2, 3`)에 국제대회를 배정합니다(올림픽 $\rightarrow$ 아시아컵 $\rightarrow$ 아시안게임 $\rightarrow$ FIBA 월드컵 $\rightarrow$ 반복). 즉 게임 내 **단 한 해도 빠짐없이 매년** 국제대회가 열립니다.

  * 그런데 `rollSeasonEvent()`는 단일 이벤트 슬롯(`CareerEvent | null`)을 반환하는 구조에서 4번 분기(국제대회 차출)가 **5번 분기(`pendingChainEvent`)** 및 6번 분기(`rollCombinatorialEncounter` / `rollStoryArcEvent`)보다 먼저 평가되어 즉시 `return`합니다.

* **파급 효과:**

  * OVR 75 이상에 도달한 만 19\~36세 선수(사실상 모든 NBA·유로리그·주력 프로 선수)는 **매년 오프시즌마다 예외 없이 4번 분기에서 국제대회 소집만 반환**됩니다.

  * 그 결과 **`storyArcEngine.ts`의 4대 멀티 시즌 스토리 아크(12단계)**, **`encounterEngine.ts`의 6대 연쇄 스토리(`pendingChainEvent`) 및 48종 조합형 인카운터**가 만 19\~36세 프로 전성기 내내 **사실상 100% 도달 불가능한 데드 콘텐츠**가 됩니다.

  * 심지어 대표팀 소집을 거절하더라도 다음 해에는 `(year + 1) % 4`의 다음 국제대회가 다시 4번 분기를 선점합니다.

* **개선 방안:** 국제대회 소집을 일반 이벤트 큐(`pendingEvent`)와 분리된 별도 오프시즌 액션/배너로 독립시키거나, 국제대회 직후/불참 시 후속으로 커리어 인카운터·스토리 아크가 이어지도록 이벤트 큐(`pendingEventQueue: CareerEvent[]`) 구조로 전환해야 합니다.

### 1-2. `resolveEventChoice()`의 31세+ 연령 보정이 '베테랑 플레이 스타일 진화' 핵심 이벤트를 무력화

* **위치:** `src/store/useCareerStore.ts` (`resolveEventChoice`) & `src/data/events.ts` (`createVeteranReinventionEvent`)

* **원인:**

  * 커리어 1회 한정 특별 이벤트 `EVT_VETERAN_REINVENTION`(만 32\~34세 발동)은 피지컬 저하를 감수하고 기술형으로 변신하는 선택지(`statChanges: { ply: 3, out: 3, def: 1, phy: -2 }`)와 기존 스타일 고수 선택지(`{ ins: 2, phy: 1 }`)를 제공합니다.

  * 그러나 `resolveEventChoice()`가 예외 없이 모든 이벤트에 `applyAgeAdjustedEventStatChanges(career.age, ...)`를 적용합니다.

* **실제 결과 왜곡:**

  * **만 32\~33세:** 선택지 1은 UI에 `PLY +3, OUT +3, DEF +1 (PHY -2)`라고 안내되지만, 양수 스탯이 전부 `+1`로 깎이고 음수 `PHY -2`만 100% 적용되어 최대 `PLY +1, OUT +1, PHY -2`만 반영됩니다.

  * **만 34세:** 신체 스탯(`phy`, `ins`, `def`, `reb`)의 양수 상승이 전면 차단되고, 기술 스탯(`out`, `ply`)도 90 미만일 때만 `+1`이 허용됩니다. 따라서 선택지 2(`INS +2, PHY +1`)는 **능력치 상승 0**, 선택지 1은 `out, ply >= 90`인 슈퍼스타에게 **`PHY -2` 페널티만 안겨주는 함정**이 됩니다.

  * 동일한 현상이 `EVT_VETERAN_CRITICAL_INJURY`(`PHY -7, PLY +2` $\rightarrow$ `PLY +1` 또는 `0`)에도 발생합니다.

* **개선 방안:** `choice.triggerVeteranReinvention` 또는 `bypassAgeStatCap?: boolean` 플래그가 명시된 전용 서사 이벤트는 `applyAgeAdjustedEventStatChanges` 필터를 우회하도록 예외 처리해야 합니다.

### 1-3. 투웨이 2년 차 연장 및 드래프트 철회 잔류 시 `contractYearsLeft = 0` 고착 버그

* **위치:** `src/store/useCareerStore.ts` — `selectOffseasonOption()`

* **원인:**

  ```
  const isTeamChanged = nextTeam.id !== career.team.id;
  const isExistingContractStay =
    option.actionType === 'STAY_TEAM' && !isTeamChanged;
  ...
  const nextContractYearsVal = isExistingContractStay
    ? career.contractYearsLeft
    : option.contractYears;
  
  ```

  * `OffseasonOption` 타입에 명시적 플래그 `isExistingContract?: boolean`이 존재함에도, 스토어가 이를 무시하고 `option.actionType === 'STAY_TEAM' && !isTeamChanged`로 판정합니다.

* **파급 효과:**

  * 투웨이 1년 차 종료 후 `contractYearsLeft`가 `0`이 된 상태에서 `OPT_TWOWAY_YEAR_2`(`actionType: 'STAY_TEAM'`, `contractYears: 1`)를 선택하면 **`contractYearsLeft`가 `1`이 아니라 `0`으로 유지**됩니다.

  * `withdrawFromDraft()`의 폴백 옵션(`OPT_WITHDRAW_STAY_FALLBACK`, `actionType: 'STAY_TEAM'`) 역시 만료 상태에서 선택 시 `contractYearsLeft = 0`이 유지됩니다.

  * 그 결과 시즌 내내 헤더 계약 표시가 `"FA 만료"` / `"대학 졸업"`으로 잘못 표시되고, 계약 마지막 해 조건 로직이 오작동합니다.

* **개선 방안:** `const isExistingContractStay = Boolean(option.isExistingContract) && !isTeamChanged && career.contractYearsLeft > 0;`으로 수정해야 합니다.

### 1-4. G리그 31개·NCAA 32개 전 구단의 `CONTENDER` 고정 및 비프로 리그 레이팅 폭주 버그

* **위치:** `src/data/teams.ts` — `deriveDirection()`, `evolveLeagueTeamRatings()`

* **원인:**

  1. `deriveDirection(rating, league)`는 `NBA`, `EUROLEAGUE`, `NBL`, `B_LEAGUE`, `KBL`만 분기하고, 나머지 4개 리그(`GLEAGUE`, `NCAA`, `U_LEAGUE`, `HIGH_SCHOOL`)를 모두 `thresholdHigh = 68, thresholdLow = 63`으로 일괄 처리합니다.

     * **G리그(31팀, 레이팅 77\~81)와 NCAA(32팀, 레이팅 75\~81)의 63개 구단 전체가 100% `CONTENDER`로 분류**됩니다(리빌딩/플레이오프 헌트 구단 0개).

     * 반대로 **고교(30팀, 레이팅 58\~65)는 28개교가 `REBUILDING`, 2개교가 `PLAYOFF_HUNT`이며 `CONTENDER`가 0개**입니다.

  2. `evolveLeagueTeamRatings()`의 `minR` / `maxR` 역시 위 4개 리그가 모두 `minR = 56, maxR = 86`으로 묶여 있습니다.

     * 장기 커리어에서 고교 팀 레이팅이 86(NBA 중위권 수준)까지 올라가거나, NCAA·G리그 팀이 56(고교 최하위 수준)으로 폭락할 수 있습니다.

* **파급 효과:** G리그·NCAA 전 구단에 컨텐더 스카우팅 장벽(`+6`), 연봉 페이컷(`0.91x`), 유망주 출전 페널티(`-1.0`), 플레이어 팀 승률 왜곡(`+0.055` vs AI `+0.022`)이 일괄 적용됩니다.

* **개선 방안:** 9개 리그 전체에 대해 `Record<LeagueId, { low: number; high: number; minR: number; maxR: number }>` 테이블을 명시적으로 정의해야 합니다.

### 1-5. NBA 드래프트 컴바인 참가 $\rightarrow$ 철회 무한 스탯·신뢰도 파밍 익스플로잇 및 생체역학 상한 미적용

* **위치:** `src/store/useCareerStore.ts` — `runCombineDrill()`, `completeCombineInterview()`, `withdrawFromDraft()`

* **원인:**

  1. `runCombineDrill()`은 `career.stats[statKey]`를 `+1` 영구 상승시키면서 `enforceBiomechanicalCaps()`를 호출하지 않습니다.

  2. `completeCombineInterview()`는 `career.coachTrust`를 `+4` 영구 상승시킵니다.

  3. `withdrawFromDraft()`로 드래프트 참가를 철회하면 당해 오프시즌의 `ENTER_NBA_DRAFT` 버튼만 숨길 뿐, **드릴 2회(`+2` 스탯)와 면접(`+4` 신뢰도)의 영구 이득을 회수하지 않습니다.**

* **파급 효과:** 만 19세 대학/프로 선수가 매년 오프시즌마다 `NBA 드래프트 참가 -> 드릴 2회 -> 면접 -> 철회 -> 소속팀 잔류`를 4년 반복하면 **무상으로 영구 능력치 +8, 감독 신뢰도 +16**을 획득할 수 있습니다.

* **개선 방안:** 드래프트 컴바인 드릴·면접 보너스는 `combineState` 내부의 임시 평가 점수로만 반영하거나, `withdrawFromDraft()` 시 컴바인에서 얻은 스탯/신뢰도 상승분을 원복(또는 커리어당 컴바인 스탯 보너스 1회 제한)하고, 드릴 스탯 반영 시 `enforceBiomechanicalCaps()`를 반드시 거쳐야 합니다.

### 1-6. `getTeamById()`의 침묵 폴백(`경복고등학교`)으로 인한 데이터 오염 위험

* **위치:** `src/data/teams.ts` (`getTeamById`) 및 호출부(`useCareerStore.ts`, `retirementEngine.ts`, `retrospectiveEngine.ts`)

* **원인:**

  ```
  export function getTeamById(id: string, ratingsMap?: Record<string, number>): TeamInfo {
    const found =
      ALL_TEAMS.find((t) => t.id === id) ||
      ALL_INTERNATIONAL_TEAMS.find((t) => t.id === id) ||
      HIGH_SCHOOL_TEAMS[0];
  
  ```

  * 존재하지 않거나 제거된 팀 ID가 들어오면 `undefined` 대신 무조건 `HIGH_SCHOOL_TEAMS[0]`(경복고등학교)를 반환합니다.

* **파급 효과:**

  * `useCareerStore.ts`의 `getTeamById(career.team.id, nextRatingsMap) || career.team`이나 `retrospectiveEngine.ts`의 `teamObj?.primaryColor || '#191f28'` 같은 방어 폴백 코드가 **전부 데드코드**가 됩니다.

  * 구 세이브·국제대회(`KOR_NAT_TEAM`)·오타 ID가 전달될 경우 선수가 갑자기 경복고등학교 소속으로 바뀌거나 회고록에 경복고 로고/색상이 출력됩니다.

* **개선 방안:** `findTeamById(id, ratingsMap): TeamInfo | undefined`를 별도 분리하거나 `getTeamById`의 반환 타입을 `TeamInfo | undefined`로 교정하여 호출부의 폴백 로직이 정상 동작하도록 해야 합니다.

### 1-7. 플레이오프 탈락 시즌에 리그 우승팀 미확정 및 라이벌 우승 경력 영구 누락

* **위치:** `src/store/useCareerStore.ts` — `playSeason()`, `finalizeSeasonAndEnterOffseason()`

* **원인:**

  * `playoffEngine.ts`의 `createPlayoffBracket()`은 플레이어가 플레이오프 진출에 실패할 경우 `rounds: []`를 반환합니다.

  * 이어서 `playSeason()`은 라이벌 우승 기록을 갱신하기 위해 다음 코드를 실행합니다.

    ```
    if (!qualifiedForPlayoffs && initialBracket.rounds.length > 0 && !initialBracket.championTeamId) {
      initialBracket = skipEntirePlayoffs(initialBracket, career, sim.standings);
    }
    
    ```

  * `rounds.length > 0`이 항상 거짓(`0`)이므로 `skipEntirePlayoffs`는 단 한 번도 실행되지 않으며, `championTeamId`는 `null`로 남습니다.

* **파급 효과:** 주인공이 플레이오프에 탈락한 모든 시즌에서 같은 리그 라이벌들의 `championships` 카운트가 영구히 누락됩니다.

* **개선 방안:** `createPlayoffBracket()`에 `simulateForNonPlayer?: boolean` 옵션을 두어 플레이어 탈락 시에도 1라운드 대진표를 정상 구성한 뒤 `skipEntirePlayoffs`로 최종 우승팀을 확정해야 합니다.

## 2. 높음 문제 (High)

### 2-1. 라이브 파이널 최다 득점이 역대 신기록실(`recordBook`)에 누락 & 국제대회 득점의 NBA 기록 오염

* **위치:** `src/store/useCareerStore.ts` — `applyCompletedLiveGameOutcome()`

* **원인:**

  1. 라이브 결승전(`LEAGUE_FINALS`)에서 플레이어가 정규시즌 최고 기록을 넘는 득점(예: 65점)을 올려도 `career.careerHighs.points`만 갱신하고 **`logs[lastIdx].singleGameHighPts`는 갱신하지 않습니다.**

     * `closeLiveGameAndReturn()`이 호출하는 `checkAndApplyRecordBreaks()`는 `seasonLog.singleGameHighPts`만 검사하므로 **라이브 파이널 대기록이 리그 신기록실과 회고록 시즌별 기록에서 완전히 누락**됩니다.

  2. 반대로 국제대회(`ASIAN_GAMES_FINAL` 등) 라이브 경기 득점도 구분 없이 `career.careerHighs.points`에 덮어쓰기 때문에, 이후 `syncRecordBookWithHof()`가 이를 **NBA 단일 경기 최다 득점 신기록**으로 잘못 귀속시킬 수 있습니다.

* **개선 방안:** `LEAGUE_FINALS` / `CONF_FINALS_GAME7` 종료 시 `logs[lastIdx].singleGameHighPts = Math.max(prevLog.singleGameHighPts, ps.pts)`를 반드시 동기화하고, 국제대회 최고 득점은 리그 커리어 하이와 분리하거나 `careerHighs`에 `league` 필드를 저장해야 합니다.

### 2-2. 180여 개 전 구단의 `preferredStyle`이 `'BALANCED'`로 고정되어 전술 스카우팅 전멸

* **위치:** `src/data/teams.ts` — `ALL_TEAMS`

* **원인:**

  * `ALL_TEAMS` 매핑에서 `preferredStyle: t.preferredStyle || 'BALANCED'`를 적용하지만, `teams.ts` 내 9개 리그 180여 개 구단 중 `preferredStyle`을 명시한 구단은 **0개**(상무만 `'BALANCED'` 명시)입니다.

* **파급 효과:** `draftEngine.ts`의 `evaluateTeamScouting()`에 구현된 `PACE_AND_SPACE`(스나이퍼/외곽 우대), `DEFENSE_GRIT`(수비/리바운드 우대), `HALF_COURT`(클러치/인사이드 우대) 구단 전술 보너스 로직이 **100% 데드코드** 상태입니다.

* **개선 방안:** `deriveDefaultNeeds(id)`처럼 구단별 `derivePreferredStyle(id)` 헬퍼를 추가하거나, 주요 구단별 전술 성향을 데이터에 명시해야 합니다.

### 2-3. 이적·드래프트·상무 입대 시 4축 관계도 미초기화, `role` 미갱신 및 대시보드 트레이드 가드 부재

* **위치:** `src/store/useCareerStore.ts` — `selectOffseasonOption()`, `finalizeDraftSigning()`, `requestTrade()`, `resolveEventChoice()`

* **원인:**

  1. **새 구단 이적 시 관계도 이월:** 타 구단으로 FA 이적·트레이드·드래프트할 때 `coachTrust`만 리셋(54 등)하고 `relationships.lockerRoom`, `relationships.frontOffice`, `relationships.coachTrust`는 갱신하지 않습니다. 이전 팀에서 프런트/라커룸과 불화(15점)를 겪고 새 팀으로 이적해도 새 팀 라커룸과 프런트가 입단 첫날부터 선수를 증오하는 상태가 이어집니다.

  2. **`role` 및 `seasonsOnCurrentTeam` 누락:**

     * `resolveEventChoice()`에서 미드시즌 트레이드 타결 또는 상무 입대(`enlistSangmu`) 시 `career.role`을 재계산하지 않습니다(약팀 1옵션이 강팀으로 트레이드되어도 에이스 직함 유지).

     * `finalizeSeasonAndEnterOffseason()`에서 상무 만기 전역 시 원소속팀으로 복귀하면서 `seasonsOnCurrentTeam`을 `0`으로 초기화하지 않습니다.

  3. **대시보드 `requestTrade()` 결함:**

     * `seasonPhase` 가드가 없어 **플레이오프 대진표나 라이브 결승전 도중 호출**을 막지 못합니다.

     * `pool.find((t) => t.neededPositions?.includes(career.primaryPos))`가 배열을 섞지 않아 매번 `ALL_TEAMS` 선두 구단(보스턴, 뉴욕, 서울 SK 등)으로만 고정 트레이드됩니다.

* **개선 방안:** 구단 변경 공통 헬퍼(`applyTeamTransfer`)를 두어 `relationships`(새 팀 기준 중립 50\~55로 재설정, `mediaFan`만 유지), `role`, `seasonsOnCurrentTeam`을 일괄 동기화하고, `requestTrade()`에 `seasonPhase` 가드 및 후보 랜덤/스카우팅 선별을 추가해야 합니다.

### 2-4. 스토리 아크(`storyArcEngine.ts`)의 타 리그 라이벌 참조 및 상무 복무 중 발동 버그

* **위치:** `src/engine/storyArcEngine.ts` — `buildRivalDestinyArcEvent()`, `rollStoryArcEvent()`

* **원인:**

  1. `buildRivalDestinyArcEvent()`가 `const rival = career.rivals?.[0]`로 첫 번째 라이벌만 꺼내옵니다. KBL을 거쳐 NBA에 진출한 선수는 `rivals[0]`이 옛 KBL 라이벌이므로, NBA 무대에서 KBL 라이벌과 올스타 브레이크 대담 및 플레이오프급 맞대결을 치르는 서사 오류가 발생합니다.

  2. `rollStoryArcEvent()`가 `isProLeague(career.league)`만 검사하고 상무(`isMilitaryTeam` / `militaryServiceSeasonsLeft > 0`)를 제외하지 않습니다. 군 복무 중인 상무 선수에게 **"프랜차이즈 왕조 시스템 구축"**, **"글로벌 시그니처 농구화 투어 및 FA 제국 선언"** 스토리 아크가 발동될 수 있습니다.

* **개선 방안:** `career.rivals?.find((r) => r.league === career.league)`로 동일 리그 라이벌을 필터링하고, `canUseProTradeSystem()`을 재사용해 상무 복무 중에는 구단/브랜드 스토리 아크를 차단해야 합니다.

### 2-5. 회고록 `playoffPriority` 문자열 매칭 불일치로 인한 최고 성적 왜곡

* **위치:** `src/engine/retrospectiveEngine.ts` — `buildChampionshipChronicle()`

* **원인:** `playoffPriority`가 검사하는 키워드가 실제 `playoffEngine.ts`의 결과 문자열(`getEliminationLabel`)과 어긋납니다.

  * `'컨퍼런스 파이널 탈락'`, `'유로리그 파이널 포 4강 탈락'`, `'G리그 컨퍼런스 파이널 탈락'` 모두 `res.includes('파이널')`에 걸려 **파이널 준우승(`5점`)과 동일한 최고 우선순위**를 받습니다(`'컨퍼런스 결승'` 문자열은 엔진에 존재하지 않음).

  * `'컨퍼런스 1R(8강) 탈락'`은 `'8강'`에 걸려 **3점**(2라운드급)을 받습니다.

  * `'PO 진출'`, `'PO 탈락'`, `'플레이인 1R 탈락'`은 `'플레이오프'`와 불일치하여 모두 1점으로 추락합니다.

* **개선 방안:** `'파이널 준우승'` / `'준우승'`을 최상위(5점)로 먼저 검사하고, `'컨퍼런스 파이널'` / `'파이널 포'` / `'4강'`을 4점으로 분리하는 등 `playoffEngine.ts`의 실제 라벨 규격에 정확히 맞춰야 합니다.

### 2-6. Zustand `onRehydrateStorage` 상태 직접 변이 및 `importSaveJson` 플래그 누락

* **위치:** `src/store/useCareerStore.ts` — `onRehydrateStorage`, `importSaveJson`

* **원인:**

  1. `onRehydrateStorage: () => (state) => { state.career = migrated.career; ... }`는 Zustand `persist`가 상태를 주입한 뒤 콜백 인자를 직접 변이(In-place mutation)합니다. 이 방식은 구독 컴포넌트에 변경 알림을 보내지 않거나 React strict/concurrent 렌더링에서 오래된 참조를 남길 수 있습니다.

  2. `importSaveJson()`에서 백업 파일을 복원할 때 `recordBookManuallyReset: false`를 리셋하지 않습니다. 사용자가 직전에 역대 기록실을 초기화한 뒤 백업을 복원하면 다음 새로고침 시 `skipRecordSync: true`가 유지되어 복원된 HOF/커리어 기록이 동기화되지 않습니다.

* **개선 방안:** `persist` 미들웨어의 `merge` 옵션 안에서 마이그레이션을 수행해 불변 객체를 반환하도록 변경하고, `importSaveJson`에서 `recordBookManuallyReset: false`를 명시해야 합니다.

### 2-7. 재활 케어 UI 설명("70% 감소")과 실제 밸런스 수치(45\~48% / 18% 감소) 괴리

* **위치:** `src/store/useCareerStore.ts` — `purchasePersonalCare()` vs `src/config/balanceConfig.ts` — `ECONOMY_CONFIG.personalCare.REHAB_LOAD_MGMT`

* **원인:**

  * 스토어 토스트와 마일스톤 문구: *"다음 시즌 부상 발생 확률 및 결장 경기 수가 **70% 감소**합니다."*

  * 실제 `balanceConfig.ts` 적용 계수: `injuryRiskMultiplier: 0.52`(**48% 감소**), `injuryGamesMultiplier: 0.55`(**45% 감소**), 중상 결장 `majorRehabGamesMult: 0.82`(**18% 감소**).

* **개선 방안:** 문구를 `balanceConfig.ts`의 수치로부터 동적으로 생성(`Math.round((1 - rehabCfg.injuryRiskMultiplier) * 100)%`)하여 밸런스 패치 시 설명이 자동 일치하도록 변경해야 합니다.

### 2-8. 포지션 전용 이벤트 10종(`POSITION_EVENTS`) 완전 데드코드

* **위치:** `src/data/events.ts` — `POSITION_EVENTS`

* **원인:** 5대 포지션별 2종씩 총 10개의 전용 이벤트(특히 `EVT_SG_COMBO`의 부포지션 PG 해금, `EVT_PF_SMALLBALL`의 부포지션 C 해금 포함)가 정의 및 `export`되어 있으나, `rollSeasonEvent()`·`encounterEngine.ts`·`useCareerStore.ts` 어디에서도 호출되지 않습니다.

* **개선 방안:** `encounterEngine.ts`의 풀에 병합하거나, 포지션 특화 분기로 `rollSeasonEvent()`에 연결(또는 미사용 시 정리)해야 합니다.

## 3. 중간 문제 (Medium)

### 3-1. 동명이인 커리어 간 역대 신기록 오귀속 버그

* **위치:** `src/engine/retrospectiveEngine.ts` — `extractPlayerBrokenRecords()`

* **원인:**

  ```
  const matchesPlayer =
    (rec.playerId && rec.playerId === career.id) || rec.holderName === career.name;
  
  ```

  * `rec.playerId`가 다른 선수 ID임에도 `|| rec.holderName === career.name`이 참이 되므로, 사용자가 같은 이름(예: 본인 이름)으로 2회차 커리어를 플레이하면 **신기록을 하나도 깨지 않은 2회차 선수가 1회차 전설 선수의 모든 역대 신기록을 본인 회고록·트로피 진열장에 그대로 상속**받습니다.

* **개선 방안:** `const matchesPlayer = rec.playerId ? rec.playerId === career.id : rec.holderName === career.name;`로 수정해야 합니다.

### 3-2. 구버전 HOF 회고 폴백 및 기록 동기화의 현실 연도(`2026`) 오용

* **위치:** `src/engine/retrospectiveEngine.ts` (`buildFallbackRetrospectiveFromHof`) & `src/engine/recordBookEngine.ts` (`syncRecordBookWithHof`)

* **원인:** `entry.inductedAt`은 현실 시간 ISO 문자열(예: `2026-11-24...`)인데 이를 인게임 은퇴 연도로 파싱(`Number(entry.inductedAt.slice(0, 4))`)합니다. 2026\~2043년(17시즌) 활약 후 2026년에 은퇴한 선수의 활동 기간이 `2025 ~ 2026 (17시즌)`으로 계산되고, 신기록 달성 연도도 `2026년`으로 덮어씌워집니다.

* **개선 방안:** `HallOfFameEntry`에 인게임 은퇴 연도(`finalSeasonYear`)를 저장하고, 폴백 시 `2026 + entry.seasonsPlayed`로 역산해야 합니다.

### 3-3. 포스트시즌 우승 시 드래프트 주가(+10) 보너스 누락

* **위치:** `src/store/useCareerStore.ts` (`applyCompletedLiveGameOutcome`, `advancePlayoffBracketRound`, `skipPlayoffsToEnd`)

* **원인:** 이전 보고서에서 지적한 `seasonSimulator.ts`의 정규시즌 우승 보너스 데드코드와 맞물려, 실제 스토어의 포스트시즌 우승 확정 3개 경로 어디에서도 `pendingSeasonSettlement.nextDraftStock`에 우승 주가 보너스(`+10`)를 가산하지 않습니다.

### 3-4. 세이브 마이그레이션의 구 해외리그 `leagueName` 및 구단 메타데이터 불일치

* **위치:** `src/store/saveMigration.ts` — `normalizeTeamInfo()`, `normalizeCareerSave()`

* **원인:**

  1. 구 `'OVERSEAS'` 시즌 로그 마이그레이션 시 `LEAGUE_CONFIG[logLeague]?.name`을 저장합니다. 신규 로그는 전부 `shortName`을 사용하므로 UI에서 `'일본 B.리그 (B1)'`과 `'B.리그'`가 혼재됩니다.

  2. `normalizeTeamInfo()`가 최신 구단 데이터에서 `league`, `name`, `shortName`, `logoUrl`만 복사하고 `primaryColor`, `secondaryColor`, `conference`, `isMilitaryTeam` 갱신은 누락합니다.

### 3-5. 스토리 아크의 `coachTrust` 경로 혼재 및 31세+ `potentialDelta` 침묵 무시

* **위치:** `src/engine/storyArcEngine.ts` & `src/store/useCareerStore.ts` (`resolveEventChoice`)

* **원인:**

  1. `buildRivalDestinyArcEvent()`의 Stage 1 선택지 1과 Stage 3 선택지 2만 `trustDelta` 대신 `relationshipChanges.coachTrust`를 사용해 `finalOutcome.trustDelta`가 `0`으로 표시됩니다.

  2. `COACH_TACTICS_ARC` Stage 3 및 `NATIONAL_TORCH_ARC` Stage 3의 `잠재력 +1 확정` 보상이 만 31세 이상에서는 `effectivePotentialDelta = Math.min(0, ...)`에 의해 사전 안내 없이 `0`으로 증발합니다.

### 3-6. 우승·루키 헤드라인 데드코드 및 "생애 첫 MVP" 반복 출력

* **위치:** `src/data/headlines.ts` — `generateSeasonHeadline()`

* **원인:**

  1. `seasonSimulator.ts`는 정규시즌 시점에 `wonChampionship: false`로 고정하고 `isRookie`를 전달하지 않으므로 `CHAMPION_MVP`와 `ROOKIE_STAR` 헤드라인 풀이 한 번도 사용되지 않습니다.

  2. `MVP_ONLY` 템플릿 2번이 \*"생애 첫 `{league}` 정규시즌 MVP 수상"\*으로 하드코딩되어 있어 2회 이상 MVP 수상 시에도 생애 첫 수상으로 보도됩니다.

### 3-7. `formatters.ts`의 음수 금액 `$0` 변환 및 `formatCashDelta(0)` `-$0` 출력

* **위치:** `src/utils/formatters.ts`

* **원인:**

  * `formatCashDelta(0)`에서 `delta > 0 ? '+' : '-'` 때문에 `-$0`이 반환됩니다.

  * `formatCurrencyCompact` / `formatCurrencyDetailed`는 음수 입력 시 모두 `'$0'`을 반환합니다.

  * `getMilitaryStatusDisplay()`의 마지막 반환문에서 `career.league === 'NBA' ? \`미필 (만 \${enlistAge}세)\` : \`미필 (만 ${enlistAge}세)\`\`로 동일한 문자열이 양쪽 분기에 중복되어 있습니다.

## 4. 낮음 및 구조 개선 과제 (Low & Maintainability)

* **아마추어 미드시즌 잠재력(+1) 우회 (`src/data/events.ts`):** `statCalculator.ts`에서는 아마추어 시절 잠재력 폭등을 막기 위해 캠프 잠재력 확장을 차단하지만, `rollMidSeasonCrossroadsEvent()`의 `EVT_MID_STARTER_SHOWCASE`는 리그 구분 없이 고교·대학 벤치 선수에게도 `potentialDelta: 1`을 부여합니다.

* **파일 중간 `import` 문 배치 (`src/data/events.ts` 213행):** `import { rollCombinatorialEncounter } from '../engine/encounterEngine';`가 파일 중간에 선언되어 코드 가독성 및 정적 분석 도구 호환성을 저해합니다.

* **`archetypes.ts`의 신장 범위 이중 선언 (`src/data/archetypes.ts`):** `POSITION_HEIGHT_RANGES`와 `POSITION_ARCHETYPES[pos].recommendedHeightRange`·`defaultHeightCm`이 같은 파일에 중복 정의되어 있습니다.

* **상수/함수 중복 및 주석 불일치:** `storyArcEngine.ts`의 `isProLeague()`가 `LEAGUE_BALANCE_META[league].isPro`와 중복되며, `teams.ts` 주석의 구단 수(고교 24개교 $\rightarrow$ 실제 30개교, NCAA 24대 명문 $\rightarrow$ 실제 32개교)가 실제 데이터와 다릅니다.

## 5. 우선순위별 수정 로드맵

1. **즉시 수정 (P0 — 게임 핵심 콘텐츠 차단 & 진행 버그):**

   * `src/data/events.ts` & `useCareerStore.ts`: 국제대회 매년 차출이 스토리 아크·연쇄 이벤트·48종 인카운터를 기아 상태로 만드는 우선순위 충돌 해소(국제대회 별도 큐/트리거 분리)

   * `src/store/useCareerStore.ts`: `EVT_VETERAN_REINVENTION`의 `applyAgeAdjustedEventStatChanges` 우회 처리, `selectOffseasonOption`의 `isExistingContractStay` 판정 교정(`option.isExistingContract` 사용), `runCombineDrill`·`withdrawFromDraft` 무한 파밍 차단 및 생체역학 상한 적용

   * `src/data/teams.ts`: `deriveDirection` 및 `evolveLeagueTeamRatings`의 9개 리그 전체 분기 추가, `getTeamById`의 `HIGH_SCHOOL_TEAMS[0]` 침묵 폴백 제거

   * `src/store/useCareerStore.ts` & `playoffEngine.ts`: 플레이어 PO 탈락 시에도 리그 우승팀 및 라이벌 우승 경력이 정상 집계되도록 수정

2. **단기 수정 (P1 — 데이터 정합성 & 상태 동기화):**

   * `src/store/useCareerStore.ts`: `applyCompletedLiveGameOutcome`에서 파이널 `singleGameHighPts` 반영 및 국제대회 하이 분리, 이적 시 4축 관계도·`role`·`seasonsOnCurrentTeam` 일괄 동기화, `requestTrade()` 가드 및 랜덤/적합 구단 선별, `onRehydrateStorage`를 `merge` 옵션으로 이전, 재활 케어 문구 실수치 연동

   * `src/data/teams.ts`: 구단별 `preferredStyle` 부여로 전술 스카우팅 활성화

   * `src/engine/storyArcEngine.ts`: 동일 리그 라이벌 필터링 및 상무 복무 제외

   * `src/engine/retrospectiveEngine.ts`: `playoffPriority` 문자열 매칭 수정 및 `extractPlayerBrokenRecords` 동명이인 오귀속 차단

3. **중기 폴리싱 (P2 — 서사 및 유틸 정리):**

   * `src/data/events.ts`, `headlines.ts`, `saveMigration.ts`, `formatters.ts`: `POSITION_EVENTS` 활용/정리, 헤드라인 `생애 첫` 문구 및 `leagueName` `shortName` 통일, `formatCashDelta(0)` 수정