import { PlayerStats, Position } from '../types/game';

export const POSITION_LABELS: Record<Position, string> = {
  PG: '포인트가드 (PG)',
  SG: '슈팅가드 (SG)',
  SF: '스몰포워드 (SF)',
  PF: '파워포워드 (PF)',
  C: '센터 (C)',
};

export const POSITION_HEIGHT_RANGES: Record<
  Position,
  { min: number; max: number; optimalMin: number; optimalMax: number; defaultCm: number }
> = {
  PG: { min: 168, max: 222, optimalMin: 176, optimalMax: 195, defaultCm: 186 },
  SG: { min: 168, max: 222, optimalMin: 185, optimalMax: 201, defaultCm: 193 },
  SF: { min: 168, max: 222, optimalMin: 193, optimalMax: 206, defaultCm: 199 },
  PF: { min: 168, max: 222, optimalMin: 198, optimalMax: 211, defaultCm: 204 },
  C: { min: 168, max: 222, optimalMin: 204, optimalMax: 222, defaultCm: 210 },
};

export interface PositionArchetypeInfo {
  pos: Position;
  name: string;
  title: string;
  description: string;
  recommendedHeightRange: [number, number];
  defaultHeightCm: number;
  baseStats: PlayerStats;
  ovrWeights: PlayerStats;
  keyStats: (keyof PlayerStats)[];
}

export const POSITION_ARCHETYPES: Record<Position, PositionArchetypeInfo> = {
  PG: {
    pos: 'PG',
    name: '포인트가드 (PG)',
    title: '볼핸들링 · 경기 조율형',
    description: '볼핸들링과 패스 시야를 바탕으로 팀 공격 템포를 조절하고 외곽 슈팅으로 공간을 여는 포지션입니다.',
    recommendedHeightRange: [
      POSITION_HEIGHT_RANGES.PG.optimalMin,
      POSITION_HEIGHT_RANGES.PG.optimalMax,
    ],
    defaultHeightCm: POSITION_HEIGHT_RANGES.PG.defaultCm,
    baseStats: { ins: 52, out: 56, ply: 62, def: 52, reb: 41, phy: 55 },
    ovrWeights: { ins: 0.14, out: 0.24, ply: 0.28, def: 0.15, reb: 0.04, phy: 0.15 },
    keyStats: ['ply', 'out', 'phy'],
  },
  SG: {
    pos: 'SG',
    name: '슈팅가드 (SG)',
    title: '외곽 슈팅 · 돌파 스코어러',
    description: '캐치앤슛 3점과 온볼 돌파로 팀의 주요 득점 루트를 맡는 백코트 득점 포지션입니다.',
    recommendedHeightRange: [
      POSITION_HEIGHT_RANGES.SG.optimalMin,
      POSITION_HEIGHT_RANGES.SG.optimalMax,
    ],
    defaultHeightCm: POSITION_HEIGHT_RANGES.SG.defaultCm,
    baseStats: { ins: 56, out: 60, ply: 52, def: 52, reb: 45, phy: 56 },
    ovrWeights: { ins: 0.22, out: 0.28, ply: 0.14, def: 0.15, reb: 0.06, phy: 0.15 },
    keyStats: ['out', 'ins', 'phy'],
  },
  SF: {
    pos: 'SF',
    name: '스몰포워드 (SF)',
    title: '공수 겸비 올라운드 윙',
    description: '내외곽 득점, 스위치 수비, 리바운드 가담까지 균형 있게 수행하는 멀티 윙 포지션입니다.',
    recommendedHeightRange: [
      POSITION_HEIGHT_RANGES.SF.optimalMin,
      POSITION_HEIGHT_RANGES.SF.optimalMax,
    ],
    defaultHeightCm: POSITION_HEIGHT_RANGES.SF.defaultCm,
    baseStats: { ins: 56, out: 56, ply: 51, def: 56, reb: 53, phy: 56 },
    ovrWeights: { ins: 0.2, out: 0.2, ply: 0.14, def: 0.18, reb: 0.13, phy: 0.15 },
    keyStats: ['out', 'ins', 'def'],
  },
  PF: {
    pos: 'PF',
    name: '파워포워드 (PF)',
    title: '인사이드 · 스트레치 빅',
    description: '골밑 피니시와 보드 경합, 외곽 스페이싱을 병행해 프론트코트 균형을 잡는 포지션입니다.',
    recommendedHeightRange: [
      POSITION_HEIGHT_RANGES.PF.optimalMin,
      POSITION_HEIGHT_RANGES.PF.optimalMax,
    ],
    defaultHeightCm: POSITION_HEIGHT_RANGES.PF.defaultCm,
    baseStats: { ins: 58, out: 50, ply: 46, def: 55, reb: 59, phy: 57 },
    ovrWeights: { ins: 0.24, out: 0.13, ply: 0.09, def: 0.17, reb: 0.22, phy: 0.15 },
    keyStats: ['ins', 'reb', 'def'],
  },
  C: {
    pos: 'C',
    name: '센터 (C)',
    title: '림 프로텍션 · 포스트 앵커',
    description: '높이와 몸싸움을 앞세워 리바운드, 스크린, 림 수비의 축을 담당하는 골밑 포지션입니다.',
    recommendedHeightRange: [
      POSITION_HEIGHT_RANGES.C.optimalMin,
      POSITION_HEIGHT_RANGES.C.optimalMax,
    ],
    defaultHeightCm: POSITION_HEIGHT_RANGES.C.defaultCm,
    baseStats: { ins: 61, out: 43, ply: 43, def: 57, reb: 63, phy: 58 },
    ovrWeights: { ins: 0.26, out: 0.07, ply: 0.07, def: 0.19, reb: 0.26, phy: 0.15 },
    keyStats: ['reb', 'ins', 'def'],
  },
};

export function getHeightModifiers(heightCm: number): {
  statModifiers: PlayerStats;
  label: string;
  physicsDesc: string;
} {
  const deltaFrom195 = heightCm - 195;
  const statModifiers: PlayerStats = {
    ins: Math.round(deltaFrom195 * 0.28),
    out: Math.round(-deltaFrom195 * 0.18),
    ply: Math.round(-deltaFrom195 * 0.32),
    def: Math.round(deltaFrom195 * 0.08),
    reb: Math.round(deltaFrom195 * 0.42),
    phy: Math.round(-Math.abs(deltaFrom195) * 0.06),
  };

  let label = '표준 밸런스 체격';
  let physicsDesc = '기동력과 타점이 고르게 배분된 표준 체격입니다.';
  if (heightCm <= 182) {
    label = '저중심 스피드형';
    physicsDesc = '무게중심이 낮아 볼핸들링과 방향 전환에 유리하지만 골밑 경합과 타점에서 불리합니다.';
  } else if (heightCm >= 210) {
    label = '장신 타점 우위형';
    physicsDesc = '높은 타점과 림 수비에서 강점이 크지만 드리블 궤적이 길고 민첩성 부담이 큽니다.';
  }

  return { statModifiers, label, physicsDesc };
}
