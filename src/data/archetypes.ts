import { PlayerStats, Position } from '../types/game';

export interface PositionArchetype {
  position: Position;
  koreanName: string;
  englishName: string;
  tagline: string;
  description: string;
  recommendedHeightRange: [number, number];
  defaultHeightCm: number;
  baseStats: PlayerStats;
  ovrWeights: {
    ins: number;
    out: number;
    ply: number;
    def: number;
    reb: number;
    phy: number;
  };
  keyStrengths: string[];
}

export const POSITION_ARCHETYPES: Record<Position, PositionArchetype> = {
  PG: {
    position: 'PG',
    koreanName: '포인트 가드',
    englishName: 'Point Guard',
    tagline: '코트 위의 야전사령관해요',
    description:
      '빠른 스피드와 넓은 시야로 팀 공격을 조립하고 외곽 픽앤롤을 주도하는 앞선의 핵심 포지션이에요.',
    recommendedHeightRange: [175, 193],
    defaultHeightCm: 185,
    baseStats: {
      ins: 48,
      out: 55,
      ply: 59,
      def: 49,
      reb: 38,
      phy: 54,
    },
    ovrWeights: {
      ins: 0.14,
      out: 0.25,
      ply: 0.30,
      def: 0.13,
      reb: 0.04,
      phy: 0.14,
    },
    keyStrengths: ['픽앤롤 전개', '외곽 3점 풀업', '스틸 & 속공 리드'],
  },
  SG: {
    position: 'SG',
    koreanName: '슈팅 가드',
    englishName: 'Shooting Guard',
    tagline: '순도 높은 외곽의 해결사해요',
    description:
      '스크린을 타고 돌아 나오는 3점슛과 날카로운 돌파로 상대 수비에 균열을 내는 득점원이에요.',
    recommendedHeightRange: [185, 198],
    defaultHeightCm: 192,
    baseStats: {
      ins: 53,
      out: 58,
      ply: 49,
      def: 50,
      reb: 42,
      phy: 53,
    },
    ovrWeights: {
      ins: 0.22,
      out: 0.30,
      ply: 0.14,
      def: 0.14,
      reb: 0.06,
      phy: 0.14,
    },
    keyStrengths: ['캐치앤슛 3점', '아이솔레이션 돌파', '퍼리미터 수비'],
  },
  SF: {
    position: 'SF',
    koreanName: '스몰 포워드',
    englishName: 'Small Forward',
    tagline: '공수 겸장 올라운더 윙맨해요',
    description:
      '내외곽 득점과 대인 수비, 리바운드 가담까지 코트 전역을 누비는 전천후 에이스 포지션이에요.',
    recommendedHeightRange: [193, 205],
    defaultHeightCm: 198,
    baseStats: {
      ins: 54,
      out: 53,
      ply: 48,
      def: 53,
      reb: 50,
      phy: 53,
    },
    ovrWeights: {
      ins: 0.22,
      out: 0.22,
      ply: 0.14,
      def: 0.18,
      reb: 0.10,
      phy: 0.14,
    },
    keyStrengths: ['내외곽 전천후 득점', '에이스 스토퍼 수비', '트랜지션 피니시'],
  },
  PF: {
    position: 'PF',
    koreanName: '파워 포워드',
    englishName: 'Power Forward',
    tagline: '강인한 보드 장악과 스트레치 빅맨해요',
    description:
      '페인트존 몸싸움과 리바운드를 책임지면서 외곽 스트레치 슈팅까지 위협하는 현대 농구의 핵심축이에요.',
    recommendedHeightRange: [198, 210],
    defaultHeightCm: 203,
    baseStats: {
      ins: 57,
      out: 47,
      ply: 43,
      def: 54,
      reb: 57,
      phy: 54,
    },
    ovrWeights: {
      ins: 0.25,
      out: 0.14,
      ply: 0.09,
      def: 0.18,
      reb: 0.20,
      phy: 0.14,
    },
    keyStrengths: ['파워 포스트업 & 림어택', '공수 리바운드 장악', '스트레치 4 코너 3점'],
  },
  C: {
    position: 'C',
    koreanName: '센터',
    englishName: 'Center',
    tagline: '골밑을 지배하는 최후의 수호신해요',
    description:
      '압도적인 높이와 림 프로텍팅, 스크린과 골밑 마무리로 페인트존을 통제하는 빅맨이에요.',
    recommendedHeightRange: [204, 220],
    defaultHeightCm: 209,
    baseStats: {
      ins: 59,
      out: 41,
      ply: 40,
      def: 56,
      reb: 61,
      phy: 53,
    },
    ovrWeights: {
      ins: 0.27,
      out: 0.08,
      ply: 0.07,
      def: 0.21,
      reb: 0.25,
      phy: 0.12,
    },
    keyStrengths: ['림 프로텍팅 & 블록슛', '공격 리바운드 풋백', '픽앤롤 롤맨 피니시'],
  },
};

