import { DRAFT_SCOUTING_CONFIG } from '../config/balanceConfig';
import { CareerEvent, CareerState, Position } from '../types/game';

export const POSITION_EVENTS: Record<Position, CareerEvent[]> = {
  PG: [
    {
      id: 'EVT_PG_PACE',
      title: '작전타임의 선택: 전술 지시 vs 자율 리딩',
      subtitle: '포인트 가드 전용 분기점',
      description:
        '4쿼터 승부처, 감독님은 세트 오펜스를 지시했지만 상대 수비 대형에 순간적인 균열이 보여요. 야전사령관으로서 어떤 판단을 내릴까요?',
      category: 'POSITION',
      choices: [
        {
          label: '과감한 얼리 오펜스 노룩 패스 시도',
          description: '상대 수비가 정돈되기 전에 림으로 달리는 동료에게 총알 패스를 찔러 넣어요.',
          effectSummary: 'PLY +2, OUT +1 · 감독 신뢰도 소폭 상승',
          statChanges: { ply: 2, out: 1 },
          trustDelta: 3,
          draftStockDelta: 4,
        },
        {
          label: '감독님의 세트 플레이 완벽 수행',
          description: '안정적으로 템포를 조절하며 약속된 스크린 패턴으로 찬스를 만들어요.',
          effectSummary: 'PLY +1, DEF +1 · 감독 신뢰도 대폭 상승',
          statChanges: { ply: 1, def: 1 },
          trustDelta: 8,
          draftStockDelta: 2,
        },
      ],
    },
    {
      id: 'EVT_PG_DEEP_THREE',
      title: '로고샷 슈팅 레인지 확장 훈련',
      subtitle: '현대 가드 트렌드 적응',
      description:
        '상대 빅맨이 드롭백 수비로 골밑만 지키는 상황이에요. 3점 라인 두 발짝 뒤에서 던지는 딥쓰리를 장착해 볼까요?',
      category: 'POSITION',
      choices: [
        {
          label: '매일 밤 500개씩 딥쓰리 풀업 훈련',
          description: '하프코트만 넘으면 언제든 던질 수 있는 외곽 위협을 만들어요.',
          effectSummary: 'OUT +2, PHY -1 · 스카우트 주목도 상승',
          statChanges: { out: 2, phy: -1 },
          draftStockDelta: 5,
        },
        {
          label: '플로터와 미드레인지 게임 완성도 강화',
          description: '드롭백 수비의 빈틈을 파고드는 정교한 플로터를 연마해요.',
          effectSummary: 'INS +2, PLY +1 · 감독 신뢰도 +5',
          statChanges: { ins: 2, ply: 1 },
          trustDelta: 5,
        },
      ],
    },
  ],
  SG: [
    {
      id: 'EVT_SG_CLUTCH',
      title: '종료 3.2초 전, 마지막 인바운드 패턴',
      subtitle: '슈팅 가드 전용 분기점',
      description:
        '2점 뒤진 경기 종료 직전, 더블팀 수비가 몰려오는 상황에서 공을 건네받았어요. 어떻게 마무리할까요?',
      category: 'POSITION',
      choices: [
        {
          label: '스텝백 역전 3점 버저비터 시도',
          description: '수비수 두 명 위로 솟구쳐 올라 가장 극적인 외곽포를 쏘아 올려요!',
          effectSummary: 'OUT +2 · 스카우트 주목도 +6',
          statChanges: { out: 2 },
          draftStockDelta: 6,
          trustDelta: 4,
        },
        {
          label: '폭발적인 림어택으로 앤드원 유도',
          description: '수비의 허를 찌르는 돌파로 파울과 득점을 동시에 노려요.',
          effectSummary: 'INS +2, PHY +1 · 감독 신뢰도 +6',
          statChanges: { ins: 2, phy: 1 },
          trustDelta: 6,
        },
      ],
    },
    {
      id: 'EVT_SG_COMBO',
      title: '세컨드 볼핸들러 역할 부여 제안',
      subtitle: '코칭스태프 전술 미팅',
      description:
        '주전 포인트가드가 집중 견제를 받자 감독님이 보조 리딩과 투맨 게임 전개를 맡아달라고 요청했어요.',
      category: 'POSITION',
      choices: [
        {
          label: '볼핸들링과 픽앤롤 리딩 적극 수행',
          description: '득점뿐 아니라 동료의 찬스까지 살려주는 듀얼 가드로 거듭나요.',
          effectSummary: 'PLY +2, OUT +1 · 부포지션 PG 해금 & 감독 신뢰도 +7',
          statChanges: { ply: 2, out: 1 },
          trustDelta: 7,
          unlockSecondaryPos: 'PG',
        },
        {
          label: '오프볼 무브와 캐치앤슛에만 집중',
          description: '가장 자신 있는 순수 슈터 본연의 파괴력을 극대화해요.',
          effectSummary: 'OUT +2, INS +1 · 감독 신뢰도 +3',
          statChanges: { out: 2, ins: 1 },
          trustDelta: 3,
        },
      ],
    },
  ],
  SF: [
    {
      id: 'EVT_SF_STOPPER',
      title: '상대 팀 최고 득점원 전담 마크 특명',
      subtitle: '스몰 포워드 전용 분기점',
      description:
        '평균 30점을 퍼붓는 상대 에이스 윙맨을 제어하기 위해 감독님이 전담 스토퍼 임무를 맡겼어요.',
      category: 'POSITION',
      choices: [
        {
          label: '체력을 쏟아부어 그림자 수비 전개',
          description: '공격 볼륨을 조금 양보하더라도 상대 에이스를 완벽히 지워버려요.',
          effectSummary: 'DEF +2, REB +1 · 감독 신뢰도 +9',
          statChanges: { def: 2, reb: 1 },
          trustDelta: 9,
          draftStockDelta: 5,
        },
        {
          label: '맞불 작전! 공격으로 상대 체력 소모시키기',
          description: '수비만 하기보다 끊임없는 아이솔레이션으로 상대를 공수 양면에서 괴롭혀요.',
          effectSummary: 'INS +2, OUT +1 · 스카우트 주목도 +5',
          statChanges: { ins: 2, out: 1 },
          draftStockDelta: 5,
          trustDelta: 4,
        },
      ],
    },
    {
      id: 'EVT_SF_POINT_FORWARD',
      title: '포인트 포워드 전술 실험',
      subtitle: '올라운더 진화 찬스',
      description:
        '리바운드 직후 가드에게 공을 넘기지 않고 직접 코트를 넘어와 공격을 지휘하는 포인트 포워드 롤을 제안받았어요.',
      category: 'POSITION',
      choices: [
        {
          label: '코트 비전과 트랜지션 패스 강화',
          description: '다재다능한 윙 플레이메이커로 스카우트들의 눈도장을 찍어요.',
          effectSummary: 'PLY +2, REB +1 · 스카우트 주목도 +6',
          statChanges: { ply: 2, reb: 1 },
          draftStockDelta: 6,
          trustDelta: 5,
        },
        {
          label: '윙 슬래셔로서의 마무리 능력 집중',
          description: '복잡한 리딩보다 간결하고 강력한 림 피니시에 집중해요.',
          effectSummary: 'INS +2, PHY +1 · 감독 신뢰도 +4',
          statChanges: { ins: 2, phy: 1 },
          trustDelta: 4,
        },
      ],
    },
  ],
  PF: [
    {
      id: 'EVT_PF_STRETCH',
      title: '스트레치 4 전향 vs 정통 파워 인사이더',
      subtitle: '파워 포워드 전용 분기점',
      description:
        '팀의 페인트존 공간을 넓히기 위해 코칭스태프가 코너 3점슛 비중을 대폭 늘려보자고 제안했어요.',
      category: 'POSITION',
      choices: [
        {
          label: '외곽 3점슛 장착으로 스트레치 빅맨 변신',
          description: '빅맨을 외곽으로 끌어내어 팀 전체의 공격 공간을 열어줘요.',
          effectSummary: 'OUT +2, PLY +1 · 현대 농구 적합도 상승',
          statChanges: { out: 2, ply: 1 },
          draftStockDelta: 6,
          trustDelta: 6,
        },
        {
          label: '웨이트 증량으로 골밑 지배력 극대화',
          description: '누구도 밀어낼 수 없는 강력한 박스아웃과 포스트업을 다져요.',
          effectSummary: 'REB +2, INS +1 · 골밑 장악력 강화',
          statChanges: { reb: 2, ins: 1 },
          trustDelta: 5,
        },
      ],
    },
    {
      id: 'EVT_PF_SMALLBALL',
      title: '스몰볼 라인업의 센터(5번) 겸임 요청',
      subtitle: '전술 유연성 확보',
      description:
        '승부처 기동성을 높이기 위해 정통 센터를 벤치로 불러들이고 나를 스몰볼 5번으로 기용하겠다고 해요.',
      category: 'POSITION',
      choices: [
        {
          label: '기꺼이 골밑 육탄전과 림 프로텍팅 수행',
          description: '부포지션 센터(C)를 해금하고 팀 전술의 핵심 축이 돼요.',
          effectSummary: 'DEF +2, REB +1 · 부포지션 C 해금 & 감독 신뢰도 +8',
          statChanges: { def: 2, reb: 1 },
          trustDelta: 8,
          unlockSecondaryPos: 'C',
        },
        {
          label: '4번 포지션에서 기동성과 윙 수비 유지',
          description: '체력 소모와 부상 위험을 줄이고 본래 역할에 집중해요.',
          effectSummary: 'PHY +2, OUT +1 · 컨디션 유지',
          statChanges: { phy: 2, out: 1 },
          trustDelta: 3,
        },
      ],
    },
  ],
  C: [
    {
      id: 'EVT_C_HIGH_POST_HUB',
      title: '하이포스트 컨트롤 타워 전술 도입',
      subtitle: '센터 전용 분기점',
      description:
        '단순히 골밑에서 공을 기다리는 대신, 자유투 라인 부근에서 컷인하는 동료들에게 패스를 뿌려주는 컨트롤 타워 역할을 제안받았어요.',
      category: 'POSITION',
      choices: [
        {
          label: '패싱 빅맨(Point Center) 스킬 연마',
          description: '넓은 시야와 킥아웃 패스로 상대 더블팀을 무력화해요!',
          effectSummary: 'PLY +2, OUT +1 · 스카우트 주목도 +7',
          statChanges: { ply: 2, out: 1 },
          draftStockDelta: 7,
          trustDelta: 6,
        },
        {
          label: '압도적인 림 프로텍팅과 앨리웁 피니시 집중',
          description: '골밑 수호신 본연의 높이와 파워로 페인트존을 봉쇄해요.',
          effectSummary: 'DEF +2, REB +2 · 감독 신뢰도 +7',
          statChanges: { def: 2, reb: 2 },
          trustDelta: 7,
        },
      ],
    },
    {
      id: 'EVT_C_SWITCH',
      title: '외곽 가드와의 스위치 수비 대처법',
      subtitle: '빅맨의 숙명적 과제',
      description:
        '상대 가드들이 픽앤롤 이후 의도적으로 나를 외곽으로 끌어내어 일대일 돌파를 시도하고 있어요.',
      category: 'POSITION',
      choices: [
        {
          label: '하체 민첩성과 사이드스텝 집중 훈련',
          description: '가드 앞에서도 밀리지 않는 기동성 있는 스위치 빅맨으로 진화해요.',
          effectSummary: 'PHY +2, DEF +1 · NBA 스카우트 호평',
          statChanges: { phy: 2, def: 1 },
          draftStockDelta: 6,
        },
        {
          label: '긴 윙스팬을 활용한 추격 블록슛 타이밍 연구',
          description: '한 발을 내주더라도 뒤에서 덮어버리는 리커버리 블록을 완성해요.',
          effectSummary: 'DEF +2, REB +1 · 감독 신뢰도 +5',
          statChanges: { def: 2, reb: 1 },
          trustDelta: 5,
        },
      ],
    },
  ],
};

