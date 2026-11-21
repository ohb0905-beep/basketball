import { getHeightModifiers, POSITION_ARCHETYPES } from '../data/archetypes';
import {
  BiomechanicalProfile,
  CareerState,
  GrowthDna,
  PlayerStats,
  PlayerTraitId,
  PlayerTraitInfo,
  PlaystyleArchetype,
  Position,
  SeasonBoxScore,
  SpecialCampType,
} from '../types/game';

/**
 * [유기적 물리 엔진] 3대 연속 생체역학 지수 산출 (calculateBiomechanicalProfile)
 * - 단방향/고정 숫자 하드코딩 없이 165cm~225cm 모든 신장과 5대 포지션(PG~C)에 대해
 *   ① 타점 및 림 장악력 지수 (reachLeverage)
 *   ② 무게중심 및 기민성 지수 (centerOfGravityAgility)
 *   ③ 포지션 전술 대비 신체 물리 부하 지수 (positionalPhysicsStrain)
 *   를 연속 함수로 계산합니다.
 */
export function calculateBiomechanicalProfile(
  heightCm: number,
  pos: Position
): BiomechanicalProfile {
  const clampVal = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, v));

  const [minH, maxH] = POSITION_ARCHETYPES[pos].recommendedHeightRange;
  const optCenterH = (minH + maxH) / 2;

  // ① 타점 및 림 장악력 지수 (신장에 비례하여 연속 증가: 165cm -> ~0.36, 195cm -> ~0.91, 220cm -> ~1.36)
  const reachLeverage = Number(
    clampVal(0.36 + ((heightCm - 165) / 55) * 1.0, 0.25, 1.45).toFixed(3)
  );

  // ② 무게중심 및 볼핸들링/방향전환 기민성 지수 (신장이 커질수록 드리블 탄성 궤적 길어짐 & 무게중심 상승으로 연속 감소)
  const centerOfGravityAgility = Number(
    clampVal(1.32 - ((heightCm - 168) / 52) * 0.92, 0.34, 1.35).toFixed(3)
  );

  // 포지션별 골밑 경합 비중 vs 퍼리미터 볼핸들링/가로수비 비중 (연속 가중치)
  const interiorDemandWeight: Record<Position, number> = {
    PG: 0.15,
    SG: 0.28,
    SF: 0.52,
    PF: 0.82,
    C: 1.0,
  };
  const perimeterAgilityWeight: Record<Position, number> = {
    PG: 1.0,
    SG: 0.82,
    SF: 0.62,
    PF: 0.32,
    C: 0.15,
  };

  // 포지션 권장 신장 범위 대비 연속 편차 (cm)
  const rawDeficit = Math.max(0, minH - heightCm);
  const rawExcess = Math.max(0, heightCm - maxH);

  // 포지션 최적 타점 대비 부족분 & 포지션 요구 기민성 대비 부족분
  const expectedReach = 0.36 + ((optCenterH - 165) / 55) * 1.0;
  const reachGap = Math.max(0, expectedReach - reachLeverage);

  const expectedAgility = 1.32 - ((optCenterH - 168) / 52) * 0.92;
  const agilityGap = Math.max(0, expectedAgility - centerOfGravityAgility);

  // ③ 포지션 전술 요구치 대비 신체 물리 부하 지수 (positionalPhysicsStrain: 0.0 ~ 1.25 연속 곡선)
  const interiorStrain =
    reachGap * interiorDemandWeight[pos] * 1.45 +
    (rawDeficit / 28) * interiorDemandWeight[pos];
  const perimeterStrain =
    agilityGap * perimeterAgilityWeight[pos] * 1.55 +
    (rawExcess / 26) * perimeterAgilityWeight[pos];

  const positionalPhysicsStrain = Number(
    clampVal(interiorStrain + perimeterStrain, 0, 1.35).toFixed(3)
  );

  // 실전 리바운드 & 블록슛 경합 배율 (타점 지수와 포지션 골밑 매치업 난이도 결합)
  const rebMultiplier = Number(
    clampVal(
      1.0 -
        reachGap * (0.65 + interiorDemandWeight[pos] * 0.85) +
        Math.max(0, reachLeverage - expectedReach) * 0.25,
      0.28,
      1.28
    ).toFixed(2)
  );

  const blkMultiplier = Number(
    clampVal(
      1.0 -
        reachGap * (0.85 + interiorDemandWeight[pos] * 0.95) +
        Math.max(0, reachLeverage - expectedReach) * 0.35,
      0.15,
      1.35
    ).toFixed(2)
  );

  // 골밑 야투 컨테스트 보정 (%p): 단신이 빅맨 매치업 시 블록/컨테스트에 막혀 야투율 급락
  const insideFgModifier = Number(
    clampVal(
      (reachLeverage - expectedReach) * (6.5 + interiorDemandWeight[pos] * 9.5) -
        perimeterStrain * 5.2,
      -15.5,
      4.5
    ).toFixed(2)
  );

  // 초장신 선수가 볼핸들러(PG/SG/SF) 수행 시 드리블 궤적 노출에 따른 턴오버율 페널티
  const tovRatePenalty = Number(
    clampVal(
      agilityGap * perimeterAgilityWeight[pos] * 4.8 +
        (rawExcess / 10) * perimeterAgilityWeight[pos] * 1.15,
      0,
      4.5
    ).toFixed(2)
  );

  // 외곽 스텝백/돌파 수비 시 무게중심 한계로 인한 Blow-by 수비 감점
  const perimeterDefPenalty = Number(
    clampVal(
      agilityGap * perimeterAgilityWeight[pos] * 9.5 +
        reachGap * interiorDemandWeight[pos] * 8.5,
      0,
      14.0
    ).toFixed(2)
  );

  // 거구 선수의 풀코트 트랜지션 가감속 시 체력 소모 및 하체 부하 배율
  const staminaDrainMultiplier = Number(
    clampVal(
      1.0 +
        Math.max(0, (heightCm - 200) / 35) * 0.28 +
        positionalPhysicsStrain * 0.32,
      0.92,
      1.65
    ).toFixed(2)
  );

  return {
    reachLeverage,
    centerOfGravityAgility,
    positionalPhysicsStrain,
    rebMultiplier,
    blkMultiplier,
    insideFgModifier,
    tovRatePenalty,
    perimeterDefPenalty,
    staminaDrainMultiplier,
  };
}

/**
 * 훈련 효율 탄력성(Growth Elasticity) — 신체 조건과 역행하는 능력치 훈련 시 연속적인 수확체감(Diminishing Returns) 적용
 * - 인위적인 하드 캡(cap = 55) 대신, 신체 프레임의 자연 평형점을 넘어설수록 훈련 상승 효율이 연속적인 시그모이드 곡선으로 감소합니다.
 */
