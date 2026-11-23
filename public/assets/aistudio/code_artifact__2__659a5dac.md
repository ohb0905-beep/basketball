# 코어 엔진 코드 분석 및 문제점 진단 보고서

본 보고서는 업로드된 5개 핵심 모듈(`balanceConfig.ts`, `progressionEngine.ts`, `statCalculator.ts`, `retirementEngine.ts`, `draftEngine.ts`)을 정적 분석하여 도출한 **로직 버그, 수식 결함, 게임 밸런스 붕괴 요소, 아키텍처 및 데이터 무결성 문제**를 심각도 순으로 정리한 문서입니다.

---

## 요약 (Executive Summary)

| 심각도 | 건수 | 핵심 영향 영역 |
| :--- | :---: | :--- |
| **치명적 (Critical)** | 5건 | 빅맨 피지컬 하드캡 버그, 포지션 추천 우회 버그, 하위 리그 강등 차단(강제 은퇴), NBA 드래프트 지명 구단 매핑 오류, 만 40~45세 강제 은퇴 누락 |
| **높음 (High)** | 7건 | 에이징 커브 비단조성(역전 현상), 스카우팅 점수·페널티 누락 2건, 하위 리그 오퍼 필터 오작동, 20~22세 NBA 복귀 데드존, 은퇴 투어 악용, `coachTrust` 이중 진실 원천 및 `NaN` 위험 |
| **중간 (Medium)** | 7건 | 레거시/영구결번 심사 편향 2건, 전술 밸런스 편향(`PACE_CONSERVE`), FA 오퍼 수량 누락, 대학 잔류 역할 하드코딩, 프리뷰/생성 스탯 불일치, 캠프 제로섬 손실 |
| **낮음 / 구조 개선 (Low)** | 4건 | SSOT(단일 진실 원천) 위반 및 상수 중복, 취약한 오버로딩 시그니처, 주석/UI 설명과 실제 수식 불일치, 잠재적 중복 카운트 |

---

## 1. 치명적 문제 (Critical)

### 1-1. 장신 빅맨의 피지컬(PHY) 상한선 붕괴 버그
* **위치:** `src/engine/statCalculator.ts` — `getBiomechanicalStatCaps()`
* **원인:**
  * `getBiomechanicalGrowthElasticity()`에서는 `phyEquilibrium`을 타점(`reachLeverage`)과 기민성(`centerOfGravityAgility`)의 가중 평균($0.45 : 0.55$)으로 계산합니다.
  * 반면 `getBiomechanicalStatCaps()`에서는 `phy` 상한을 기민성 단독 및 체력 소모 배율 차감으로만 계산합니다.
    $$\text{cap}_{\text{phy}} = \text{round}\big(60 + \text{agility} \times 34 - (\text{staminaDrain} - 1) \times 22\big)$$
* **실제 수치 영향:**
  * **213cm 센터:** $\text{agility} \approx 0.524$, $\text{staminaDrain} \approx 1.104$ $\rightarrow$ `phy` 상한 **76**
  * **220cm 센터:** $\text{agility} \approx 0.400$, $\text{staminaDrain} \approx 1.160$ $\rightarrow$ `phy` 상한 **70**
  * **205cm 파워포워드:** $\text{agility} \approx 0.665$, $\text{staminaDrain} \approx 1.040$ $\rightarrow$ `phy` 상한 **82**
  * 반면 170cm 포인트가드는 `phy` 상한이 **99**에 도달합니다.
* **파급 효과:** 부상 리스크 기준선(`phyReference = 72`)과 에이징 방어 기준선(`phyReference = 72`)을 고려할 때, 정통 빅맨은 게임 끝까지 평균 수준의 피지컬조차 확보하지 못하며 `상위권 운동능력(PHY >= 85)` 배지 획득도 원천 불가능해집니다.
* **개선 방안:** `getBiomechanicalStatCaps()`의 `phy` 공식을 `phyEquilibrium`과 일관되게 `reachLeverage`와 `centerOfGravityAgility`의 혼합식으로 재설계하고, 체력 소모 페널티는 극단적 포지션 미스매치(`positionalPhysicsStrain`)에만 한정 적용해야 합니다.