import { rollCombinatorialEncounter } from '../engine/encounterEngine';

export const ASIAN_GAMES_MILITARY_EVENT: CareerEvent = {
  id: 'EVT_ASIAN_GAMES_GOLD',
  title: '🇰🇷 아시안게임 남자농구 국가대표 최종 엔트리 차출 (4년 주기)',
  subtitle: '조별리그(3경기) → 8강 → 4강 토너먼트 돌파 시 결승전 & 금메달 병역특례 도전',
  description:
    '4년마다 열리는 아시안게임 남자농구 국가대표팀 최종 12인 엔트리에 발탁되었어요! 조별리그와 8강·4강 토너먼트를 모두 통과해 결승전에서 우승(금메달)을 차지해야만 병역특례(예술·체육요원) 혜택을 받을 수 있어요.',
  category: 'MILITARY',
  choices: [
    {
      label: '아시안게임 본선 토너먼트 출전',
      description:
        '조별리그부터 4강까지 승부를 펼치며 4강 승리 시 결승전 실시간 중계로 직행합니다.',
      effectSummary:
        '아시안게임 토너먼트 진행 (결승 우승 시 병역특례 획득)',
      statChanges: { ins: 1, out: 1, ply: 1 },
      trustDelta: 6,
      draftStockDelta: 6,
      enterAsianGamesTournament: true,
    },
    {
      label: '소속팀 비시즌 훈련 및 컨디션 관리 집중',
      description: '대표팀 차출을 고사하고 개인 기량 연마와 부상 관리에 집중합니다.',
      effectSummary: 'PHY +2, OUT +1 · 대표팀 불참 (병역 미필 유지)',
      statChanges: { phy: 2, out: 1 },
      trustDelta: 2,
    },
  ],
};

