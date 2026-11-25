import {
  CareerEvent,
  CareerEventChoice,
  CareerState,
  PlayerStats,
  RelationshipMetrics,
  StoryArcId,
  StoryArcState,
} from '../types/game';
import {
  RELATIONSHIP_LABELS,
  getEffectiveRelationships,
  getEffectiveStoryArcs,
} from './progressionEngine';
import {
  LEAGUE_BALANCE_META,
  canUseProTradeSystem,
} from '../config/balanceConfig';
import { PLAYER_TRAIT_META } from './statCalculator';
import { isKoreanNational } from '../data/nationalities';

const STAT_SHORT_LABEL: Record<keyof PlayerStats, string> = {
  ins: '골밑',
  out: '외곽',
  ply: '패스',
  def: '수비',
  reb: '리바운드',
  phy: '피지컬',
};

export interface EncounterChoiceUnlockStatus {
  unlocked: boolean;
  requirementLabel?: string;
  missingSummary?: string;
}

/**
 * 인카운터 선택지의 6대 능력치·특성·4축 관계도 해금 조건을 판정합니다.
 */
export function checkEncounterChoiceUnlock(
  career: CareerState | null,
  choice: CareerEventChoice
): EncounterChoiceUnlockStatus {
  const req = choice.requirements;
  const traitReq = req?.requiredTrait || choice.requiredTrait;

  if (!req && !traitReq) {
    return { unlocked: true };
  }

  if (!career) {
    return {
      unlocked: false,
      requirementLabel:
        req?.label || (traitReq ? PLAYER_TRAIT_META[traitReq]?.name : undefined),
      missingSummary: req?.label || '조건 미충족',
    };
  }

  const missing: string[] = [];
  const relationships = getEffectiveRelationships(career);

  if (req?.minStat) {
    for (const [key, minVal] of Object.entries(req.minStat) as [
      keyof PlayerStats,
      number | undefined,
    ][]) {
      if (typeof minVal === 'number' && (career.stats[key] ?? 0) < minVal) {
        missing.push(`${STAT_SHORT_LABEL[key]} ${minVal}+`);
      }
    }
  }

  if (req?.minRelationship) {
    for (const [key, minVal] of Object.entries(req.minRelationship) as [
      keyof RelationshipMetrics,
      number | undefined,
    ][]) {
      if (typeof minVal === 'number' && relationships[key] < minVal) {
        missing.push(`${RELATIONSHIP_LABELS[key]} ${minVal}+`);
      }
    }
  }

  if (traitReq && !(career.traits || []).includes(traitReq)) {
    const traitName = PLAYER_TRAIT_META[traitReq]?.name || traitReq;
    missing.push(`특성 '${traitName}'`);
  }

  return {
    unlocked: missing.length === 0,
    requirementLabel:
      req?.label ||
      (traitReq
        ? `특성 '${PLAYER_TRAIT_META[traitReq]?.name || traitReq}' 전용`
        : undefined),
    missingSummary: missing.length > 0 ? `${missing.join(' · ')} 필요` : undefined,
  };
}