### 1-2. `analyzePositionFit()`의 부포지션 허용 검증 우회 버그
* **위치:** `src/engine/statCalculator.ts` — `analyzePositionFit()`
* **원인:** 부포지션 후보(`secondBest`)를 탐색할 때 `canSwitchToPosition(currentPrimary, r.pos, heightCm, r.pos)`를 호출합니다.
  * `canSwitchToPosition` 내부 로직은 `isUnlockedSecondary = secondaryPos === targetPos`로 판정합니다.
  * 4번째 인자(`secondaryPos`)에 `currentSecondary`가 아닌 대상 포지션 `r.pos`를 그대로 넘겼기 때문에, **모든 포지션에 대해 `isUnlockedSecondary`가 항상 `true`**가 됩니다.
* **파급 효과:** 인접 포지션 제한(`ADJACENT_POSITIONS`)이 완전히 무력화되어, 예를 들어 PG에게 비인접 포지션(SF 등)을 추천하는 현상이 발생합니다.
* **개선 방안:** 호출 인자를 `canSwitchToPosition(currentPrimary, r.pos, heightCm, currentSecondary)`로 수정해야 합니다. 추가로 같은 함수에서 `currentPosOvr`를 계산할 때 `heightCm`을 누락하여 상한 미적용 OVR과 상한 적용 OVR을 비교하는 불일치도 함께 수정(`calculateOvr(stats, currentPrimary, heightCm)`)해야 합니다.

### 1-3. 상위 리그 노쇠화 판정(`isOutOfLeague`)으로 인한 하위 리그 진출 원천 차단
* **위치:** `src/engine/retirementEngine.ts` (`checkRetirementEligibility`) & `src/engine/draftEngine.ts` (`generateOffseasonOptions` 5~6단계)
* **원인:**
  * `checkRetirementEligibility()`는 현재 소속 리그(`career.league`)의 수비 저항(`LDR`)만을 기준으로 `ovrGapFromLeague = career.ovr - leagueLdr`를 계산해 `isOutOfLeague`를 판정합니다.
  * `generateOffseasonOptions()`는 5단계(하위 리그 스텝다운 오퍼) 조건에 `!isOutOfLeague`를 걸고, 6단계에서 `if (teamOffersCount === 0 || isOutOfLeague)` 시 강제 은퇴를 반환합니다.
* **재현 시나리오:** 만 34세 NBA 선수가 OVR 72(NBA `LDR` 대비 $-12$), 평균 4.0득점을 기록하면 `isOutOfLeague = true`가 됩니다. OVR 72는 KBL·B.리그·NBL 등에서 MVP급 최정상 기량임에도 불구하고, 스텝다운 로직이 건너뛰어져 **단 하나의 하위 리그 오퍼도 받지 못한 채 강제 은퇴**합니다.
* **개선 방안:** `isOutOfLeague`는 현재 소속 리그가 아닌 **최하위 프로 리그(예: KBL) 기준선** 대비 경쟁력 상실 여부로 판정하거나, 5단계 하위 리그 오퍼 탐색을 먼저 수행한 뒤 최종 `teamOffersCount === 0`일 때만 미계약 강제 은퇴를 발동해야 합니다.

### 1-4. NBA 드래프트 1·2라운드 지명 구단 매핑 공식 오류
* **위치:** `src/engine/draftEngine.ts` — `executeDraftResolution()`
* **원인:** NBA 30개 구단을 레이팅 오름차순(약팀 $\rightarrow$ 강팀)으로 정렬한 뒤 다음과 같이 인덱스를 계산합니다.
  $$\text{bucketIndex} = \left\lfloor \frac{\text{finalPickCalc} - 1}{60} \times 30 \right\rfloor$$
* **문제점:** NBA 드래프트는 1라운드(1~30순위)와 2라운드(31~60순위)가 모두 약팀부터 강팀 순서로 순환합니다. 현재 공식은 60으로 나누기 때문에 다음과 같이 왜곡됩니다.
  * 1라운드 30순위(우승팀 지명권) $\rightarrow$ 인덱스 14(중위권 팀)에 배정
  * 2라운드 31순위(최하위팀 지명권) $\rightarrow$ 인덱스 15(중상위권 팀)에 배정