export const SANGMU_ENLISTMENT_EVENT: CareerEvent = {
  id: 'EVT_SANGMU_ENLISTMENT',
  title: '국군체육부대 상무 입대 영장',
  subtitle: '만 27세 병역 의무 이행 · 2시즌 복무',
  description:
    '만 27세가 될 때까지 병역특례 혜택을 획득하지 못해 국군체육부대 상무에 입대하게 되었습니다. 2시즌 동안 복무한 뒤 프로 무대로 복귀합니다.',
  category: 'MILITARY',
  choices: [
    {
      label: '국군체육부대 상무 입대 (2시즌 복무)',
      description: '규칙적인 일과와 웨이트 트레이닝으로 전역 후 복귀를 준비합니다.',
      effectSummary: '2시즌 상무 복무 시작 · PHY +1, DEF +1 · 전역 후 병역필 전환',
      statChanges: { phy: 1, def: 1 },
      enlistSangmu: true,
    },
  ],
};

export const VETERAN_CRITICAL_INJURY_EVENT: CareerEvent = {
  id: 'EVT_VETERAN_CRITICAL_INJURY',
  title: '경기 중 아킬레스건 · 무릎 중상 발생',
  subtitle: '베테랑 치명적 부상 은퇴 기로',
  description:
    '리바운드 경합 후 착지 과정에서 중상을 입어 최소 1년의 재활이 필요하다는 진단을 받았습니다. 베테랑으로서 진로를 결정해야 합니다.',
  category: 'INJURY',
  choices: [
    {
      label: '1년 재활 후 코트 복귀 도전 (PHY -7)',
      description: '운동능력 저하를 감수하고 재활 후 다시 코트에 섭니다.',
      effectSummary: 'PHY -7 영구 하락 · PLY +2 · 재활 복귀',
      statChanges: { phy: -7, ply: 2 },
      trustDelta: 5,
    },
    {
      label: '부상을 받아들이고 현역 은퇴 선언',
      description: '코트와 작별하고 명예의 전당 심사로 이동합니다.',
      effectSummary: '현역 은퇴식 진행 및 명예의 전당 심사 이동',
      triggerRetirement: 'CRITICAL_INJURY',
    },
  ],
};