function buildCoachTacticsArcEvent(
  career: CareerState,
  nextStage: number
): CareerEvent {
  const teamName = career.team.shortName;
  if (nextStage === 1) {
    return {
      id: `ARC_COACH_S1_${career.seasonYear}`,
      arcId: 'COACH_TACTICS_ARC',
      arcStage: 1,
      arcTitle: '감독 전술 주도권',
      category: 'TACTICAL_CLASH',
      title: '감독과의 전술 미팅: 공격 비중 조율',
      subtitle: '스토리 아크 · 1/3단계',
      description: `${teamName} 코칭스태프가 새 시즌 세트 오펜스를 개편하며 ${career.name}의 볼 소유 시간을 조정하려 합니다. 시스템에 맞출지, 주도권을 요구할지 기로에 섰습니다.`,
      choices: [
        {
          label: '코치진 전술 시스템을 우선 수용한다',
          description: '팀 규율에 맞춰 오프볼 움직임과 수비 로테이션을 철저히 수행합니다.',
          effectSummary: '감독 신뢰 +8 · 라커룸 +4 · DEF +1',
          riskTier: 'SAFE',
          statChanges: { def: 1 },
          trustDelta: 8,
          relationshipChanges: { lockerRoom: 4 },
          arcAdvance: {
            arcId: 'COACH_TACTICS_ARC',
            nextStage: 1,
            branchTag: 'SYSTEM_FIRST',
            summary: '1단계: 코칭스태프의 전술 시스템을 수용하며 신뢰 기반을 다졌습니다.',
          },
        },
        {
          label: '볼 핸들링 비중 확대를 정면 요청한다',
          description: '연습 경기에서 직접 공격 주도권을 증명해 역할 승격을 노립니다.',
          effectSummary: '성공 시 PLY +2, 감독 신뢰 +6, 프런트 +4 / 실패 시 감독 신뢰 -6',
          riskTier: 'HIGH_RISK',
          successCheck: {
            statKey: 'ply',
            difficulty: -2,
            baseProb: 0.6,
            label: '패스 · BQ(PLY)',
          },
          successOutcome: {
            narrative: '실전 스크리미지에서 탁월한 공격 전개를 증명하며 코칭스태프의 전술 비중이 확대되었습니다.',
            statChanges: { ply: 2 },
            trustDelta: 6,
            relationshipChanges: { frontOffice: 4 },
            arcAdvance: {
              arcId: 'COACH_TACTICS_ARC',
              nextStage: 1,
              branchTag: 'ALPHA_PUSH',
              summary: '1단계: 실력으로 볼 핸들링 비중 확대를 관철했습니다.',
            },
          },
          failureOutcome: {
            narrative: '무리한 개인 플레이가 이어지며 감독의 전술 신뢰가 일시적으로 하락했습니다.',
            trustDelta: -6,
            relationshipChanges: { lockerRoom: -3 },
            arcAdvance: {
              arcId: 'COACH_TACTICS_ARC',
              nextStage: 1,
              branchTag: 'TENSION_START',
              summary: '1단계: 공격 비중 요구가 무산되며 감독과 미묘한 긴장이 생겼습니다.',
            },
          },
        },
        {
          label: '영상 분석 자료로 맞춤형 2대2 세트 역제안',
          description: '상대 수비 약점을 겨냥한 투맨 게임 패턴을 직접 제시해 감독을 설득합니다.',
          effectSummary: 'PLY +2 · OUT +1 · 감독 신뢰 +10 · 라커룸 +5 확정',
          riskTier: 'SAFE',
          isExclusiveChoice: true,
          requirements: {
            minStat: { ply: 72 },
            label: '전용 분기 · 패스(PLY) 72+',
          },
          statChanges: { ply: 2, out: 1 },
          trustDelta: 10,
          relationshipChanges: { lockerRoom: 5, frontOffice: 4 },
          arcAdvance: {
            arcId: 'COACH_TACTICS_ARC',
            nextStage: 1,
            branchTag: 'TACTICAL_PARTNER',
            summary: '1단계: 전술 분석 역제안으로 감독의 전술 파트너로 인정받았습니다.',
          },
        },
      ],
    };
  }

  if (nextStage === 2) {
    return {
      id: `ARC_COACH_S2_${career.seasonYear}`,
      arcId: 'COACH_TACTICS_ARC',
      arcStage: 2,
      arcTitle: '감독 전술 주도권',
      category: 'TACTICAL_CLASH',
      title: '승부처 주도권 경쟁: 4쿼터 클로저 지명전',
      subtitle: '스토리 아크 · 2/3단계',
      description: `${teamName}의 접전 승률이 흔들리자 코칭스태프가 4쿼터 마지막 5분 전술을 재정비합니다. 클러치 타임을 누가 책임질지 라커룸의 시선이 쏠립니다.`,
      choices: [
        {
          label: '동료들과 볼 셰어링 원칙을 먼저 제안한다',
          description: '모두가 참여하는 모션 오펜스로 팀 케미스트리를 끌어올립니다.',
          effectSummary: '라커룸 +9 · 감독 신뢰 +5 · PLY +1',
          riskTier: 'SAFE',
          statChanges: { ply: 1 },
          trustDelta: 5,
          relationshipChanges: { lockerRoom: 9 },
          arcAdvance: {
            arcId: 'COACH_TACTICS_ARC',
            nextStage: 2,
            branchTag: 'SHARED_CLOSER',
            summary: '2단계: 이타적 볼 셰어링으로 라커룸의 두터운 지지를 확보했습니다.',
          },
        },
        {
          label: '4쿼터 아이솔레이션 전권을 요구한다',
          description: '승부처 결정을 본인이 직접 짊어지겠다며 코칭스태프를 설득합니다.',
          effectSummary: '성공 시 INS +1, OUT +1, 감독 신뢰 +6 / 실패 시 라커룸 -6, 감독 신뢰 -4',
          riskTier: 'HIGH_RISK',
          successCheck: {
            statKey: career.stats.out >= career.stats.ins ? 'out' : 'ins',
            difficulty: 0,
            baseProb: 0.58,
            label: '주력 득점력 기반',
          },
          successOutcome: {
            narrative: '클러치 타임 연속 득점으로 의심을 지우며 팀의 확실한 해결사로 자리매김했습니다.',
            statChanges: { ins: 1, out: 1 },
            trustDelta: 6,
            relationshipChanges: { mediaFan: 6 },
            arcAdvance: {
              arcId: 'COACH_TACTICS_ARC',
              nextStage: 2,
              branchTag: 'SOLO_CLOSER',
              summary: '2단계: 4쿼터 아이솔레이션 전권을 따내며 클로저로 부상했습니다.',
            },
          },
          failureOutcome: {
            narrative: '무리한 클러치 슛 선택이 겹치며 동료들과 코칭스태프의 신뢰가 흔들렸습니다.',
            trustDelta: -4,
            relationshipChanges: { lockerRoom: -6 },
            arcAdvance: {
              arcId: 'COACH_TACTICS_ARC',
              nextStage: 2,
              branchTag: 'CLOSER_FRICTION',
              summary: '2단계: 클러치 주도권 갈등으로 라커룸 내 온도차가 커졌습니다.',
            },
          },
        },
        {
          label: '클러치 전담 클로저 + 미끼 패스 투트랙 선언',
          description: '더블팀이 몰리면 오픈 동료를 살리고, 1대1이면 직접 끝내는 완성형 마무리를 제시합니다.',
          effectSummary: 'OUT +1 · PLY +1 · 감독 신뢰 +9 · 언론·팬심 +7 확정',
          riskTier: 'SAFE',
          isExclusiveChoice: true,
          requirements: {
            requiredTrait: 'CLUTCH_PERFORMER',
            label: "전용 분기 · 특성 '승부사' 보유",
          },
          statChanges: { out: 1, ply: 1 },
          trustDelta: 9,
          relationshipChanges: { lockerRoom: 6, mediaFan: 7 },
          arcAdvance: {
            arcId: 'COACH_TACTICS_ARC',
            nextStage: 2,
            branchTag: 'COMPLETE_CLOSER',
            summary: '2단계: 완벽한 승부처 지배력으로 코치진과 동료를 모두 납득시켰습니다.',
          },
        },
      ],
    };
  }

  return {
    id: `ARC_COACH_S3_${career.seasonYear}`,
    arcId: 'COACH_TACTICS_ARC',
    arcStage: 3,
    arcTitle: '감독 전술 주도권',
    category: 'TACTICAL_CLASH',
    title: '프랜차이즈의 중심축: 전술 책임을 넘겨받다',
    subtitle: '스토리 아크 · 완결 (3/3단계)',
    description: `수 시즌에 걸친 전술 조율 끝에 ${teamName} 구단이 ${career.name}을 중심으로 한 차세대 플랜을 확정하려 합니다. 구단 내 위상을 어떤 방향으로 매듭지을지 결정할 순간입니다.`,
    choices: [
      {
        label: '감독과 함께 프랜차이즈 왕조 시스템 구축',
        description: '코칭스태프와 장기 신뢰를 굳히며 팀의 상징적 리더로 자리합니다.',
        effectSummary: '감독 신뢰 +10 · 프런트 +9 · 라커룸 +8 · PLY +1',
        riskTier: 'SAFE',
        statChanges: { ply: 1 },
        trustDelta: 10,
        relationshipChanges: { frontOffice: 9, lockerRoom: 8 },
        arcAdvance: {
          arcId: 'COACH_TACTICS_ARC',
          nextStage: 3,
          branchTag: 'DYNASTY_LEADER',
          summary: '완결: 감독·프런트와 완전한 신뢰를 구축한 프랜차이즈 핵심으로 등극했습니다.',
          completed: true,
        },
      },
      {
        label: '우승 로스터 보강을 프런트에 공개 요구',
        description: '에이스의 발언권을 행사해 즉전감 영입과 공격 자유도를 강하게 압박합니다.',
        effectSummary:
          career.age >= 31
            ? 'OUT +2 · 언론·팬심 +8 · 프런트 -5'
            : '성장 한계 확장 · OUT +1 · 언론·팬심 +8 · 프런트 -5',
        riskTier: 'SAFE',
        statChanges: career.age >= 31 ? { out: 2 } : { out: 1 },
        ...(career.age >= 31 ? {} : { potentialDelta: 1 }),
        relationshipChanges: { mediaFan: 8, frontOffice: -5 },
        arcAdvance: {
          arcId: 'COACH_TACTICS_ARC',
          nextStage: 3,
          branchTag: 'SUPERSTAR_LEVERAGE',
          summary: '완결: 구단을 움직이는 슈퍼스타 영향력을 행사하며 독립적 입지를 굳혔습니다.',
          completed: true,
        },
      },
      {
        label: '구단 차세대 플레이북 공동 설계 참여',
        description: '코트 위 감독 자격으로 오프시즌 전술 설계와 로테이션 구성에 직접 의견을 보탭니다.',
        effectSummary: 'PLY +2 · OUT +1 · 감독 신뢰 +12 · 프런트 +10 확정',
        riskTier: 'SAFE',
        isExclusiveChoice: true,
        requirements: {
          minRelationship: { coachTrust: 78 },
          minStat: { ply: 78 },
          label: '전용 분기 · 감독 신뢰 78+ & 패스 78+',
        },
        statChanges: { ply: 2, out: 1 },
        trustDelta: 12,
        relationshipChanges: { frontOffice: 10, lockerRoom: 8 },
        arcAdvance: {
          arcId: 'COACH_TACTICS_ARC',
          nextStage: 3,
          branchTag: 'COURT_ARCHITECT',
          summary: '완결: 코트 위 전술 설계자로 인정받으며 구단 역사의 중심에 섰습니다.',
          completed: true,
        },
      },
    ],
  };
}

