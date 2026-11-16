import {
  CareerEvent,
  CareerEventChoice,
  CareerState,
  EncounterArchetypeCategory,
  LeagueId,
  PlayerTraitId,
} from '../types/game';
import { LEAGUE_CONFIG } from '../data/leagues';

export type CareerContextTag =
  | 'HS_PROSPECT'
  | 'COLLEGE_STAR'
  | 'ROOKIE_GRINDER'
  | 'PRIME_ACE'
  | 'AGING_VET'
  | 'CONTENDER_RUN'
  | 'REBUILDING_TANK'
  | 'PLAYOFF_BUBBLE'
  | 'HOT_STREAK'
  | 'SHOOTING_SLUMP'
  | 'CONTRACT_YEAR'
  | 'BROKEN_PROMISE'
  | 'LOW_STAMINA';

export interface EncounterScenarioTemplate {
  id: string;
  category: EncounterArchetypeCategory;
  requiredTags?: CareerContextTag[];
  allowedLeagues?: LeagueId[];
  minAge?: number;
  maxAge?: number;
  title: string;
  subtitle: string;
  description: string;
  choices: CareerEventChoice[];
}

/**
 * Axis 1: 선수의 나이, 소속 리그, 구단 기조, 최근 성적, 감독 신뢰도, 계약 상태에서 컨텍스트 태그를 추출합니다.
 */
export function extractCareerContextTags(career: CareerState): CareerContextTag[] {
  const tags: CareerContextTag[] = [];
  const lastLog =
    career.seasonLogs.length > 0
      ? career.seasonLogs[career.seasonLogs.length - 1]
      : null;

  if (career.league === 'HIGH_SCHOOL') {
    tags.push('HS_PROSPECT');
  } else if (career.league === 'U_LEAGUE' || career.league === 'NCAA') {
    tags.push('COLLEGE_STAR');
  } else if (career.seasonsPlayed <= 3 || career.age <= 22) {
    tags.push('ROOKIE_GRINDER');
  }

  if (career.age >= 24 && career.age <= 30 && career.ovr >= 74) {
    tags.push('PRIME_ACE');
  }
  if (career.age >= 31) {
    tags.push('AGING_VET');
  }

  const dir = career.team.direction || 'PLAYOFF_HUNT';
  if (dir === 'CONTENDER') {
    tags.push('CONTENDER_RUN');
  } else if (dir === 'REBUILDING') {
    tags.push('REBUILDING_TANK');
  } else {
    tags.push('PLAYOFF_BUBBLE');
  }

  if (lastLog) {
    if (lastLog.ppg >= 18 || lastLog.fgPct >= 49.5) {
      tags.push('HOT_STREAK');
    }
    if (lastLog.fgPct < 42.0 || lastLog.tpPct < 31.0) {
      tags.push('SHOOTING_SLUMP');
    }
    if (lastLog.injuredGamesMissed >= 4 || career.stats.phy <= 64) {
      tags.push('LOW_STAMINA');
    }
  }

  if (career.contractYearsLeft <= 1) {
    tags.push('CONTRACT_YEAR');
  }
  if (career.brokenRolePromise) {
    tags.push('BROKEN_PROMISE');
  }

  return tags;
}

/**
 * Axis 3: 시나리오 텍스트의 동적 변수를 현재 커리어 및 라이벌 데이터로 치환합니다.
 */
export function injectDynamicVariables(text: string, career: CareerState): string {
  const lastLog =
    career.seasonLogs.length > 0
      ? career.seasonLogs[career.seasonLogs.length - 1]
      : null;
  const sameLeagueRival =
    (career.rivals || []).find((r) => r.league === career.league) ||
    (career.rivals && career.rivals[0]);

  const rivalName = sameLeagueRival ? sameLeagueRival.name : '라이벌 에이스';
  const rivalTeamName = sameLeagueRival
    ? sameLeagueRival.teamShortName
    : '맞수 구단';
  const rivalPpg =
    sameLeagueRival && sameLeagueRival.ppg > 0
      ? sameLeagueRival.ppg.toFixed(1)
      : '21.4';
  const ppg = lastLog ? lastLog.ppg.toFixed(1) : '14.5';
  const fgPct = lastLog ? lastLog.fgPct.toFixed(1) : '45.0';
  const leagueName = LEAGUE_CONFIG[career.league].shortName;

  return text
    .replace(/\{playerName\}/g, career.name || '선수')
    .replace(/\{teamName\}/g, career.team.name)
    .replace(/\{teamShortName\}/g, career.team.shortName)
    .replace(/\{leagueName\}/g, leagueName)
    .replace(/\{rivalName\}/g, rivalName)
    .replace(/\{rivalTeamName\}/g, rivalTeamName)
    .replace(/\{rivalPpg\}/g, rivalPpg)
    .replace(/\{ppg\}/g, ppg)
    .replace(/\{fgPct\}/g, fgPct)
    .replace(/\{age\}/g, String(career.age));
}

function makeCategoryScenarios(
  category: EncounterArchetypeCategory,
  items: Array<{
    code: string;
    title: string;
    subtitle: string;
    description: string;
    requiredTags?: CareerContextTag[];
    allowedLeagues?: LeagueId[];
    minAge?: number;
    maxAge?: number;
    traitChoice?: {
      trait: PlayerTraitId;
      label: string;
      description: string;
      effectSummary: string;
      statChanges?: CareerEventChoice['statChanges'];
      trustDelta?: number;
      draftStockDelta?: number;
    };
    chainFollowUp?: {
      title: string;
      description: string;
      statChanges: CareerEventChoice['statChanges'];
      trustDelta: number;
    };
    choiceA: CareerEventChoice;
    choiceB: CareerEventChoice;
  }>
): EncounterScenarioTemplate[] {
  return items.map((item) => {
    const choices: CareerEventChoice[] = [];

    const aWithChain: CareerEventChoice = item.chainFollowUp
      ? {
          ...item.choiceA,
          nextChainEvent: {
            id: `${item.code}_CHAIN_FOLLOWUP`,
            title: item.chainFollowUp.title,
            subtitle: '이전 시즌 선택에 따른 후속 연쇄 이벤트',
            description: item.chainFollowUp.description,
            category,
            choices: [
              {
                label: '결실을 코트 위 퍼포먼스로 증명한다',
                description: '꾸준히 준비한 과정을 실전 경기에 그대로 녹여냅니다.',
                effectSummary: '핵심 능력치 추가 상승 및 감독 신뢰도 상승',
                statChanges: item.chainFollowUp.statChanges,
                trustDelta: item.chainFollowUp.trustDelta,
              },
              {
                label: '팀 동료들과 성과를 나누며 라커룸 결속을 다진다',
                description: '개인 기록보다 팀 케미스트리를 우선시합니다.',
                effectSummary: '플레이메이킹 +1 / 감독 신뢰도 +6',
                statChanges: { ply: 1 },
                trustDelta: 6,
              },
            ],
          },
        }
      : item.choiceA;

    choices.push(aWithChain, item.choiceB);

    if (item.traitChoice) {
      choices.push({
        label: item.traitChoice.label,
        description: item.traitChoice.description,
        effectSummary: item.traitChoice.effectSummary,
        requiredTrait: item.traitChoice.trait,
        statChanges: item.traitChoice.statChanges,
        trustDelta: item.traitChoice.trustDelta,
        draftStockDelta: item.traitChoice.draftStockDelta,
      });
    }

    return {
      id: item.code,
      category,
      requiredTags: item.requiredTags,
      allowedLeagues: item.allowedLeagues,
      minAge: item.minAge,
      maxAge: item.maxAge,
      title: item.title,
      subtitle: item.subtitle,
      description: item.description,
      choices,
    };
  });
}

/**
 * Axis 2: 12대 인카운터 아키타입 × 4개 세부 시나리오 = 총 48종의 풍부한 유기적 이벤트 풀
 */
