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
      label: '🇰🇷 태극마크를 달고 아시안게임 본선 토너먼트(조별리그 → 8강 → 4강) 출전!',
      description:
        '조별리그부터 4강까지 아시아 강호들과 진검승부를 펼쳐요. 4강 승리 시 대망의 결승전 실시간 중계로 직행해요!',
      effectSummary:
        '🏀 아시안게임 풀 토너먼트 진행 (4강 승리 시 결승전 라이브 중계 진입 · 결승 우승 시에만 병역특례 부여)',
      statChanges: { ins: 1, out: 1, ply: 1 },
      trustDelta: 6,
      draftStockDelta: 6,
      enterAsianGamesTournament: true,
    },
    {
      label: '🏥 소속팀 비시즌 훈련 및 부상 관리에 전념 (대표팀 차출 고사)',
      description: '아시안게임에 불참하고 개인 기량 연마와 컨디션 관리에 집중해요 (병역특례 기회 패스).',
      effectSummary: 'PHY +2, OUT +1 · 대표팀 불참 (병역 미필 유지)',
      statChanges: { phy: 2, out: 1 },
      trustDelta: 2,
    },
  ],
};

export const SANGMU_ENLISTMENT_EVENT: CareerEvent = {
  id: 'EVT_SANGMU_ENLISTMENT',
  title: '🫡 국군체육부대(상무) 입대 영장 도착',
  subtitle: '만 27세 병역 의무 이행 (2시즌 상무 농구단 복무)',
  description:
    '만 27세가 될 때까지 아시안게임 금메달 등 병역특례 혜택을 획득하지 못해 국군체육부대(상무 농구단)에 입대하게 되었어요. 앞으로 2시즌 동안 문경 상무 농구단 소속으로 복무한 뒤 프로 무대로 복귀해요.',
  category: 'MILITARY',
  choices: [
    {
      label: '🫡 성실하게 상무 농구단에 입대하여 웨이트 및 기초 체력 단련 (2시즌 복무)',
      description: '규칙적인 일과와 웨이트 트레이닝으로 몸을 만들며 전역 후의 도약을 준비해요.',
      effectSummary: '2시즌 국군체육부대(상무) 복무 시작 · PHY +1, DEF +1 · 전역 후 병역필 전환',
      statChanges: { phy: 1, def: 1 },
      enlistSangmu: true,
    },
  ],
};