function buildRivalDestinyArcEvent(
  career: CareerState,
  nextStage: number
): CareerEvent {
  const rival =
    career.rivals?.find((r) => r.league === career.league) ?? career.rivals?.[0];
  const rivalName = rival?.name || '동기 에이스';
  const rivalTeam = rival?.teamShortName || '라이벌 구단';

  if (nextStage === 1) {
    return {
      id: `ARC_RIVAL_S1_${career.seasonYear}`,
      arcId: 'RIVAL_DESTINY_ARC',
      arcStage: 1,
      arcTitle: '동기 라이벌 숙명전',
      category: 'RIVAL_SHOWDOWN',
      title: `입단 동기 ${rivalName}과의 첫 정면 충돌`,
      subtitle: '스토리 아크 · 1/3단계',
      description: `언론이 ${career.name}과 ${rivalTeam}의 ${rivalName}을 연일 비교하며 리그 최고의 차세대 라이벌 구도를 띄우고 있습니다. 맞대결을 앞두고 인터뷰 요청이 들어왔습니다.`,
      choices: [
        {
          label: '개인 비교 대신 팀 승리에만 집중한다고 답한다',
          description: '불필요한 신경전을 피하고 차분하게 경기력을 끌어올립니다.',
          effectSummary: 'DEF +1 · 라커룸 +5 · 감독 신뢰 +4',
          riskTier: 'SAFE',
          statChanges: { def: 1 },
          trustDelta: 4,
          relationshipChanges: { lockerRoom: 5 },
          arcAdvance: {
            arcId: 'RIVAL_DESTINY_ARC',
            nextStage: 1,
            branchTag: 'CALM_FOCUS',
            summary: `1단계: ${rivalName}과의 비교 속에서도 흔들리지 않고 팀 승리에 집중했습니다.`,
          },
        },
        {
          label: '코트 위에서 실력으로 결판내겠다고 선전포고한다',
          description: '전국 중계 맞대결에서 정면 승부를 예고해 관심을 집중시킵니다.',
          effectSummary: '성공 시 OUT +1, INS +1, 언론·팬심 +10 / 실패 시 언론·팬심 -6',
          riskTier: 'HIGH_RISK',
          successCheck: {
            statKey: 'out',
            difficulty: 0,
            baseProb: 0.6,
            label: '외곽 득점력(OUT)',
          },
          successOutcome: {
            narrative: `전국 중계 맞대결에서 ${rivalName}을 판정승으로 누르며 리그 팬들에게 강렬한 인상을 남겼습니다.`,
            statChanges: { out: 1, ins: 1 },
            relationshipChanges: { mediaFan: 10 },
            draftStockDelta: 5,
            arcAdvance: {
              arcId: 'RIVAL_DESTINY_ARC',
              nextStage: 1,
              branchTag: 'BOLD_VICTORY',
              summary: `1단계: ${rivalName}과의 공개 맞대결에서 완승하며 주도권을 잡았습니다.`,
            },
          },
          failureOutcome: {
            narrative: `${rivalName}에게 결정적 득점을 허용하며 언론의 비교 기사가 쏟아졌습니다.`,
            relationshipChanges: { mediaFan: -6 },
            arcAdvance: {
              arcId: 'RIVAL_DESTINY_ARC',
              nextStage: 1,
              branchTag: 'RIVAL_GRUDGE',
              summary: `1단계: ${rivalName}에게 일격을 당하며 설욕의 불씨를 남겼습니다.`,
            },
          },
        },
        {
          label: `${rivalName} 전담 매치업 수비를 자청한다`,
          description: '공수 양면에서 라이벌을 직접 묶어내며 팀의 에너지를 끌어올립니다.',
          effectSummary: 'DEF +2 · 감독 신뢰 +7 · 언론·팬심 +7 확정',
          riskTier: 'SAFE',
          isExclusiveChoice: true,
          requirements: {
            minStat: { def: 75 },
            label: '전용 분기 · 수비 75+',
          },
          statChanges: { def: 2 },
          trustDelta: 7,
          relationshipChanges: { lockerRoom: 5, mediaFan: 7 },
          arcAdvance: {
            arcId: 'RIVAL_DESTINY_ARC',
            nextStage: 1,
            branchTag: 'LOCKDOWN_RIVAL',
            summary: `1단계: ${rivalName} 전담 수비를 완수하며 공수 겸장의 면모를 각인시켰습니다.`,
          },
        },
      ],
    };
  }

  if (nextStage === 2) {
    return {
      id: `ARC_RIVAL_S2_${career.seasonYear}`,
      arcId: 'RIVAL_DESTINY_ARC',
      arcStage: 2,
      arcTitle: '동기 라이벌 숙명전',
      category: 'RIVAL_SHOWDOWN',
      title: `리턴 매치: ${rivalName}과의 플레이오프급 격돌`,
      subtitle: '스토리 아크 · 2/3단계',
      description: `시즌 중반 순위 싸움이 걸린 경기에서 다시 ${rivalName}(${rivalTeam})과 마주했습니다. 4쿼터 승부처에서 두 선수의 자존심이 정면으로 충돌합니다.`,
      choices: [
        {
          label: '치열한 경기 후 비시즌 합동 훈련을 제안한다',
          description: '선의의 경쟁자로서 서로의 기술을 흡수하며 한 단계 도약합니다.',
          effectSummary: 'OUT +1 · INS +1 · 라커룸 +6 · 언론·팬심 +4',
          riskTier: 'SAFE',
          statChanges: { out: 1, ins: 1 },
          relationshipChanges: { lockerRoom: 6, mediaFan: 4 },
          arcAdvance: {
            arcId: 'RIVAL_DESTINY_ARC',
            nextStage: 2,
            branchTag: 'MUTUAL_RESPECT',
            summary: `2단계: ${rivalName}과의 합동 훈련으로 기술적 완성도를 함께 높였습니다.`,
          },
        },
        {
          label: '4쿼터 정면 아이솔레이션 승부를 걸어 끝낸다',
          description: '체력 소모를 감수하고 마지막 3분 동안 라이벌 앞에서 정면 승부를 펼칩니다.',
          effectSummary: '성공 시 INS +2, 언론·팬심 +9, 프런트 +5 / 실패 시 언론·팬심 -3',
          riskTier: 'HIGH_RISK',
          successCheck: {
            statKey: 'ins',
            difficulty: 1,
            baseProb: 0.56,
            label: '돌파 · 마무리(INS)',
          },
          successOutcome: {
            narrative: `종료 직전 ${rivalName}의 수비를 뚫고 결승 득점을 꽂아 넣으며 경기장을 열광시켰습니다.`,
            statChanges: { ins: 2 },
            relationshipChanges: { mediaFan: 9, frontOffice: 5 },
            arcAdvance: {
              arcId: 'RIVAL_DESTINY_ARC',
              nextStage: 2,
              branchTag: 'CLUTCH_DOMINANCE',
              summary: `2단계: ${rivalName}을 상대로 클러치 결승 득점을 터뜨리며 우위를 굳혔습니다.`,
            },
          },
          failureOutcome: {
            narrative: '강한 몸싸움 끝에 슛이 림을 외면했고, 후반 부담이 커졌습니다.',
            relationshipChanges: { mediaFan: -3 },
            arcAdvance: {
              arcId: 'RIVAL_DESTINY_ARC',
              nextStage: 2,
              branchTag: 'FIERCE_DUEL',
              summary: `2단계: ${rivalName}과 명승부를 벌였으나 마지막 고비에서 아쉬움을 남겼습니다.`,
            },
          },
        },
        {
          label: '외곽 폭격과 킥아웃 패스로 승부처를 완벽 제압',
          description: '정확한 장거리 슛으로 수비를 끌어낸 뒤 득점과 어시스트를 번갈아 터뜨립니다.',
          effectSummary: 'OUT +2 · PLY +1 · 언론·팬심 +10 · 프런트 +6 확정',
          riskTier: 'SAFE',
          isExclusiveChoice: true,
          requirements: {
            minStat: { out: 78 },
            label: '전용 분기 · 외곽 78+',
          },
          statChanges: { out: 2, ply: 1 },
          relationshipChanges: { mediaFan: 10, frontOffice: 6, lockerRoom: 5 },
          arcAdvance: {
            arcId: 'RIVAL_DESTINY_ARC',
            nextStage: 2,
            branchTag: 'CLUTCH_MASTER',
            summary: `2단계: 날카로운 외곽 화력으로 ${rivalName}과의 리턴 매치를 완벽히 지배했습니다.`,
          },
        },
      ],
    };
  }

  return {
    id: `ARC_RIVAL_S3_${career.seasonYear}`,
    arcId: 'RIVAL_DESTINY_ARC',
    arcStage: 3,
    arcTitle: '동기 라이벌 숙명전',
    category: 'RIVAL_SHOWDOWN',
    title: `시대의 라이벌리 결착: ${rivalName}과 정상에서`,
    subtitle: '스토리 아크 · 완결 (3/3단계)',
    description: `리그를 대표하는 두 스타로 성장한 ${career.name}과 ${rivalName}. 올스타 브레이크 특별 대담에서 두 선수의 라이벌리가 한 시대의 상징으로 조명됩니다.`,
    choices: [
      {
        label: '서로를 성장시킨 최고의 라이벌이라 예우한다',
        description: '품격 있는 리스펙트로 리그 전체와 팬들의 찬사를 끌어냅니다.',
        effectSummary: '언론·팬심 +10 · 라커룸 +8 · 프런트 +5',
        riskTier: 'SAFE',
        relationshipChanges: { mediaFan: 10, lockerRoom: 8, frontOffice: 5 },
        arcAdvance: {
          arcId: 'RIVAL_DESTINY_ARC',
          nextStage: 3,
          branchTag: 'GOLDEN_ERA_RESPECT',
          summary: `완결: ${rivalName}과 함께 한 시대를 수놓은 품격 있는 라이벌리로 기록되었습니다.`,
          completed: true,
        },
      },
      {
        label: '결국 우승 반지가 시대의 주인을 가린다며 정면 선언',
        description: '우승 타이틀로 라이벌리에 마침표를 찍겠다고 못 박습니다.',
        effectSummary: 'INS +1 · 언론·팬심 +12 · 감독 신뢰 +5 · 스카우트 평가 +5',
        riskTier: 'SAFE',
        statChanges: { ins: 1 },
        draftStockDelta: 5,
        trustDelta: 5,
        relationshipChanges: { mediaFan: 12 },
        arcAdvance: {
          arcId: 'RIVAL_DESTINY_ARC',
          nextStage: 3,
          branchTag: 'RING_SETTLEMENT',
          summary: `완결: ${rivalName}과의 숙명전을 우승 경쟁의 서사로 승화시켰습니다.`,
          completed: true,
        },
      },
      {
        label: '올스타 무대 공동 지배 후 리그 1인자 위상 확정',
        description: '최정상급 기량과 팬 지지를 코트 위에서 직접 증명하며 라이벌리 구도에서 우위를 굳힙니다.',
        effectSummary: 'INS +1 · OUT +1 · 언론·팬심 +12 · 프런트 +8 확정',
        riskTier: 'SAFE',
        isExclusiveChoice: true,
        requirements: {
          minRelationship: { mediaFan: 76 },
          minStat: { ins: 76 },
          label: '전용 분기 · 언론·팬심 76+ & 골밑 76+',
        },
        statChanges: { ins: 1, out: 1 },
        relationshipChanges: { mediaFan: 12, frontOffice: 8, lockerRoom: 6 },
        arcAdvance: {
          arcId: 'RIVAL_DESTINY_ARC',
          nextStage: 3,
          branchTag: 'UNDISPUTED_ERA',
          summary: `완결: ${rivalName}과의 라이벌 구도를 넘어 리그 최정상 에이스로 공인받았습니다.`,
          completed: true,
        },
      },
    ],
  };
}

