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
          effectSummary: 'PLY +2, OUT +1 · 감독 신뢰도 소폭 변동',
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
          effectSummary: 'OUT +3, PHY -1 · 스카우트 주목도 상승',
          statChanges: { out: 3, phy: -1 },
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
          effectSummary: 'OUT +3 · 스카우트 주목도 +6',
          statChanges: { out: 3 },
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
          effectSummary: 'PLY +2, OUT +1 · 감독 신뢰도 +7',
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
          effectSummary: 'DEF +3, REB +1 · 감독 신뢰도 +9',
          statChanges: { def: 3, reb: 1 },
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
          effectSummary: 'OUT +3, PLY +1 · 현대 농구 적합도 상승',
          statChanges: { out: 3, ply: 1 },
          draftStockDelta: 6,
          trustDelta: 6,
        },
        {
          label: '웨이트 증량으로 골밑 지배력 극대화',
          description: '누구도 밀어낼 수 없는 강력한 박스아웃과 포스트업을 다져요.',
          effectSummary: 'REB +2, INS +2 · 골밑 장악력 강화',
          statChanges: { reb: 2, ins: 2 },
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
      id: 'EVT_C_JOKIC_HUB',
      title: '하이포스트 컨트롤 타워 전술 도입',
      subtitle: '센터 전용 분기점',
      description:
        '단순히 골밑에서 공을 기다리는 대신, 자유투 라인 부근에서 컷인하는 동료들에게 패스를 뿌려주는 컨트롤 타워 역할을 제안받았어요.',
      category: 'POSITION',
      choices: [
        {
          label: '패싱 빅맨(Point Center) 스킬 연마',
          description: '넓은 시야와 킥아웃 패스로 상대 더블팀을 무력화해요!',
          effectSummary: 'PLY +3, OUT +1 · 스카우트 주목도 +7',
          statChanges: { ply: 3, out: 1 },
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
          effectSummary: 'PHY +2, DEF +2 · NBA 스카우트 호평',
          statChanges: { phy: 2, def: 2 },
          draftStockDelta: 6,
        },
        {
          label: '긴 윙스팬을 활용한 추격 블록슛 타이밍 연구',
          description: '한 발을 내주더라도 뒤에서 덮어버리는 리커버리 블록을 완성해요.',
          effectSummary: 'DEF +3, REB +1 · 감독 신뢰도 +5',
          statChanges: { def: 3, reb: 1 },
          trustDelta: 5,
        },
      ],
    },
  ],
};

export const ASIAN_GAMES_MILITARY_EVENT: CareerEvent = {
  id: 'EVT_ASIAN_GAMES_GOLD',
  title: '🇰🇷 아시안게임 남자농구 국가대표 차출 & 결승전',
  subtitle: '병역특례(예술·체육요원) 혜택이 걸린 운명의 한판',
  description:
    '태극마크를 달고 출전한 아시안게임 결승전! 숙적과의 결승 4쿼터 막판, 대표팀의 에이스로서 금메달과 병역특례 혜택을 동시에 거머쥘 절호의 기회가 찾아왔어요.',
  category: 'MILITARY',
  choices: [
    {
      label: '모든 에너지를 쏟아부어 결승전 클러치 지배!',
      description: '공수 양면에서 코트를 지배하며 대한민국의 금메달을 이끌어요!',
      effectSummary: '🎖️ 아시안게임 금메달 & 병역특례 획득! · 전 능력치 +1 · 스카우트 주목도 +10',
      statChanges: { ins: 1, out: 1, ply: 1, def: 1, reb: 1, phy: 1 },
      trustDelta: 10,
      draftStockDelta: 10,
      grantMilitaryExemption: true,
    },
    {
      label: '팀원들을 살리는 헌신적인 수비와 리바운드 집중',
      description: '궂은일을 도맡아 팀 승리의 일등공신이 되어 금메달을 목에 걸어요!',
      effectSummary: '🎖️ 아시안게임 금메달 & 병역특례 획득! · DEF +2, REB +2',
      statChanges: { def: 2, reb: 2 },
      trustDelta: 12,
      draftStockDelta: 8,
      grantMilitaryExemption: true,
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

export const FAREWELL_TOUR_LOGS: string[] = [
  '원정 경기장 전 관중이 기립박수로 레전드의 마지막 방문을 배웅했어요!',
  '경기 종료 후 상대 팀 에이스와 뜨거운 포옹을 나누며 마지막 유니폼 교환식을 가졌어요!',
  '원정 구단 프런트에서 헌정 영상과 함께 특별 기념 액자를 선물하며 경의를 표했어요!',
  '코트를 떠나는 순간, 벤치의 어린 후배들이 모두 일어나 고개 숙여 존경을 표했어요!',
  '수많은 어린이 팬들이 "고마워요 레전드!" 플래카드를 흔들며 눈시울을 붉혔어요!',
];

export function rollSeasonEvent(career: CareerState): CareerEvent | null {
  // 1) ④ 노장 치명적 부상 은퇴 기로: 만 32세 이상이고 PHY <= 65일 때 10% 확률
  if (career.age >= 32 && career.stats.phy <= 65 && Math.random() < 0.1) {
    return VETERAN_CRITICAL_INJURY_EVENT;
  }

  // 2) 아시안게임 병역특례 이벤트: 미필 상태 & OVR >= 64 & 21~26세 사이일 때 높은 확률로 발생
  if (
    !career.militaryExempt &&
    career.age >= 21 &&
    career.age <= 26 &&
    career.ovr >= 64 &&
    Math.random() < 0.45
  ) {
    return ASIAN_GAMES_MILITARY_EVENT;
  }

  // 3) 포지션별 전용 분기점 이벤트 (35% 확률)
  if (Math.random() < 0.38) {
    const pool = POSITION_EVENTS[career.primaryPos] || POSITION_EVENTS.PG;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    return picked;
  }

  return null;
}