* **개선 방안:** 라운드별 순환을 반영해 `(finalPickCalc - 1) % sortedByRatingAsc.length`로 수정해야 합니다. 또한 `calculateProjectedNbaPick()`의 언드래프티 위험 기준(`> 58`)과 `executeDraftResolution()`의 지명 탈락 기준(`> 60`)도 단일 상수로 통일해야 합니다.

### 1-5. `generateOffseasonOptions()`의 강제 은퇴 연령(`isMandatoryAge40`) 미검증
* **위치:** `src/engine/draftEngine.ts` — `generateOffseasonOptions()`
* **원인:** `checkRetirementEligibility(career)`로부터 `canRetireVoluntarily`, `canDeclareFarewellTour`, `isOutOfLeague`만 구조 분해하고 `isMandatoryAge40`은 아예 무시합니다.
* **파급 효과:** 만 40세 이상 경쟁력 미달 선수나 절대 상한인 **만 45세(`hardRetireAge`) 이상 선수**가 이 함수를 통과하면 정상적인 재계약/FA/잔류 오퍼가 계속 생성됩니다. 외부 스토어에 강제 은퇴 분기를 위임한 구조라면, 엔진 계층 단독 호출 및 테스트 시 규칙 위반이 발생합니다.
* **개선 방안:** `generateOffseasonOptions()` 최상단(상무 분기 직후 또는 최우선)에서 `isMandatoryAge40`일 때 의무 은퇴 옵션만 반환하도록 방어 로직을 추가해야 합니다.

---

## 2. 높음 문제 (High)

### 2-1. 에이징 커브 2단계 $\rightarrow$ 3단계 전환 시 하락폭 역전 (비단조성 버그)
* **위치:** `src/engine/retirementEngine.ts` — `applyAgingCurve()`
* **원인:** `agingYears` 구간별 심각도 계수가 불연속적으로 설계되어 있습니다.
  * 2단계 끝($\text{agingYears} = 5.0$):
    $$\text{continuousSeverity} = 1 + 5.0^{1.18} \times 0.26 \approx 2.737$$
    $\rightarrow$ `phy` 평균 하락량($\text{rng}=0.5, \text{mult}=1.0$): $(1.45 + 0.475) \times 2.737 \approx 5.27$
  * 3단계 시작($\text{agingYears} = 5.1$):
    $$\text{twilightSeverity} = 1 + (5.1 - 3.5)^{1.15} \times 0.28 \approx 1.481$$
    $\rightarrow$ `phy` 평균 하락량: $(2.0 + 0.675) \times 1.481 \approx 3.96$
* **파급 효과:** 선수가 나이를 더 먹어 황혼기(3단계)에 진입하는 순간, 오히려 신체 능력 하락폭이 약 25% 완화되는 비정상적 역전 현상이 발생합니다. 또한 1단계($2.0$)에서 2단계($2.1$)로 넘어갈 때도 총 스탯 하락량이 갑자기 2배 이상 튀어 오릅니다.
* **개선 방안:** 구간별 분기 대신 `agingYears`에 대해 단조 증가하는 단일 연속 함수(또는 경계값이 정확히 일치하는 스플라인/구간 선형 함수)로 재설계해야 합니다.

### 2-2. 포인트가드(PG) 저조한 어시스트 페널티가 항상 0으로 계산되는 버그
* **위치:** `src/engine/draftEngine.ts` — `evaluateTeamScouting()`
* **원인:**
  ```ts
  career.primaryPos === 'PG' &&
    (lastLog.apg * scale36 < 4.2 || bio.tovRatePenalty >= 1.8)
    ? bio.tovRatePenalty * 2.4
    : 0
  ```
* **문제점:** 조건절에서는 36분 환산 어시스트가 4.2 미만인 PG를 감지하지만, 실제 감점 값으로 `bio.tovRatePenalty * 2.4`만 사용합니다. 정상 신장(180~193cm) PG는 `bio.tovRatePenalty`가 `0`이므로, **36분 환산 어시스트가 0.5개여도 페널티가 0점**이 됩니다.
* **개선 방안:** 어시스트 부족분 페널티 `Math.max(0, 4.2 - lastLog.apg * scale36) * 1.5`와 턴오버 페널티 `bio.tovRatePenalty * 2.4`를 분리하여 합산해야 합니다.