function buildBrandEmpireArcEvent(
  career: CareerState,
  nextStage: number
): CareerEvent {
  if (nextStage === 1) {
    return {
      id: `ARC_BRAND_S1_${career.seasonYear}`,
      arcId: 'BRAND_EMPIRE_ARC',
      arcStage: 1,
      arcTitle: '브랜드와 FA 제국',
      category: 'OFF_COURT_BRAND',
      title: '에이전트 전략 회의: 커리어 가치 재설계',
      subtitle: '스토리 아크 · 1/3단계',
      description: `프로 무대에서 입지가 커지자 대형 스포츠 에이전시들이 ${career.name}에게 협업을 제안했습니다. 구단과의 안정적 관계와 글로벌 상업 가치 사이에서 방향을 정해야 합니다.`,
      choices: [
        {
          label: '기존 에이전트와 구단 친화적 노선을 유지한다',
          description: '프런트와의 신뢰를 지키며 차기 재계약 협상력을 다집니다.',
          effectSummary: '프런트 +7 · 감독 신뢰 +3 · 자산 +$25K',
          riskTier: 'SAFE',
          cashDelta: 25000,
          trustDelta: 3,
          relationshipChanges: { frontOffice: 7 },
          arcAdvance: {
            arcId: 'BRAND_EMPIRE_ARC',
            nextStage: 1,
            branchTag: 'FRONT_OFFICE_ALLY',
            summary: '1단계: 구단 친화적 에이전트 전략으로 프런트의 신뢰를 확보했습니다.',
          },
        },
        {
          label: '글로벌 마케팅 전문 에이전시로 전격 교체한다',
          description: '구단의 경계심은 높아지지만 스폰서 수익과 대중 인지도가 크게 오릅니다.',
          effectSummary: '자산 +$55K · 언론·팬심 +9 · 프런트 -4',
          riskTier: 'SAFE',
          cashDelta: 55000,
          relationshipChanges: { mediaFan: 9, frontOffice: -4 },
          arcAdvance: {
            arcId: 'BRAND_EMPIRE_ARC',
            nextStage: 1,
            branchTag: 'MEGA_AGENCY',
            summary: '1단계: 대형 에이전시 합류로 상업적 영향력을 빠르게 확장했습니다.',
          },
        },
        {
          label: '스폰서·구단 공동 브랜드 패키지를 직접 타결한다',
          description: '높은 대중 인기를 지렛대로 구단과 스폰서 모두 윈윈하는 조건을 이끌어냅니다.',
          effectSummary: '자산 +$85K · 언론·팬심 +10 · 프런트 +7 확정',
          riskTier: 'SAFE',
          isExclusiveChoice: true,
          requirements: {
            minRelationship: { mediaFan: 65 },
            label: '전용 분기 · 언론·팬심 65+',
          },
          cashDelta: 85000,
          relationshipChanges: { mediaFan: 10, frontOffice: 7 },
          arcAdvance: {
            arcId: 'BRAND_EMPIRE_ARC',
            nextStage: 1,
            branchTag: 'DUAL_LEVERAGE',
            summary: '1단계: 스폰서와 구단의 이해관계를 모두 만족시키는 계약을 성사시켰습니다.',
          },
        },
      ],
    };
  }

  if (nextStage === 2) {
    return {
      id: `ARC_BRAND_S2_${career.seasonYear}`,
      arcId: 'BRAND_EMPIRE_ARC',
      arcStage: 2,
      arcTitle: '브랜드와 FA 제국',
      category: 'OFF_COURT_BRAND',
      title: '시그니처 농구화 라인 런칭 제안',
      subtitle: '스토리 아크 · 2/3단계',
      description: `글로벌 스포츠 브랜드가 ${career.name}의 이름을 내건 시그니처 농구화 출시를 공식 제안했습니다. 대규모 투어 일정을 소화할지, 시즌 컨디션을 우선할지 선택해야 합니다.`,
      choices: [
        {
          label: '시즌 집중을 위해 온라인 한정 캡슐 라인만 진행한다',
          description: '이동 피로를 최소화하면서도 탄탄한 수익과 감독의 신뢰를 챙깁니다.',
          effectSummary: '자산 +$45K · PHY +1 · 감독 신뢰 +5',
          riskTier: 'SAFE',
          cashDelta: 45000,
          statChanges: { phy: 1 },
          trustDelta: 5,
          relationshipChanges: { mediaFan: 4 },
          arcAdvance: {
            arcId: 'BRAND_EMPIRE_ARC',
            nextStage: 2,
            branchTag: 'DISCIPLINED_BRAND',
            summary: '2단계: 경기력을 최우선에 둔 시그니처 캡슐 라인으로 호평을 얻었습니다.',
          },
        },
        {
          label: '아시아·북미 글로벌 런칭 투어를 전면 소화한다',
          description: '강행군이지만 막대한 자산과 팬덤을 단번에 확보합니다.',
          effectSummary: '자산 +$130K · 언론·팬심 +12 · 감독 신뢰 -3',
          riskTier: 'SAFE',
          cashDelta: 130000,
          trustDelta: -3,
          relationshipChanges: { mediaFan: 12 },
          arcAdvance: {
            arcId: 'BRAND_EMPIRE_ARC',
            nextStage: 2,
            branchTag: 'GLOBAL_TOUR',
            summary: '2단계: 대규모 시그니처 투어를 완주하며 글로벌 스타 반열에 올랐습니다.',
          },
        },
        {
          label: '전담 회복팀 동행 맞춤형 투어로 피로 없이 런칭',
          description: '강인한 신체 내구도를 바탕으로 훈련과 글로벌 프로모션을 동시에 완수합니다.',
          effectSummary: '자산 +$120K · PHY +1 · 언론·팬심 +11 · 프런트 +5 확정',
          riskTier: 'SAFE',
          isExclusiveChoice: true,
          requirements: {
            minStat: { phy: 76 },
            label: '전용 분기 · 피지컬 76+',
          },
          cashDelta: 120000,
          statChanges: { phy: 1 },
          relationshipChanges: { mediaFan: 11, frontOffice: 5 },
          arcAdvance: {
            arcId: 'BRAND_EMPIRE_ARC',
            nextStage: 2,
            branchTag: 'PEAK_ICON',
            summary: '2단계: 최상의 피지컬을 유지한 채 시그니처 라인을 성공적으로 안착시켰습니다.',
          },
        },
      ],
    };
  }

  return {
    id: `ARC_BRAND_S3_${career.seasonYear}`,
    arcId: 'BRAND_EMPIRE_ARC',
    arcStage: 3,
    arcTitle: '브랜드와 FA 제국',
    category: 'OFF_COURT_BRAND',
    title: '글로벌 아이콘과 차기 대형 계약의 기로',
    subtitle: '스토리 아크 · 완결 (3/3단계)',
    description: `시그니처 라인이 흥행하며 ${career.name}은 코트 안팎을 아우르는 거물 선수가 되었습니다. 구단과 스폰서가 장기 파트너십의 최종 청사진을 내밀었습니다.`,
    choices: [
      {
        label: '프랜차이즈 충성 파트너십으로 장기 안정을 택한다',
        description: '구단 역사에 남을 장기 계약과 탄탄한 내부 지지를 확보합니다.',
        effectSummary: '자산 +$100K · 프런트 +12 · 라커룸 +8 · 감독 신뢰 +6',
        riskTier: 'SAFE',
        cashDelta: 100000,
        trustDelta: 6,
        relationshipChanges: { frontOffice: 12, lockerRoom: 8 },
        arcAdvance: {
          arcId: 'BRAND_EMPIRE_ARC',
          nextStage: 3,
          branchTag: 'FRANCHISE_EMPIRE',
          summary: '완결: 구단과 함께 성장하는 프랜차이즈 대표 아이콘으로 자리잡았습니다.',
          completed: true,
        },
      },
      {
        label: '시장 최고 대우를 겨냥한 독립 브랜드 제국을 선언한다',
        description: '프런트와의 협상 주도권을 쥔 채 커리어 최고 수준의 상업적 보상을 챙깁니다.',
        effectSummary: '자산 +$190K · 언론·팬심 +10 · 프런트 -5',
        riskTier: 'SAFE',
        cashDelta: 190000,
        relationshipChanges: { mediaFan: 10, frontOffice: -5 },
        arcAdvance: {
          arcId: 'BRAND_EMPIRE_ARC',
          nextStage: 3,
          branchTag: 'INDEPENDENT_MOGUL',
          summary: '완결: 독자적인 글로벌 스포츠 브랜드를 구축한 아이콘이 되었습니다.',
          completed: true,
        },
      },
      {
        label: '구단 공동 유소년 아카데미 및 맥스급 브랜드 협약 체결',
        description: '프런트와 팬덤 모두의 절대적 지지를 바탕으로 코트 안팎의 레거시를 완성합니다.',
        effectSummary: '자산 +$170K · 프런트 +11 · 언론·팬심 +12 · 라커룸 +7 확정',
        riskTier: 'SAFE',
        isExclusiveChoice: true,
        requirements: {
          minRelationship: { frontOffice: 70, mediaFan: 72 },
          label: '전용 분기 · 프런트 70+ & 언론·팬심 72+',
        },
        cashDelta: 170000,
        relationshipChanges: { frontOffice: 11, mediaFan: 12, lockerRoom: 7 },
        arcAdvance: {
          arcId: 'BRAND_EMPIRE_ARC',
          nextStage: 3,
          branchTag: 'LEGACY_EMPIRE',
          summary: '완결: 유소년 아카데미와 글로벌 브랜드 제국을 동시에 완성했습니다.',
          completed: true,
        },
      },
    ],
  };
}

