import {
  CareerState,
  RelationshipAxis,
  RelationshipMetrics,
  StoryArcId,
  StoryArcState,
} from '../types/game';

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

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
  return {
    coachTrust: clamp(Math.round(coachTrust), 15, 100),
    lockerRoom: 54,
    frontOffice: 52,
    mediaFan: clamp(Math.round(40 + fanPopularity * 0.4), 25, 95),
  };
}

export function getEffectiveRelationships(
  career: Pick<CareerState, 'relationships' | 'coachTrust' | 'fanPopularity'>
): RelationshipMetrics {
  if (career.relationships) {
    return {
      coachTrust: clamp(Math.round(career.coachTrust), 15, 100),
      lockerRoom: clamp(Math.round(career.relationships.lockerRoom), 15, 100),
      frontOffice: clamp(Math.round(career.relationships.frontOffice), 15, 100),
      mediaFan: clamp(Math.round(career.relationships.mediaFan), 15, 100),
    };
  }
  return createInitialRelationships(career.coachTrust, career.fanPopularity || 15);
}

export function applyRelationshipDelta(
  current: RelationshipMetrics,
  delta?: Partial<RelationshipMetrics>,
  coachTrustDelta: number = 0
): RelationshipMetrics {
  return {
    coachTrust: clamp(
      Math.round(current.coachTrust + (delta?.coachTrust ?? 0) + coachTrustDelta),
      15,
      100
    ),
    lockerRoom: clamp(
      Math.round(current.lockerRoom + (delta?.lockerRoom ?? 0)),
      15,
      100
    ),
    frontOffice: clamp(
      Math.round(current.frontOffice + (delta?.frontOffice ?? 0)),
      15,
      100
    ),
    mediaFan: clamp(
      Math.round(current.mediaFan + (delta?.mediaFan ?? 0)),
      15,
      100
    ),
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