### 2-3. `evaluateTeamScouting()` 내 `realGameCompetence` 지연 갱신으로 인한 스카우팅 점수 왜곡
* **위치:** `src/engine/draftEngine.ts` — `evaluateTeamScouting()`
* **원인:** `rawScoutingScore` 계산 시 `(realGameCompetence ? 0 : 22)` 감점을 적용한 **이후에** 노쇠화 베테랑 판정(`if (career.age >= 34 && veteranDeclineGap <= -7 && translatedPerfScore < 9.0) realGameCompetence = false`)이 실행됩니다.
* **파급 효과:** 해당 조건으로 탈락한 베테랑 선수는 `passesOfferThreshold = false`가 되지만 `scoutingScore`에는 `-22` 감점이 반영되지 않아, 트레이드 후보 정렬·UI 표시 점수·드래프트 스카우팅 등급에서 실제 경쟁력보다 부풀려진 점수가 노출됩니다.
* **개선 방안:** 베테랑 노쇠화 판정 분기를 `rawScoutingScore` 산출 이전으로 이동해야 합니다.

### 2-4. 하위 리그 스텝다운 필터가 KBL 기준으로 유로리그 오퍼를 허용하는 버그
* **위치:** `src/engine/draftEngine.ts` — `generateOffseasonOptions()` (5단계)
* **원인:** NBA 선수가 오퍼를 받지 못했을 때 `stepDownPools`에 유로리그, G리그, NBL, B.리그, KBL을 모두 합친 뒤 다음 필터를 적용합니다.
  ```ts
  .filter(
    (x) =>
      x.eval.passesOfferThreshold ||
      (career.age <= 33 && career.ovr >= LEAGUE_CONFIG.KBL.ldr - 6)
  )
  ```
* **파급 효과:** 우항 조건에 `x.team.league === 'KBL'` 제한이 빠져 있어, 만 33세 이하 OVR 62~65 수준의 선수가 모든 구단 스카우팅에서 탈락하더라도 **유로리그나 NBL 구단의 `passesOfferThreshold`를 우회하여 영입 오퍼를 받는 현상**이 발생합니다.
* **개선 방안:** 최후 안전망 조건을 `x.team.league === 'KBL'`(또는 `career.ovr >= LEAGUE_CONFIG[x.team.league].ldr - 6`)으로 한정해야 합니다.

### 2-5. 만 20~22세 NBA 방출 선수의 NBA 복귀 데드존(Dead Zone) 및 G리그 정식 승격 불가
* **위치:** `src/engine/draftEngine.ts` — `generateOffseasonOptions()` (4단계)
* **원인:**
  1. KBL/B.리그/NBL 소속 선수의 NBA 드래프트 참가 조건은 `age <= 22 && totals.nbaGp === 0`, NBA 자유계약(FA) 도전 조건은 `age >= 23`입니다.
     * 만약 만 20~21세에 NBA 투웨이로 몇 경기 출전(`nbaGp > 0`)했다가 방출되어 KBL/NBL로 내려온 선수가 압도적 기량(OVR 85+)으로 반등해도, 만 22세 시즌까지는 **드래프트도 불가(`nbaGp > 0`)하고 NBA FA도 불가(`age < 23`)한 완전한 진입 차단 구간**에 갇힙니다.
     * 반대로 언드래프티로 KBL에 간 만 21세 선수(`nbaGp === 0`)는 현실 규정과 달리 만 22세에 NBA 드래프트에 중복 참가할 수 있습니다.
  2. G리그 소속 선수는 `OPT_GLEAGUE_TO_TWOWAY_*` 경로만 존재하며, OVR이 85 이상이어도 NBA 정식 보장 계약(`NBA_STANDARD`) 오퍼를 받을 수 없습니다(오직 `TWO_WAY`로 고정).
* **개선 방안:** 드래프트 기참가 여부 플래그(`hasEnteredNbaDraft`)를 도입해 이미 드래프트를 거쳤거나 `nbaGp > 0`인 선수는 연령 무관하게 NBA FA 경로로 진입하도록 수정하고, G리그 최정상급 선수에게는 `eval.recommendedContract`에 따라 `NBA_STANDARD` 오퍼도 허용해야 합니다.