export function getBiomechanicalGrowthElasticity(
  heightCm: number,
  pos: Position,
  currentStats: PlayerStats
): PlayerStats {
  const bio = calculateBiomechanicalProfile(heightCm, pos);
  const clampE = (v: number) => Number(Math.max(0.14, Math.min(1.18, v)).toFixed(3));

  // 신장 기반 자연 평형점 (이 지점 위로는 신체 한계 극복에 훨씬 많은 노력이 필요하여 수확체감 발생)
  const insEquilibrium = 52 + bio.reachLeverage * 36;
  const rebEquilibrium = 48 + bio.reachLeverage * 40;
  const defEquilibrium =
    54 +
    (pos === 'C' || pos === 'PF'
      ? bio.reachLeverage * 34
      : bio.centerOfGravityAgility * 32);
  const plyEquilibrium = 52 + bio.centerOfGravityAgility * 38;
  const outEquilibrium = 60 + bio.centerOfGravityAgility * 30;
  const phyEquilibrium =
    55 + (bio.reachLeverage * 0.45 + bio.centerOfGravityAgility * 0.55) * 34;

  const calcDiminishing = (statVal: number, eq: number) => {
    const over = Math.max(0, statVal - eq);
    return clampE(1.0 / (1.0 + Math.pow(over / 14, 1.65)) - bio.positionalPhysicsStrain * 0.18);
  };

  return {
    ins: calcDiminishing(currentStats.ins, insEquilibrium),
    out: calcDiminishing(currentStats.out, outEquilibrium),
    ply: calcDiminishing(currentStats.ply, plyEquilibrium),
    def: calcDiminishing(currentStats.def, defEquilibrium),
    reb: calcDiminishing(currentStats.reb, rebEquilibrium),
    phy: calcDiminishing(currentStats.phy, phyEquilibrium),
  };
}

/**
 * 생체역학 평형 한계선 (연속 수확체감 적용 후 극단적 오버플로우만 완만하게 제어)
 */
export function getBiomechanicalStatCaps(
  heightCm: number,
  pos: Position
): PlayerStats {
  const bio = calculateBiomechanicalProfile(heightCm, pos);
  const clampCap = (v: number) => Math.max(54, Math.min(99, Math.round(v)));

  return {
    ins: clampCap(58 + bio.reachLeverage * 38 - bio.positionalPhysicsStrain * 14),
    out: clampCap(66 + bio.centerOfGravityAgility * 32 - bio.positionalPhysicsStrain * 8),
    ply: clampCap(58 + bio.centerOfGravityAgility * 38 - bio.tovRatePenalty * 4.2),
    def: clampCap(60 + (bio.reachLeverage + bio.centerOfGravityAgility) * 22 - bio.perimeterDefPenalty * 1.2),
    reb: clampCap(54 + bio.reachLeverage * 41 - bio.positionalPhysicsStrain * 15),
    phy: clampCap(60 + bio.centerOfGravityAgility * 34 - (bio.staminaDrainMultiplier - 1) * 22),
  };
}

export function enforceBiomechanicalCaps(
  stats: PlayerStats,
  heightCm: number,
  pos: Position
): PlayerStats {
  const caps = getBiomechanicalStatCaps(heightCm, pos);
  return {
    ins: Math.min(caps.ins, stats.ins),
    out: Math.min(caps.out, stats.out),
    ply: Math.min(caps.ply, stats.ply),
    def: Math.min(caps.def, stats.def),
    reb: Math.min(caps.reb, stats.reb),
    phy: Math.min(caps.phy, stats.phy),
  };
}

/**
 * 실제 경기 시뮬레이션 및 구단 스카우팅에 적용되는 양방향 생체역학 물리 지표 래퍼
 */
export function calculateHeightMismatchPenalty(
  heightCm: number,
  pos: Position
): {
  deficitCm: number;
  excessCm: number;
  rebMultiplier: number;
  blkMultiplier: number;
  fgPctPenalty: number;
  tovRatePenalty: number;
  positionalPhysicsStrain: number;
  scoutingPenalty: number;
  isSevereMismatch: boolean;
} {
  const [minH, maxH] = POSITION_ARCHETYPES[pos].recommendedHeightRange;
  const deficitCm = Math.max(0, minH - heightCm);
  const excessCm = Math.max(0, heightCm - maxH);
  const bio = calculateBiomechanicalProfile(heightCm, pos);

  const fgPctPenalty = Number(
    Math.max(
      0,
      -bio.insideFgModifier + bio.tovRatePenalty * 1.45 + bio.positionalPhysicsStrain * 4.5
    ).toFixed(1)
  );
  const scoutingPenalty = Number(
    (
      bio.positionalPhysicsStrain * 22.0 +
      bio.tovRatePenalty * 2.8 +
      bio.perimeterDefPenalty * 0.85
    ).toFixed(1)
  );

  return {
    deficitCm,
    excessCm,
    rebMultiplier: bio.rebMultiplier,
    blkMultiplier: bio.blkMultiplier,
    fgPctPenalty,
    tovRatePenalty: bio.tovRatePenalty,
    positionalPhysicsStrain: bio.positionalPhysicsStrain,
    scoutingPenalty,
    isSevereMismatch: bio.positionalPhysicsStrain >= 0.48,
  };
}

const ADJACENT_POSITIONS: Record<Position, Position[]> = {
  PG: ['PG', 'SG'],
  SG: ['PG', 'SG', 'SF'],
  SF: ['SG', 'SF', 'PF'],
  PF: ['SF', 'PF', 'C'],
  C: ['PF', 'C'],
};

/**
 * 주포지션 전향 가능 여부 판정 (인접 포지션 또는 해금된 부포지션만 허용 + 생체역학적 부하 한계 체크)
 */
export function canSwitchToPosition(
  currentPrimary: Position,
  targetPos: Position,
  arg3: number | Position | null,
  arg4: Position | null | number = null
): { allowed: boolean; reason?: string } {
  const heightCm = typeof arg3 === 'number' ? arg3 : typeof arg4 === 'number' ? arg4 : 190;
  const secondaryPos = typeof arg3 === 'string' ? arg3 : typeof arg4 === 'string' ? arg4 : null;

  if (currentPrimary === targetPos) {
    return { allowed: true };
  }

  const isAdjacent = ADJACENT_POSITIONS[currentPrimary].includes(targetPos);
  const isUnlockedSecondary = secondaryPos === targetPos;

  if (!isAdjacent && !isUnlockedSecondary) {
    return {
      allowed: false,
      reason: `${currentPrimary}에서는 인접 포지션(${ADJACENT_POSITIONS[currentPrimary]
        .filter((p) => p !== currentPrimary)
        .join(', ')}) 또는 해금된 부포지션으로만 전향할 수 있습니다.`,
    };
  }

  const targetBio = calculateBiomechanicalProfile(heightCm, targetPos);
  const currentBio = calculateBiomechanicalProfile(heightCm, currentPrimary);
  // 현재 포지션보다 물리 부하가 줄어드는 방향(정상 포지션 찾아가기)은 언제나 허용하고,
  // 극단적 역행 전향(positionalPhysicsStrain >= 0.52)만 차단
  if (
    targetBio.positionalPhysicsStrain >= 0.52 &&
    targetBio.positionalPhysicsStrain > currentBio.positionalPhysicsStrain
  ) {
    const [minH, maxH] = POSITION_ARCHETYPES[targetPos].recommendedHeightRange;
    return {
      allowed: false,
      reason: `신장 ${heightCm}cm는 ${targetPos} 포지션 권장 신장 범위(${minH}~${maxH}cm)와 체격 조건 차이가 커 전향할 수 없습니다.`,
    };
  }

  return { allowed: true };
}

