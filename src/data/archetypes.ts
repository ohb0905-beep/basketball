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
    title: '코트 위의 야전사령관 (Floor General)',
    description: '정교한 볼핸들링과 시야로 팀 공격을 조율하고 외곽 슈팅으로 수비를 흔드는 사령탑이에요.',
    recommendedHeightRange: [176, 195],
    defaultHeightCm: 186,
    baseStats: { ins: 52, out: 56, ply: 62, def: 52, reb: 41, phy: 55 },
    ovrWeights: { ins: 0.14, out: 0.24, ply: 0.28, def: 0.15, reb: 0.04, phy: 0.15 },
    keyStats: ['ply', 'out', 'phy'],
  },
  SG: {
    pos: 'SG',
    name: '슈팅가드 (SG)',
    title: '폭발적인 외곽 스코어러 (Sharpshooter & Slasher)',
    description: '정교한 3점슛과 날카로운 돌파로 팀의 주득점원 역할을 수행하는 백코트 에이스예요.',
    recommendedHeightRange: [185, 201],
    defaultHeightCm: 193,
    baseStats: { ins: 56, out: 60, ply: 52, def: 52, reb: 45, phy: 56 },
    ovrWeights: { ins: 0.22, out: 0.28, ply: 0.14, def: 0.15, reb: 0.06, phy: 0.15 },
    keyStats: ['out', 'ins', 'phy'],
  },
  SF: {
    pos: 'SF',
    name: '스몰포워드 (SF)',
    title: '공수겸장 올라운드 윙 (Two-Way Wing)',
    description: '내외곽 득점과 대인 수비, 리바운드 가담까지 코트 전역을 지배하는 다재다능한 에이스예요.',
    recommendedHeightRange: [193, 206],
    defaultHeightCm: 199,
    baseStats: { ins: 56, out: 56, ply: 51, def: 56, reb: 53, phy: 56 },
    ovrWeights: { ins: 0.2, out: 0.2, ply: 0.14, def: 0.18, reb: 0.13, phy: 0.15 },
    keyStats: ['out', 'ins', 'def'],
  },
  PF: {
    pos: 'PF',
    name: '파워포워드 (PF)',
    title: '기동력과 파워의 인사이드·스트레치 빅 (Modern Forward)',
    description: '강력한 보드 장악력과 골밑 피니시, 스트레치 슈팅으로 공수 밸런스를 잡아주는 프론트코트의 핵심이에요.',
    recommendedHeightRange: [198, 211],
    defaultHeightCm: 204,
    baseStats: { ins: 58, out: 50, ply: 46, def: 55, reb: 59, phy: 57 },
    ovrWeights: { ins: 0.24, out: 0.13, ply: 0.09, def: 0.17, reb: 0.22, phy: 0.15 },
    keyStats: ['ins', 'reb', 'def'],
  },
  C: {
    pos: 'C',
    name: '센터 (C)',
    title: '페인트존의 지배자 (Rim Protector & Post Anchor)',
    description: '압도적인 높이와 림 프로텍팅, 리바운드와 포스트업으로 골밑을 장악하는 최후의 보루예요.',
    recommendedHeightRange: [204, 222],
    defaultHeightCm: 210,
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

  let label = '밸런스형 피지컬';
  let physicsDesc = '공수 밸런스와 기동력·타점이 조화를 이루는 표준 체격이에요.';
  if (heightCm <= 182) {
    label = '초저중심 스피드스터';
    physicsDesc = '낮은 무게중심으로 볼핸들링과 방향전환이 매우 빠르지만 골밑 경합과 타점에서 불리해요.';
  } else if (heightCm >= 210) {
    label = '초장신 타점 지배자';
    physicsDesc = '압도적인 타점과 림 프로텍팅을 자랑하지만 드리블 궤적이 길고 민첩성 소모가 커요.';
  }

  return { statModifiers, label, physicsDesc };
}