### 2-6. 은퇴 투어(`START_FAREWELL_TOUR`)를 통한 계약 만료 후 무임승차 연장 악용
* **위치:** `src/engine/draftEngine.ts` — `generateOffseasonOptions()` (최하단)
* **원인:** `canDeclareFarewellTour`가 `true`이면 계약 만료(`contractYearsLeft === 0`)로 원소속 구단이 재계약을 거절한 상태여도, 타 구단 오퍼가 1개라도 존재하면(`teamOffersCount > 0`) **`career.team` 소속·기존 `career.annualSalary` 그대로 1년 은퇴 투어 옵션**이 노출됩니다.
* **파급 효과:** NBA 구단에서 방출 수준의 평가를 받아 KBL 오퍼만 1개 남은 만 36세 레전드가, 자신을 포기한 원소속 NBA 구단과 기존 맥스 연봉으로 1년 강제 재계약할 수 있습니다.
* **개선 방안:** 은퇴 투어 선언은 ① 잔여 계약이 1년 이상 남아 있거나, ② 원소속 구단으로부터 재계약 오퍼를 받은 경우에만 활성화되도록 제한하고, 재계약 시에는 새 오퍼 연봉을 적용해야 합니다.

### 2-7. `progressionEngine.ts`의 `coachTrust` 이중 진실 원천 및 레거시 세이브 `NaN` 위험
* **위치:** `src/engine/progressionEngine.ts` — `getEffectiveRelationships()`, `applyRelationshipDelta()`
* **원인:**
  1. `getEffectiveRelationships()`는 `career.relationships`가 존재할 때 `career.relationships.coachTrust`를 무시하고 `career.coachTrust`로 덮어씁니다. 반면 `applyRelationshipDelta()`는 반환 객체의 `coachTrust`를 갱신합니다. 호출부가 `career.coachTrust`를 별도로 동기화하지 않으면 감독 신뢰도 변경치가 조용히 유실됩니다.
  2. `career.relationships` 객체가 존재하지만 일부 속성(`frontOffice` 등)이 `undefined`인 부분 마이그레이션 세이브일 경우, `Math.round(undefined)`가 `NaN`을 반환하며 `clamp(NaN, 15, 100)` 역시 `NaN`으로 전파됩니다(반면 `getEffectiveStoryArcs`는 `base` 객체와 안전하게 병합).
* **개선 방안:** `getEffectiveRelationships()`에서 `base = createInitialRelationships(...)`를 먼저 생성한 뒤 `??` 연산자로 각 축의 누락값을 방어하고, `coachTrust`의 단일 저장 위치를 명확히 통합해야 합니다.

---

## 3. 중간 문제 (Medium)

### 3-1. 영구결번 심사가 단일 최고 `impactScore` 구단만 검사하는 편향
* **위치:** `src/engine/retirementEngine.ts` — `evaluateCareerLegacy()`
* **원인:** 선수가 거친 프로 구단 중 `impactScore`가 가장 높은 1개 구단(`sorted[0]`)만 뽑아 영구결번 조건(7시즌 이상 + 득점/우승/MVP 기준)을 검사합니다.
* **재현 시나리오:** KBL A구단에서 9시즌·7,500득점·MVP 2회로 영구결번 자격을 완벽히 충족한 뒤, NBA B구단에서 4시즌 활약해 리그 가중치($1.6\times$) 덕분에 B구단의 `impactScore`가 근소하게 높아지면, B구단(4시즌 < 7시즌)만 검사하고 **영구결번 탈락(`jerseyRetired = false`)** 판정이 내려집니다.
* **개선 방안:** 영구결번 자격을 충족하는 프로 구단 목록을 먼저 필터링한 뒤, 그중 `impactScore`가 가장 높은 구단을 `honoredTeam`으로 우선 선정해야 합니다.