export const ENCOUNTER_SCENARIO_POOL: EncounterScenarioTemplate[] = [
  // 1. TACTICAL_CLASH (전술 및 시스템 충돌 - 4종)
  ...makeCategoryScenarios('TACTICAL_CLASH', [
    {
      code: 'ENC_TAC_01',
      title: '하프코트 세트오펜스 vs 런앤건 속도전 논쟁',
      subtitle: '{teamName} 전술 미팅에서의 정면충돌',
      description:
        '{teamName} 코칭스태프가 이번 시즌 공격 템포를 두고 선수단과 긴급 미팅을 열었어요. 평균 {ppg}점을 기록 중인 {playerName} 선수에게 공격 전개 방식에 대한 의견을 묻습니다.',
      choiceA: {
        label: '감독의 정교한 하프코트 시스템에 맞춘다',
        description: '약속된 스크린과 패턴 플레이를 철저히 이행합니다.',
        effectSummary: '플레이메이킹 +1 / 감독 신뢰도 +7',
        statChanges: { ply: 1 },
        trustDelta: 7,
      },
      choiceB: {
        label: '트랜지션 속공과 얼리 오펜스 비중 확대를 건의한다',
        description: '수비 성공 직후 빠른 템포로 상대 수비가 정돈되기 전에 공략합니다.',
        effectSummary: '피지컬 +1, 인사이드 +1 / 감독 신뢰도 -2',
        statChanges: { phy: 1, ins: 1 },
        trustDelta: -2,
      },
      traitChoice: {
        trait: 'CLUTCH_PERFORMER',
        label: '[승부사] 4쿼터 클러치 타임에 한해 자율 아이솔레이션 권한을 요청한다',
        description: '평소엔 시스템을 따르되 승부처에서는 직접 해결사로 나섭니다.',
        effectSummary: '인사이드 +1, 아웃사이드 +1 / 감독 신뢰도 +5',
        statChanges: { ins: 1, out: 1 },
        trustDelta: 5,
      },
      chainFollowUp: {
        title: '새로 자리 잡은 하프코트 모션 오펜스의 결실',
        description:
          '지난 시즌 전술 미팅에서 코칭스태프와 뜻을 모았던 하프코트 패턴이 완벽히 체화되어 {teamName}의 핵심 공격 무기로 자리 잡았어요!',
        statChanges: { ply: 2, out: 1 },
        trustDelta: 6,
      },
    },
    {
      code: 'ENC_TAC_02',
      title: '스위치 디펜스와 드롭 백 수비 전술 개편',
      subtitle: '{leagueName} 상위권 공격수들을 막기 위한 수비 실험',
      description:
        '수비 코치가 상대 픽앤롤을 제어하기 위해 전원 스위치 디펜스를 도입하자고 주장해요. {playerName} 선수의 수비 활동량과 판단력이 시험대에 올랐어요.',
      choiceA: {
        label: '공격적인 외곽 스위치 & 트랩 수비에 앞장선다',
        description: '체력 소모를 감수하고 볼핸들러를 강하게 압박합니다.',
        effectSummary: '수비력 +2 / 피지컬 -1, 감독 신뢰도 +5',
        statChanges: { def: 2, phy: -1 },
        trustDelta: 5,
      },
      choiceB: {
        label: '페인트존 보호와 리바운드 박스아웃 중심 수비를 고수한다',
        description: '골밑 실점을 최소화하고 수비 리바운드를 확실히 사수합니다.',
        effectSummary: '리바운드 +2 / 감독 신뢰도 +2',
        statChanges: { reb: 2 },
        trustDelta: 2,
      },
    },
    {
      code: 'ENC_TAC_03',
      title: '4쿼터 클러치 볼핸들러 위임 논쟁',
      subtitle: '박빙 승부처에서 누구의 손에 공을 맡길 것인가',
      description:
        '최근 {teamName}이 접전 승부에서 연이어 아쉬운 턴오버를 범하자, 감독이 마지막 2분 공격 조립 책임을 {playerName} 선수에게 맡길지 고심하고 있어요.',
      choiceA: {
        label: '마지막 공격의 온볼 결정권을 직접 책임지겠다고 자청한다',
        description: '부담감을 이겨내고 승부처 1옵션 역할을 수행합니다.',
        effectSummary: '인사이드 +1, 아웃사이드 +1 / 감독 신뢰도 +4',
        statChanges: { ins: 1, out: 1 },
        trustDelta: 4,
      },
      choiceB: {
        label: '오프볼 스크린을 활용해 위크사이드 오픈 찬스를 노린다',
        description: '수비 시선을 분산시켜 가장 확률 높은 슛 찬스를 만듭니다.',
        effectSummary: '아웃사이드 +2 / 감독 신뢰도 +3',
        statChanges: { out: 2 },
        trustDelta: 3,
      },
    },
    {
      code: 'ENC_TAC_04',
      title: '5-Out 스페이싱 시스템과 페인트존 어택의 조화',
      subtitle: '현대 농구 트렌드에 맞춘 코트 밸런스 재조정',
      description:
        '전력분석팀이 야투율({fgPct}%) 데이터를 제시하며 코트 넓이를 극대화하는 5-Out 대형을 제안했어요. {playerName} 선수도 동선을 조정해야 합니다.',
      choiceA: {
        label: '코너와 윙 3점 라인 밖으로 넓게 서서 스페이싱을 살린다',
        description: '외곽 슛 빈도를 높여 동료들의 돌파 공간을 열어줍니다.',
        effectSummary: '아웃사이드 +2 / 감독 신뢰도 +4',
        statChanges: { out: 2 },
        trustDelta: 4,
      },
      choiceB: {
        label: '하이포스트와 덩커 스팟을 오가며 컷인 득점을 노린다',
        description: '수비수의 시야 사각지대를 파고드는 영리한 오프볼 움직임을 가져갑니다.',
        effectSummary: '인사이드 +2 / 감독 신뢰도 +3',
        statChanges: { ins: 2 },
        trustDelta: 3,
      },
    },
  ]),

  // 2. LOCKER_ROOM (라커룸 케미스트리 및 리더십 - 4종)
  ...makeCategoryScenarios('LOCKER_ROOM', [
    {
      code: 'ENC_LCK_01',
      title: '연패 수렁에 빠진 라커룸의 무거운 침묵',
      subtitle: '분위기 반전이 절실한 {teamName} 선수단',
      description:
        '아쉬운 역전패가 이어지며 {teamName} 라커룸 분위기가 얼어붙었어요. 고참과 신인 선수들 사이에 미묘한 긴장감마저 감돌고 있어요.',
      choiceA: {
        label: '선수단 전용 미팅을 소집해 허심탄회하게 결속을 다진다',
        description: '서로의 고충을 들어주고 원팀 정신을 일깨웁니다.',
        effectSummary: '플레이메이킹 +1, 수비력 +1 / 감독 신뢰도 +6',
        statChanges: { ply: 1, def: 1 },
        trustDelta: 6,
      },
      choiceB: {
        label: '말 대신 가장 먼저 체육관에 나와 묵묵히 야간 슈팅 훈련을 한다',
        description: '행동으로 솔선수범하여 동료들에게 자극을 줍니다.',
        effectSummary: '아웃사이드 +2 / 감독 신뢰도 +4',
        statChanges: { out: 2 },
        trustDelta: 4,
      },
      traitChoice: {
        trait: 'FRANCHISE_HEART',
        label: '[프랜차이즈의 심장] 구단 역사와 자부심을 일깨우는 연설로 라커룸을 하나로 묶는다',
        description: '프랜차이즈 리더로서 흔들리는 선수단의 중심을 완벽히 잡습니다.',
        effectSummary: '플레이메이킹 +2, 수비력 +1 / 감독 신뢰도 +9',
        statChanges: { ply: 2, def: 1 },
        trustDelta: 9,
      },
    },
    {
      code: 'ENC_LCK_02',
      title: '신인 후배와의 볼 배분 및 출전 시간 갈등',
      subtitle: '패기 넘치는 팀 내 유망주의 도전장',
      description:
        '팀에 새로 합류한 신인 선수가 훈련 중 무리한 개인기를 남발하며 {playerName} 선수에게 패스를 건네지 않는 장면이 잦아졌어요.',
      choiceA: {
        label: '훈련 후 따로 불러 비디오를 함께 보며 투맨게임 호흡을 맞춘다',
        description: '선배로서 노하우를 전수하고 시너지를 끌어냅니다.',
        effectSummary: '플레이메이킹 +2 / 감독 신뢰도 +5',
        statChanges: { ply: 2 },
        trustDelta: 5,
      },
      choiceB: {
        label: '자체 청백전 1대1 매치업에서 압도적인 실력 차이를 보여준다',
        description: '코트 위 경쟁을 통해 주전의 위엄을 각인시킵니다.',
        effectSummary: '인사이드 +1, 수비력 +1 / 감독 신뢰도 +3',
        statChanges: { ins: 1, def: 1 },
        trustDelta: 3,
      },
    },
    {
      code: 'ENC_LCK_03',
      title: '원정 연전 이동 중 벌어진 베테랑과 코치의 언쟁',
      subtitle: '체력 고갈 속 폭발한 선수단 피로감',
      description:
        '빡빡한 원정 일정 중 팀 내 베테랑 선수가 훈련 강도에 불만을 품고 코치와 언성을 높였어요. 주변 선수들이 모두 {playerName} 선수의 눈치를 봅니다.',
      choiceA: {
        label: '양측 사이를 중재하며 선수단 컨디션 조절 일정을 조율한다',
        description: '코칭스태프의 체면을 살리면서도 선수단의 휴식을 이끌어냅니다.',
        effectSummary: '플레이메이킹 +1, 피지컬 +1 / 감독 신뢰도 +6',
        statChanges: { ply: 1, phy: 1 },
        trustDelta: 6,
      },
      choiceB: {
        label: '코칭스태프의 기강 확립에 힘을 실어주며 훈련을 끝까지 소화한다',
        description: '엄격한 팀 규율을 유지하는 데 동참합니다.',
        effectSummary: '수비력 +1 / 감독 신뢰도 +7',
        statChanges: { def: 1 },
        trustDelta: 7,
      },
    },
    {
      code: 'ENC_LCK_04',
      title: '플레이오프 진출을 앞둔 선수단 단합 만찬',
      subtitle: '{teamName}의 봄 농구 각오 다지기',
      description:
        '시즌 막바지 순위 싸움이 한창인 가운데, {playerName} 선수가 선수단 전체 회식을 제안할 기회가 찾아왔어요.',
      choiceA: {
        label: '트레이너와 스태프까지 모두 초대해 격려의 자리를 마련한다',
        description: '보이지 않는 곳에서 헌신하는 스태프들까지 챙기며 사기를 끌어올립니다.',
        effectSummary: '플레이메이킹 +1, 리바운드 +1 / 감독 신뢰도 +6',
        statChanges: { ply: 1, reb: 1 },
        trustDelta: 6,
      },
      choiceB: {
        label: '가벼운 티타임 후 상대 팀 전력분석 영상을 함께 시청한다',
        description: '실전 대비에 초점을 맞춰 전술 완성도를 높입니다.',
        effectSummary: '수비력 +2 / 감독 신뢰도 +5',
        statChanges: { def: 2 },
        trustDelta: 5,
      },
    },
  ]),

  // 3. MEDIA_SPOTLIGHT (미디어 인터뷰 및 여론전 - 4종)
  ...makeCategoryScenarios('MEDIA_SPOTLIGHT', [
    {
      code: 'ENC_MED_01',
      title: '전국 생중계 경기 직후 수훈선수 마이크 인터뷰',
      subtitle: '{leagueName} 팬들의 이목이 쏠린 코트 중앙',
      description:
        '화려한 활약으로 팀 승리를 이끈 직후 방송국 리포터가 {playerName} 선수에게 다가와 이번 시즌 목표와 자신감을 물었어요.',
      choiceA: {
        label: '"동료들의 헌신 덕분에 넣은 득점입니다. 목표는 오직 우승뿐입니다!"',
        description: '겸손하면서도 팀 중심적인 인터뷰로 코칭스태프와 팬들의 박수를 받습니다.',
        effectSummary: '플레이메이킹 +1 / 감독 신뢰도 +6, 스카우팅 주가 +3',
        statChanges: { ply: 1 },
        trustDelta: 6,
        draftStockDelta: 3,
      },
      choiceB: {
        label: '"지금 제 폼이라면 {leagueName} 누구도 저를 1대1로 막을 수 없습니다!"',
        description: '도발적인 쇼맨십으로 미디어 헤드라인을 장식합니다.',
        effectSummary: '인사이드 +1, 아웃사이드 +1 / 스카우팅 주가 +6, 감독 신뢰도 -2',
        statChanges: { ins: 1, out: 1 },
        trustDelta: -2,
        draftStockDelta: 6,
      },
    },
    {
      code: 'ENC_MED_02',
      title: '해설위원의 공개 비판과 수비 공헌도 논란',
      subtitle: '스포츠 토크쇼에서 도마 위에 오른 {playerName}',
      description:
        '유명 농구 해설위원이 방송에서 "{playerName} 선수는 공격(평균 {ppg}점)에 비해 수비 적극성이 아쉽다"라고 날 선 비평을 남겼어요.',
      choiceA: {
        label: '다음 경기에서 상대 에이스를 전담 마크하며 실력으로 입을 다물게 한다',
        description: '비판을 연료 삼아 코트 위 수비 에너지 레벨을 끌어올립니다.',
        effectSummary: '수비력 +2, 리바운드 +1 / 감독 신뢰도 +5',
        statChanges: { def: 2, reb: 1 },
        trustDelta: 5,
      },
      choiceB: {
        label: '"기록지에 보이지 않는 팀 전술 움직임을 모르는 소리"라며 반박한다',
        description: '흔들리지 않고 본인의 공격 리듬과 슈팅 밸런스를 유지합니다.',
        effectSummary: '아웃사이드 +2 / 스카우팅 주가 +3',
        statChanges: { out: 2 },
        draftStockDelta: 3,
      },
    },
    {
      code: 'ENC_MED_03',
      title: '유명 스포츠 매거진 커버스토리 단독 화보 촬영',
      subtitle: '{leagueName} 차세대 아이콘으로 선정된 {playerName}',
      description:
        '권위 있는 농구 전문지에서 {playerName} 선수를 이번 달 표지 모델로 선정하고 심층 인터뷰를 요청했어요.',
      choiceA: {
        label: '휴식일 반나절만 할애해 깔끔하게 촬영하고 오후엔 훈련장으로 복귀한다',
        description: '미디어 노출과 본업인 농구 훈련의 균형을 완벽히 지킵니다.',
        effectSummary: '아웃사이드 +1 / 감독 신뢰도 +4, 스카우팅 주가 +4',
        statChanges: { out: 1 },
        trustDelta: 4,
        draftStockDelta: 4,
      },
      choiceB: {
        label: '심층 다큐멘터리 촬영까지 수락해 전국적인 스타성을 극대화한다',
        description: '대중적 인지도와 스카우트 주목도를 크게 끌어올립니다.',
        effectSummary: '스카우팅 주가 +8 / 감독 신뢰도 -2',
        trustDelta: -2,
        draftStockDelta: 8,
      },
    },
    {
      code: 'ENC_MED_04',
      title: '판정 불이익 논란 속 기자회견장의 날카로운 질문',
      subtitle: '석연치 않은 종료 직전 휘슬에 대한 질문 세례',
      description:
        '경기 막판 아쉬운 판정으로 승부를 내준 뒤 공식 기자회견장에서 기자들이 심판 판정에 대한 솔직한 심경을 유도하고 있어요.',
      choiceA: {
        label: '"판정은 심판의 몫입니다. 판정 이전에 우리가 더 완벽했어야 합니다."',
        description: '성숙한 프로 의식으로 징계를 피하고 품격을 지킵니다.',
        effectSummary: '플레이메이킹 +1 / 감독 신뢰도 +6',
        statChanges: { ply: 1 },
        trustDelta: 6,
      },
      choiceB: {
        label: '"선수들의 땀방울이 정당하게 평가받길 바랍니다"라며 소신 발언한다',
        description: '선수단과 팬들의 열렬한 지지를 얻습니다.',
        effectSummary: '피지컬 +1, 수비력 +1 / 스카우팅 주가 +4',
        statChanges: { phy: 1, def: 1 },
        draftStockDelta: 4,
      },
    },
  ]),

  // 4. RIVAL_SHOWDOWN (숙적 및 동기 라이벌 매치업 - 4종)
  ...makeCategoryScenarios('RIVAL_SHOWDOWN', [
    {
      code: 'ENC_RIV_01',
      title: '숙명의 라이벌 {rivalName} 선수의 도발적인 인터뷰',
      subtitle: '{rivalTeamName}전을 이틀 앞둔 폭풍전야',
      description:
        '이번 시즌 평균 {rivalPpg}점을 기록 중인 라이벌 {rivalName}({rivalTeamName}) 선수가 언론 인터뷰에서 "{playerName}과의 매치업은 언제나 손쉬운 먹잇감"이라며 도발했어요!',
      choiceA: {
        label: '공수 양면에서 {rivalName}과 전 시간 매치업을 자청해 정면 승부한다',
        description: '자존심을 건 진검승부로 한계를 돌파합니다.',
        effectSummary: '인사이드 +1, 수비력 +2 / 감독 신뢰도 +5',
        statChanges: { ins: 1, def: 2 },
        trustDelta: 5,
      },
      choiceB: {
        label: '개인 맞대결에 휘말리지 않고 동료들을 살리는 팀 승리로 응수한다',
        description: '냉정함을 유지하며 어시스트와 스페이싱으로 상대를 무너뜨립니다.',
        effectSummary: '플레이메이킹 +2, 아웃사이드 +1 / 감독 신뢰도 +6',
        statChanges: { ply: 2, out: 1 },
        trustDelta: 6,
      },
      traitChoice: {
        trait: 'CLUTCH_PERFORMER',
        label: '[승부사] 4쿼터 종료 버저비터 매치업에서 {rivalName} 앞에서 위닝샷을 꽂는다',
        description: '라이벌이 보는 앞에서 클러치 지배력을 증명합니다.',
        effectSummary: '아웃사이드 +2, 인사이드 +1 / 스카우팅 주가 +6, 감독 신뢰도 +6',
        statChanges: { out: 2, ins: 1 },
        trustDelta: 6,
        draftStockDelta: 6,
      },
    },
    {
      code: 'ENC_RIV_02',
      title: '비시즌 픽업 게임에서 마주친 {rivalName}과의 1대1',
      subtitle: '카메라 없는 체육관에서 펼쳐진 자존심 대결',
      description:
        '휴식일 개인 훈련장을 찾았다가 우연히 {rivalName} 선수와 마주쳤어요. 자연스럽게 자존심을 건 11점 내기 1대1 단판 승부가 벌어집니다.',
      choiceA: {
        label: '강한 몸싸움과 포스트업·돌파로 집요하게 림을 폭격한다',
        description: '피지컬 우위와 인사이드 마무리 감각을 극한으로 끌어올립니다.',
        effectSummary: '인사이드 +2, 피지컬 +1',
        statChanges: { ins: 2, phy: 1 },
      },
      choiceB: {
        label: '현란한 스텝백과 풀업 점퍼로 손끝 감각을 점검한다',
        description: '수비수의 간격을 무너뜨리는 외곽 슈팅 기술을 가다듬습니다.',
        effectSummary: '아웃사이드 +2, 플레이메이킹 +1',
        statChanges: { out: 2, ply: 1 },
      },
    },
    {
      code: 'ENC_RIV_03',
      title: '{leagueName} 주간 MVP 선정을 둘러싼 라이벌 경쟁',
      subtitle: '{playerName} vs {rivalName}, 뜨거운 스포트라이트',
      description:
        '이번 주 {leagueName} 최고의 화제는 평균 {ppg}점의 {playerName} 선수와 {rivalPpg}점의 {rivalName} 선수 중 누가 주간 최고의 별인가입니다.',
      choiceA: {
        label: '공격 볼륨을 더욱 끌어올려 압도적인 득점 쇼케이스를 펼친다',
        description: '화려한 다득점 경기로 스카우트와 팬들의 시선을 사로잡습니다.',
        effectSummary: '인사이드 +1, 아웃사이드 +1 / 스카우팅 주가 +5',
        statChanges: { ins: 1, out: 1 },
        draftStockDelta: 5,
      },
      choiceB: {
        label: '리바운드와 블록슛, 스틸 등 궂은일 마진으로 팀 승률을 챙긴다',
        description: '공수 겸장으로서의 가치를 증명합니다.',
        effectSummary: '수비력 +1, 리바운드 +2 / 감독 신뢰도 +5',
        statChanges: { def: 1, reb: 2 },
        trustDelta: 5,
      },
    },
    {
      code: 'ENC_RIV_04',
      title: '{rivalTeamName}의 집중 견제 수비 분석 리포트',
      subtitle: '{playerName} 봉쇄를 위해 준비된 박스앤원 전술',
      description:
        '다가오는 맞대결에서 {rivalTeamName}이 {playerName} 선수를 막기 위해 변칙적인 박스앤원(Box-and-1) 수비를 준비했다는 정보가 입수되었어요.',
      choiceA: {
        label: '빠른 원터치 패스와 그래비티 활용으로 수비 대형을 파훼한다',
        description: '수비가 몰리는 순간 노마크 동료를 정확히 찾아냅니다.',
        effectSummary: '플레이메이킹 +2 / 감독 신뢰도 +6',
        statChanges: { ply: 2 },
        trustDelta: 6,
      },
      choiceB: {
        label: '터프샷 메이킹 훈련을 통해 이중 수비 위에서도 득점을 꽂아 넣는다',
        description: '콘택트와 견제를 이겨내는 슛 밸런스를 완성합니다.',
        effectSummary: '아웃사이드 +1, 인사이드 +1 / 스카우팅 주가 +4',
        statChanges: { out: 1, ins: 1 },
        draftStockDelta: 4,
      },
    },
  ]),

  // 5. SLUMP_MECHANICS (슈팅 슬럼프 및 폼 교정 - 4종)
  ...makeCategoryScenarios('SLUMP_MECHANICS', [
    {
      code: 'ENC_SLM_01',
      title: '미묘하게 흔들린 슈팅 릴리즈 포인트와 림 외면',
      subtitle: '야투율 {fgPct}%의 벽을 넘기 위한 메커니즘 점검',
      description:
        '최근 경기에서 공이 림 앞쪽에 걸리는 현상이 반복되자 슈팅 코치가 릴리즈 각도를 3도 높이는 폼 교정을 제안했어요.',
      choiceA: {
        label: '시즌 중이라도 과감하게 슈팅 릴리즈 아크 교정에 돌입한다',
        description: '단기적인 어색함을 극복하고 더 높은 포물선을 장착합니다.',
        effectSummary: '아웃사이드 +2 / 감독 신뢰도 +3',
        statChanges: { out: 2 },
        trustDelta: 3,
      },
      choiceB: {
        label: '기존 슛폼을 유지하되 골밑 돌파와 자유투 획득으로 감각을 찾는다',
        description: '림 근처 쉬운 득점부터 차근차근 손끝 감각을 깨웁니다.',
        effectSummary: '인사이드 +2 / 감독 신뢰도 +3',
        statChanges: { ins: 2 },
        trustDelta: 3,
      },
      traitChoice: {
        trait: 'SNIPER',
        label: '[스나이퍼] 하체 밸런스와 손목 스냅 미세 영점 조절로 단숨에 슛감을 회복한다',
        description: '타고난 슈터의 감각으로 슬럼프를 즉시 타파합니다.',
        effectSummary: '아웃사이드 +3 / 감독 신뢰도 +5',
        statChanges: { out: 3 },
        trustDelta: 5,
      },
    },
    {
      code: 'ENC_SLM_02',
      title: '클러치 자유투 에어볼 이후 찾아온 심리적 압박',
      subtitle: '스포츠 심리 상담가의 멘탈 코칭 제안',
      description:
        '접전 상황 자유투 라인에서 아쉬운 실수가 나온 뒤, 구단 멘탈 코치가 루틴 재설정과 호흡 명상 프로그램을 권유했어요.',
      choiceA: {
        label: '새로운 자유투 루틴과 호흡법을 도입해 평정심을 되찾는다',
        description: '심박수를 낮추고 일정한 리듬으로 슛을 던집니다.',
        effectSummary: '아웃사이드 +1, 플레이메이킹 +1 / 감독 신뢰도 +4',
        statChanges: { out: 1, ply: 1 },
        trustDelta: 4,
      },
      choiceB: {
        label: '매일 밤 자유투 500개 연속 성공 훈련으로 몸에 기억시킨다',
        description: '압도적인 연습량으로 불안감을 정면 돌파합니다.',
        effectSummary: '아웃사이드 +2',
        statChanges: { out: 2 },
      },
    },
    {
      code: 'ENC_SLM_03',
      title: '상대 수비의 언더(Under) 스크린 유도 파훼법',
      subtitle: '볼핸들링 중 좁혀오는 수비 간격 극복하기',
      description:
        '상대 수비수들이 스크린 아래로 돌아가며 {playerName} 선수의 풀업 점퍼를 시험하고 있어요. 코칭스태프가 대응책을 주문합니다.',
      choiceA: {
        label: '스크린 직후 망설임 없는 딥쓰리(Deep 3) 풀업으로 응징한다',
        description: '수비가 물러설 수 없도록 외곽 사거리를 확장합니다.',
        effectSummary: '아웃사이드 +2 / 스카우팅 주가 +3',
        statChanges: { out: 2 },
        draftStockDelta: 3,
      },
      choiceB: {
        label: '스크리너와 리스크린(Re-screen) 호흡을 맞춰 미드레인지를 공략한다',
        description: '영리한 투맨 게임으로 완벽한 오픈 공간을 창출합니다.',
        effectSummary: '플레이메이킹 +1, 인사이드 +1 / 감독 신뢰도 +5',
        statChanges: { ply: 1, ins: 1 },
        trustDelta: 5,
      },
    },
    {
      code: 'ENC_SLM_04',
      title: '고속 카메라 바이오메카닉 슈팅 밸런스 분석',
      subtitle: '구단 스포츠과학 랩의 정밀 진단 결과',
      description:
        '스포츠과학 랩에서 점프 착지 시 좌우 밸런스가 미세하게 무너져 후반 쿼터 야투율이 떨어진다는 분석 결과를 내놓았어요.',
      choiceA: {
        label: '코어 및 하체 밸런스 보강 운동을 병행해 점프 축을 바로잡는다',
        description: '4쿼터 지친 상황에서도 흔들리지 않는 하체 힘을 기릅니다.',
        effectSummary: '피지컬 +1, 아웃사이드 +1 / 감독 신뢰도 +4',
        statChanges: { phy: 1, out: 1 },
        trustDelta: 4,
      },
      choiceB: {
        label: '원모션(One-motion) 빠른 릴리즈로 체력 소모를 줄인다',
        description: '점프 높이에 덜 의존하는 간결한 슛 메커니즘을 익힙니다.',
        effectSummary: '아웃사이드 +2',
        statChanges: { out: 2 },
      },
    },
  ]),

  // 6. LOAD_MANAGEMENT (부상 관리 및 스포츠 과학 - 4종)
  ...makeCategoryScenarios('LOAD_MANAGEMENT', [
    {
      code: 'ENC_LDM_01',
      title: '백투백 원정 강행군과 의무팀의 결장 권고',
      subtitle: '피로 누적 경고가 뜬 {playerName}의 바이오 데이터',
      description:
        '연속 원정 경기를 앞두고 의무팀장이 근육 피로도가 임계치에 가까워졌다며 오늘 경기는 출전을 쉬어가자고 감독에게 보고했어요.',
      choiceA: {
        label: '의무팀의 권고를 받아들여 크라이오테라피 회복에 집중한다',
        description: '장기 레이스를 위해 몸 상태를 100%로 재충전합니다.',
        effectSummary: '피지컬 +2 / 감독 신뢰도 +2',
        statChanges: { phy: 2 },
        trustDelta: 2,
      },
      choiceB: {
        label: '출전 시간을 20분 내외로 제한하는 조건으로 코트에 나선다',
        description: '팀을 위해 출전하되 효율적인 플레이로 무리를 피합니다.',
        effectSummary: '플레이메이킹 +1 / 감독 신뢰도 +6',
        statChanges: { ply: 1 },
        trustDelta: 6,
      },
      traitChoice: {
        trait: 'IRON_STAMINA',
        label: '[강철 체력] 타고난 회복력으로 풀타임을 소화하며 팀 승리를 견인한다',
        description: '강철 체력 특성으로 피로 경고를 무색하게 만듭니다.',
        effectSummary: '피지컬 +2, 리바운드 +1 / 감독 신뢰도 +8',
        statChanges: { phy: 2, reb: 1 },
        trustDelta: 8,
      },
    },
    {
      code: 'ENC_LDM_02',
      title: '발목 테이핑 보강과 착지 메커니즘 재설계',
      subtitle: '잦은 골밑 충돌 속에서 선수 생명 지키기',
      description:
        '골밑 경합 도중 상대 발을 밟을 뻔한 아찔한 장면이 나온 뒤, 전담 트레이너가 발목 안정화 프로그램과 전용 보호대 착용을 제안했어요.',
      choiceA: {
        label: '고강도 발목 안정화 재활과 착지 분산 훈련을 철저히 수행한다',
        description: '부상 위험을 원천 차단하고 내구도를 높입니다.',
        effectSummary: '피지컬 +2, 수비력 +1',
        statChanges: { phy: 2, def: 1 },
      },
      choiceB: {
        label: '민첩성을 유지하기 위해 가벼운 테이핑만 하고 스텝 속도를 살린다',
        description: '순간 가속력과 퍼스트 스텝의 날카로움을 유지합니다.',
        effectSummary: '인사이드 +2',
        statChanges: { ins: 2 },
      },
    },
    {
      code: 'ENC_LDM_03',
      title: '개인 전담 영양사 및 수면 사이클 최적화 프로젝트',
      subtitle: '프로 선수로서의 철저한 자기관리 투자',
      description:
        '시즌 후반기로 갈수록 체력 저하를 막기 위해 스포츠 영양학 전문가가 맞춤형 식단과 수면 코칭 프로그램을 제안했어요.',
      choiceA: {
        label: '엄격한 항염증 식단과 수면 루틴을 도입해 컨디션을 극대화한다',
        description: '철저한 루틴 관리로 코트 위 지구력을 끌어올립니다.',
        effectSummary: '피지컬 +2 / 감독 신뢰도 +4',
        statChanges: { phy: 2 },
        trustDelta: 4,
      },
      choiceB: {
        label: '웨이트 트레이닝 중량을 늘려 파워와 몸싸움 경쟁력을 키운다',
        description: '골밑 박스아웃과 포스트 수비 힘을 보강합니다.',
        effectSummary: '리바운드 +2, 피지컬 +1',
        statChanges: { reb: 2, phy: 1 },
      },
    },
    {
      code: 'ENC_LDM_04',
      title: '초저온 냉각치료(크라이오) 및 수중 러닝 회복 세션',
      subtitle: '{teamName} 클럽하우스 최신 회복 설비 가동',
      description:
        '구단이 선수들의 회복을 돕기 위해 최신 수중 트레드밀과 냉각 캡슐을 도입했어요. 휴식일 회복 세션을 어떻게 활용할지 선택하세요.',
      choiceA: {
        label: '관절 부담 없는 수중 코어 훈련으로 민첩성과 체력을 동시에 잡는다',
        description: '부상 없이 하체 밸런스와 지구력을 탄탄히 다집니다.',
        effectSummary: '피지컬 +2 / 감독 신뢰도 +3',
        statChanges: { phy: 2 },
        trustDelta: 3,
      },
      choiceB: {
        label: '빠르게 피로를 푼 뒤 전술 비디오 분석실에서 상대 수비 습관을 연구한다',
        description: '체력 회복과 농구 지능(BQ) 향상을 함께 챙깁니다.',
        effectSummary: '플레이메이킹 +1, 수비력 +1 / 감독 신뢰도 +4',
        statChanges: { ply: 1, def: 1 },
        trustDelta: 4,
      },
    },
  ]),

  // 7. OFF_COURT_BRAND (스폰서십, 브랜드 및 사회공헌 - 4종)
  ...makeCategoryScenarios('OFF_COURT_BRAND', [
    {
      code: 'ENC_BRD_01',
      title: '글로벌 스포츠 브랜드의 시그니처 농구화 프로토타입 제안',
      subtitle: '{playerName}의 플레이스타일을 담은 커스텀 농구화 테스트',
      description:
        '유명 스포츠 용품사에서 {playerName} 선수의 발 모양과 스텝에 맞춘 커스텀 농구화 라인업을 제안하며, 디자인 방향성에 대한 의견을 구했어요.',
      choiceA: {
        label: '최상의 접지력과 발목 지지력을 갖춘 실전 퍼포먼스형으로 제작한다',
        description: '코트 위 급격한 방향 전환과 수비 스텝에 최적화된 신발을 완성합니다.',
        effectSummary: '수비력 +1, 피지컬 +1 / 스카우팅 주가 +3',
        statChanges: { def: 1, phy: 1 },
        draftStockDelta: 3,
      },
      choiceB: {
        label: '초경량 쿠셔닝과 화려한 컬러웨이를 강조한 스타성 중심 모델을 택한다',
        description: '폭발적인 공격 이미지와 대중적 인기를 동시에 끌어올립니다.',
        effectSummary: '인사이드 +1 / 스카우팅 주가 +6',
        statChanges: { ins: 1 },
        draftStockDelta: 6,
      },
    },
    {
      code: 'ENC_BRD_02',
      title: '유소년 농구 클리닉 및 연고지 야외 코트 기증 행사',
      subtitle: '{teamName} 연고지 팬들과 함께하는 뜻깊은 하루',
      description:
        '구단 홍보팀에서 지역 유소년 농구 꿈나무들을 위한 일일 스킬 캠프 멘토로 {playerName} 선수를 초청했어요.',
      choiceA: {
        label: '아이들과 일일이 눈을 맞추며 기본기 패스와 슛 동작을 정성껏 가르친다',
        description: '가르치는 과정에서 본인의 기본기 또한 한층 더 단단해집니다.',
        effectSummary: '플레이메이킹 +1, 아웃사이드 +1 / 감독 신뢰도 +5',
        statChanges: { ply: 1, out: 1 },
        trustDelta: 5,
      },
      choiceB: {
        label: '화려한 덩크와 3점슛 콘테스트 쇼케이스로 현장을 열광시킨다',
        description: '지역 언론의 찬사와 함께 스타성을 입증합니다.',
        effectSummary: '인사이드 +1 / 스카우팅 주가 +5, 감독 신뢰도 +3',
        statChanges: { ins: 1 },
        trustDelta: 3,
        draftStockDelta: 5,
      },
    },
    {
      code: 'ENC_BRD_03',
      title: '스포츠 음료 전국 TV CF 메인 모델 발탁',
      subtitle: '비시즌 및 휴식일을 활용한 광고 촬영 제안',
      description:
        '대형 음료 브랜드에서 {playerName} 선수의 역동적인 플레이에 반해 메인 광고 모델 계약을 제안했어요.',
      choiceA: {
        label: '팀 훈련 일정에 지장이 없는 범위에서만 단발성 촬영을 진행한다',
        description: '구단과의 신뢰를 지키면서 브랜드 가치를 높입니다.',
        effectSummary: '스카우팅 주가 +4 / 감독 신뢰도 +4',
        trustDelta: 4,
        draftStockDelta: 4,
      },
      choiceB: {
        label: '광고 출연료 일부로 팀 트레이닝룸에 최신 회복 장비를 선물한다',
        description: '동료들과 코칭스태프의 절대적인 지지를 얻습니다.',
        effectSummary: '피지컬 +1, 플레이메이킹 +1 / 감독 신뢰도 +7',
        statChanges: { phy: 1, ply: 1 },
        trustDelta: 7,
      },
    },
    {
      code: 'ENC_BRD_04',
      title: '오프코트 다큐멘터리 "코트 너머의 땀방울" 제작 제의',
      subtitle: '{playerName}의 훈련 루틴을 밀착 취재하고 싶다는 제작진',
      description:
        '스포츠 전문 스트리밍 채널에서 {playerName} 선수의 시즌 준비 과정을 다루는 미니 다큐멘터리 제작을 요청했어요.',
      choiceA: {
        label: '새벽 슈팅 훈련과 웨이트 세션만 공개해 진지한 구도자 이미지를 남긴다',
        description: '스카우트들에게 성실한 워크에씩을 강하게 각인시킵니다.',
        effectSummary: '아웃사이드 +1 / 스카우팅 주가 +5, 감독 신뢰도 +3',
        statChanges: { out: 1 },
        trustDelta: 3,
        draftStockDelta: 5,
      },
      choiceB: {
        label: '정중히 고사하고 비공개 전술 완성에만 100% 몰두한다',
        description: '외부 시선을 차단하고 오직 실력 향상에만 집중합니다.',
        effectSummary: '인사이드 +1, 수비력 +1 / 감독 신뢰도 +5',
        statChanges: { ins: 1, def: 1 },
        trustDelta: 5,
      },
    },
  ]),

  // 8. FRONT_OFFICE (프런트 오피스, 계약 및 구단 기조 - 4종)
  ...makeCategoryScenarios('FRONT_OFFICE', [
    {
      code: 'ENC_FRO_01',
      title: '단장(GM)과의 비공개 면담: 구단의 향후 로스터 청사진',
      subtitle: '{teamName} 프런트 오피스 집무실 호출',
      description:
        '{teamName} 단장이 {playerName} 선수를 집무실로 불러 향후 구단 운영 방향과 {playerName} 선수의 팀 내 비전에 대해 솔직한 대화를 요청했어요.',
      choiceA: {
        label: '구단의 장기 플랜에 전적으로 공감하며 팀의 기둥이 되겠다고 약속한다',
        description: '프런트와 코칭스태프에게 확실한 신뢰를 심어줍니다.',
        effectSummary: '플레이메이킹 +1 / 감독 신뢰도 +8',
        statChanges: { ply: 1 },
        trustDelta: 8,
      },
      choiceB: {
        label: '우승 경쟁을 위해 즉시 전력감 빅맨/슈터 보강이 필요하다고 직언한다',
        description: '승리를 향한 강한 열망을 드러내어 프런트를 자극합니다.',
        effectSummary: '인사이드 +1, 수비력 +1 / 감독 신뢰도 +3, 스카우팅 주가 +4',
        statChanges: { ins: 1, def: 1 },
        trustDelta: 3,
        draftStockDelta: 4,
      },
      traitChoice: {
        trait: 'CONTRACT_YEAR_BOOST',
        label: '[FA 로이드] 이번 시즌 압도적 성적으로 구단 최고 대우의 가치를 증명하겠다고 선언한다',
        description: '계약 시즌 특유의 초집중 모드로 코트를 폭격합니다.',
        effectSummary: '인사이드 +2, 아웃사이드 +1 / 스카우팅 주가 +7',
        statChanges: { ins: 2, out: 1 },
        draftStockDelta: 7,
      },
    },
    {
      code: 'ENC_FRO_02',
      title: '트레이드 데드라인을 앞둔 루머와 어수선한 분위기',
      subtitle: '{leagueName} 이적 시장의 태풍의 눈',
      description:
        '트레이드 마감 시한이 다가오며 {teamName}이 로스터 개편을 추진한다는 루머가 돌고 있어요. 기자들과 동료들이 술렁입니다.',
      choiceA: {
        label: '루머에 일절 흔들리지 않고 코트 위에서 시즌 최고 득점 경기를 펼친다',
        description: '대체 불가능한 핵심 전력임을 실력으로 증명합니다.',
        effectSummary: '아웃사이드 +2 / 감독 신뢰도 +6',
        statChanges: { out: 2 },
        trustDelta: 6,
      },
      choiceB: {
        label: '에이전트를 통해 프런트에 확고한 주전 롤 보장을 재확인한다',
        description: '팀 내 입지를 분명히 다지고 경기에 집중합니다.',
        effectSummary: '인사이드 +1 / 감독 신뢰도 +3, 스카우팅 주가 +4',
        statChanges: { ins: 1 },
        trustDelta: 3,
        draftStockDelta: 4,
      },
    },
    {
      code: 'ENC_FRO_03',
      title: '데이터 애널리틱스 팀의 샷 셀렉션 보고서',
      subtitle: '기대 득점(eFG%) 극대화를 요구하는 프런트',
      description:
        '구단 데이터 분석팀에서 미드레인지 점퍼 비중을 줄이고 림 어택과 코너 3점슛 비중을 80% 이상으로 높여달라는 보고서를 전달했어요.',
      choiceA: {
        label: '세이버메트릭스 데이터를 수용해 고효율 구역 공략에 집중한다',
        description: '확률 높은 림 어택과 3점슛 위주로 공격 효율을 극대화합니다.',
        effectSummary: '아웃사이드 +1, 인사이드 +1 / 감독 신뢰도 +6',
        statChanges: { out: 1, ins: 1 },
        trustDelta: 6,
      },
      choiceB: {
        label: '플레이오프 반코트 농구에선 미드레인지 풀업이 필수라며 올라운드 기술을 연마한다',
        description: '수비가 알고도 못 막는 미드레인지 마스터리를 추구합니다.',
        effectSummary: '아웃사이드 +2 / 스카우팅 주가 +3',
        statChanges: { out: 2 },
        draftStockDelta: 3,
      },
    },
    {
      code: 'ENC_FRO_04',
      title: '구단주 특별 격려 방문과 승리 수당 인센티브 발표',
      subtitle: '홈 경기장을 찾은 {teamName} 구단주',
      description:
        '구단주가 직접 라커룸을 방문해 최근 선수단의 투지를 치하하며 강팀과의 홈 경기 필승을 당부했어요.',
      choiceA: {
        label: '몸을 사리지 않는 허슬 플레이와 다이빙 루즈볼로 홈 팬들을 열광시킨다',
        description: '투지 넘치는 플레이로 구단주와 감독의 눈도장을 찍습니다.',
        effectSummary: '수비력 +1, 리바운드 +1 / 감독 신뢰도 +7',
        statChanges: { def: 1, reb: 1 },
        trustDelta: 7,
      },
      choiceB: {
        label: '화려한 패스와 외곽포로 여유 있게 경기를 지배한다',
        description: '세련된 경기 운영 능력을 선보입니다.',
        effectSummary: '플레이메이킹 +1, 아웃사이드 +1 / 감독 신뢰도 +5',
        statChanges: { ply: 1, out: 1 },
        trustDelta: 5,
      },
    },
  ]),

  // 9. ROLE_ADAPTATION (식스맨, 수비 스토퍼, 전술적 역할 변화 - 4종)
  ...makeCategoryScenarios('ROLE_ADAPTATION', [
    {
      code: 'ENC_ROL_01',
      title: '세컨드 유닛을 이끄는 식스맨 야전사령관 임무',
      subtitle: '벤치 구간 득점 가뭄을 해결하기 위한 감독의 특별 지시',
      description:
        '감독이 주전 휴식 구간에 팀 공격이 정체된다며, {playerName} 선수에게 세컨드 유닛과 함께 뛸 때 공격을 전적으로 주도해달라고 요청했어요.',
      choiceA: {
        label: '벤치 멤버들과의 투맨 게임을 주도하며 세컨드 유닛 득점력을 폭발시킨다',
        description: '식스맨 구간 코트 마진을 플러스로 바꾸며 팀의 핵심 고리가 됩니다.',
        effectSummary: '플레이메이킹 +1, 인사이드 +1 / 감독 신뢰도 +7',
        statChanges: { ply: 1, ins: 1 },
        trustDelta: 7,
      },
      choiceB: {
        label: '강력한 압박 수비와 리바운드로 상대 세컨드 유닛을 질식시킨다',
        description: '수비 에너지 레벨로 경기 흐름을 가져옵니다.',
        effectSummary: '수비력 +2, 리바운드 +1 / 감독 신뢰도 +6',
        statChanges: { def: 2, reb: 1 },
        trustDelta: 6,
      },
      traitChoice: {
        trait: 'BENCH_ACE',
        label: '[벤치의 에이스] 교체 투입 즉시 연속 득점을 몰아쳐 경기 흐름을 단숨에 뒤집는다',
        description: '최고의 식스맨다운 폭발력으로 주전 이상의 임팩트를 남깁니다.',
        effectSummary: '인사이드 +2, 아웃사이드 +1 / 감독 신뢰도 +8',
        statChanges: { ins: 2, out: 1 },
        trustDelta: 8,
      },
    },
    {
      code: 'ENC_ROL_02',
      title: '상대 팀 외국인/에이스 스코어러 전담 봉쇄 특명',
      subtitle: '수비 스페셜리스트로서의 가치 증명',
      description:
        '리그 득점 선두를 달리는 상대 에이스를 막기 위해 코칭스태프가 {playerName} 선수에게 페이스 가드(Face-guard) 전담 마크를 맡겼어요.',
      choiceA: {
        label: '하프코트부터 숨 쉴 틈 없이 따라붙어 볼 터치 자체를 차단한다',
        description: '집요한 대인 방어로 상대 에이스의 야투율을 떨어뜨립니다.',
        effectSummary: '수비력 +2, 피지컬 +1 / 감독 신뢰도 +7',
        statChanges: { def: 2, phy: 1 },
        trustDelta: 7,
      },
      choiceB: {
        label: '패스 길목을 읽는 인터셉트와 속공 전환으로 맞불을 놓는다',
        description: '수비를 곧바로 빠른 공격 득점으로 연결합니다.',
        effectSummary: '수비력 +1, 인사이드 +1 / 감독 신뢰도 +5',
        statChanges: { def: 1, ins: 1 },
        trustDelta: 5,
      },
    },
    {
      code: 'ENC_ROL_03',
      title: '스몰볼 라인업 가동과 멀티 포지션 스위칭 실험',
      subtitle: '포지션 파괴 농구에서 살아남기',
      description:
        '감독이 4쿼터 승부처에서 기동성을 극대화하기 위해 스몰볼 라인업을 가동하며 {playerName} 선수에게 한 단계 위 포지션 수비와 박스아웃을 주문했어요.',
      choiceA: {
        label: '낮은 무게중심과 적극적인 박스아웃으로 장신 상대를 완벽히 버텨낸다',
        description: '포지션 대비 뛰어난 리바운드와 수비 지능을 발휘합니다.',
        effectSummary: '리바운드 +2, 수비력 +1 / 감독 신뢰도 +6',
        statChanges: { reb: 2, def: 1 },
        trustDelta: 6,
      },
      choiceB: {
        label: '스피드 미스매치를 역이용해 느린 상대 빅맨을 외곽에서 공략한다',
        description: '기동력 우위를 살려 공격에서 득점 마진을 만듭니다.',
        effectSummary: '아웃사이드 +1, 플레이메이킹 +1 / 감독 신뢰도 +5',
        statChanges: { out: 1, ply: 1 },
        trustDelta: 5,
      },
    },
    {
      code: 'ENC_ROL_04',
      title: '오프볼 무브와 스크린 어시스트 마스터 클래스',
      subtitle: '공을 오래 쥐지 않고도 코트를 지배하는 법',
      description:
        '팀 내 볼 점유율이 높은 동료들과 공존하기 위해, 코치가 {playerName} 선수에게 오프볼 컷인과 핀다운 스크린 활용도를 높여보자고 제안했어요.',
      choiceA: {
        label: '수비의 허를 찌르는 백도어 컷인과 캐치앤슛 타이밍을 완성한다',
        description: '적은 볼 터치로도 최고의 득점 효율을 뽑아냅니다.',
        effectSummary: '아웃사이드 +1, 인사이드 +1 / 감독 신뢰도 +6',
        statChanges: { out: 1, ins: 1 },
        trustDelta: 6,
      },
      choiceB: {
        label: '숏롤(Short-roll) 상황에서 4대3 패스를 뿌리는 연결고리가 된다',
        description: '팀 오펜스의 윤활유 역할을 완벽히 해냅니다.',
        effectSummary: '플레이메이킹 +2 / 감독 신뢰도 +6',
        statChanges: { ply: 2 },
        trustDelta: 6,
      },
    },
  ]),

  // 10. SCOUTING_SHOWCASE (해외 스카우트 방문 및 쇼케이스 - 4종)
  ...makeCategoryScenarios('SCOUTING_SHOWCASE', [
    {
      code: 'ENC_SCT_01',
      title: '관중석 1열에 나타난 상위 리그 스카우트 파견단',
      subtitle: '메모장과 스톱워치를 든 스카우트들의 시선',
      description:
        '오늘 {teamName} 경기의 본부석 맞은편에 상위 리그 구단 스카우트들이 대거 착석해 {playerName} 선수의 일거수일투족을 체크하고 있어요!',
      choiceA: {
        label: '폭발적인 운동능력과 과감한 1대1 돌파·외곽포로 강렬한 인상을 남긴다',
        description: '상위 무대에서도 통할 공격 재능을 확실히 어필합니다.',
        effectSummary: '인사이드 +1, 아웃사이드 +1 / 스카우팅 주가 +8',
        statChanges: { ins: 1, out: 1 },
        draftStockDelta: 8,
      },
      choiceB: {
        label: '안정적인 경기 운영과 스위치 수비, 박스아웃으로 완성도를 보여준다',
        description: '즉시 전력감으로서의 전술 이해도와 수비력을 증명합니다.',
        effectSummary: '플레이메이킹 +1, 수비력 +1 / 스카우팅 주가 +6, 감독 신뢰도 +4',
        statChanges: { ply: 1, def: 1 },
        trustDelta: 4,
        draftStockDelta: 6,
      },
    },
    {
      code: 'ENC_SCT_02',
      title: '비공개 인비테이셔널 프로암(Pro-Am) 미니 캠프 초청',
      subtitle: '검증된 유망주와 프로들이 모이는 프라이빗 런(Run)',
      description:
        '휴식기를 맞아 상위 리그 현역 선수들과 톱 유망주들이 모이는 비공개 미니 캠프에 {playerName} 선수가 특별 초청받았어요.',
      choiceA: {
        label: '한 단계 높은 피지컬의 상대들과 부딪히며 수비와 돌파 기술을 점검한다',
        description: '상위 레벨의 수비 저항에 적응하며 실전 감각을 키웁니다.',
        effectSummary: '인사이드 +1, 수비력 +1 / 스카우팅 주가 +6',
        statChanges: { ins: 1, def: 1 },
        draftStockDelta: 6,
      },
      choiceB: {
        label: '빠른 릴리즈의 3점슛과 픽앤롤 패스로 현대 농구 적합성을 뽐낸다',
        description: '스카우트들이 가장 선호하는 스페이싱과 BQ를 과시합니다.',
        effectSummary: '아웃사이드 +1, 플레이메이킹 +1 / 스카우팅 주가 +7',
        statChanges: { out: 1, ply: 1 },
        draftStockDelta: 7,
      },
    },
    {
      code: 'ENC_SCT_03',
      title: '글로벌 스카우팅 리포트의 약점 지적과 반전 쇼케이스',
      subtitle: '"잠재력은 높지만 약점 보완이 필요하다"는 평가',
      description:
        '최신 유망주 스카우팅 리포트에서 {playerName} 선수의 장점을 호평하면서도 "반대손 마무리와 외곽 일관성 검증이 더 필요하다"는 코멘트가 실렸어요.',
      choiceA: {
        label: '약점으로 지적된 반대손 레이업과 풀업 점퍼를 실전에서 성공시킨다',
        description: '스카우트들의 의구심을 단숨에 지워버립니다.',
        effectSummary: '인사이드 +1, 아웃사이드 +1 / 스카우팅 주가 +7',
        statChanges: { ins: 1, out: 1 },
        draftStockDelta: 7,
      },
      choiceB: {
        label: '본인의 최고 강점인 수비와 에너지 레벨을 극대화해 특화 가치를 높인다',
        description: '확실한 스페셜리티로 스카우팅 점수를 끌어올립니다.',
        effectSummary: '수비력 +2, 피지컬 +1 / 스카우팅 주가 +5',
        statChanges: { def: 2, phy: 1 },
        draftStockDelta: 5,
      },
    },
    {
      code: 'ENC_SCT_04',
      title: '해외 구단 국제 스카우트 디렉터와의 경기 후 티타임',
      subtitle: '글로벌 무대 진출 가능성을 타진하는 대화',
      description:
        '경기 종료 후 해외 스카우트 디렉터가 {playerName} 선수에게 다가와 명함을 건네며 큰 무대에 대한 목표 의식을 물었어요.',
      choiceA: {
        label: '"언제든 세계 최고 무대와 부딪힐 준비가 되어 있습니다"라며 포부를 밝힌다',
        description: '강한 도전 정신으로 국제 스카우트 명단 상단에 이름을 올립니다.',
        effectSummary: '스카우팅 주가 +8 / 피지컬 +1',
        statChanges: { phy: 1 },
        draftStockDelta: 8,
      },
      choiceB: {
        label: '"현재 소속팀 {teamName}의 우승이 최우선입니다"라며 집중력을 보인다',
        description: '현재 시즌에 대한 책임감으로 감독의 깊은 신뢰를 얻습니다.',
        effectSummary: '감독 신뢰도 +7 / 플레이메이킹 +1, 스카우팅 주가 +3',
        statChanges: { ply: 1 },
        trustDelta: 7,
        draftStockDelta: 3,
      },
    },
  ]),

  // 11. NATIONAL_PRIDE (국가대표 및 국제 교류전 - 4종)
  ...makeCategoryScenarios('NATIONAL_PRIDE', [
    {
      code: 'ENC_NAT_01',
      title: '국가대표팀 강화훈련 소집과 태극마크의 무게',
      subtitle: '진천선수촌에서 펼쳐지는 대표팀 주전 경쟁',
      description:
        '국제 대회를 앞두고 {playerName} 선수가 국가대표 강화훈련 명단에 이름을 올렸어요! 각 팀 최고의 에이스들이 모인 자리에서 역할을 증명해야 합니다.',
      choiceA: {
        label: '대표팀의 주포로서 국제 무대 장신 수비를 뚫는 고타점 슛을 연마한다',
        description: '국제 경기 피지컬에 맞서는 득점 기술이 한 단계 성장합니다.',
        effectSummary: '아웃사이드 +2, 인사이드 +1 / 스카우팅 주가 +5',
        statChanges: { out: 2, ins: 1 },
        draftStockDelta: 5,
      },
      choiceB: {
        label: '대표팀의 수비 에너자이저와 볼 배급자로서 궂은일을 도맡는다',
        description: '국제 무대에서의 헌신으로 코칭스태프의 찬사를 받습니다.',
        effectSummary: '수비력 +2, 플레이메이킹 +1 / 감독 신뢰도 +6',
        statChanges: { def: 2, ply: 1 },
        trustDelta: 6,
      },
    },
    {
      code: 'ENC_NAT_02',
      title: '아시아-퍼시픽 챔피언스 클럽 교류전 출전',
      subtitle: '{teamName} 대표로 나서는 국제 클럽 대항전',
      description:
        '해외 명문 구단들과 맞붙는 국제 클럽 초청 대회에서 {playerName} 선수가 팀의 간판으로 코트에 나섭니다.',
      choiceA: {
        label: '해외 피지컬 빅맨들을 상대로 과감한 림 어택과 리바운드 경합을 펼친다',
        description: '낯선 스타일의 상대와 부딪히며 몸싸움 노하우를 습득합니다.',
        effectSummary: '인사이드 +1, 리바운드 +2 / 스카우팅 주가 +4',
        statChanges: { ins: 1, reb: 2 },
        draftStockDelta: 4,
      },
      choiceB: {
        label: '정교한 외곽 슈팅과 패스 게임으로 한국 농구의 매운맛을 보여준다',
        description: '세련된 야투 감각과 시야를 국제 무대에 각인시킵니다.',
        effectSummary: '아웃사이드 +1, 플레이메이킹 +2 / 스카우팅 주가 +5',
        statChanges: { out: 1, ply: 2 },
        draftStockDelta: 5,
      },
    },
    {
      code: 'ENC_NAT_03',
      title: 'FIBA 대륙별 예선 원정 경기와 텃세 극복',
      subtitle: '만원 관중의 야유가 쏟아지는 원정 아레나',
      description:
        '국제 대회 원정 경기에서 홈 팬들의 일방적인 응원 속에 경기가 시작되었어요. 흔들리는 팀 분위기를 다잡을 한 방이 필요합니다.',
      choiceA: {
        label: '원정 관중석을 침묵시키는 연속 3점포와 포효로 분위기를 가져온다',
        description: '강심장다운 클러치 슈팅으로 국제 경쟁력을 입증합니다.',
        effectSummary: '아웃사이드 +2 / 스카우팅 주가 +6',
        statChanges: { out: 2 },
        draftStockDelta: 6,
      },
      choiceB: {
        label: '차분한 경기 조율과 철벽 수비로 상대의 조급함을 유도한다',
        description: '노련한 경기 운영으로 승리를 챙깁니다.',
        effectSummary: '플레이메이킹 +1, 수비력 +1 / 감독 신뢰도 +5',
        statChanges: { ply: 1, def: 1 },
        trustDelta: 5,
      },
    },
    {
      code: 'ENC_NAT_04',
      title: '해외 전지훈련 스파링 파트너와의 실전 모의고사',
      subtitle: '{teamName}의 전술 완성도를 높이는 해외 원정 스파링',
      description:
        '구단 전지훈련 도중 현지 프로 구단과 비공개 연습경기가 잡혔어요. 실전 못지않은 치열한 신경전이 벌어집니다.',
      choiceA: {
        label: '공수 전환 속도를 극한으로 끌어올려 현지 선수들을 압도한다',
        description: '트랜지션 게임에서의 기동력과 결정력을 끌어올립니다.',
        effectSummary: '피지컬 +1, 인사이드 +1 / 감독 신뢰도 +5',
        statChanges: { phy: 1, ins: 1 },
        trustDelta: 5,
      },
      choiceB: {
        label: '약속된 수비 로테이션과 세트 오펜스를 정교하게 점검한다',
        description: '팀 전술 완성도를 높여 코칭스태프를 만족시킵니다.',
        effectSummary: '수비력 +1, 플레이메이킹 +1 / 감독 신뢰도 +6',
        statChanges: { def: 1, ply: 1 },
        trustDelta: 6,
      },
    },
  ]),

  // 12. VETERAN_LEGACY (베테랑의 품격, 멘토링 및 구단 유산 - 4종)
  ...makeCategoryScenarios('VETERAN_LEGACY', [
    {
      code: 'ENC_VET_01',
      title: '어린 루키를 위한 비법 전수와 멘토링 클래스',
      subtitle: '{age}세 시즌, 코트 안팎에서 빛나는 존재감',
      description:
        '팀의 1라운드 신인이 슬럼프에 빠져 {playerName} 선수에게 조언을 구하러 찾아왔어요. 그동안 쌓아온 커리어의 지혜를 나눌 순간입니다.',
      choiceA: {
        label: '수비수의 타이밍을 뺏는 노련한 풋워크와 시야 활용법을 전수한다',
        description: '후배를 가르치며 본인의 농구 지능과 패스 타이밍도 더욱 날카로워집니다.',
        effectSummary: '플레이메이킹 +2 / 감독 신뢰도 +7',
        statChanges: { ply: 2 },
        trustDelta: 7,
      },
      choiceB: {
        label: '프로에서 롱런하기 위한 코어 보강 루틴과 슈팅 밸런스를 함께 훈련한다',
        description: '모범적인 워크에씩으로 선수단 전체의 귀감이 됩니다.',
        effectSummary: '아웃사이드 +1, 피지컬 +1 / 감독 신뢰도 +6',
        statChanges: { out: 1, phy: 1 },
        trustDelta: 6,
      },
    },
    {
      code: 'ENC_VET_02',
      title: '운동능력 대신 농구 도사(Crafty Play)의 경지로',
      subtitle: '세월의 흐름을 이겨내는 노련한 기술 개조',
      description:
        '예전만큼 폭발적인 점프에만 의존하기보다, 완급 조절과 헤지테이션, 정확한 포스트 스텝으로 수비를 요리하는 스타일로 진화할 시점이에요.',
      choiceA: {
        label: '완급 조절 드리블과 뱅크슛, 플로터 기술을 정교하게 다듬는다',
        description: '체력 소모 없이도 득점을 만들어내는 베테랑의 기술을 완성합니다.',
        effectSummary: '인사이드 +1, 플레이메이킹 +1 / 감독 신뢰도 +5',
        statChanges: { ins: 1, ply: 1 },
        trustDelta: 5,
      },
      choiceB: {
        label: '정확한 위치 선정과 예측 수비로 리바운드와 스틸 효율을 극대화한다',
        description: '노련한 수비 지능으로 코트 위 존재감을 지킵니다.',
        effectSummary: '수비력 +1, 리바운드 +2 / 감독 신뢰도 +5',
        statChanges: { def: 1, reb: 2 },
        trustDelta: 5,
      },
      traitChoice: {
        trait: 'SLOW_STARTER',
        label: '[슬로우 스타터] 농익은 경기 이해도로 오히려 젊은 시절보다 높은 야투 효율을 달성한다',
        description: '대기만성형 선수의 진가를 유감없이 발휘합니다.',
        effectSummary: '아웃사이드 +2, 플레이메이킹 +1 / 감독 신뢰도 +7',
        statChanges: { out: 2, ply: 1 },
        trustDelta: 7,
      },
    },
    {
      code: 'ENC_VET_03',
      title: '구단 역사 박물관에 전시될 기념비적 마일스톤',
      subtitle: '{teamName} 팬들이 기립박수를 보내는 순간',
      description:
        '홈 경기장 전광판에 {playerName} 선수의 통산 기록 헌정 영상이 상영되며 만원 관중이 이름을 연호하고 있어요.',
      choiceA: {
        label: '관중석을 향해 깊이 인사한 뒤 변함없는 클러치 3점포로 보답한다',
        description: '팬들의 사랑에 최고의 경기력으로 화답합니다.',
        effectSummary: '아웃사이드 +2 / 감독 신뢰도 +6',
        statChanges: { out: 2 },
        trustDelta: 6,
      },
      choiceB: {
        label: '벤치의 동료들을 모두 코트 중앙으로 불러 모아 영광을 함께 나눈다',
        description: '최고의 리더십으로 팀 결속력을 정점으로 끌어올립니다.',
        effectSummary: '플레이메이킹 +2 / 감독 신뢰도 +8',
        statChanges: { ply: 2 },
        trustDelta: 8,
      },
    },
    {
      code: 'ENC_VET_04',
      title: '감독의 전술 고문 제안: 플레잉 코치급 코트 리더',
      subtitle: '타임아웃 작전판 앞에서 함께 호흡하는 {playerName}',
      description:
        '감독이 경기 중 상대 수비 변화를 가장 먼저 읽어내는 {playerName} 선수에게 코트 위 전술 콜(Call) 권한을 전폭 위임했어요.',
      choiceA: {
        label: '상대 수비 약점을 즉각 공략하는 오더를 내려 팀 공격을 지휘한다',
        description: '코트 위의 감독으로서 완벽한 경기 운영을 선보입니다.',
        effectSummary: '플레이메이킹 +2, 아웃사이드 +1 / 감독 신뢰도 +7',
        statChanges: { ply: 2, out: 1 },
        trustDelta: 7,
      },
      choiceB: {
        label: '수비 로테이션 콜과 헬프 타이밍을 통솔해 실점을 틀어막는다',
        description: '수비 조직력의 핵심 기둥 역할을 수행합니다.',
        effectSummary: '수비력 +2, 리바운드 +1 / 감독 신뢰도 +7',
        statChanges: { def: 2, reb: 1 },
        trustDelta: 7,
      },
    },
  ]),
];