function buildNationalTorchArcEvent(
  career: CareerState,
  nextStage: number
): CareerEvent {
  if (nextStage === 1) {
    return {
      id: `ARC_NAT_S1_${career.seasonYear}`,
      arcId: 'NATIONAL_TORCH_ARC',
      arcStage: 1,
      arcTitle: '국가대표 세대교체',
      category: 'NATIONAL_PRIDE',
      title: '태극마크 첫 소집: 대표팀 합숙 훈련',
      subtitle: '스토리 아크 · 1/3단계',
      description: `대한민국 남자농구 국가대표팀 예비 소집 명단에 ${career.name}이 이름을 올렸습니다. 쟁쟁한 선배들 사이에서 어떤 역할로 눈도장을 찍을지 결정할 시간입니다.`,
      choices: [
        {
          label: '수비와 허슬로 대표팀 에너지를 끌어올린다',
          description: '궂은일을 도맡아 선배들과 대표팀 코칭스태프의 신뢰를 얻습니다.',
          effectSummary: 'DEF +1 · 라커룸 +7 · 언론·팬심 +4',
          riskTier: 'SAFE',
          statChanges: { def: 1 },
          relationshipChanges: { lockerRoom: 7, mediaFan: 4 },
          arcAdvance: {
            arcId: 'NATIONAL_TORCH_ARC',
            nextStage: 1,
            branchTag: 'ENERGY_SPARK',
            summary: '1단계: 헌신적인 수비와 허슬로 대표팀 막내 이상의 존재감을 보였습니다.',
          },
        },
        {
          label: '평가전에서 과감한 공격 주도권을 시험한다',
          description: '국제 무대 득점원으로서의 가능성을 대표팀 코치진 앞에 어필합니다.',
          effectSummary: 'OUT +1 · 언론·팬심 +7 · 스카우트 평가 +3',
          riskTier: 'SAFE',
          statChanges: { out: 1 },
          draftStockDelta: 3,
          relationshipChanges: { mediaFan: 7 },
          arcAdvance: {
            arcId: 'NATIONAL_TORCH_ARC',
            nextStage: 1,
            branchTag: 'YOUNG_SCORER',
            summary: '1단계: 과감한 득점 감각으로 대표팀 차세대 스코어러 후보에 올랐습니다.',
          },
        },
        {
          label: 'FIBA 국제 룰 맞춤형 스페이싱·존 공략 마스터',
          description: '높은 패스 감각과 시야로 국제 대회 특유의 지역방어를 해체하는 핵심 자원이 됩니다.',
          effectSummary: 'OUT +2 · PLY +1 · 라커룸 +6 · 언론·팬심 +6 확정',
          riskTier: 'SAFE',
          isExclusiveChoice: true,
          requirements: {
            minStat: { ply: 74 },
            label: '전용 분기 · 패스(PLY) 74+',
          },
          statChanges: { out: 2, ply: 1 },
          relationshipChanges: { lockerRoom: 6, mediaFan: 6 },
          arcAdvance: {
            arcId: 'NATIONAL_TORCH_ARC',
            nextStage: 1,
            branchTag: 'FIBA_TACTICIAN',
            summary: '1단계: FIBA 전술 이해도로 대표팀 핵심 로테이션에 즉시 안착했습니다.',
          },
        },
      ],
    };
  }

  if (nextStage === 2) {
    return {
      id: `ARC_NAT_S2_${career.seasonYear}`,
      arcId: 'NATIONAL_TORCH_ARC',
      arcStage: 2,
      arcTitle: '국가대표 세대교체',
      category: 'NATIONAL_PRIDE',
      title: '세대교체의 기수: 대표팀 핵심 주전 도약',
      subtitle: '스토리 아크 · 2/3단계',
      description: `대표팀 베테랑들이 은퇴 수순에 들어가며 ${career.name}에게 본격적인 주전 에이스의 바통이 넘어오고 있습니다.`,
      choices: [
        {
          label: '조직력과 패스 전개로 대표팀 중심을 잡는다',
          description: '개인 기록보다 팀 농구의 완성도를 높이며 세대교체를 안정적으로 이끕니다.',
          effectSummary: 'PLY +1 · 라커룸 +8 · 언론·팬심 +5',
          riskTier: 'SAFE',
          statChanges: { ply: 1 },
          relationshipChanges: { lockerRoom: 8, mediaFan: 5 },
          arcAdvance: {
            arcId: 'NATIONAL_TORCH_ARC',
            nextStage: 2,
            branchTag: 'TEAM_ANCHOR',
            summary: '2단계: 대표팀 조직력의 중심축으로 자리하며 세대교체를 안착시켰습니다.',
          },
        },
        {
          label: '강호 상대 에이스 매치업을 자청해 정면 돌파한다',
          description: '아시아·세계 강호의 간판 스타를 상대로 대표팀 1옵션임을 증명합니다.',
          effectSummary: '성공 시 OUT +1, DEF +1, 언론·팬심 +10 / 실패 시 언론·팬심 -2',
          riskTier: 'HIGH_RISK',
          successCheck: {
            statKey: 'out',
            difficulty: 1,
            baseProb: 0.6,
            label: '국제 무대 슈팅(OUT)',
          },
          successOutcome: {
            narrative: '강호 상대 평가전에서 맹활약하며 대한민국 대표팀의 새 간판으로 떠올랐습니다.',
            statChanges: { out: 1, def: 1 },
            relationshipChanges: { mediaFan: 10, lockerRoom: 6 },
            arcAdvance: {
              arcId: 'NATIONAL_TORCH_ARC',
              nextStage: 2,
              branchTag: 'NATIONAL_ACE',
              summary: '2단계: 강호와의 정면 대결에서 승리하며 대표팀 1옵션 입지를 굳혔습니다.',
            },
          },
          failureOutcome: {
            narrative: '강한 압박 수비에 고전했으나 큰 무대 경험을 값진 교훈으로 삼았습니다.',
            relationshipChanges: { mediaFan: -2 },
            arcAdvance: {
              arcId: 'NATIONAL_TORCH_ARC',
              nextStage: 2,
              branchTag: 'HARD_LESSON',
              summary: '2단계: 국제 무대의 높은 벽을 체감하며 절치부심의 계기를 만들었습니다.',
            },
          },
        },
        {
          label: '위기 상황에서 코트를 정리하는 부주장 리더십 발휘',
          description: '탄탄한 수비 리더십과 라커룸 신뢰로 흔들리는 젊은 선수단을 결집합니다.',
          effectSummary: 'PLY +1 · DEF +1 · 라커룸 +9 · 언론·팬심 +8 확정',
          riskTier: 'SAFE',
          isExclusiveChoice: true,
          requirements: {
            minRelationship: { lockerRoom: 72 },
            minStat: { def: 74 },
            label: '전용 분기 · 라커룸 72+ & 수비 74+',
          },
          statChanges: { ply: 1, def: 1 },
          relationshipChanges: { lockerRoom: 9, mediaFan: 8 },
          arcAdvance: {
            arcId: 'NATIONAL_TORCH_ARC',
            nextStage: 2,
            branchTag: 'VICE_CAPTAIN',
            summary: '2단계: 공수 리더십으로 대표팀 차기 주장 0순위로 낙점되었습니다.',
          },
        },
      ],
    };
  }

  return {
    id: `ARC_NAT_S3_${career.seasonYear}`,
    arcId: 'NATIONAL_TORCH_ARC',
    arcStage: 3,
    arcTitle: '국가대표 세대교체',
    category: 'NATIONAL_PRIDE',
    title: '태극마크 주장 완장 수여',
    subtitle: '스토리 아크 · 완결 (3/3단계)',
    description: `대한민국 남자농구 국가대표팀 감독과 선수단 만장일치로 ${career.name}이 새 주장으로 선임되었습니다. 한국 농구의 자존심을 대표하는 자리입니다.`,
    choices: [
      {
        label: '후배 육성과 대표팀 시스템 정착에 헌신한다',
        description: '세대 간 가교 역할을 맡아 대표팀의 지속 가능한 경쟁력을 설계합니다.',
        effectSummary: '라커룸 +12 · 언론·팬심 +9 · PLY +1',
        riskTier: 'SAFE',
        statChanges: { ply: 1 },
        relationshipChanges: { lockerRoom: 12, mediaFan: 9 },
        arcAdvance: {
          arcId: 'NATIONAL_TORCH_ARC',
          nextStage: 3,
          branchTag: 'TORCH_BEARER',
          summary: '완결: 후배들에게 태극마크의 품격을 전수하는 대표팀 주장으로 남았습니다.',
          completed: true,
        },
      },
      {
        label: '국제대회 시상대를 향한 필승 출사표를 던진다',
        description: '국민의 기대를 정면으로 짊어지며 대표팀의 투지를 최고조로 끌어올립니다.',
        effectSummary: 'OUT +1 · 언론·팬심 +12 · 라커룸 +7',
        riskTier: 'SAFE',
        statChanges: { out: 1 },
        relationshipChanges: { mediaFan: 12, lockerRoom: 7 },
        arcAdvance: {
          arcId: 'NATIONAL_TORCH_ARC',
          nextStage: 3,
          branchTag: 'IRON_CAPTAIN',
          summary: '완결: 국제 무대 시상대를 정조준하는 강인한 국가대표 주장으로 각인되었습니다.',
          completed: true,
        },
      },
      {
        label: '세대를 잇는 대한민국 농구의 상징으로 등극',
        description: '완벽한 라커룸 신뢰와 위상으로 한국 농구 황금기를 선도합니다.',
        effectSummary:
          career.age >= 31
            ? '라커룸 +12 · 언론·팬심 +12 · 프런트 +6 · PLY +1, OUT +1 확정'
            : '라커룸 +12 · 언론·팬심 +12 · 프런트 +6 · 성장 한계 확장 확정',
        riskTier: 'SAFE',
        isExclusiveChoice: true,
        requirements: {
          minRelationship: { lockerRoom: 74 },
          label: '전용 분기 · 라커룸 74+',
        },
        ...(career.age >= 31
          ? { statChanges: { ply: 1, out: 1 } }
          : { potentialDelta: 1 }),
        relationshipChanges: { lockerRoom: 12, mediaFan: 12, frontOffice: 6 },
        arcAdvance: {
          arcId: 'NATIONAL_TORCH_ARC',
          nextStage: 3,
          branchTag: 'NATIONAL_SYMBOL',
          summary: '완결: 태극마크 주장으로서 한국 농구 한 시대의 상징이 되었습니다.',
          completed: true,
        },
      },
    ],
  };
}