### 3-2. 아마추어 기록 및 비아시아 프로 기록이 `ASIA_KBL_LEGEND` 등급으로 분류되는 문제
* **위치:** `src/engine/retirementEngine.ts` — `evaluateCareerLegacy()`
* **원인:** `ASIA_KBL_LEGEND`("KBL · 아시아 최정상급 선수") 판정이 `career.totals.championships >= 2 || career.totals.mvps >= 1 || career.totals.points >= 6500 || legacyScore >= 2600`으로 작성되어 있습니다.
  * `totals`에 고교·대학 아마추어 우승/MVP가 합산될 경우 프로 실적이 미미해도 아시아 레전드 등급을 획득할 수 있습니다.
  * 유로리그·호주 NBL·G리그에서만 커리어를 보낸 선수도 KBL/아시아 레전드 칭호를 받습니다.
  * 또한 `legacyScore` 계산에서 `finalsMvps`, `dpoys`, `allLeagueSelections`가 리그 티어 가중치 없이 합산됩니다.
* **개선 방안:** 프로 리그(`LEAGUE_BALANCE_META[l].isPro`) 로그만으로 프로 우승/MVP/득점을 집계하고, 주 활동 리그에 따라 칭호를 분기(예: 유로리그/해외 프로 레전드 vs KBL·아시아 레전드)해야 합니다.

### 3-3. 라이브 전술 `PACE_CONSERVE(체력 안배)`의 과도한 효율 편향
* **위치:** `src/config/balanceConfig.ts` — `LIVE_GAME_CONFIG.tacticMods`
* **수치 비교:**
  | 전술 | `usageMult` | `fgBonus` | `defBonus` | `staminaDrain` | `foulRisk` |
  | :--- | :---: | :---: | :---: | :---: | :---: |
  | `ACE_HERO` | 1.38 | +0.010 | 0.00 | 23 | 0.24 |
  | `LOCKDOWN_DEFENSE` | 0.86 | +0.010 | +1.45 | 22 | 0.42 |
  | `UNSELFISH_PASS` | 1.00 | +0.032 | -0.40 | 15 | 0.17 |
  | **`PACE_CONSERVE`** | **0.78** | **+0.030** | **+1.15** | **8** | **0.10** |
* **문제점:** `PACE_CONSERVE`가 체력 소모는 최하(8), 파울 위험도 최하(0.10)이면서 **야투 보정(+3.0%)은 이타적 조율 수준이고 수비 보정(+1.15)은 질식 수비(1.45)에 육박**합니다. 리스크 없이 공수 효율과 체력을 모두 챙기는 지배 전략(Dominant Strategy)이 됩니다.
* **개선 방안:** `PACE_CONSERVE`의 `defBonus`를 음수 또는 소폭($-0.2 \sim +0.1$)으로 낮추고 `fgBonus`를 하향 조정해 체력 보존이라는 명확한 트레이드오프를 형성해야 합니다.

### 3-4. FA 시장 동일 리그 타 구단 오퍼가 1개로 축소되는 분기 결함
* **위치:** `src/engine/draftEngine.ts` — `generateOffseasonOptions()` (Case 4, 2단계)
* **원인:** `starterOffer`와 `contenderOffer`를 각각 1개씩 추출한 뒤 `if (pickedOffers.length === 0)`일 때만 `evaluatedSameLeague.slice(0, 2)`를 보충합니다.
* **문제점:** 10개 구단이 영입을 원해도 모두 리빌딩/중위권 주전 오퍼여서 `contenderOffer`가 `undefined`이면 `pickedOffers.length`가 `1`이 되어 추가 보충이 실행되지 않고 오퍼가 1개만 제시됩니다.
* **개선 방안:** `pickedOffers.length < 2`일 때 `evaluatedSameLeague`에서 중복되지 않는 차순위 구단을 채워 넣도록 변경해야 합니다.

### 3-5. 대학 잔류 옵션(`OPT_COLLEGE_STAY`)의 `ACE_FIRST_OPTION` 하드코딩
* **위치:** `src/engine/draftEngine.ts` — `generateOffseasonOptions()` (Case 2)
* **원인:** 대학 2~4학년 잔류 옵션 생성 시 선수의 OVR·출전 시간과 무관하게 `promisedRole: 'ACE_FIRST_OPTION'`을 고정 부여합니다.
* **파급 효과:** 벤치/식스맨 수준 대학 선수가 잔류를 선택했을 때 실제로 1옵션 역할을 받지 못하면 부당하게 역할 약속 불이행(`brokenRolePromise`) 상태로 판정될 수 있습니다.
* **개선 방안:** 프로 잔류 옵션과 동일하게 `determineTeamRolePromise(career, career.team, 'AMATEUR')`를 사용해 현실적인 역할을 부여해야 합니다.

