import { getHeightModifiers, POSITION_ARCHETYPES } from '../data/archetypes';
import {
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
 * 생체역학적(Biomechanical) 신장-포지션별 6대 스탯 물리적 상한선 계산
 * - 예: 168cm 선수가 C(센터, 권장 204~220cm)나 PF(권장 198~210cm)로 뛸 경우,
 *   아무리 훈련해도 INS(골밑), REB(리바운드), DEF(림 프로텍션)가 55~60 이상 오를 수 없음.
 * - 반면 168~178cm 단신 선수가 PG로 뛸 때는 OUT, PLY, PHY 상한이 99까지 열려 기술과 스피드로 승부 가능.
 */
export function getBiomechanicalStatCaps(
  heightCm: number,
  pos: Position
): PlayerStats {
  const [minH, maxH] = POSITION_ARCHETYPES[pos].recommendedHeightRange;
  const deficitCm = Math.max(0, minH - heightCm);
  const excessCm = Math.max(0, heightCm - maxH);

  // 절대 신장에 따른 골밑/리바운드 물리 한계 + 포지션 권장 신장 미달 페널티 결합
  const shortInteriorDrag = Math.max(0, 185 - heightCm);
  const mismatchDrag = deficitCm > 5 ? (deficitCm - 5) * 1.15 : 0;

  const insCap = Math.max(
    54,
    Math.min(99, Math.round(99 - shortInteriorDrag * 0.75 - mismatchDrag * 0.95))
  );
  const rebCap = Math.max(
    52,
    Math.min(99, Math.round(99 - shortInteriorDrag * 1.15 - mismatchDrag * 1.05))
  );
  const defCap = Math.max(
    56,
    Math.min(
      99,
      Math.round(
        99 -
          (pos === 'C' || pos === 'PF' ? shortInteriorDrag * 0.85 : 0) -
          mismatchDrag * 0.9
      )
    )
  );

  // 초장신 선수가 가드 포지션을 볼 때 볼핸들링/민첩성 상한 제한
  const tallPerimeterDrag = Math.max(0, heightCm - 206);
  const excessMismatchDrag = excessCm > 5 ? (excessCm - 5) * 1.1 : 0;

  const plyCap = Math.max(
    58,
    Math.min(99, Math.round(99 - tallPerimeterDrag * 1.2 - excessMismatchDrag * 0.95))
  );
  const outCap = Math.max(
    64,
    Math.min(99, Math.round(99 - tallPerimeterDrag * 0.7 - excessMismatchDrag * 0.6))
  );
  const phyCap = Math.max(
    60,
    Math.min(
      99,
      Math.round(99 - tallPerimeterDrag * 1.1 - Math.max(deficitCm, excessCm) * 0.45)
    )
  );

  return {
    ins: insCap,
    out: outCap,
    ply: plyCap,
    def: defCap,
    reb: rebCap,
    phy: phyCap,
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
 * 실제 경기 시뮬레이션 및 구단 스카우팅에 적용되는 신장-포지션 미스매치 물리 페널티
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
  scoutingPenalty: number;
  isSevereMismatch: boolean;
} {
  const [minH, maxH] = POSITION_ARCHETYPES[pos].recommendedHeightRange;
  const deficitCm = Math.max(0, minH - heightCm);
  const excessCm = Math.max(0, heightCm - maxH);

  // 168~178cm 단신 가드가 PG를 볼 때는 deficitCm가 0~7cm 수준으로 정상 범주
  const effectiveDeficit = Math.max(0, deficitCm - 4);
  const effectiveExcess = Math.max(0, excessCm - 5);

  const rebMultiplier = Number(
    Math.max(0.32, 1.0 - effectiveDeficit * 0.022).toFixed(2)
  );
  const blkMultiplier = Number(
    Math.max(0.18, 1.0 - effectiveDeficit * 0.028).toFixed(2)
  );
  const fgPctPenalty = Number(
    Math.min(14.0, effectiveDeficit * 0.38 + effectiveExcess * 0.22).toFixed(1)
  );
  const scoutingPenalty = Number(
    (effectiveDeficit * 1.35 + effectiveExcess * 1.1).toFixed(1)
  );

  return {
    deficitCm,
    excessCm,
    rebMultiplier,
    blkMultiplier,
    fgPctPenalty,
    scoutingPenalty,
    isSevereMismatch: deficitCm >= 14 || excessCm >= 14,
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
 * 주포지션 전향 가능 여부 판정 (인접 포지션 또는 해금된 부포지션만 허용 + 극단적 신장 미스매치 차단)
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
        .join(', ')}) 또는 해금된 부포지션으로만 전향할 수 있어요.`,
    };
  }

  const [minH, maxH] = POSITION_ARCHETYPES[targetPos].recommendedHeightRange;
  if (heightCm < minH - 11 || heightCm > maxH + 11) {
    return {
      allowed: false,
      reason: `신장 ${heightCm}cm는 ${targetPos} 권장 신장(${minH}~${maxH}cm)과 물리적 차이가 너무 커서 전향할 수 없어요.`,
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
    badge: '🦾 강철 체력',
    kind: 'INNATE',
    description: '타고난 회복력과 유연성으로 부상 발생 확률이 대폭 감소하고 풀타임 체력을 유지해요.',
  },
  SLOW_STARTER: {
    id: 'SLOW_STARTER',
    name: '슬로우 스타터',
    badge: '🌱 슬로우 스타터',
    kind: 'INNATE',
    description: '20대 중후반부터 성장 속도가 가속화되며 프로 무대에서 잠재력 한계 돌파 확률이 높아져요.',
  },
  GLASS_BODY: {
    id: 'GLASS_BODY',
    name: '유리몸 천재성',
    badge: '💎 유리몸 천재성',
    kind: 'INNATE',
    description: '선천적 재능과 성장 잠재력 상한선이 높지만, 잔부상 위험이 높아 피지컬(PHY) 관리가 필수예요.',
  },
  CLUTCH_PERFORMER: {
    id: 'CLUTCH_PERFORMER',
    name: '승부사 기질',
    badge: '🔥 클러치 승부사',
    kind: 'INNATE',
    description: '강팀 상대 및 플레이오프·우승 경쟁 무대에서 야투 효율과 팀 승률 보정을 받아요.',
  },
  CONTRACT_YEAR_BOOST: {
    id: 'CONTRACT_YEAR_BOOST',
    name: 'FA 로이드',
    badge: '💰 FA 로이드',
    kind: 'ACQUIRED',
    description: '계약 마지막 해(FA 직전 시즌)에 집중력이 폭발해 실전 생산성과 슈팅 효율이 상승해요.',
  },
  FRANCHISE_HEART: {
    id: 'FRANCHISE_HEART',
    name: '프랜차이즈의 심장',
    badge: '❤️ 프랜차이즈의 심장',
    kind: 'ACQUIRED',
    description: '단일 구단에서 6시즌 이상 헌신하여 감독 신뢰도와 원소속팀 재계약·영구결번 평가에서 우대받아요.',
  },
  BENCH_ACE: {
    id: 'BENCH_ACE',
    name: '벤치의 에이스',
    badge: '⚡ 벤치의 에이스',
    kind: 'ACQUIRED',
    description: '식스맨상 수상으로 검증된 세컨드 유닛 리더로, 벤치·식스맨 기용 시 분당 득점 효율이 크게 올라가요.',
  },
  SNIPER: {
    id: 'SNIPER',
    name: '스나이퍼',
    badge: '🎯 외곽 스나이퍼',
    kind: 'ACQUIRED',
    description: '시즌 3점슛 성공률 40% 이상을 증명한 전문 슈터로, 컨텐더 구단의 스카우팅 선호도가 상승해요.',
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
  >,
  latestBox: SeasonBoxScore
): { nextTraits: PlayerTraitId[]; newlyAcquired: PlayerTraitInfo[] } {
  const current = [...(career.traits || [])];
  const newlyAcquired: PlayerTraitInfo[] = [];

  const tryAdd = (id: PlayerTraitId) => {
    if (current.length >= 3 || current.includes(id)) return;
    current.push(id);
    newlyAcquired.push(PLAYER_TRAIT_META[id]);
  };

  if (latestBox.tpPct >= 40.0 && latestBox.gp >= 20) {
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
 */
export function getSpecialCampOptions(career: CareerState): {
  id: SpecialCampType;
  title: string;
  subtitle: string;
  costUsd: number;
  effectText: string;
}[] {
  const baseUnit =
    career.league === 'NBA'
      ? 250000
      : career.league === 'OVERSEAS' || career.league === 'KBL'
      ? 45000
      : 15000;

  return [
    {
      id: 'LEGEND_SKILL_CAMP',
      title: '🏆 레전드 스킬 멘토링 캠프',
      subtitle:
        '은퇴한 올스타 레전드의 비공개 워크아웃에 참가해 주력 무기를 가다듬고 잠재력 한계 돌파를 노려요.',
      costUsd: baseUnit,
      effectText: '중점 능력치 +2~3 · 프로 리그 잠재력(POT) +1 확장 기회 · 스카우트 주가 +4',
    },
    {
      id: 'BULK_UP',
      title: '🦍 골밑 파워 벌크업 (신체 개조)',
      subtitle:
        '체중과 근력을 집중 증량해 페인트존 몸싸움과 리바운드 장악력을 끌어올려요 (포워드/빅맨 전향에 유리).',
      costUsd: Math.round(baseUnit * 0.85),
      effectText: 'INS +2, REB +2, PHY +1 상승 · PLY -1, OUT -1 소폭 감소',
    },
    {
      id: 'LEAN_MASS',
      title: '⚡ 퍼리미터 린매스업 (신체 개조)',
      subtitle:
        '체지방을 줄이고 퍼스트 스텝과 외곽 슈팅 밸런스를 극대화해요 (가드/윙맨 전향에 유리).',
      costUsd: Math.round(baseUnit * 0.85),
      effectText: 'PLY +2, OUT +2, DEF +1 상승 · REB -1, INS -1 소폭 감소',
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
} {
  const options = getSpecialCampOptions(career);
  const chosen = options.find((o) => o.id === campType) || options[0];
  const clamp = (v: number) => Math.max(35, Math.min(99, Math.round(v)));
  let nextStats: PlayerStats = { ...career.stats };
  let nextPotential = career.potential;
  let summary = '';

  const isAmateur =
    career.league === 'HIGH_SCHOOL' ||
    career.league === 'U_LEAGUE' ||
    career.league === 'NCAA';

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
        ? `레전드 스킬 캠프 수료! 핵심 능력치 상승 및 잠재력 상한선이 ${nextPotential}(+${potGain})로 확장되었어요!`
        : '레전드 스킬 캠프 수료! 레전드 멘토의 지도로 중점 기술 완성도가 한 단계 높아졌어요!';
  } else if (campType === 'BULK_UP') {
    nextStats.ins = clamp(nextStats.ins + 2);
    nextStats.reb = clamp(nextStats.reb + 2);
    nextStats.phy = clamp(nextStats.phy + 1);
    nextStats.ply = clamp(nextStats.ply - 1);
    nextStats.out = clamp(nextStats.out - 1);
    summary =
      '벌크업 신체 개조 완료! 골밑 파괴력(INS +2, REB +2, PHY +1)이 강화되어 인사이드 경쟁력이 높아졌어요.';
  } else {
    nextStats.ply = clamp(nextStats.ply + 2);
    nextStats.out = clamp(nextStats.out + 2);
    nextStats.def = clamp(nextStats.def + 1);
    nextStats.reb = clamp(nextStats.reb - 1);
    nextStats.ins = clamp(nextStats.ins - 1);
    summary =
      '린매스업 신체 개조 완료! 스피드와 외곽 기술(PLY +2, OUT +2, DEF +1)이 예리해져 가드/윙 포지션 소화력이 상승했어요.';
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
        label: '조숙형 천재',
        badge: '⚡ 조숙형 DNA',
        description: '10대 후반~20대 초반 성장 속도가 매우 빠르지만, 30대 진입 후 노쇠화가 조금 일찍 찾아와요.',
        peakAgeRange: [24, 27],
        agingOnsetOffset: -1,
      };
    case 'LATE_BLOOMER':
      return {
        id: 'LATE_BLOOMER',
        label: '대기만성형',
        badge: '🌱 대기만성 DNA',
        description: '초기 성장은 완만하지만 20대 중후반~30세까지도 기량이 꺾이지 않고 만개해요.',
        peakAgeRange: [27, 31],
        agingOnsetOffset: 1,
      };
    case 'IRONMAN':
      return {
        id: 'IRONMAN',
        label: '철강왕 내구도',
        badge: '🛡️ 철강왕 DNA',
        description: '타고난 강철 몸매로 잔부상 확률이 낮고 30대 중반까지 신체 능력 하락이 크게 억제돼요.',
        peakAgeRange: [26, 32],
        agingOnsetOffset: 2,
      };
    case 'STANDARD':
    default:
      return {
        id: 'STANDARD',
        label: '정통 밸런스형',
        badge: '⚖️ 표준형 DNA',
        description: '20대 중반에 전성기에 도달하고 30대 초반부터 자연스러운 에이징 커브를 겪는 정석적인 성장형이에요.',
        peakAgeRange: [26, 29],
        agingOnsetOffset: 0,
      };
  }
}

/**
 * 플레이 성향 아키타입 메타 정보 반환
 */
export function getPlaystyleInfo(style: PlaystyleArchetype = 'ALL_ROUNDER'): {
  id: PlaystyleArchetype;
  label: string;
  badge: string;
  description: string;
} {
  switch (style) {
    case 'SCORER':
      return {
        id: 'SCORER',
        label: '크리에이티브 스코어러',
        badge: '🔥 스코어러',
        description: '내외곽을 가리지 않고 림을 공략해 득점 볼륨을 책임지는 공격 특화 성향이에요.',
      };
    case 'PLAYMAKER':
      return {
        id: 'PLAYMAKER',
        label: '플로어 제너럴',
        badge: '🪄 플레이메이커',
        description: '넓은 시야와 패스 센스로 동료들의 슛 기회를 살려주는 야전사령관 성향이에요.',
      };
    case 'THREE_AND_D':
      return {
        id: 'THREE_AND_D',
        label: '3&D 스페셜리스트',
        badge: '🎯 3&D 윙맨',
        description: '순도 높은 외곽 3점슛과 끈질긴 대인 수비로 모든 우승권 구단이 탐내는 공수 알짜 성향이에요.',
      };
    case 'RIM_PROTECTOR':
      return {
        id: 'RIM_PROTECTOR',
        label: '림 프로텍터 & 보드 장악',
        badge: '🦍 림 프로텍터',
        description: '골밑 블록슛과 리바운드, 든든한 스크린으로 페인트존을 지배하는 수비형 빅맨 성향이에요.',
      };
    case 'ALL_ROUNDER':
    default:
      return {
        id: 'ALL_ROUNDER',
        label: '공수겸장 올라운더',
        badge: '🌟 올라운더',
        description: '득점, 리바운드, 패스, 수비까지 코트 위 모든 영역에서 고른 효율을 보여주는 다재다능한 성향이에요.',
      };
  }
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

  let playstyle: PlaystyleArchetype = 'ALL_ROUNDER';
  const attackScore = Math.max(stats.ins, stats.out) + (stats.ins + stats.out) * 0.35;
  const playmakeScore = stats.ply * 1.45 + stats.out * 0.2;
  const threeAndDScore = (stats.out + stats.def) * 0.85;
  const rimScore = (stats.reb + stats.def) * 0.85 + (pos === 'C' || pos === 'PF' ? 8 : -6);

  const candidates: { id: PlaystyleArchetype; score: number }[] = [
    { id: 'SCORER', score: attackScore + (rng() * 6 - 3) },
    { id: 'PLAYMAKER', score: playmakeScore + (pos === 'PG' ? 6 : 0) + (rng() * 6 - 3) },
    { id: 'THREE_AND_D', score: threeAndDScore + (pos === 'SG' || pos === 'SF' ? 5 : 0) + (rng() * 6 - 3) },
    { id: 'RIM_PROTECTOR', score: rimScore + (rng() * 6 - 3) },
    {
      id: 'ALL_ROUNDER',
      score:
        ((stats.ins + stats.out + stats.ply + stats.def + stats.reb + stats.phy) / 6) * 1.65 +
        (rng() * 5 - 2.5),
    },
  ];

  candidates.sort((a, b) => b.score - a.score);
  playstyle = candidates[0].id;

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
    coachAdvice = `⚠️ 현재 신장(${heightCm}cm)으로 '${currentPrimary}' 포지션을 소화하기엔 골밑 높이와 리바운드 물리적 열세(미스매치 감점 -${currentMismatch.scoutingPenalty}점)가 너무 커요! 신체 조건에 맞는 '${bestPrimary.pos}' 포지션으로 전향하는 것을 강력히 권고해요.`;
  } else if (bestPrimary.pos !== currentPrimary && bestPrimary.ovr > currentPosOvr) {
    coachAdvice = `현재 기술과 ${heightCm}cm의 신장을 고려하면 '${bestPrimary.pos}' 포지션으로 전향했을 때 OVR이 ${currentPosOvr}에서 ${bestPrimary.ovr}(으)로 상승해요! 인접 포지션 단계별 변경을 고려해 봐요.`;
  } else if (!currentSecondary) {
    coachAdvice = `주포지션 '${currentPrimary}'에 아주 잘 맞고 있어요! 여기에 '${secondBest.pos}' 부포지션까지 소화해주면 로테이션 출전 시간(roleIndex +2.5 보너스)을 훨씬 많이 부여할 수 있어요.`;
  } else {
    coachAdvice = `'${currentPrimary}/${currentSecondary}' 듀얼 포지션 소화 능력 덕분에 팀 전술 운용에 큰 힘이 되고 있어요! 지금처럼 훈련에 매진해 주세요.`;
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
 * 보유 능력치 및 고유 DNA/성향/특성에 따른 자동 배지 부여
 */
export function evaluatePlayerBadges(
  stats: PlayerStats,
  secondaryPos: Position | null,
  growthDna?: GrowthDna,
  playstyle?: PlaystyleArchetype,
  traits?: PlayerTraitId[]
): string[] {
  const badges: string[] = [];
  if (growthDna) {
    badges.push(getGrowthDnaInfo(growthDna).badge);
  }
  if (playstyle) {
    badges.push(getPlaystyleInfo(playstyle).badge);
  }
  if (traits && traits.length > 0) {
    for (const tr of traits) {
      badges.push(getTraitInfo(tr).badge);
    }
  }

  if (stats.out >= 85) badges.push('🎯 데드아이 스나이퍼');
  else if (stats.out >= 75) badges.push('🔥 캐치앤슛 스페셜리스트');

  if (stats.ins >= 85) badges.push('🔨 림 브레이커');
  else if (stats.ins >= 75) badges.push('⚡ 아크로바틱 피니셔');

  if (stats.ply >= 85) badges.push('🧠 플로어 제너럴');
  else if (stats.ply >= 75) badges.push('🪄 다임 드로퍼');

  if (stats.def >= 85) badges.push('🔒 1군 락다운 디펜더');
  else if (stats.def >= 75) badges.push('🛡️ 퍼리미터 스토퍼');

  if (stats.reb >= 85) badges.push('🦍 보드 지배자');
  else if (stats.reb >= 75) badges.push('🧲 리바운드 허슬러');

  if (stats.phy >= 85) badges.push('🚀 강철의 운동능력');

  if (secondaryPos) {
    badges.push(`🔄 듀얼 포지션 (${secondaryPos} 겸임)`);
  }

  return badges;
}