/**
 * 포지션별 가중치에 따른 종합 능력치(OVR) 산출
 */
export function calculateOvr(
  stats: PlayerStats,
  pos: Position,
  heightCm?: number
): number {
  const effectiveStats =
    typeof heightCm === 'number'
      ? enforceBiomechanicalCaps(stats, heightCm, pos)
      : stats;
  const weights = POSITION_ARCHETYPES[pos].ovrWeights;
  const weighted =
    effectiveStats.ins * weights.ins +
    effectiveStats.out * weights.out +
    effectiveStats.ply * weights.ply +
    effectiveStats.def * weights.def +
    effectiveStats.reb * weights.reb +
    effectiveStats.phy * weights.phy;

  return Math.max(40, Math.min(99, Math.round(weighted)));
}

/**
 * 선수 고유 특성(Player Traits) 메타데이터 (선천적 4종 + 후천적 4종)
 */
export const PLAYER_TRAIT_META: Record<PlayerTraitId, PlayerTraitInfo> = {
  IRON_STAMINA: {
    id: 'IRON_STAMINA',
    name: '강철 체력',
    badge: '강철 체력',
    kind: 'INNATE',
    description: '회복력과 내구도가 뛰어나 부상 발생 확률이 크게 줄고 긴 출전 시간을 안정적으로 소화합니다.',
  },
  SLOW_STARTER: {
    id: 'SLOW_STARTER',
    name: '슬로우 스타터',
    badge: '슬로우 스타터',
    kind: 'INNATE',
    description: '20대 중후반부터 성장 속도가 높아지며 프로 무대에서 잠재력 상한 확장 확률이 상승합니다.',
  },
  GLASS_BODY: {
    id: 'GLASS_BODY',
    name: '유리몸 천재성',
    badge: '유리몸 천재성',
    kind: 'INNATE',
    description: '선천적 재능과 성장 잠재력 상한은 높지만 잔부상 위험이 커 피지컬(PHY) 관리가 필수입니다.',
  },
  CLUTCH_PERFORMER: {
    id: 'CLUTCH_PERFORMER',
    name: '승부사 기질',
    badge: '클러치 승부사',
    kind: 'INNATE',
    description: '강팀 맞대결과 플레이오프·우승 경쟁 무대에서 야투 효율과 승률 보정을 받습니다.',
  },
  CONTRACT_YEAR_BOOST: {
    id: 'CONTRACT_YEAR_BOOST',
    name: '계약 해 집중력',
    badge: 'FA 시즌 집중력',
    kind: 'ACQUIRED',
    description: '계약 마지막 해(FA 직전 시즌)에 집중력이 높아져 실전 생산성과 슈팅 효율이 상승합니다.',
  },
  FRANCHISE_HEART: {
    id: 'FRANCHISE_HEART',
    name: '원클럽맨',
    badge: '프랜차이즈 중심',
    kind: 'ACQUIRED',
    description: '단일 구단에서 6시즌 이상 활약해 감독 신뢰도와 원소속팀 재계약·영구결번 평가에서 우대받습니다.',
  },
  BENCH_ACE: {
    id: 'BENCH_ACE',
    name: '세컨드 유닛 에이스',
    badge: '벤치 에이스',
    kind: 'ACQUIRED',
    description: '식스맨상 수상으로 검증된 벤치 득점원으로, 식스맨·벤치 기용 시 분당 생산성이 크게 올라갑니다.',
  },
  SNIPER: {
    id: 'SNIPER',
    name: '외곽 슈터',
    badge: '외곽 슈터',
    kind: 'ACQUIRED',
    description: '시즌 3점슛 성공률 40% 이상을 기록한 전문 슈터로, 우승권 구단의 영입 선호도가 높아집니다.',
  },
};

export function getTraitInfo(traitId: PlayerTraitId): PlayerTraitInfo {
  return PLAYER_TRAIT_META[traitId] || PLAYER_TRAIT_META.IRON_STAMINA;
}

/**
 * 캐릭터 생성 시 선천적 특성(Innate Trait) 1개 무작위 부여
 */
export function rollInnateTrait(
  growthDna: GrowthDna = 'STANDARD',
  rng: () => number = Math.random
): PlayerTraitId {
  const r = rng();
  if (growthDna === 'IRONMAN' && r < 0.55) return 'IRON_STAMINA';
  if (growthDna === 'LATE_BLOOMER' && r < 0.55) return 'SLOW_STARTER';

  const roll = rng();
  if (roll < 0.28) return 'IRON_STAMINA';
  if (roll < 0.54) return 'CLUTCH_PERFORMER';
  if (roll < 0.80) return 'SLOW_STARTER';
  return 'GLASS_BODY';
}

/**
 * 잠재력(Potential) 스펙트럼 전면 개방 (68 ~ 96 연속 분포)
 */
export function rollInitialPotential(
  initialOvr: number,
  growthDna: GrowthDna = 'STANDARD',
  innateTrait: PlayerTraitId = 'IRON_STAMINA',
  rng: () => number = Math.random
): number {
  const u1 = rng();
  const u2 = rng();
  const baseSpectrum = 68 + Math.round((u1 * 0.65 + u2 * 0.35) * 26);

  const dnaBonus =
    growthDna === 'LATE_BLOOMER' ? 2 : growthDna === 'EARLY_BLOOMER' ? 1 : 0;
  const traitBonus =
    innateTrait === 'GLASS_BODY'
      ? 3
      : innateTrait === 'SLOW_STARTER'
      ? 2
      : 0;
  const ovrAnchor = Math.round((initialOvr - 54) * 0.25);

  const rawPotential = baseSpectrum + dnaBonus + traitBonus + ovrAnchor;
  return Math.max(68, Math.min(96, Math.max(initialOvr + 10, rawPotential)));
}

/**
 * 시즌 종료 시 후천적 특성(Acquired Traits) 발현 심사 (최대 3개 보유 제한)
 */