### 3-6. 캐릭터 생성 프리뷰 범위와 실제 초기 스탯 생성 로직 불일치
* **위치:** `src/engine/statCalculator.ts` — `getPreviewStatsAndOvrRange()`, `createInitialStats()`
* **원인:**
  * `getPreviewStatsAndOvrRange()`는 개별 스탯 상한을 `82`, `maxOvr`를 `Math.min(61, baseOvr + 5)`로 계산합니다.
  * `createInitialStats()`는 개별 스탯 상한을 `72`로 자르고, 변동폭은 `talentOffset`($[-2, +2]$) $+$ `randStatVariance`($[-4, +5]$) $=$ **$[-6, +7]$**입니다.
* **파급 효과:** 프리뷰에서는 특정 스탯이 75+로 보이지만 실제 생성 시 72로 잘리거나, 반대로 프리뷰 `maxOvr`는 61인데 실제 생성된 OVR은 62~64가 나오는 불일치가 발생합니다.
* **개선 방안:** 두 함수의 개별 스탯 클램프 범위와 OVR 예상 상·하한 계산식을 동일한 상수 기반으로 일치시켜야 합니다.

### 3-7. 특별 훈련 캠프(`BULK_UP` / `LEAN_MASS`)의 생체역학 상한 클리핑으로 인한 순손실
* **위치:** `src/engine/statCalculator.ts` — `applySpecialCampProgram()`
* **원인:** 벌크업(`INS +2, REB +2, PHY +1 / PLY -1, OUT -1`)이나 베테랑 제로섬 조정을 적용한 뒤 `enforceBiomechanicalCaps()`로 상한을 자릅니다.
* **파급 효과:** 이미 `PHY`나 `INS`/`REB`가 생체역학 상한에 도달한 선수(특히 1-1 버그로 `PHY` 상한이 낮은 빅맨)가 거액을 내고 벌크업을 하면 상승분은 상한에 막혀 0이 되고 하락분(`PLY -1, OUT -1`)만 적용되어 **돈을 내고 능력치가 순감소**합니다.
* **개선 방안:** 상한 도달 스탯이 있는 경우 UI에 사전 경고하거나, 제로섬 조정 시 실제 상승한 총량만큼만 반대 스탯을 차감하도록 보정해야 합니다.

---

## 4. 낮음 및 아키텍처 개선 과제 (Low & Maintainability)

### 4-1. Single Source of Truth(SSOT) 위반 및 로직 중복
* **프로/아마추어 구분 중복:** `balanceConfig.ts`에 `LEAGUE_BALANCE_META[league].isPro`와 `canUseProTradeSystem()`이 정의되어 있으나, `statCalculator.ts`와 `retirementEngine.ts`는 리그 문자열을 직접 비교(`HIGH_SCHOOL`, `PRO_LEAGUES` 배열)하고 `draftEngine.ts`는 `canUseProTradeSystem()`을 호출하지 않습니다.
* **DNA 노쇠화 오프셋 3중 하드코딩:** `IRONMAN(+1.2)`, `LATE_BLOOMER(+0.6)`, `EARLY_BLOOMER(-1.2)` 값이 `statCalculator.ts`(`getGrowthDnaInfo`)와 `retirementEngine.ts`(`getAgingPhaseInfo`, `applyAgingCurve`) 3곳에 각각 복제되어 있습니다.
* **국제대회 상수 중복:** `LIVE_GAME_CONFIG.asianGamesLdr: 67`이 `INTERNATIONAL_TOURNAMENT_CONFIG.ASIAN_GAMES.ldr: 67`과 중복 정의되어 있습니다.
* **`clamp` 함수 6중 정의:** `balanceConfig.ts`의 `clampNum`이 있음에도 4개 파일 곳곳에 로컬 `clamp`, `clampVal`, `clampE`, `clampCap` 함수가 중복 선언되어 있습니다.