/**
 * 현재 커리어 상태에 따라 다음 단계로 진입 가능한 멀티 시즌 스토리 아크 이벤트를 선정합니다.
 * - 동일 아크는 최소 1시즌 이상 간격을 두고 진행
 * - 프로 무대 및 대표팀 경력 조건에 자연스럽게 연동 (상무 군 복무 중에는 제외)
 */
export function rollStoryArcEvent(
  career: CareerState,
  rng: () => number = Math.random
): CareerEvent | null {
  if (!LEAGUE_BALANCE_META[career.league]?.isPro) return null;
  if (
    !canUseProTradeSystem({
      league: career.league,
      contractType: career.contractType,
      isMilitaryTeam: career.team.isMilitaryTeam,
      teamId: career.team.id,
    })
  ) {
    return null;
  }

  const arcs = getEffectiveStoryArcs(career);
  const seenIds = career.seenEventIds || [];
  const recentCats = (career.recentEventCategories || []).slice(-2);
  const eligible: { arc: StoryArcState; weight: number }[] = [];

  const arcPrefixMap: Record<StoryArcId, string> = {
    COACH_TACTICS_ARC: 'ARC_COACH',
    RIVAL_DESTINY_ARC: 'ARC_RIVAL',
    BRAND_EMPIRE_ARC: 'ARC_BRAND',
    NATIONAL_TORCH_ARC: 'ARC_NAT',
  };
  const arcCategoryMap: Record<StoryArcId, string> = {
    COACH_TACTICS_ARC: 'TACTICAL_CLASH',
    RIVAL_DESTINY_ARC: 'RIVAL_SHOWDOWN',
    BRAND_EMPIRE_ARC: 'OFF_COURT_BRAND',
    NATIONAL_TORCH_ARC: 'NATIONAL_PRIDE',
  };

  const canAdvance = (arc: StoryArcState, minGapYears = 1): boolean => {
    if (arc.completed || arc.stage >= arc.maxStage) return false;
    if (
      arc.lastTriggeredYear !== null &&
      career.seasonYear - arc.lastTriggeredYear < minGapYears
    ) {
      return false;
    }
    const nextStage = arc.stage + 1;
    const stagePrefix = `${arcPrefixMap[arc.id]}_S${nextStage}_`;
    if (seenIds.some((id) => id.startsWith(stagePrefix))) {
      return false;
    }
    if (recentCats.includes(arcCategoryMap[arc.id])) {
      return false;
    }
    return true;
  };

  if (canAdvance(arcs.COACH_TACTICS_ARC, 1) && career.seasonsPlayed >= 1) {
    eligible.push({
      arc: arcs.COACH_TACTICS_ARC,
      weight: arcs.COACH_TACTICS_ARC.stage > 0 ? 2.4 : 1.5,
    });
  }

  const hasSameLeagueRival = (career.rivals || []).some(
    (r) => r.league === career.league
  );
  if (
    canAdvance(arcs.RIVAL_DESTINY_ARC, 1) &&
    hasSameLeagueRival &&
    career.ovr >= 72
  ) {
    eligible.push({
      arc: arcs.RIVAL_DESTINY_ARC,
      weight: arcs.RIVAL_DESTINY_ARC.stage > 0 ? 2.3 : 1.4,
    });
  }

  if (
    canAdvance(arcs.BRAND_EMPIRE_ARC, 1) &&
    (career.ovr >= 74 || career.seasonsPlayed >= 3)
  ) {
    eligible.push({
      arc: arcs.BRAND_EMPIRE_ARC,
      weight: arcs.BRAND_EMPIRE_ARC.stage > 0 ? 2.2 : 1.3,
    });
  }

  // 1.2.0: 태극마크 아크는 대한민국 국적만 해당합니다.
  if (
    isKoreanNational(career) &&
    !career.nationalTeamRetired &&
    canAdvance(arcs.NATIONAL_TORCH_ARC, 1) &&
    ((career.totals.internationalCaps || 0) >= 1 || career.ovr >= 75)
  ) {
    eligible.push({
      arc: arcs.NATIONAL_TORCH_ARC,
      weight:
        arcs.NATIONAL_TORCH_ARC.stage > 0 ||
        (career.totals.internationalCaps || 0) >= 1
          ? 2.5
          : 1.2,
    });
  }

  if (eligible.length === 0) return null;
  if (rng() > 0.42) return null;

  const totalWeight = eligible.reduce((s, e) => s + e.weight, 0);
  let pick = rng() * totalWeight;
  let chosen = eligible[0].arc;
  for (const item of eligible) {
    pick -= item.weight;
    if (pick <= 0) {
      chosen = item.arc;
      break;
    }
  }

  const nextStage = chosen.stage + 1;
  switch (chosen.id) {
    case 'COACH_TACTICS_ARC':
      return buildCoachTacticsArcEvent(career, nextStage);
    case 'RIVAL_DESTINY_ARC':
      return buildRivalDestinyArcEvent(career, nextStage);
    case 'BRAND_EMPIRE_ARC':
      return buildBrandEmpireArcEvent(career, nextStage);
    case 'NATIONAL_TORCH_ARC':
      return buildNationalTorchArcEvent(career, nextStage);
  }
}

export function buildStoryArcEventById(
  career: CareerState,
  arcId: StoryArcId,
  stage: number
): CareerEvent {
  switch (arcId) {
    case 'COACH_TACTICS_ARC':
      return buildCoachTacticsArcEvent(career, stage);
    case 'RIVAL_DESTINY_ARC':
      return buildRivalDestinyArcEvent(career, stage);
    case 'BRAND_EMPIRE_ARC':
      return buildBrandEmpireArcEvent(career, stage);
    case 'NATIONAL_TORCH_ARC':
      return buildNationalTorchArcEvent(career, stage);
  }
}
