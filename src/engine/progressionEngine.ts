import {
  CareerState,
  RelationshipAxis,
  RelationshipMetrics,
  StoryArcId,
  StoryArcState,
} from '../types/game';
import { clampNum } from '../config/balanceConfig';

export const RELATIONSHIP_LABELS: Record<RelationshipAxis, string> = {
  coachTrust: '감독 신뢰도',
  lockerRoom: '라커룸 케미',
  frontOffice: '구단 프런트',
  mediaFan: '언론·팬 평판',
};

export function createInitialRelationships(
  coachTrust: number = 50,
  fanPopularity: number = 15
): RelationshipMetrics {
  const safeCoachTrust = Number.isFinite(coachTrust) ? coachTrust : 50;
  const safeFanPop = Number.isFinite(fanPopularity) ? fanPopularity : 15;
  return {
    coachTrust: clampNum(Math.round(safeCoachTrust), 15, 100),
    lockerRoom: 54,
    frontOffice: 52,
    mediaFan: clampNum(Math.round(40 + safeFanPop * 0.4), 25, 95),
  };
}

export function getEffectiveRelationships(
  career: Pick<CareerState, 'relationships' | 'coachTrust' | 'fanPopularity'>
): RelationshipMetrics {
  const base = createInitialRelationships(
    career.coachTrust,
    career.fanPopularity || 15
  );
  if (!career.relationships) {
    return base;
  }
  const rel = career.relationships;
  const resolvedCoachTrust = Number.isFinite(career.coachTrust)
    ? career.coachTrust
    : Number.isFinite(rel.coachTrust)
    ? rel.coachTrust
    : base.coachTrust;
  const resolvedLocker = Number.isFinite(rel.lockerRoom)
    ? rel.lockerRoom
    : base.lockerRoom;
  const resolvedFront = Number.isFinite(rel.frontOffice)
    ? rel.frontOffice
    : base.frontOffice;
  const resolvedMedia = Number.isFinite(rel.mediaFan)
    ? rel.mediaFan
    : base.mediaFan;

  return {
    coachTrust: clampNum(Math.round(resolvedCoachTrust), 15, 100),
    lockerRoom: clampNum(Math.round(resolvedLocker), 15, 100),
    frontOffice: clampNum(Math.round(resolvedFront), 15, 100),
    mediaFan: clampNum(Math.round(resolvedMedia), 15, 100),
  };
}

export function applyRelationshipDelta(
  current: RelationshipMetrics,
  delta?: Partial<RelationshipMetrics>,
  coachTrustDelta: number = 0
): RelationshipMetrics {
  const baseCoach = Number.isFinite(current.coachTrust) ? current.coachTrust : 50;
  const baseLocker = Number.isFinite(current.lockerRoom) ? current.lockerRoom : 54;
  const baseFront = Number.isFinite(current.frontOffice) ? current.frontOffice : 52;
  const baseMedia = Number.isFinite(current.mediaFan) ? current.mediaFan : 46;
  return {
    coachTrust: clampNum(
      Math.round(baseCoach + (delta?.coachTrust ?? 0) + coachTrustDelta),
      15,
      100
    ),
    lockerRoom: clampNum(
      Math.round(baseLocker + (delta?.lockerRoom ?? 0)),
      15,
      100
    ),
    frontOffice: clampNum(
      Math.round(baseFront + (delta?.frontOffice ?? 0)),
      15,
      100
    ),
    mediaFan: clampNum(
      Math.round(baseMedia + (delta?.mediaFan ?? 0)),
      15,
      100
    ),
  };
}

/**
 * career.coachTrust와 career.relationships.coachTrust의 단일 진실 원천 동기화 헬퍼
 */
export function syncCareerRelationships(
  career: Pick<CareerState, 'relationships' | 'coachTrust' | 'fanPopularity'>,
  delta?: Partial<RelationshipMetrics>,
  coachTrustDelta: number = 0
): { relationships: RelationshipMetrics; coachTrust: number } {
  const current = getEffectiveRelationships(career);
  const next = applyRelationshipDelta(current, delta, coachTrustDelta);
  return {
    relationships: next,
    coachTrust: next.coachTrust,
  };
}

export function createInitialStoryArcs(): Record<StoryArcId, StoryArcState> {
  return {
    COACH_TACTICS_ARC: {
      id: 'COACH_TACTICS_ARC',
      title: '전술 철학의 충돌과 완성',
      stage: 0,
      maxStage: 3,
      completed: false,
      lastTriggeredYear: null,
      summary: '감독의 전술 시스템 안에서 역할을 증명하고 팀의 심장으로 자리 잡는 서사',
    },
    RIVAL_DESTINY_ARC: {
      id: 'RIVAL_DESTINY_ARC',
      title: '숙명의 라이벌리 3부작',
      stage: 0,
      maxStage: 3,
      completed: false,
      lastTriggeredYear: null,
      summary: '리그 최정상 경쟁자와의 맞대결을 거쳐 시대의 기준을 세우는 서사',
    },
    BRAND_EMPIRE_ARC: {
      id: 'BRAND_EMPIRE_ARC',
      title: '시그니처 브랜드와 레거시',
      stage: 0,
      maxStage: 3,
      completed: false,
      lastTriggeredYear: null,
      summary: '코트 밖 상업적 압박과 경기력 사이의 균형을 맞추며 자신만의 제국을 세우는 서사',
    },
    NATIONAL_TORCH_ARC: {
      id: 'NATIONAL_TORCH_ARC',
      title: '태극마크 세대교체의 횃불',
      stage: 0,
      maxStage: 3,
      completed: false,
      lastTriggeredYear: null,
      summary: '대한민국 국가대표팀의 새 리더로 성장해 국제 무대의 벽에 도전하는 서사',
    },
  };
}

export function getEffectiveStoryArcs(
  career: Pick<CareerState, 'storyArcs'>
): Record<StoryArcId, StoryArcState> {
  const base = createInitialStoryArcs();
  if (!career.storyArcs) return base;
  return {
    COACH_TACTICS_ARC: {
      ...base.COACH_TACTICS_ARC,
      ...(career.storyArcs.COACH_TACTICS_ARC || {}),
    },
    RIVAL_DESTINY_ARC: {
      ...base.RIVAL_DESTINY_ARC,
      ...(career.storyArcs.RIVAL_DESTINY_ARC || {}),
    },
    BRAND_EMPIRE_ARC: {
      ...base.BRAND_EMPIRE_ARC,
      ...(career.storyArcs.BRAND_EMPIRE_ARC || {}),
    },
    NATIONAL_TORCH_ARC: {
      ...base.NATIONAL_TORCH_ARC,
      ...(career.storyArcs.NATIONAL_TORCH_ARC || {}),
    },
  };
}
