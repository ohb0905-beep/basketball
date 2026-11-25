import type { CareerState, SeasonBoxScore } from '../types/game';

/**
 * NCAA '신입 적응' 목표
 * - NCAA 첫 시즌(신입생)에만 열리는 시즌 목표입니다.
 * - 로테이션 정착(출전 시간)과 신인왕 레이스 상위권 두 가지를 노리고,
 *   달성한 만큼 드래프트 스카우트 주가 보너스를 받습니다.
 */
export const FRESHMAN_ADAPTATION_CONFIG = {
  rotationMinMpg: 15,
  royTopRank: 3,
  stockBonusPerGoal: 3,
  stockBonusAllClear: 2,
} as const;

export interface FreshmanAdaptationGoal {
  id: 'ROTATION' | 'ROY_RACE';
  label: string;
  achieved: boolean;
  detail: string;
}

export interface FreshmanAdaptationResult {
  goals: FreshmanAdaptationGoal[];
  achievedCount: number;
  draftStockBonus: number;
}

export function isNcaaFreshmanSeason(
  career: Pick<CareerState, 'league' | 'seasonLogs'>
): boolean {
  return (
    career.league === 'NCAA' &&
    !(career.seasonLogs || []).some((l) => l.league === 'NCAA')
  );
}

/** 시즌 시작 전 보여줄 목표 문구 */
export function describeFreshmanAdaptationGoals(): Array<
  Pick<FreshmanAdaptationGoal, 'id' | 'label'>
> {
  const cfg = FRESHMAN_ADAPTATION_CONFIG;
  return [
    { id: 'ROTATION', label: `로테이션 정착 · 평균 ${cfg.rotationMinMpg}분 이상 출전` },
    { id: 'ROY_RACE', label: `신인왕 레이스 TOP ${cfg.royTopRank} 진입` },
  ];
}

export function evaluateFreshmanAdaptation(
  boxScore: Pick<SeasonBoxScore, 'mpg' | 'playerRoyRank' | 'wonRookieOfYear'>
): FreshmanAdaptationResult {
  const cfg = FRESHMAN_ADAPTATION_CONFIG;
  const royRank = boxScore.wonRookieOfYear ? 1 : boxScore.playerRoyRank ?? null;
  const rotationOk = boxScore.mpg >= cfg.rotationMinMpg;
  const royOk = royRank !== null && royRank <= cfg.royTopRank;
  const [rotationLabel, royLabel] = describeFreshmanAdaptationGoals();
  const goals: FreshmanAdaptationGoal[] = [
    {
      ...rotationLabel,
      achieved: rotationOk,
      detail: `평균 ${boxScore.mpg}분 출전`,
    },
    {
      ...royLabel,
      achieved: royOk,
      detail:
        royRank !== null ? `신인왕 투표 ${royRank}위` : '신인왕 투표 순위권 밖',
    },
  ];
  const achievedCount = goals.filter((g) => g.achieved).length;
  const draftStockBonus =
    achievedCount * cfg.stockBonusPerGoal +
    (achievedCount === goals.length ? cfg.stockBonusAllClear : 0);
  return { goals, achievedCount, draftStockBonus };
}