function hydrateEventTemplate(
  template: EncounterScenarioTemplate,
  career: CareerState
): CareerEvent {
  const playerTraits = career.traits || [];

  const filteredChoices = template.choices
    .filter((c) => !c.requiredTrait || playerTraits.includes(c.requiredTrait))
    .map((c) => ({
      ...c,
      label: injectDynamicVariables(c.label, career),
      description: injectDynamicVariables(c.description, career),
      effectSummary: injectDynamicVariables(c.effectSummary, career),
      nextChainEvent: c.nextChainEvent
        ? {
            ...c.nextChainEvent,
            title: injectDynamicVariables(c.nextChainEvent.title, career),
            subtitle: injectDynamicVariables(c.nextChainEvent.subtitle, career),
            description: injectDynamicVariables(
              c.nextChainEvent.description,
              career
            ),
          }
        : undefined,
    }));

  return {
    id: template.id,
    title: injectDynamicVariables(template.title, career),
    subtitle: injectDynamicVariables(template.subtitle, career),
    description: injectDynamicVariables(template.description, career),
    category: template.category,
    choices: filteredChoices,
  };
}

/**
 * Axis 4: 중복 방지(seenEventIds), 최근 2시즌 카테고리 쿨다운(recentEventCategories),
 * 연쇄 이벤트(pendingChainEvent), 컨텍스트 태그 가중치를 결합하여 최적의 인카운터를 추첨합니다.
 */