export function evaluateAcquiredTraits(
  career: Pick<
    CareerState,
    'traits' | 'contractYearsLeft' | 'team' | 'seasonLogs' | 'league'
  > & {
    stats?: Pick<PlayerStats, 'out'>;
  },
  latestBox: SeasonBoxScore
): { nextTraits: PlayerTraitId[]; newlyAcquired: PlayerTraitInfo[] } {
  const current = [...(career.traits || [])];
  const newlyAcquired: PlayerTraitInfo[] = [];

  const tryAdd = (id: PlayerTraitId) => {
    if (current.length >= 3 || current.includes(id)) return;
    current.push(id);
    newlyAcquired.push(PLAYER_TRAIT_META[id]);
  };

  // 외곽 슈터(SNIPER)는 단순 성공률 40%+뿐만 아니라 실제 경기당 3점슛 시도 볼륨(tpa)까지 충족해야 부여
  const hasSniperVolume =
    typeof latestBox.tpa === 'number'
      ? latestBox.tpa >= 2.5 ||
        ((career.stats?.out ?? 0) >= 72 && latestBox.tpa >= 2.0)
      : (career.stats?.out ?? 75) >= 68;

  if (latestBox.tpPct >= 40.0 && latestBox.gp >= 20 && hasSniperVolume) {
    tryAdd('SNIPER');
  }

  if (latestBox.wonSixthMan) {
    tryAdd('BENCH_ACE');
  }

  const allLogsWithLatest = [...(career.seasonLogs || []), latestBox];
  const sameTeamSeasons = allLogsWithLatest.filter(
    (l) => l.teamId === latestBox.teamId
  ).length;
  if (sameTeamSeasons >= 6) {
    tryAdd('FRANCHISE_HEART');
  }

  if (
    career.contractYearsLeft <= 1 &&
    career.league !== 'HIGH_SCHOOL' &&
    career.league !== 'U_LEAGUE' &&
    career.league !== 'NCAA' &&
    latestBox.fgPct >= 47.0 &&
    latestBox.mpg >= 20.0
  ) {
    tryAdd('CONTRACT_YEAR_BOOST');
  }

  return { nextTraits: current, newlyAcquired };
}

/**
 * 비시즌 특별 훈련 캠프 & 신체 개조(Offseason Camp) 비용 및 효과 계산
 * - 만 31세+: 스탯 무한 우상향 차단 → 기량 유지 · 노쇠화 방어 모드로 전환
 */
export function getSpecialCampOptions(career: CareerState): {
  id: SpecialCampType;
  title: string;
  subtitle: string;
  costUsd: number;
  effectText: string;
  isVeteranMode?: boolean;
}[] {
  const baseUnit =
    career.league === 'NBA'
      ? 250000
      : career.league === 'EUROLEAGUE'
      ? 90000
      : career.league === 'NBL'
      ? 55000
      : career.league === 'B_LEAGUE' || career.league === 'KBL'
      ? 45000
      : 15000;

  if (career.age >= 31) {
    return [
      {
        id: 'LEGEND_SKILL_CAMP',
        title: '베테랑 컨디셔닝 · 스킬 유지 캠프',
        subtitle:
          '노쇠화 속도를 늦추는 회복·스킬 유지 프로그램입니다. 차기 시즌 에이징 하락폭을 방어하고 기술 완성도를 지킵니다.',
        costUsd: baseUnit,
        effectText:
          career.age <= 36
            ? '차기 시즌 노쇠화 -25% 방어 · 기술(OUT/PLY) 유지(+1, 92 미만)'
            : '차기 시즌 노쇠화 -25% 방어 · 베테랑 기량 유지',
        isVeteranMode: true,
      },
      {
        id: 'BULK_UP',
        title: '베테랑 코어 밸런스 조정 (벌크)',
        subtitle:
          '순 능력치 증가 없이 골밑·리바운드 비중으로 체형 밸런스를 미세 조정합니다.',
        costUsd: Math.round(baseUnit * 0.85),
        effectText: 'INS +1, REB +1 · PLY -1, OUT -1 (제로섬 조정)',
        isVeteranMode: true,
      },
      {
        id: 'LEAN_MASS',
        title: '베테랑 체중 감량 · 기동 유지 (린)',
        subtitle:
          '관절 부담을 줄이고 외곽·수비 밸런스로 체형을 미세 조정합니다.',
        costUsd: Math.round(baseUnit * 0.85),
        effectText: 'OUT +1, DEF +1 · REB -1, INS -1 (제로섬 조정)',
        isVeteranMode: true,
      },
    ];
  }

  return [
    {
      id: 'LEGEND_SKILL_CAMP',
      title: '베테랑 스킬 워크아웃',
      subtitle:
        '은퇴 올스타 출신 트레이너와 비공개 워크아웃을 진행해 주력 기술을 다듬고 잠재력 확장을 노립니다.',
      costUsd: baseUnit,
      effectText: '중점 능력치 +2~3 · 프로 잠재력(POT) +1 기회 · 스카우트 평가 +4',
      isVeteranMode: false,
    },
    {
      id: 'BULK_UP',
      title: '인사이드 파워 벌크업',
      subtitle:
        '체중과 근력을 증량해 페인트존 몸싸움과 리바운드 경합력을 끌어올립니다. 포워드·빅맨 전환에 유리합니다.',
      costUsd: Math.round(baseUnit * 0.85),
      effectText: 'INS +2, REB +2, PHY +1 · PLY -1, OUT -1',
      isVeteranMode: false,
    },
    {
      id: 'LEAN_MASS',
      title: '퍼리미터 린매스업',
      subtitle:
        '체지방을 줄여 퍼스트 스텝과 외곽 슈팅 밸런스를 높입니다. 가드·윙 포지션 소화에 유리합니다.',
      costUsd: Math.round(baseUnit * 0.85),
      effectText: 'PLY +2, OUT +2, DEF +1 · REB -1, INS -1',
      isVeteranMode: false,
    },
  ];
}