/**
 * 에이전트 은퇴 권유 리포트 생성
 * - 동일 리그 내 최근 2~3시즌 연속 기량 하락 또는 만 35세 이상 고령화 시에만 단 1회 발생
 * - 리그 승격(예: 대학/KBL -> NBA)으로 인한 볼륨 감소를 기량 하락으로 오인하지 않음!
 */
export function createAgentRetirementAdviceEvent(
  input: string | CareerState
): CareerEvent | null {
  let reasonText = '';

  if (typeof input === 'string') {
    reasonText = input;
  } else {
    const career = input;
    if (career.agentAdviceShown) return null;

    // 동일 리그 내 최근 기록만 추출해 비교 (리그 승격/이적 시 볼륨 착시 방지)
    const sameLeagueLogs = career.seasonLogs.filter(
      (l) => l.league === career.league
    );
    const ovrHist = career.ovrHistory || [];
    const twoYearOvrDrop =
      ovrHist.length >= 3 ? ovrHist[ovrHist.length - 3] - career.ovr : 0;

    let sameLeagueDecline = false;
    let peakSameLeaguePpg = 0;
    let lastSameLeaguePpg = 0;

    if (sameLeagueLogs.length >= 2) {
      const prevInLeague = sameLeagueLogs[sameLeagueLogs.length - 2];
      const lastInLeague = sameLeagueLogs[sameLeagueLogs.length - 1];
      peakSameLeaguePpg = Math.max(...sameLeagueLogs.map((l) => l.ppg));
      lastSameLeaguePpg = lastInLeague.ppg;

      const significantPpgDrop =
        prevInLeague.ppg >= 12.0 && lastInLeague.ppg <= prevInLeague.ppg * 0.58;
      const lostStarterMinutes =
        prevInLeague.mpg >= 24.0 && lastInLeague.mpg <= 13.5;

      if (
        career.age >= 31 &&
        ((twoYearOvrDrop >= 4 && (significantPpgDrop || lostStarterMinutes)) ||
          (twoYearOvrDrop >= 5 && lastInLeague.ppg < 8.0))
      ) {
        sameLeagueDecline = true;
      }
    }

    const advancedVeteranDecline =
      career.age >= 35 && (twoYearOvrDrop >= 3 || career.stats.phy <= 62);

    if (!sameLeagueDecline && !advancedVeteranDecline) {
      return null;
    }

    if (sameLeagueDecline && peakSameLeaguePpg > 0) {
      reasonText = `동일 리그 내에서 최근 종합 능력치(OVR -${twoYearOvrDrop})와 평균 득점(${peakSameLeaguePpg.toFixed(
        1
      )}점 → ${lastSameLeaguePpg.toFixed(1)}점)이 뚜렷하게 하락하며 베테랑의 기로에 섰어요.`;
    } else {
      reasonText = `어느덧 만 ${career.age}세 고령 베테랑 구간에 접어들며 체력과 기량 유지가 쉽지 않은 시점이 찾아왔어요.`;
    }
  }

  return {
    id: 'EVT_AGENT_RETIREMENT_ADVICE',
    title: '에이전트 면담 · 현역 은퇴 권유 리포트',
    subtitle: '동일 리그 기량 하락 또는 베테랑 은퇴 기로 (커리어 1회)',
    description: `${reasonText} 에이전트가 명예 은퇴와 현역 연장 선택지를 함께 제시했습니다. 현역 연장을 선택하면 이후 은퇴 권유는 다시 표시되지 않습니다.`,
    category: 'RETIREMENT_ADVICE',
    choices: [
      {
        label: '에이전트 조언 수용 · 명예 은퇴 선언',
        description: '공식 은퇴식과 명예의 전당 심사로 이동합니다.',
        effectSummary: '현역 명예 은퇴식 진행',
        triggerRetirement: 'VOLUNTARY_HONOR',
      },
      {
        label: '현역 연장 도전 (은퇴 권유 해제)',
        description: '권유를 정중히 거절하고 현역 도전을 이어갑니다.',
        effectSummary: '현역 연장 확정 · 이후 은퇴 권유 비활성화',
        trustDelta: 0,
        markAgentAdviceDismissed: true,
      },
    ],
  };
}