export function rollCombinatorialEncounter(
  career: CareerState,
  rng: () => number = Math.random
): CareerEvent {
  // 1. 예약된 연쇄(Chain) 후속 이벤트가 있다면 최우선 발동
  if (career.pendingChainEvent) {
    return {
      ...career.pendingChainEvent,
      title: injectDynamicVariables(career.pendingChainEvent.title, career),
      subtitle: injectDynamicVariables(career.pendingChainEvent.subtitle, career),
      description: injectDynamicVariables(
        career.pendingChainEvent.description,
        career
      ),
    };
  }

  const seenIds = new Set(career.seenEventIds || []);
  const recentCats = new Set((career.recentEventCategories || []).slice(-2));
  const activeTags = new Set(extractCareerContextTags(career));

  // 2. 미노출 시나리오 필터링
  let candidates = ENCOUNTER_SCENARIO_POOL.filter(
    (s) => !seenIds.has(s.id)
  );
  if (candidates.length === 0) {
    candidates = [...ENCOUNTER_SCENARIO_POOL];
  }

  // 3. 최근 2시즌 동일 아키타입 카테고리 쿨다운 적용
  const cooldownFiltered = candidates.filter(
    (s) => !recentCats.has(s.category)
  );
  if (cooldownFiltered.length > 0) {
    candidates = cooldownFiltered;
  }

  // 4. 선수 컨텍스트 태그 및 연령대 매칭 가중치 부여
  const scored = candidates.map((scenario) => {
    let weight = 10;

    if (scenario.category === 'VETERAN_LEGACY') {
      weight += activeTags.has('AGING_VET') ? 18 : -6;
    }
    if (scenario.category === 'SCOUTING_SHOWCASE') {
      weight +=
        activeTags.has('HS_PROSPECT') ||
        activeTags.has('COLLEGE_STAR') ||
        activeTags.has('ROOKIE_GRINDER')
          ? 16
          : -3;
    }
    if (scenario.category === 'SLUMP_MECHANICS' && activeTags.has('SHOOTING_SLUMP')) {
      weight += 16;
    }
    if (scenario.category === 'LOAD_MANAGEMENT' && activeTags.has('LOW_STAMINA')) {
      weight += 16;
    }
    if (scenario.category === 'FRONT_OFFICE' && activeTags.has('CONTRACT_YEAR')) {
      weight += 15;
    }
    if (scenario.category === 'RIVAL_SHOWDOWN' && (career.rivals || []).length > 0) {
      weight += 12;
    }

    return {
      scenario,
      score: Math.max(1, weight) + rng() * 12,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const chosen = scored[0]?.scenario || ENCOUNTER_SCENARIO_POOL[0];
  return hydrateEventTemplate(chosen, career);
}