export function applySpecialCampProgram(
  career: CareerState,
  campType: SpecialCampType,
  rng: () => number = Math.random
): {
  nextStats: PlayerStats;
  nextPotential: number;
  costUsd: number;
  summary: string;
  grantsAgingShield: boolean;
} {
  const options = getSpecialCampOptions(career);
  const chosen = options.find((o) => o.id === campType) || options[0];
  const clamp = (v: number) => Math.max(35, Math.min(99, Math.round(v)));
  let nextStats: PlayerStats = { ...career.stats };
  let nextPotential = career.potential;
  let summary = '';
  let grantsAgingShield = false;

  const isAmateur =
    career.league === 'HIGH_SCHOOL' ||
    career.league === 'U_LEAGUE' ||
    career.league === 'NCAA';

  // 만 31세+ 베테랑 구간: 스탯 무한 우상향 차단 → 기량 유지 · 노쇠화 방어 전환
  if (career.age >= 31) {
    if (campType === 'LEGEND_SKILL_CAMP') {
      grantsAgingShield = true;
      const targetSkillKey: 'out' | 'ply' =
        career.trainingFocus === 'PLAYMAKING'
          ? 'ply'
          : career.trainingFocus === 'OUTSIDE_SHOOTING'
          ? 'out'
          : career.stats.out <= career.stats.ply
          ? 'out'
          : 'ply';
      const skillLabel = targetSkillKey === 'out' ? '외곽 슈팅(OUT)' : '패스·시야(PLY)';

      if (career.age <= 36 && nextStats[targetSkillKey] < 92) {
        nextStats[targetSkillKey] = clamp(nextStats[targetSkillKey] + 1);
        summary = `베테랑 컨디셔닝 캠프 수료: 차기 시즌 노쇠화 하락 방어(-25%) 버프 획득 및 ${skillLabel} +1 유지 보강을 완료했습니다.`;
      } else {
        summary =
          '베테랑 컨디셔닝 캠프 수료: 차기 시즌 노쇠화 하락 방어(-25%) 버프를 확보하며 최상의 컨디션 유지에 집중했습니다.';
      }
    } else if (campType === 'BULK_UP') {
      nextStats.ins = clamp(nextStats.ins + 1);
      nextStats.reb = clamp(nextStats.reb + 1);
      nextStats.ply = clamp(nextStats.ply - 1);
      nextStats.out = clamp(nextStats.out - 1);
      summary =
        '베테랑 코어 밸런스 조정 완료: 골밑(INS +1)·리바운드(REB +1) 비중을 높이고 외곽·패스(OUT -1, PLY -1)를 재분배했습니다.';
    } else {
      nextStats.out = clamp(nextStats.out + 1);
      nextStats.def = clamp(nextStats.def + 1);
      nextStats.reb = clamp(nextStats.reb - 1);
      nextStats.ins = clamp(nextStats.ins - 1);
      summary =
        '베테랑 체중 감량 · 기동 유지 완료: 외곽(OUT +1)·수비(DEF +1) 밸런스를 다듬고 골밑(INS -1, REB -1) 부하를 줄였습니다.';
    }

    nextStats = enforceBiomechanicalCaps(
      nextStats,
      career.heightCm,
      career.primaryPos
    );

    return {
      nextStats,
      nextPotential,
      costUsd: chosen.costUsd,
      summary,
      grantsAgingShield,
    };
  }

  if (campType === 'LEGEND_SKILL_CAMP') {
    const focus = career.trainingFocus;
    if (focus === 'OUTSIDE_SHOOTING') {
      nextStats.out = clamp(nextStats.out + 2);
      nextStats.ply = clamp(nextStats.ply + 1);
    } else if (focus === 'INSIDE_SCORING') {
      nextStats.ins = clamp(nextStats.ins + 2);
      nextStats.phy = clamp(nextStats.phy + 1);
    } else if (focus === 'PLAYMAKING') {
      nextStats.ply = clamp(nextStats.ply + 2);
      nextStats.out = clamp(nextStats.out + 1);
    } else if (focus === 'DEFENSE_LOCKDOWN') {
      nextStats.def = clamp(nextStats.def + 2);
      nextStats.phy = clamp(nextStats.phy + 1);
    } else if (focus === 'REBOUND_POST') {
      nextStats.reb = clamp(nextStats.reb + 2);
      nextStats.ins = clamp(nextStats.ins + 1);
    } else {
      nextStats.phy = clamp(nextStats.phy + 2);
      nextStats.def = clamp(nextStats.def + 1);
    }

    // 아마추어 시절에는 잠재력 폭등 차단, 프로 무대에서만 낮은 확률로 +1 확장
    const potGain = !isAmateur && rng() < 0.35 ? 1 : 0;
    nextPotential = Math.min(97, career.potential + potGain);
    summary =
      potGain > 0
        ? `베테랑 스킬 워크아웃 수료: 핵심 능력치 상승 및 잠재력 상한이 ${nextPotential}(+${potGain})로 확장되었습니다.`
        : '베테랑 스킬 워크아웃 수료: 중점 기술 완성도가 한 단계 올라갔습니다.';
  } else if (campType === 'BULK_UP') {
    nextStats.ins = clamp(nextStats.ins + 2);
    nextStats.reb = clamp(nextStats.reb + 2);
    nextStats.phy = clamp(nextStats.phy + 1);
    nextStats.ply = clamp(nextStats.ply - 1);
    nextStats.out = clamp(nextStats.out - 1);
    summary =
      '벌크업 프로그램 완료: 골밑 득점(INS +2), 리바운드(REB +2), 피지컬(PHY +1)이 강화되었습니다.';
  } else {
    nextStats.ply = clamp(nextStats.ply + 2);
    nextStats.out = clamp(nextStats.out + 2);
    nextStats.def = clamp(nextStats.def + 1);
    nextStats.reb = clamp(nextStats.reb - 1);
    nextStats.ins = clamp(nextStats.ins - 1);
    summary =
      '린매스업 프로그램 완료: 패스·핸들링(PLY +2), 외곽 슈팅(OUT +2), 수비력(DEF +1)이 향상되었습니다.';
  }

  // 생체역학적 물리 상한선 적용
  nextStats = enforceBiomechanicalCaps(
    nextStats,
    career.heightCm,
    career.primaryPos
  );

  return {
    nextStats,
    nextPotential,
    costUsd: chosen.costUsd,
    summary,
    grantsAgingShield,
  };
}

const PHYSICAL_STAT_KEYS: ReadonlySet<keyof PlayerStats> = new Set([
  'phy',
  'ins',
  'def',
  'reb',
]);

/**
 * 만 31세+ 랜덤 인카운터 / 스토리 아크 스탯 보상 연령 보정 필터
 * - 30세 이하: 모든 스탯 변화 100% 반영
 * - 31~33세: 양수 상승 항목당 최대 +1 제한 (신체 스탯 85+는 상승 대신 기량 유지 버프/신뢰도로 전환)
 * - 34세+: 신체 계열(PHY/INS/DEF/REB) 양수 상승 차단 → 노쇠화 방어 버프·신뢰도로 전환, 기술(OUT/PLY)만 90 미만일 때 최대 +1
 * - 음수 패널티(부상·슬럼프 등)는 연령 무관 100% 적용
 */