/**
 * 시즌 중반(50% 진행 시점) '커리어 분기점(Mid-Season Crossroads)' 이벤트 생성
 * - 트레이드 데드라인 루머는 최소 3시즌 쿨다운 + 현 소속팀 2시즌 이상 재적 조건 적용 (역할 약속 위반 시에만 예외)
 * - 매 시즌 반복 대신 올스타 브레이크 점검, 라커룸 리더십, 전술 해법 등 다양한 서사를 제공
 */
export function rollMidSeasonCrossroadsEvent(
  career: CareerState,
  rng: () => number = Math.random
): CareerEvent {
  const isProLeague =
    career.league === 'NBA' ||
    career.league === 'KBL' ||
    career.league === 'OVERSEAS';
  const isAceOrStarter =
    career.role.includes('에이스') || career.role.includes('스타터');

  const rumorCfg = DRAFT_SCOUTING_CONFIG.tradeRumor;
  const lastRumorYear = career.lastTradeRumorYear ?? null;
  const seasonsSinceRumor =
    lastRumorYear !== null ? career.seasonYear - lastRumorYear : 99;
  const seasonsOnTeam = career.seasonsOnCurrentTeam ?? 0;

  const passesTradeCooldown = seasonsSinceRumor >= rumorCfg.cooldownSeasons;
  const passesTeamTenure =
    Boolean(career.brokenRolePromise) ||
    seasonsOnTeam >= rumorCfg.minSeasonsOnTeam;

  let tradeRumorChance = 0;
  if (isProLeague && passesTradeCooldown && passesTeamTenure) {
    if (career.brokenRolePromise) {
      tradeRumorChance = rumorCfg.brokenPromiseProb;
    } else if (career.team.direction === 'REBUILDING') {
      tradeRumorChance =
        rumorCfg.rebuildingBaseProb +
        (career.contractYearsLeft <= 1 ? rumorCfg.contractYearBonusProb : 0);
    } else if (career.team.direction === 'CONTENDER') {
      tradeRumorChance = rumorCfg.contenderRareProb;
    } else {
      tradeRumorChance =
        rumorCfg.playoffHuntBaseProb +
        (career.contractYearsLeft <= 1 ? rumorCfg.contractYearBonusProb * 0.75 : 0);
    }
  }

  // 시나리오 1: 트레이드 데드라인 루머 (희귀 발동 · 쿨다운 & 최소 재적 연수 충족 시에만)
  if (tradeRumorChance > 0 && rng() < tradeRumorChance) {
    return {
      id: `EVT_MID_TRADE_DEADLINE_${career.seasonYear}`,
      title: '트레이드 데드라인 영입 타진 루머',
      subtitle: '정규시즌 반환점 · 잔류 vs 구단 트레이드 협상',
      description: career.brokenRolePromise
        ? `계약 당시 약속받은 출전 시간이 지켜지지 않자 타 구단들이 트레이드 데드라인을 앞두고 영입을 타진하고 있습니다.`
        : `${career.team.shortName}에서의 시즌이 길어지며 타 구단 단장들이 트레이드 문의를 넣어오고 있습니다. 잔류할지 프런트에 트레이드 협상을 요청할지 결정하세요.`,
      category: 'MID_SEASON_CROSSROADS',
      choices: [
        {
          label: '이적 루머 일축 · 소속팀 잔류 선언',
          description: '라커룸 분위기를 다잡고 현재 동료들과 시즌을 완주합니다.',
          riskTier: 'SAFE',
          effectSummary: '안정 확정 · 감독 신뢰도 +8 · INS +1, DEF +1',
          statChanges: { ins: 1, def: 1 },
          trustDelta: 8,
        },
        {
          label: '구단 프런트에 공식 트레이드 협상 요청',
          description:
            '단장에게 타 구단과의 트레이드 협상을 요청합니다. 시장 가치와 계약 조건에 따라 성사되거나 반려될 수 있습니다.',
          riskTier: 'HIGH_RISK',
          effectSummary:
            '구단 협상 판정 · 성사 시 타 구단 이적 · 반려 시 잔류 및 신뢰도 하락',
          draftStockDelta: 3,
          negotiateMidSeasonTrade: true,
        },
      ],
    };
  }

  // 시나리오 2: 주전 부상으로 찾아온 3주간의 임시 선발 쇼케이스 기회 (벤치/식스맨/유망주 역할일 때)
  if (!isAceOrStarter) {
    return {
      id: `EVT_MID_STARTER_SHOWCASE_${career.seasonYear}`,
      title: '주전 부상 · 3주간 임시 선발 기회',
      subtitle: '정규시즌 반환점 · 주전 도약 찬스',
      description:
        '팀 내 주전 선수가 발목 염좌로 3주간 결장하며 임시 선발 출전 기회가 주어졌습니다.',
      category: 'MID_SEASON_CROSSROADS',
      choices: [
        {
          label: '공격적인 득점 쇼케이스로 어필',
          description: '과감한 1대1 돌파와 외곽슛으로 공격 재능을 증명합니다.',
          riskTier: 'HIGH_RISK',
          effectSummary: '성공 시 INS +2, OUT +1, POT +1, 주가 +8 · 실패 시 신뢰도 -6, 주가 -3',
          successCheck: {
            statKey: 'ins',
            difficulty: 0,
            baseProb: 0.65,
            label: '인사이드(INS) 기반 쇼케이스 판정',
          },
          successOutcome: {
            narrative: '3주간 임시 선발로 맹활약하며 잠재력 상한선까지 끌어올렸습니다.',
            statChanges: { ins: 2, out: 1 },
            trustDelta: 5,
            draftStockDelta: 8,
            potentialDelta: 1,
          },
          failureOutcome: {
            narrative: '무리한 아이솔레이션이 턴오버로 이어지며 다시 벤치 롤로 복귀했습니다.',
            statChanges: { ply: -1 },
            trustDelta: -6,
            draftStockDelta: -3,
          },
          statChanges: { ins: 1, out: 1 },
          draftStockDelta: 7,
          potentialDelta: 1,
        },
        {
          label: '궂은일과 이타적 패스로 감독 신뢰 확보',
          description: '수비 로테이션과 찬스 메이킹에 집중해 감독의 신뢰를 얻습니다.',
          riskTier: 'SAFE',
          effectSummary: '안정 확정 · PLY +1, DEF +1 · 감독 신뢰도 +10',
          statChanges: { ply: 1, def: 1 },
          trustDelta: 10,
        },
      ],
    };
  }

  // 시나리오 3~5: 다양한 비-트레이드 시즌 중반 분기점 로테이션
  const scenarioRoll = rng();
  if (scenarioRoll < 0.34) {
    return {
      id: `EVT_MID_ALLSTAR_BREAK_${career.seasonYear}`,
      title: '올스타 브레이크 집중 교정 캠프',
      subtitle: '정규시즌 반환점 · 체력 회복 vs 약점 보완',
      description:
        '올스타 브레이크로 5일간의 휴식기가 주어졌습니다. 후반기 순위 싸움을 앞두고 시간을 어떻게 보낼까요?',
      category: 'MID_SEASON_CROSSROADS',
      choices: [
        {
          label: '개인 스킬 트레이너와 약점 기술 집중 교정',
          description: '휴식 대신 슈팅 폼과 풋워크를 교정해 후반기 폭발력을 노립니다.',
          riskTier: 'BALANCED',
          effectSummary: '성공 시 INS +1, OUT +2, PLY +1 · 실패 시 피로 누적 PHY -1',
          successCheck: {
            statKey: 'phy',
            difficulty: -2,
            baseProb: 0.72,
            label: '피지컬(PHY) 체력 소화력 판정',
          },
          successOutcome: {
            narrative: '브레이크 집중 교정으로 후반기에 한층 예리한 공격 감각을 뽐냈습니다.',
            statChanges: { ins: 1, out: 2, ply: 1 },
            trustDelta: 4,
            draftStockDelta: 5,
          },
          failureOutcome: {
            narrative: '휴식 없이 무리한 훈련을 강행해 하체 피로가 쌓였습니다.',
            statChanges: { phy: -1 },
            trustDelta: -2,
          },
          statChanges: { out: 1, ply: 1 },
        },
        {
          label: '리커버리와 전술 비디오 분석 집중',
          description: '관절을 회복시키며 후반기 상대 팀 수비 패턴을 분석합니다.',
          riskTier: 'SAFE',
          effectSummary: '안정 확정 · PHY +1, PLY +1 · 감독 신뢰도 +6',
          statChanges: { phy: 1, ply: 1 },
          trustDelta: 6,
        },
      ],
    };
  }

  if (scenarioRoll < 0.67) {
    return {
      id: `EVT_MID_LOCKER_LEADERSHIP_${career.seasonYear}`,
      title: '후반기 연패 위기 · 라커룸 미팅',
      subtitle: '정규시즌 반환점 · 팀 케미스트리와 리더십',
      description:
        '후반기 진입 직전 3연패에 빠지며 라커룸 분위기가 무거워졌습니다. 팀의 핵심 선수로서 어떤 대응을 택할까요?',
      category: 'MID_SEASON_CROSSROADS',
      choices: [
        {
          label: '선수단 미팅 소집 · 수비 기강 다잡기',
          description: '수비 로테이션 문제를 정면으로 짚으며 팀의 각성을 이끌어냅니다.',
          riskTier: 'HIGH_RISK',
          effectSummary: '성공 시 DEF +2, REB +1, 신뢰도 +9 · 실패 시 신뢰도 -5',
          successCheck: {
            statKey: 'ply',
            difficulty: 0,
            baseProb: 0.68,
            label: '경기 조율(PLY) 리더십 판정',
          },
          successOutcome: {
            narrative: '직언에 동료들이 하나로 뭉치며 후반기 수비력이 크게 반등했습니다.',
            statChanges: { def: 2, reb: 1 },
            trustDelta: 9,
            draftStockDelta: 4,
          },
          failureOutcome: {
            narrative: '거친 표현에 일부 동료들이 반발하며 분위기가 잠시 서먹해졌습니다.',
            statChanges: {},
            trustDelta: -5,
          },
          statChanges: { def: 1 },
        },
        {
          label: '궂은일과 리바운드 경합으로 솔선수범',
          description: '말보다 허슬 플레이로 팀 에너지를 끌어올립니다.',
          riskTier: 'SAFE',
          effectSummary: '안정 확정 · REB +1, PHY +1 · 감독 신뢰도 +7',
          statChanges: { reb: 1, phy: 1 },
          trustDelta: 7,
        },
      ],
    };
  }

  // 시나리오 5: 시즌 중반 상대 집중 견제 & 슈팅 밸런스 조정
  return {
    id: `EVT_MID_TACTICAL_ADJUST_${career.seasonYear}`,
    title: '상대 수비 집중 견제와 전술 해법',
    subtitle: '정규시즌 반환점 · 후반기 돌파구 선택',
    description:
      '시즌 중반에 접어들며 상대 팀들이 집요한 더블팀과 함정 수비를 펼치고 있습니다.',
    category: 'MID_SEASON_CROSSROADS',
    choices: [
      {
        label: '퀵릴리스 야간 슈팅 · 풀업 3점 특훈',
        description: '수비가 붙기 전에 한 박자 빠르게 올라가는 릴리스로 돌파구를 찾습니다.',
        riskTier: 'HIGH_RISK',
        effectSummary: '성공 시 OUT +3, PLY +1, 주가 +7 · 실패 시 PHY -1, 신뢰도 -4',
        successCheck: {
          statKey: 'out',
          difficulty: 2,
          baseProb: 0.64,
          label: '외곽 슈팅(OUT) 기반 특훈 판정',
        },
        successOutcome: {
          narrative: '야간 특훈으로 더블팀 위에서도 흔들리지 않는 퀵릴리스를 완성했습니다.',
          statChanges: { out: 3, ply: 1 },
          trustDelta: 5,
          draftStockDelta: 7,
        },
        failureOutcome: {
          narrative: '과도한 야간 슈팅 훈련으로 피로가 누적되어 슛 밸런스가 흔들렸습니다.',
          statChanges: { phy: -1 },
          trustDelta: -4,
        },
        statChanges: { out: 2, ply: 1 },
        draftStockDelta: 5,
      },
      {
        label: '웨이트와 압박 수비로 공수 밸런스 재정비',
        description: '체력과 대인 방어로 상대 에이스를 먼저 지치게 만듭니다.',
        riskTier: 'SAFE',
        effectSummary: '안정 확정 · DEF +1, REB +1, PHY +1 · 감독 신뢰도 +7',
        statChanges: { def: 1, reb: 1, phy: 1 },
        trustDelta: 7,
      },
    ],
  };
}