export const VETERAN_CRITICAL_INJURY_EVENT: CareerEvent = {
  id: 'EVT_VETERAN_CRITICAL_INJURY',
  title: '🚨 비보: 경기 중 아킬레스건/무릎 중상 발생',
  subtitle: '④ 노장 치명적 부상 은퇴 기로 (만 32세 이상 · 피지컬 저하)',
  description:
    '치열한 리바운드 경합 후 착지 과정에서 날카로운 통증과 함께 코트에 쓰러졌어요. 정밀 검진 결과 최소 1년의 혹독한 재활이 필요한 중상이라는 진단을 받았어요. 베테랑으로서 중대한 결정을 내려야 해요.',
  category: 'INJURY',
  choices: [
    {
      label: '🔥 1년 재활 후 코트 복귀 도전 (PHY -7 영구 하락)',
      description: '운동능력은 크게 떨어지겠지만, 농구를 향한 열정으로 다시 코트에 서요.',
      effectSummary: 'PHY -7 영구 하락 · 노련미 PLY +2 · 불굴의 재활 투혼',
      statChanges: { phy: -7, ply: 2 },
      trustDelta: 5,
    },
    {
      label: '🎤 부상을 받아들이고 명예롭게 현역 은퇴 선언',
      description: '그동안 쏟아부은 땀방울을 가슴에 품고 정든 코트와 작별 인사를 나눠요.',
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
    title: '📋 에이전트의 진지한 면담: 현역 은퇴 권유 리포트 (커리어 1회)',
    subtitle: '동일 리그 내 기량 하락 또는 고령 베테랑 은퇴 기로',
    description: `${reasonText} 에이전트가 조심스럽게 다가와 박수칠 때 명예롭게 코트를 떠나는 선택지와, 현역 연장에 도전하는 선택지를 함께 제시했어요. (현역 연장을 선택하면 앞으로 에이전트가 다시 은퇴를 권유하지 않아요)`,
    category: 'RETIREMENT_ADVICE',
    choices: [
      {
        label: '🎤 에이전트의 조언을 받아들여 명예 은퇴 선언',
        description: '아름다운 추억을 가슴에 품고 공식 은퇴식과 명예의 전당 심사로 향해요.',
        effectSummary: '현역 명예 은퇴식 진행 (VOLUNTARY_HONOR)',
        triggerRetirement: 'VOLUNTARY_HONOR',
      },
      {
        label: '🔥 현역 연장에 도전 (더 이상 은퇴 권유 받지 않음)',
        description: '아직 코트를 떠날 수 없어요! 에이전트의 권유를 정중히 거절하고 현역 도전을 이어가요.',
        effectSummary: '현역 연장 확정 · 이후 에이전트 은퇴 권유 영구 비활성화',
        trustDelta: 0,
        markAgentAdviceDismissed: true,
      },
    ],
  };
}

/**
 * 시즌 중반(50% 진행 시점) '커리어 분기점(Mid-Season Crossroads)' 이벤트 생성
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
  const isRebuildingOrBrokenPromise =
    career.team.direction === 'REBUILDING' || Boolean(career.brokenRolePromise);

  // 시나리오 1: 트레이드 데드라인 루머 (프로 리그에서 리빌딩 팀 에이스이거나 역할 약속이 깨졌을 때)
  if (isProLeague && (isRebuildingOrBrokenPromise || (isAceOrStarter && rng() < 0.45))) {
    return {
      id: `EVT_MID_TRADE_DEADLINE_${career.seasonYear}`,
      title: '🚨 [시즌 중반 분기점] 트레이드 데드라인 빅딜 루머!',
      subtitle: '정규시즌 반환점(50%) · 프랜차이즈 의리 vs 우승 컨텐더 이적',
      description: career.brokenRolePromise
        ? `계약 당시 약속받았던 출전 시간이 지켜지지 않자, 플레이오프 우승권을 노리는 타 구단 단장이 즉시 전력감으로 영입하겠다는 트레이드 오퍼를 보냈어요!`
        : `하위권에서 고군분투하는 나의 활약을 눈여겨본 우승 컨텐더 구단이 트레이드 데드라인 직전 영입 제안을 보내왔어요! 어떤 결단을 내릴까요?`,
      category: 'MID_SEASON_CROSSROADS',
      choices: [
        {
          label: '🤝 팀에 남아 프랜차이즈 충성 선언',
          description: '이적 루머를 일축하고 현재 동료들과 끝까지 시즌을 완주하겠다고 선언해요.',
          effectSummary: '감독 신뢰도 +9 · INS +1, DEF +1 상승',
          statChanges: { ins: 1, def: 1 },
          trustDelta: 9,
        },
        {
          label: '✈️ 우승 반지와 새로운 기회를 위해 트레이드 요청 단행!',
          description: '단장에게 공식 트레이드를 요청해 포지션 니즈가 맞는 상위 전력 구단으로 즉시 이적해요!',
          effectSummary: '즉시 타 구단으로 트레이드 이적 · 스카우트 주목도 +5 · 승률 상승 기대',
          draftStockDelta: 5,
          executeTradeToContender: true,
        },
      ],
    };
  }

  // 시나리오 2: 주전 부상으로 찾아온 3주간의 임시 선발 쇼케이스 기회 (벤치/식스맨/유망주 역할일 때)
  if (!isAceOrStarter) {
    return {
      id: `EVT_MID_STARTER_SHOWCASE_${career.seasonYear}`,
      title: '⚡ [시즌 중반 분기점] 주전 선수 부상! 3주간의 임시 선발 기회',
      subtitle: '정규시즌 반환점(50%) · 식스맨에서 주전으로 도약할 결정적 찬스',
      description:
        '팀 내 주전 선수가 발목 염좌로 3주간 결장하게 되면서 감독님이 나에게 임시 선발 출전 기회를 부여했어요! 코트 위에서 어떤 인상을 남길까요?',
      category: 'MID_SEASON_CROSSROADS',
      choices: [
        {
          label: '🔥 공격적인 득점 쇼케이스로 스카우트들에게 강렬한 어필!',
          description: '과감한 1대1 돌파와 외곽슛으로 내 공격 재능과 잠재력을 만천하에 증명해요.',
          effectSummary: 'INS +1, OUT +1 · 잠재력(POT) +1 확장 · 스카우트 주가 +7',
          statChanges: { ins: 1, out: 1 },
          draftStockDelta: 7,
          potentialDelta: 1,
        },
        {
          label: '🛡️ 팀 전술에 맞춘 궂은일과 이타적 패스로 감독 신뢰 독차지!',
          description: '수비 로테이션과 찬스 메이킹에 집중해 감독님의 눈도장을 확실하게 찍어요.',
          effectSummary: 'PLY +1, DEF +1 · 감독 신뢰도 +11 대폭 상승 (출전시간 증가)',
          statChanges: { ply: 1, def: 1 },
          trustDelta: 11,
        },
      ],
    };
  }

  // 시나리오 3: 시즌 중반 상대 집중 견제 & 슈팅 밸런스 조정
  return {
    id: `EVT_MID_TACTICAL_ADJUST_${career.seasonYear}`,
    title: '🏀 [시즌 중반 분기점] 상대 수비의 집중 견제와 전술 해법',
    subtitle: '정규시즌 반환점(50%) · 후반기 퍼포먼스를 좌우할 훈련 선택',
    description:
      '시즌 중반에 접어들자 상대 팀들이 스카우팅 리포트를 바탕으로 집요한 더블팀과 함정 수비를 펼치고 있어요. 후반기 돌파구를 어떻게 마련할까요?',
    category: 'MID_SEASON_CROSSROADS',
    choices: [
      {
        label: '🎯 릴리스 속도를 높이는 야간 슈팅 & 볼핸들링 특훈',
        description: '수비가 붙기 전에 한 박자 빠르게 올라가는 풀업 점퍼와 패스 타이밍을 연마해요.',
        effectSummary: 'OUT +2, PLY +1 · 스카우트 주가 +5',
        statChanges: { out: 2, ply: 1 },
        draftStockDelta: 5,
      },
      {
        label: '💪 웨이트와 압박 수비 에너지로 공수 밸런스 재정비',
        description: '강한 체력과 대인 방어로 상대 에이스를 먼저 지치게 만들어요.',
        effectSummary: 'DEF +1, REB +1, PHY +1 · 감독 신뢰도 +7',
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
    title: '🧬 [베테랑의 진화] 점프력 대신 농구 IQ로! 플레이 스타일 변신 제안',
    subtitle: `만 ${career.age}세 베테랑 전환기 · 코칭스태프 전술 미팅 (커리어 1회)`,
    description: `어느덧 만 ${career.age}세에 접어들며 젊은 시절 같은 폭발적인 탄력과 스피드(PHY)를 매 경기 쏟아붓기 쉽지 않아졌어요. 감독님이 조용히 다가와 "이제 무리한 림 어택 대신, 노련한 패스 시야(PLY)와 코너 3점슛(OUT)으로 코트를 지휘하는 베테랑 포인트 포워드·3&D 멘토로 플레이 스타일을 진화시켜 보는 게 어떻겠나?"라고 제안했어요.`,
    category: 'VETERAN_LEGACY',
    choices: [
      {
        label: '🧠 패스 시야와 코너 3점슛으로 팀을 이끄는 베테랑 도사로 변신!',
        description:
          '운동능력(PHY) 저하를 자연스럽게 받아들이는 대신, 정교한 외곽슛과 패스 지능을 극대화해 30대 후반까지 우승 반지를 노려요!',
        effectSummary:
          '✨ 플레이 스타일 진화 완료 · PLY +3, OUT +3, DEF +1 (PHY -2) · 향후 에이징 커브 시 슛/패스 하락 영구 방어!',
        statChanges: { ply: 3, out: 3, def: 1, phy: -2 },
        trustDelta: 9,
        triggerVeteranReinvention: true,
      },
      {
        label: '🔥 내 원래의 폭발적인 돌파와 인사이드 승부 스타일을 끝까지 고수한다',
        description:
          '스타일을 바꾸기보다 웨이트 트레이닝으로 버티며 기존 에이스 플레이를 유지해요.',
        effectSummary: 'INS +2, PHY +1 · 감독 신뢰도 +3 · 기존 플레이 스타일 유지',
        statChanges: { ins: 2, phy: 1 },
        trustDelta: 3,
      },
    ],
  };
}

export function rollSeasonEvent(
  career: CareerState,
  rng: () => number = Math.random
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
  const isAsianGamesYear = career.seasonYear % 4 === 2;
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