export interface HeightModifierResult {
  statModifiers: {
    ins: number;
    out: number;
    ply: number;
    def: number;
    reb: number;
    phy: number;
  };
  heightLabel: string;
  physicsComment: string;
}

/**
 * 신장(168cm ~ 220cm)에 따른 물리 보정 계산 테이블
 * - 단신일수록 볼핸들링(PLY), 외곽슛(OUT), 민첩성(PHY)에 이점, 리바운드(REB) 및 골밑(INS) 페널티
 * - 장신일수록 리바운드(REB), 골밑 마무리(INS), 블록/림보호(DEF)에 이점, 기동성(PHY) 및 볼핸들링(PLY) 페널티
 */
export function getHeightModifiers(heightCm: number): HeightModifierResult {
  const clamped = Math.max(168, Math.min(220, heightCm));
  const deltaFrom195 = clamped - 195; // 195cm를 밸런스 기준점으로 설정

  const ins = Math.round(deltaFrom195 * 0.24);
  const out = Math.round(-deltaFrom195 * 0.18);
  const ply = Math.round(-deltaFrom195 * 0.28);
  const def = Math.round(deltaFrom195 * 0.12);
  const reb = Math.round(deltaFrom195 * 0.36);
  const phy = Math.round(-Math.abs(clamped - 192) * 0.12 + (clamped <= 188 ? 2 : -1));

  let heightLabel = '스탠다드 윙 프레임';
  let physicsComment = '공수 밸런스가 이상적인 현대 농구 표준 신장이에요.';

  if (clamped <= 178) {
    heightLabel = '초단신 스피드스터';
    physicsComment = '낮은 무게중심으로 드리블과 3점슛이 날카롭지만, 골밑 경합과 수비 미스매치 극복이 과제예요.';
  } else if (clamped <= 188) {
    heightLabel = '테크니컬 가드 프레임';
    physicsComment = '빠른 퍼스트 스텝과 패스 시야, 외곽 슈팅 감각이 돋보이는 정통 가드 체형이에요.';
  } else if (clamped <= 198) {
    heightLabel = '스탠다드 윙 프레임';
    physicsComment = '1번부터 3번까지 스위치 수비와 외곽 공격을 모두 소화할 수 있는 황금 밸런스 신장이에요.';
  } else if (clamped <= 207) {
    heightLabel = '모던 포워드 / 스트레치 빅';
    physicsComment = '리바운드 장악력과 인사이드 피니시가 강력하며, 기동성까지 갖춘 장신 포워드 프레임이에요.';
  } else {
    heightLabel = '압도적 타워 빅맨';
    physicsComment = '존재만으로 골밑을 지배하고 리바운드와 블록슛에서 절대 우위를 점하지만, 외곽 기동성 관리가 중요해요.';
  }

  return {
    statModifiers: { ins, out, ply, def, reb, phy },
    heightLabel,
    physicsComment,
  };
}
