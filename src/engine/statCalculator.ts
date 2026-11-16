import { getHeightModifiers, POSITION_ARCHETYPES } from '../data/archetypes';
import { PlayerStats, Position } from '../types/game';

/**
 * 포지션별 가중치에 따른 종합 능력치(OVR) 산출
 */
export function calculateOvr(stats: PlayerStats, pos: Position): number {
  const weights = POSITION_ARCHETYPES[pos].ovrWeights;
  const weighted =
    stats.ins * weights.ins +
    stats.out * weights.out +
    stats.ply * weights.ply +
    stats.def * weights.def +
    stats.reb * weights.reb +
    stats.phy * weights.phy;

  return Math.max(40, Math.min(99, Math.round(weighted)));
}

/**
 * 캐릭터 생성 전 미리보기용 기준 능력치 및 예상 OVR 범위 산출
 * (실제 생성 시에는 개체별 무작위 편차 -4 ~ +5 및 초기 재능 편차가 적용됨)
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

  const baselineStats: PlayerStats = {
    ins: clamp(base.ins + statModifiers.ins),
    out: clamp(base.out + statModifiers.out),
    ply: clamp(base.ply + statModifiers.ply),
    def: clamp(base.def + statModifiers.def),
    reb: clamp(base.reb + statModifiers.reb),
    phy: clamp(base.phy + statModifiers.phy),
  };

  const baseOvr = calculateOvr(baselineStats, pos);
  const minOvr = Math.max(46, baseOvr - 5);
  const maxOvr = Math.min(62, baseOvr + 5);

  return { baselineStats, minOvr, maxOvr };
}

/**
 * 캐릭터 생성 시 기본 포지션 아키타입 + 신장(cm) 물리 보정 +
 * 각 6대 능력치 개체별 무작위 편차(-4 ~ +5)와 초기 재능 편차를 결합하여
 * 생성할 때마다 초기 스탯과 초기 OVR(약 48~61 범위)이 랜덤으로 결정되게 함
 */
export function createInitialStats(
  pos: Position,
  heightCm: number,
  rng: () => number = Math.random
): PlayerStats {
  const base = POSITION_ARCHETYPES[pos].baseStats;
  const { statModifiers } = getHeightModifiers(heightCm);

  // 개체별 초기 재능 편차 (-2 ~ +2)
  const talentOffset = Math.floor(rng() * 5) - 2;
  // 각 스탯별 무작위 편차 (-4 ~ +5)
  const randStatVariance = () => Math.floor(rng() * 10) - 4;
  const clamp = (v: number) => Math.max(36, Math.min(72, Math.round(v)));

  return {
    ins: clamp(base.ins + statModifiers.ins + talentOffset + randStatVariance()),
    out: clamp(base.out + statModifiers.out + talentOffset + randStatVariance()),
    ply: clamp(base.ply + statModifiers.ply + talentOffset + randStatVariance()),
    def: clamp(base.def + statModifiers.def + talentOffset + randStatVariance()),
    reb: clamp(base.reb + statModifiers.reb + talentOffset + randStatVariance()),
    phy: clamp(base.phy + statModifiers.phy + talentOffset + randStatVariance()),
  };
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
      const rawOvr = calculateOvr(stats, p);
      const [minH, maxH] = POSITION_ARCHETYPES[p].recommendedHeightRange;
      let heightFitBonus = 0;
      if (heightCm >= minH && heightCm <= maxH) {
        heightFitBonus = 1.5;
      } else if (Math.abs(heightCm - minH) > 10 && Math.abs(heightCm - maxH) > 10) {
        heightFitBonus = -2.0;
      }
      return {
        pos: p,
        ovr: rawOvr,
        fitScore: rawOvr + heightFitBonus,
      };
    })
    .sort((a, b) => b.fitScore - a.fitScore);

  const bestPrimary = ranked[0];
  const secondBest = ranked.find((r) => r.pos !== currentPrimary) || ranked[1];
  const currentPosOvr = calculateOvr(stats, currentPrimary);

  const canUnlockSecondary =
    currentSecondary === null && (coachTrust >= 55 || secondBest.ovr >= 56);

  let coachAdvice = '';
  if (bestPrimary.pos !== currentPrimary && bestPrimary.ovr > currentPosOvr) {
    coachAdvice = `현재 기술과 ${heightCm}cm의 신장을 고려하면 '${bestPrimary.pos}' 포지션으로 전향했을 때 OVR이 ${currentPosOvr}에서 ${bestPrimary.ovr}(으)로 상승해요! 포지션 변경을 진지하게 고려해 봐요.`;
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
 * 보유 능력치에 따른 자동 배지 부여
 */
export function evaluatePlayerBadges(stats: PlayerStats, secondaryPos: Position | null): string[] {
  const badges: string[] = [];
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