export function applyAgeAdjustedEventStatChanges(
  age: number,
  prevStats: PlayerStats,
  rawChanges: Partial<PlayerStats>
): {
  adjustedChanges: Partial<PlayerStats>;
  suppressedPhysicalCount: number;
  convertedTrustBonus: number;
  grantedAgingShield: boolean;
} {
  if (age <= 30) {
    return {
      adjustedChanges: { ...rawChanges },
      suppressedPhysicalCount: 0,
      convertedTrustBonus: 0,
      grantedAgingShield: false,
    };
  }

  const adjustedChanges: Partial<PlayerStats> = {};
  let suppressedPhysicalCount = 0;
  let dampedAnyPositive = false;

  for (const key of Object.keys(rawChanges) as (keyof PlayerStats)[]) {
    const rawDiff = rawChanges[key] || 0;
    if (rawDiff === 0) continue;

    // 음수 패널티는 나이 무관 100% 적용
    if (rawDiff < 0) {
      adjustedChanges[key] = rawDiff;
      continue;
    }

    const isPhysical = PHYSICAL_STAT_KEYS.has(key);

    if (age >= 34) {
      if (isPhysical) {
        suppressedPhysicalCount += 1;
        dampedAnyPositive = true;
      } else {
        // 기술 스탯(OUT/PLY)은 90 미만일 때만 최대 +1 허용
        if (prevStats[key] < 90) {
          adjustedChanges[key] = 1;
          if (rawDiff > 1) dampedAnyPositive = true;
        } else {
          dampedAnyPositive = true;
        }
      }
    } else {
      // 31 ~ 33세: 항목당 최대 +1, 신체 스탯 85 이상은 유지 버프로 전환
      if (isPhysical && prevStats[key] >= 85) {
        suppressedPhysicalCount += 1;
        dampedAnyPositive = true;
      } else if (!isPhysical && prevStats[key] >= 94) {
        dampedAnyPositive = true;
      } else {
        adjustedChanges[key] = 1;
        if (rawDiff > 1) dampedAnyPositive = true;
      }
    }
  }

  const grantedAgingShield = suppressedPhysicalCount > 0;
  const convertedTrustBonus =
    suppressedPhysicalCount > 0 ? 2 : dampedAnyPositive ? 1 : 0;

  return {
    adjustedChanges,
    suppressedPhysicalCount,
    convertedTrustBonus,
    grantedAgingShield,
  };
}

/**
 * 성장 곡선 DNA 메타 정보 반환
 */
export function getGrowthDnaInfo(dna: GrowthDna = 'STANDARD'): {
  id: GrowthDna;
  label: string;
  badge: string;
  description: string;
  peakAgeRange: [number, number];
  agingOnsetOffset: number;
} {
  switch (dna) {
    case 'EARLY_BLOOMER':
      return {
        id: 'EARLY_BLOOMER',
        label: '조숙형',
        badge: '조숙형 성장',
        description: '10대 후반~20대 초반 성장 속도가 빠르지만, 30대 진입 전후로 에이징 커브가 다소 빠르게 찾아옵니다.',
        peakAgeRange: [24, 27],
        agingOnsetOffset: -1.2,
      };
    case 'LATE_BLOOMER':
      return {
        id: 'LATE_BLOOMER',
        label: '대기만성형',
        badge: '대기만성형',
        description: '초기 성장은 완만하지만 20대 중후반부터 30~31세 정점까지 꾸준히 기량이 올라갑니다.',
        peakAgeRange: [28, 31],
        agingOnsetOffset: 0.6,
      };
    case 'IRONMAN':
      return {
        id: 'IRONMAN',
        label: '내구도 특화형',
        badge: '고내구도형',
        description: '부상 위험이 낮고 30대 초반 이후에도 신체 능력 하락 폭이 완만하게 유지됩니다.',
        peakAgeRange: [28, 31],
        agingOnsetOffset: 1.2,
      };
    case 'STANDARD':
    default:
      return {
        id: 'STANDARD',
        label: '표준 균형형',
        badge: '표준 성장형',
        description: '20대 후반~30세에 전성기 정점을 찍고 32세부터 현실적인 에이징 커브를 따릅니다.',
        peakAgeRange: [27, 30],
        agingOnsetOffset: 0,
      };
  }
}

/**
 * 포지션별 허용 플레이 성향 매트릭스 (현실 농구 고증: 센터 3&D, 가드 림 프로텍터 등 부조화 원천 차단)
 */
export const ALLOWED_PLAYSTYLES_BY_POS: Record<Position, PlaystyleArchetype[]> = {
  PG: ['PLAYMAKER', 'SCORER', 'THREE_AND_D', 'ALL_ROUNDER'],
  SG: ['SCORER', 'THREE_AND_D', 'PLAYMAKER', 'ALL_ROUNDER'],
  SF: ['THREE_AND_D', 'SCORER', 'PLAYMAKER', 'ALL_ROUNDER'],
  PF: ['RIM_PROTECTOR', 'STRETCH_BIG', 'POST_SCORER', 'SCORER', 'ALL_ROUNDER'],
  C: ['RIM_PROTECTOR', 'POST_SCORER', 'STRETCH_BIG', 'ALL_ROUNDER'],
};

export function isPlaystyleAllowedForPosition(
  style: PlaystyleArchetype,
  pos: Position
): boolean {
  return ALLOWED_PLAYSTYLES_BY_POS[pos].includes(style);
}

/**
 * 플레이 성향 아키타입 메타 정보 반환 (포지션에 맞는 명칭 보정 지원)
 */
export function getPlaystyleInfo(
  style: PlaystyleArchetype = 'ALL_ROUNDER',
  pos?: Position
): {
  id: PlaystyleArchetype;
  label: string;
  badge: string;
  description: string;
} {
  switch (style) {
    case 'SCORER':
      return {
        id: 'SCORER',
        label: '득점원',
        badge: '스코어러',
        description: '내외곽을 가리지 않고 공격 마무리를 책임지는 득점 중심 성향입니다.',
      };
    case 'PLAYMAKER':
      return {
        id: 'PLAYMAKER',
        label: '볼핸들러 · 패서',
        badge: '플레이메이커',
        description: '넓은 시야와 패스 타이밍으로 팀 공격 전개를 조율하는 리딩 성향입니다.',
      };
    case 'THREE_AND_D': {
      const label = pos === 'PG' ? '3&D 가드' : '3&D 윙';
      return {
        id: 'THREE_AND_D',
        label,
        badge: label,
        description: '안정적인 외곽 3점슛과 퍼리미터 대인 수비로 우승권 로테이션에 적합한 공수 겸비 성향입니다.',
      };
    }
    case 'RIM_PROTECTOR':
      return {
        id: 'RIM_PROTECTOR',
        label: '림 프로텍터',
        badge: '림 프로텍터',
        description: '골밑 블록슛, 리바운드, 스크린으로 페인트존을 지키는 수비형 빅맨 성향입니다.',
      };
    case 'STRETCH_BIG':
      return {
        id: 'STRETCH_BIG',
        label: '스트레치 빅',
        badge: '스트레치 빅',
        description: '외곽 3점슛 스페이싱과 빅맨 피지컬을 겸비해 상대 골밑 수비를 끌어내는 현대형 빅맨 성향입니다.',
      };
    case 'POST_SCORER':
      return {
        id: 'POST_SCORER',
        label: '포스트 스코어러',
        badge: '포스트 스코어러',
        description: '페인트존 풋워크와 훅샷, 피지컬을 앞세워 골밑 득점을 주도하는 정통 인사이드 공격형 성향입니다.',
      };
    case 'ALL_ROUNDER':
    default:
      return {
        id: 'ALL_ROUNDER',
        label: '올라운더',
        badge: '올라운더',
        description: '득점, 리바운드, 패스, 수비 전 영역에서 고른 생산성을 내는 균형형 성향입니다.',
      };
  }
}

