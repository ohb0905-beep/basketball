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

export type NationalTeamRetirementTier =
  | 'HONORABLE'
  | 'RESPECTED'
  | 'EARLY_CONTROVERSY';

export interface NationalTeamRetirementOutcome {
  tier: NationalTeamRetirementTier;
  mediaFanDelta: number;
  lockerRoomDelta: number;
  reactionTitle: string;
  reactionSummary: string;
  milestoneDescription: string;
  caps: number;
  totalMedals: number;
}

/**
 * 국가대표 은퇴 시점의 만 나이·A매치 경력·메달·국대 아크 완결 여부에 따라
 * 여론(언론·팬심, 라커룸) 반응과 공식 기록 문구를 산출합니다.
 */
export function evaluateNationalTeamRetirement(
  career: Pick<
    CareerState,
    | 'age'
    | 'seasonYear'
    | 'totals'
    | 'storyArcs'
    | 'militaryExempt'
    | 'militaryServiceSeasonsLeft'
  >
): NationalTeamRetirementOutcome {
  const caps = career.totals?.internationalCaps || 0;
  const medals = career.totals?.internationalMedals || {
    gold: 0,
    silver: 0,
    bronze: 0,
  };
  const totalMedals = medals.gold + medals.silver + medals.bronze;
  const natArcCompleted = Boolean(career.storyArcs?.NATIONAL_TORCH_ARC?.completed);

  const medalParts: string[] = [];
  if (medals.gold > 0) medalParts.push(`금 ${medals.gold}`);
  if (medals.silver > 0) medalParts.push(`은 ${medals.silver}`);
  if (medals.bronze > 0) medalParts.push(`동 ${medals.bronze}`);
  const careerRecordTag =
    caps > 0
      ? medalParts.length > 0
        ? `A매치 ${caps}경기 (${medalParts.join(' · ')})`
        : `A매치 ${caps}경기`
      : 'A매치 미출전';

  if (career.age >= 31 || totalMedals >= 1 || caps >= 12 || natArcCompleted) {
    const reactionSummary =
      totalMedals > 0
        ? `${careerRecordTag}의 빛나는 헌신을 남긴 채 명예롭게 태극마크를 내려놓았습니다. 팬들과 언론이 뜨거운 박수로 배웅했습니다.`
        : caps > 0
        ? `만 ${career.age}세까지 ${careerRecordTag}를 소화하며 한국 농구에 헌신한 노고를 인정받아 박수 속에 대표팀에서 물러났습니다.`
        : `만 ${career.age}세 베테랑으로서 소속팀 커리어 마무리에 집중하겠다는 결단을 내렸고, 팬들과 언론도 이를 존중했습니다.`;

    return {
      tier: 'HONORABLE',
      mediaFanDelta: 6,
      lockerRoomDelta: 3,
      reactionTitle: '태극마크 헌정에 쏟아진 박수',
      reactionSummary,
      milestoneDescription: `만 ${career.age}세에 대한민국 국가대표 은퇴를 공식 선언했습니다. (${careerRecordTag}) ${reactionSummary}`,
      caps,
      totalMedals,
    };
  }

  if (career.age >= 26 && caps >= 1) {
    const reactionSummary = `만 ${career.age}세에 대표팀 은퇴를 선언하자 팬들 사이에서 아쉬움이 남았지만, ${careerRecordTag}의 헌신과 소속팀 집중 의지를 존중하는 분위기입니다.`;
    return {
      tier: 'RESPECTED',
      mediaFanDelta: -2,
      lockerRoomDelta: 1,
      reactionTitle: '아쉬움 속 소속팀 집중 결정 존중',
      reactionSummary,
      milestoneDescription: `만 ${career.age}세에 대한민국 국가대표 은퇴를 공식 선언했습니다. (${careerRecordTag}) ${reactionSummary}`,
      caps,
      totalMedals,
    };
  }

  const isUnexempt =
    !career.militaryExempt && career.militaryServiceSeasonsLeft === 0;
  const mediaFanDelta = isUnexempt ? -10 : -8;
  const reactionSummary =
    caps === 0
      ? `공식 A매치 출전 없이 만 ${career.age}세에 국가대표 은퇴를 선언해 농구 팬들과 언론의 아쉬움과 논쟁이 이어졌습니다.`
      : `만 ${career.age}세의 이른 나이에 대표팀 은퇴를 결정하자 팬들의 아쉬움이 커지며 여론이 일시적으로 차가워졌습니다.`;

  return {
    tier: 'EARLY_CONTROVERSY',
    mediaFanDelta,
    lockerRoomDelta: -2,
    reactionTitle: '이른 국가대표 은퇴 선언에 여론 술렁',
    reactionSummary,
    milestoneDescription: `만 ${career.age}세에 대한민국 국가대표 은퇴를 공식 선언했습니다. (${careerRecordTag}) ${reactionSummary}`,
    caps,
    totalMedals,
  };
}

/**
 * 국가대표 국제대회 차출 또는 국가대표 세대교체 스토리 아크 이벤트인지 판별합니다.
 */
export function isNationalTeamEvent(
  evt: { id?: string; arcId?: StoryArcId; choices?: { enterInternationalTournament?: string; enterAsianGamesTournament?: boolean }[] } | null | undefined
): boolean {
  if (!evt) return false;
  if (evt.arcId === 'NATIONAL_TORCH_ARC') return true;
  if (
    evt.id === 'EVT_ASIAN_GAMES_GOLD' ||
    (typeof evt.id === 'string' && evt.id.startsWith('EVT_INTL_'))
  ) {
    return true;
  }
  return Boolean(
    evt.choices?.some(
      (c) => Boolean(c.enterInternationalTournament) || Boolean(c.enterAsianGamesTournament)
    )
  );
}