export const FAREWELL_TOUR_LOGS: string[] = [
  '원정 경기장 전 관중이 기립박수로 레전드의 마지막 방문을 배웅했어요!',
  '경기 종료 후 상대 팀 에이스와 뜨거운 포옹을 나누며 마지막 유니폼 교환식을 가졌어요!',
  '원정 구단 프런트에서 헌정 영상과 함께 특별 기념 액자를 선물하며 경의를 표했어요!',
  '코트를 떠나는 순간, 벤치의 어린 후배들이 모두 일어나 고개 숙여 존경을 표했어요!',
  '수많은 어린이 팬들이 "고마워요 레전드!" 플래카드를 흔들며 눈시울을 붉혔어요!',
];

/**
 * 32~34세 베테랑 '플레이 스타일 진화(Re-invention)' 특별 서사 이벤트 (커리어 1회)
 * - 에이징 커브로 인해 피지컬(PHY)이 하락하기 시작할 때, 점프력 대신 패스 시야(PLY)와 코너 3점슛(OUT)으로
 *   팀을 이끄는 베테랑 포인트 포워드 / 3&D 도사로 변신할 수 있는 기회 제공
 */
export function createVeteranReinventionEvent(
  career: CareerState
): CareerEvent {
  return {
    id: 'EVT_VETERAN_REINVENTION',
    title: '베테랑 플레이 스타일 진화 제안',
    subtitle: `만 ${career.age}세 베테랑 전환기 · 코칭스태프 전술 미팅 (커리어 1회)`,
    description: `만 ${career.age}세에 접어들며 폭발적인 탄력 유지가 쉽지 않아졌습니다. 감독이 패스 시야(PLY)와 코너 3점슛(OUT) 중심의 베테랑 스타일 전환을 제안했습니다.`,
    category: 'VETERAN_LEGACY',
    choices: [
      {
        label: '패스 시야와 외곽슛 중심의 베테랑 스타일로 전환',
        description:
          '운동능력(PHY) 저하를 받아들이고 슈팅과 패스 지능을 끌어올려 30대 후반까지 경쟁력을 유지합니다.',
        effectSummary:
          'PLY +3, OUT +3, DEF +1 (PHY -2) · 향후 에이징 시 슛/패스 하락 완화',
        statChanges: { ply: 3, out: 3, def: 1, phy: -2 },
        trustDelta: 9,
        triggerVeteranReinvention: true,
      },
      {
        label: '기존 돌파와 인사이드 스타일 고수',
        description:
          '웨이트 트레이닝으로 버티며 기존 에이스 플레이를 유지합니다.',
        effectSummary: 'INS +2, PHY +1 · 감독 신뢰도 +3 · 기존 스타일 유지',
        statChanges: { ins: 2, phy: 1 },
        trustDelta: 3,
      },
    ],
  };
}