function scorePlaystylesForPosition(
  stats: PlayerStats,
  pos: Position,
  rng: () => number
): { id: PlaystyleArchetype; score: number }[] {
  const base = POSITION_ARCHETYPES[pos].baseStats;
  const dIns = stats.ins - base.ins;
  const dOut = stats.out - base.out;
  const dPly = stats.ply - base.ply;
  const dDef = stats.def - base.def;
  const dReb = stats.reb - base.reb;
  const dPhy = stats.phy - base.phy;
  const minDelta = Math.min(dIns, dOut, dPly, dDef, dReb, dPhy);
  const avgDelta = (dIns + dOut + dPly + dDef + dReb + dPhy) / 6;

  const allowed = ALLOWED_PLAYSTYLES_BY_POS[pos];
  const jitter = () => rng() * 5.0 - 2.5;

  const rawScores: Record<PlaystyleArchetype, number> = {
    PLAYMAKER:
      dPly * 1.35 +
      dOut * 0.25 +
      (pos === 'PG' ? 2.6 : pos === 'SG' ? -1.2 : -2.2),
    SCORER:
      Math.max(dIns, dOut) * 1.1 +
      (dIns + dOut) * 0.35 +
      (pos === 'SG' ? 2.2 : pos === 'PF' ? 0.2 : 0.7),
    THREE_AND_D:
      (dOut + dDef) * 0.92 +
      (pos === 'SF' ? 2.4 : pos === 'SG' ? 1.1 : -1.0),
    RIM_PROTECTOR:
      (dDef + dReb) * 0.92 +
      (pos === 'C' ? 1.8 : 0.9),
    POST_SCORER:
      dIns * 1.15 +
      dPhy * 0.55 +
      dReb * 0.3 +
      (pos === 'C' ? 1.4 : 0.9),
    STRETCH_BIG:
      dOut * 1.25 +
      dDef * 0.35 +
      (stats.out >= 56 ? 1.8 : -1.8) +
      (pos === 'PF' ? 1.4 : -0.3),
    ALL_ROUNDER:
      avgDelta * 0.9 + minDelta * 0.45 + 1.4,
  };

  return allowed
    .map((id) => ({ id, score: rawScores[id] + jitter() }))
    .sort((a, b) => b.score - a.score);
}

/**
 * 포지션 전향 또는 레거시 세이브 복구 시 현재 포지션과 충돌하는 플레이 성향을 자동 재평가
 */
export function reconcilePlaystyleForPosition(
  currentStyle: PlaystyleArchetype | undefined,
  stats: PlayerStats,
  pos: Position
): PlaystyleArchetype {
  if (currentStyle && isPlaystyleAllowedForPosition(currentStyle, pos)) {
    return currentStyle;
  }

  // 의미적으로 가장 자연스러운 대응 성향 매핑 우선 적용
  const isBig = pos === 'PF' || pos === 'C';
  if (currentStyle === 'THREE_AND_D' && isBig) {
    return 'STRETCH_BIG';
  }
  if (currentStyle === 'STRETCH_BIG' && !isBig) {
    return stats.def >= 65 ? 'THREE_AND_D' : 'SCORER';
  }
  if (currentStyle === 'PLAYMAKER' && pos === 'C') {
    return stats.out >= 74 ? 'STRETCH_BIG' : 'ALL_ROUNDER';
  }
  if (currentStyle === 'PLAYMAKER' && pos === 'PF') {
    return stats.out >= 74 ? 'STRETCH_BIG' : 'ALL_ROUNDER';
  }
  if (
    (currentStyle === 'RIM_PROTECTOR' || currentStyle === 'POST_SCORER') &&
    !isBig
  ) {
    if (stats.def >= 68 && stats.out >= 66) return 'THREE_AND_D';
    if (stats.ins >= 68 || stats.out >= 68) return 'SCORER';
    return 'ALL_ROUNDER';
  }

  const ranked = scorePlaystylesForPosition(stats, pos, () => 0.5);
  return ranked[0]?.id || 'ALL_ROUNDER';
}

/**
 * 초기 능력치와 포지션, 난수를 결합하여 선수 고유 성장 DNA 및 플레이 성향 산출
 */
export function rollPlayerDnaAndPlaystyle(
  stats: PlayerStats,
  pos: Position,
  rng: () => number = Math.random
): {
  growthDna: GrowthDna;
  playstyle: PlaystyleArchetype;
} {
  const dnaRoll = rng();
  let growthDna: GrowthDna = 'STANDARD';
  if (dnaRoll < 0.24) {
    growthDna = 'EARLY_BLOOMER';
  } else if (dnaRoll < 0.50) {
    growthDna = 'LATE_BLOOMER';
  } else if (dnaRoll < 0.72) {
    growthDna = 'IRONMAN';
  } else {
    growthDna = 'STANDARD';
  }

  const candidates = scorePlaystylesForPosition(stats, pos, rng);
  const playstyle: PlaystyleArchetype = candidates[0]?.id || 'ALL_ROUNDER';

  return { growthDna, playstyle };
}

/**
 * 캐릭터 생성 전 미리보기용 기준 능력치 및 예상 OVR 범위 산출
 */
export function getPreviewStatsAndOvrRange(
  pos: Position,
  heightCm: number
): {
  baselineStats: PlayerStats;
  minOvr: number;
  maxOvr: number;
} {
  const base = POSITION_ARCHETYPES[pos].baseStats;
  const { statModifiers } = getHeightModifiers(heightCm);
  const clamp = (v: number) => Math.max(35, Math.min(82, Math.round(v)));

  const rawBaseline: PlayerStats = {
    ins: clamp(base.ins + statModifiers.ins),
    out: clamp(base.out + statModifiers.out),
    ply: clamp(base.ply + statModifiers.ply),
    def: clamp(base.def + statModifiers.def),
    reb: clamp(base.reb + statModifiers.reb),
    phy: clamp(base.phy + statModifiers.phy),
  };

  const baselineStats = enforceBiomechanicalCaps(rawBaseline, heightCm, pos);
  const baseOvr = calculateOvr(baselineStats, pos);
  const minOvr = Math.max(46, baseOvr - 5);
  const maxOvr = Math.min(61, baseOvr + 5);

  return { baselineStats, minOvr, maxOvr };
}