### 4-2. 주석/UI 설명과 실제 수식의 불일치
* `statCalculator.ts`(`getGrowthDnaInfo`) 및 `retirementEngine.ts` 주석은 표준형 선수가 **"32세부터 노쇠화"** 한다고 안내하지만, 실제 `AGING_RETIREMENT_CONFIG.baseOnsetAge`는 **`30`**이며 누적 마일리지 18,000분 초과 시 29~30세부터 하락이 시작됩니다.
* `getAgingPhaseInfo()`에서 `LATE_BLOOMER`(`maxGrowthAge = 28`)가 고마일리지(`mileageOffset = -1.8`)를 기록하면 `onsetAge = 28.8`이 되어, 만 28세 `GROWTH`에서 만 29세 `VETERAN_MANAGE`로 직행하며 **전성기(`PRIME`) 구간이 통째로 사라집니다.**
* `statCalculator.ts`의 `calculateBiomechanicalProfile()` 내 `staminaDrainMultiplier` 하한 `0.92`는 내부 수식이 항상 $\ge 1.0$이므로 도달 불가능한 데드 코드(Dead Code)입니다.

### 4-3. 취약한 함수 시그니처 및 방어 코드 미비
* `canSwitchToPosition(currentPrimary, targetPos, arg3, arg4)`는 인자 타입을 런타임에 추론해 위치를 바꾸는 취약한 오버로딩을 사용하며, 신장 누락 시 임의로 `190cm`를 대입합니다. 명시적인 옵션 객체(`{ heightCm, secondaryPos }`)로 리팩터링하는 것이 안전합니다.
* `calculateProjectedNbaPick()`의 저성적 페널티 조건 `lastLog && per36Pts < 10.5 && lastLog.mpg < 12.0`은 `&&` 연산자 때문에 25분 이상 뛰면서 36분 환산 7득점에 그친 최악의 효율 선수에게 페널티가 0이 됩니다.
* `evaluateAcquiredTraits()`는 `[...(career.seasonLogs || []), latestBox]`로 배열을 합치므로, 호출 시점에 `seasonLogs`에 이미 `latestBox`가 포함되어 있으면 동일 시즌을 2회 카운트할 위험이 있습니다(연도 기준 중복 제거 필요).
* `executeDraftResolution('KBL')` 및 KBL FA 풀 생성 시 `getTeamsByLeague('KBL')` 결과에 국군체육부대 상무(`isMilitaryTeam`)가 섞이지 않도록 `!t.isMilitaryTeam` 방어 필터를 명시하는 것이 안전합니다.

---

## 5. 우선순위별 수정 로드맵

1. **즉시 수정 (P0 — 게임 진행/밸런스 치명 결함):**
   * `statCalculator.ts`: `getBiomechanicalStatCaps`의 `phy` 공식 수정 및 `analyzePositionFit`의 `canSwitchToPosition` 4번째 인자 수정
   * `draftEngine.ts` / `retirementEngine.ts`: `isOutOfLeague`의 하위 리그 차단 해제, `isMandatoryAge40` 강제 은퇴 반영, NBA 2라운드 `bucketIndex` 모듈러(`% 30`) 수정
2. **단기 수정 (P1 — 핵심 시스템 정합성):**
   * `retirementEngine.ts`: `applyAgingCurve` 구간 경계 연속성 확보(2단계 $\rightarrow$ 3단계 역전 제거)
   * `draftEngine.ts`: PG 어시스트 페널티 수식 복구, `realGameCompetence` 평가 순서 교정, 스텝다운 KBL 안전망 범위 한정, 20~22세 NBA 복귀 데드존 및 은퇴 투어 연장 악용 차단
   * `progressionEngine.ts`: `getEffectiveRelationships`의 `NaN` 방어 및 `coachTrust` 단일화
3. **중기 리팩터링 (P2 — 밸런스 폴리싱 및 SSOT 통합):**
   * `balanceConfig.ts`: `PACE_CONSERVE` 전술 하향, DNA 오프셋·캠프 비용·스카우팅 상수의 중앙화
   * `retirementEngine.ts`: 영구결번 다중 구단 자격 심사 및 프로/리그별 레거시 등급 정교화
   * `statCalculator.ts`: 프리뷰/생성 스탯 일치, 캠프 상한 클리핑 방지, `canSwitchToPosition` 시그니처 정리