export function rollSeasonEvent(
  career: CareerState,
  rng: () => number = Math.random,
  completedSeasonYear?: number
): CareerEvent | null {
  // 0) 만 27세 병역 미필자 상무 입대 이벤트 (최우선 발동)
  if (
    !career.militaryExempt &&
    career.militaryServiceSeasonsLeft === 0 &&
    career.age >= 27
  ) {
    return SANGMU_ENLISTMENT_EVENT;
  }

  // 1) 🧬 만 32~34세 베테랑 '플레이 스타일 진화(Re-invention)' 이벤트 (커리어 단 1회)
  if (
    career.age >= 32 &&
    career.age <= 34 &&
    !career.veteranReinventionOffered &&
    !career.veteranReinvented
  ) {
    return createVeteranReinventionEvent(career);
  }

  // 2) ④ 노장 치명적 부상 은퇴 기로: 만 32세 이상이고 PHY <= 65일 때 10% 확률
  if (career.age >= 32 && career.stats.phy <= 65 && rng() < 0.1) {
    return VETERAN_CRITICAL_INJURY_EVENT;
  }

  // 3) 에이전트 은퇴 권유 리포트 (커리어 중 단 1회만, 동일 리그 내 뚜렷한 기량 하락 또는 만 35세+ 노쇠화 시)
  if (!career.agentAdviceShown) {
    const adviceEvent = createAgentRetirementAdviceEvent(career);
    if (adviceEvent) {
      return adviceEvent;
    }
  }

  // 4) 아시안게임 국가대표 차출 이벤트: 실제 4년 주기(2026, 2030, 2034, 2038...)에만 발동 & 미필 상태 & OVR >= 65 & 20~26세
  const targetYear = completedSeasonYear ?? career.seasonYear;
  const isAsianGamesYear = targetYear % 4 === 2;
  if (
    isAsianGamesYear &&
    !career.militaryExempt &&
    career.militaryServiceSeasonsLeft === 0 &&
    career.age >= 20 &&
    career.age <= 26 &&
    career.ovr >= 65
  ) {
    return ASIAN_GAMES_MILITARY_EVENT;
  }

  // 5) 예약된 연쇄(Chain) 이벤트가 있으면 즉시 발동
  if (career.pendingChainEvent) {
    return rollCombinatorialEncounter(career, rng);
  }

  // 6) 4축 조합형 랜덤 인카운터 엔진 (중복 0%, 최근 2시즌 카테고리 쿨다운, 48종 시나리오 풀)
  if (rng() < 0.48) {
    return rollCombinatorialEncounter(career, rng);
  }

  return null;
}