/**
 * 캐릭터 생성 시 기본 포지션 아키타입 + 신장(cm) 물리 보정 +
 * 개체별 무작위 편차(-4 ~ +5) + 생체역학적 상한선 적용
 */
export function createInitialStats(
  pos: Position,
  heightCm: number,
  rng: () => number = Math.random
): PlayerStats {
  const base = POSITION_ARCHETYPES[pos].baseStats;
  const { statModifiers } = getHeightModifiers(heightCm);

  const talentOffset = Math.floor(rng() * 5) - 2;
  const randStatVariance = () => Math.floor(rng() * 10) - 4;
  const clamp = (v: number) => Math.max(36, Math.min(72, Math.round(v)));

  const rawStats: PlayerStats = {
    ins: clamp(base.ins + statModifiers.ins + talentOffset + randStatVariance()),
    out: clamp(base.out + statModifiers.out + talentOffset + randStatVariance()),
    ply: clamp(base.ply + statModifiers.ply + talentOffset + randStatVariance()),
    def: clamp(base.def + statModifiers.def + talentOffset + randStatVariance()),
    reb: clamp(base.reb + statModifiers.reb + talentOffset + randStatVariance()),
    phy: clamp(base.phy + statModifiers.phy + talentOffset + randStatVariance()),
  };

  return enforceBiomechanicalCaps(rawStats, heightCm, pos);
}

export interface PositionRecommendation {
  bestPrimaryPos: Position;
  bestPrimaryOvr: number;
  currentPosOvr: number;
  recommendedSecondaryPos: Position;
  secondaryPosOvr: number;
  canUnlockSecondary: boolean;
  coachAdvice: string;
}

/**
 * 감독 면담: 현재 선수의 능력치와 신장을 분석하여 최적 포지션 전향 및 듀얼 포지션(부포지션) 해금을 추천
 */
export function analyzePositionFit(
  stats: PlayerStats,
  heightCm: number,
  currentPrimary: Position,
  currentSecondary: Position | null,
  coachTrust: number
): PositionRecommendation {
  const allPositions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

  const ranked = allPositions
    .map((p) => {
      const cappedStats = enforceBiomechanicalCaps(stats, heightCm, p);
      const rawOvr = calculateOvr(cappedStats, p);
      const mismatch = calculateHeightMismatchPenalty(heightCm, p);
      let heightFitBonus = 0;
      if (mismatch.deficitCm === 0 && mismatch.excessCm === 0) {
        heightFitBonus = 2.0;
      } else {
        heightFitBonus = -mismatch.scoutingPenalty * 0.35;
      }
      return {
        pos: p,
        ovr: rawOvr,
        fitScore: rawOvr + heightFitBonus,
      };
    })
    .sort((a, b) => b.fitScore - a.fitScore);

  const bestPrimary = ranked[0];
  const secondBest =
    ranked.find(
      (r) =>
        r.pos !== currentPrimary &&
        canSwitchToPosition(currentPrimary, r.pos, heightCm, r.pos).allowed
    ) ||
    ranked.find((r) => r.pos !== currentPrimary) ||
    ranked[1];
  const currentPosOvr = calculateOvr(stats, currentPrimary);
  const currentMismatch = calculateHeightMismatchPenalty(heightCm, currentPrimary);

  const canUnlockSecondary =
    currentSecondary === null && (coachTrust >= 55 || secondBest.ovr >= 56);

  let coachAdvice = '';
  if (currentMismatch.isSevereMismatch) {
    coachAdvice = `현재 신장(${heightCm}cm)으로 ${currentPrimary} 포지션을 소화하기엔 높이·리바운드 미스매치 감점(-${currentMismatch.scoutingPenalty})이 큽니다. 신체 조건에 맞는 ${bestPrimary.pos} 전향을 권고합니다.`;
  } else if (bestPrimary.pos !== currentPrimary && bestPrimary.ovr > currentPosOvr) {
    coachAdvice = `현재 기술 구성과 ${heightCm}cm 신장을 감안하면 ${bestPrimary.pos} 전향 시 OVR이 ${currentPosOvr}에서 ${bestPrimary.ovr}로 상승합니다.`;
  } else if (!currentSecondary) {
    coachAdvice = `주포지션 ${currentPrimary} 적합도가 높습니다. ${secondBest.pos} 부포지션을 해금하면 로테이션 기용 폭이 넓어집니다.`;
  } else {
    coachAdvice = `${currentPrimary}/${currentSecondary} 멀티 포지션 소화가 팀 전술 운용에 안정적으로 기여하고 있습니다.`;
  }

  return {
    bestPrimaryPos: bestPrimary.pos,
    bestPrimaryOvr: bestPrimary.ovr,
    currentPosOvr,
    recommendedSecondaryPos: secondBest.pos,
    secondaryPosOvr: secondBest.ovr,
    canUnlockSecondary,
    coachAdvice,
  };
}

/**
 * 보유 능력치 및 고유 DNA/성향/특성에 따른 자동 배지 부여 (포지션별 자연스러운 명칭 적용)
 */
export function evaluatePlayerBadges(
  stats: PlayerStats,
  secondaryPos: Position | null,
  growthDna?: GrowthDna,
  playstyle?: PlaystyleArchetype,
  traits?: PlayerTraitId[],
  primaryPos?: Position
): string[] {
  const badges: string[] = [];
  const isBig = primaryPos === 'PF' || primaryPos === 'C';

  if (growthDna) {
    badges.push(getGrowthDnaInfo(growthDna).badge);
  }
  if (playstyle) {
    badges.push(getPlaystyleInfo(playstyle, primaryPos).badge);
  }
  if (traits && traits.length > 0) {
    for (const tr of traits) {
      badges.push(getTraitInfo(tr).badge);
    }
  }

  if (stats.out >= 85) badges.push('엘리트 3점 슈터');
  else if (stats.out >= 75) badges.push('캐치앤슛 슈터');

  if (stats.ins >= 85) badges.push('엘리트 림 피니셔');
  else if (stats.ins >= 75) badges.push('인사이드 피니셔');

  if (stats.ply >= 85) {
    badges.push(isBig ? '하이포스트 패싱 허브' : '1옵션 볼핸들러');
  } else if (stats.ply >= 75) {
    badges.push('패스 스페셜리스트');
  }

  if (stats.def >= 85) {
    badges.push('올-디펜시브 수비수');
  } else if (stats.def >= 75) {
    badges.push(isBig ? '페인트존 수비수' : '퍼리미터 수비수');
  }

  if (stats.reb >= 85) badges.push('엘리트 리바운더');
  else if (stats.reb >= 75) badges.push('보드 경합 우수');

  if (stats.phy >= 85) badges.push('상위권 운동능력');

  if (secondaryPos) {
    badges.push(`멀티 포지션 (${secondaryPos})`);
  }

  return badges;
}
