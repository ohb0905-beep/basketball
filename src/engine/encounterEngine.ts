import {
  CareerEvent,
  CareerEventChoice,
  CareerState,
  EncounterResolutionResult,
  LeagueId,
  PlayerStats,
  PlayerTraitId,
  Position,
  RelationshipMetrics,
} from '../types/game';
import { LEAGUE_CONFIG } from '../data/leagues';
import { clampNum } from '../config/balanceConfig';
import { rollStoryArcEvent } from './storyArcEngine';

export type CareerEventCategory = NonNullable<CareerEvent['category']>;

export type CareerContextTag =
  | 'HOT_STREAK'
  | 'PRIME_ACE'
  | 'CONTRACT_YEAR'
  | 'ROOKIE_WALL'
  | 'BENCH_SPARK'
  | 'VETERAN_LEADER'
  | 'INJURY_PRONE'
  | 'AMATEUR_PROSPECT'
  | 'PRO_STAR'
  | 'CHAMPIONSHIP_HUNT';

export interface EncounterScenarioTemplate {
  id: string;
  category: CareerEventCategory;
  title: string;
  subtitle: string;
  description: string;
  allowedLeagues?: LeagueId[];
  allowedPositions?: Position[];
  excludedPositions?: Position[];
  minAge?: number;
  maxAge?: number;
  preferredPositions?: Position[];
  preferredLeagues?: LeagueId[];
  preferredTraits?: PlayerTraitId[];
  preferredTags?: CareerContextTag[];
  choices: CareerEvent['choices'];
}

export function extractCareerContextTags(
  career: CareerState
): CareerContextTag[] {
  const tags: CareerContextTag[] = [];
  const latestLog = career.seasonLogs[career.seasonLogs.length - 1];

  if (latestLog && (latestLog.ppg >= 20 || latestLog.fgPct >= 49.0)) {
    tags.push('HOT_STREAK');
  }
  if (career.ovr >= 80 && career.age >= 23 && career.age <= 31) {
    tags.push('PRIME_ACE');
  }
  if (career.contractYearsLeft <= 1) {
    tags.push('CONTRACT_YEAR');
  }
  if (career.seasonsPlayed <= 2) {
    tags.push('ROOKIE_WALL');
  }
  if (latestLog && latestLog.mpg < 24 && latestLog.ppg >= 8) {
    tags.push('BENCH_SPARK');
  }
  if (career.age >= 31) {
    tags.push('VETERAN_LEADER');
  }
  if (
    (career.traits || []).includes('GLASS_BODY') ||
    (latestLog && (latestLog.injuredGamesMissed ?? 0) >= 8)
  ) {
    tags.push('INJURY_PRONE');
  }
  if (
    career.league === 'HIGH_SCHOOL' ||
    career.league === 'U_LEAGUE' ||
    career.league === 'NCAA'
  ) {
    tags.push('AMATEUR_PROSPECT');
  } else {
    tags.push('PRO_STAR');
  }
  if (career.team.direction === 'CONTENDER') {
    tags.push('CHAMPIONSHIP_HUNT');
  }

  return tags;
}

const CATEGORIES: CareerEventCategory[] = [
  'ROLE_ADAPTATION',
  'TACTICAL_CLASH',
  'LOCKER_ROOM',
  'LOAD_MANAGEMENT',
  'MEDIA_SPOTLIGHT',
  'RIVAL_SHOWDOWN',
  'OFF_COURT_BRAND',
  'SCOUTING_SHOWCASE',
];

const SCENARIO_SEEDS: Array<{
  category: CareerEventCategory;
  code: string;
  title: string;
  subtitle: string;
  description: string;
  tags: CareerContextTag[];
  allowedPositions?: Position[];
  excludedPositions?: Position[];
  preferredPositions?: Position[];
  c1Label: string;
  c1Desc: string;
  c1Summary: string;
  c1Stats: CareerEvent['choices'][0]['statChanges'];
  c1Trust: number;
  c1Draft: number;
  c2Label: string;
  c2Desc: string;
  c2Summary: string;
  c2Stats: CareerEvent['choices'][0]['statChanges'];
  c2Trust: number;
  c2Draft: number;
}> = [
  // POSITION (6)
  {
    category: 'POSITION',
    code: 'POS_01',
    title: '코칭스태프의 스위치 디펜스 실험',
    subtitle: '포지션 파괴 전술 미팅',
    description: '상대 스몰볼 라인업에 대응하기 위해 1번부터 5번까지 모두 바꿔 막는 올-스위치 수비가 도입되었어요.',
    tags: ['PRO_STAR', 'CHAMPIONSHIP_HUNT'],
    c1Label: '사이드 스텝과 외곽 대인 방어 집중 연마',
    c1Desc: '빠른 가드 앞에서도 벗겨지지 않는 풋워크를 완성해요.',
    c1Summary: 'DEF +2, PHY +1 · 감독 신뢰도 +5',
    c1Stats: { def: 2, phy: 1 },
    c1Trust: 5,
    c1Draft: 2,
    c2Label: '수비 리바운드 박스아웃과 림 보호에 집중',
    c2Desc: '골밑 보드를 장악해 세컨드 찬스를 원천 차단해요.',
    c2Summary: 'REB +2, INS +1 · 감독 신뢰도 +4',
    c2Stats: { reb: 2, ins: 1 },
    c2Trust: 4,
    c2Draft: 2,
  },
  {
    category: 'POSITION',
    code: 'POS_02',
    title: '하프코트 핸드오프(DHO) 허브 역할 부여',
    subtitle: '모션 오펜스 중심축 실험',
    description: '단순히 볼을 받아 던지는 역할을 넘어 탑에서 드리블 핸드오프와 백도어 패스를 찔러주는 전술 허브 임무가 주어졌어요.',
    tags: ['PRIME_ACE', 'HOT_STREAK'],
    c1Label: '찰나의 컷인을 포착하는 패스 시야 극대화',
    c1Desc: '동료들의 움직임을 한 수 앞서 읽는 패스 타이밍을 익혀요.',
    c1Summary: 'PLY +2, OUT +1 · 감독 신뢰도 +6',
    c1Stats: { ply: 2, out: 1 },
    c1Trust: 6,
    c1Draft: 3,
    c2Label: '페이크 후 직접 림을 파고드는 돌파 피니시',
    c2Desc: '수비가 패스 길을 읽을 때 역으로 골밑을 폭격해요.',
    c2Summary: 'INS +2, PHY +1 · 스카우트 주가 +4',
    c2Stats: { ins: 2, phy: 1 },
    c2Trust: 3,
    c2Draft: 4,
  },
  {
    category: 'POSITION',
    code: 'POS_03',
    title: '트랜지션 얼리 오펜스 선봉장 지시',
    subtitle: '세컨더리 브레이크 전술',
    description: '리바운드 직후 7초 이내에 마무리하는 런앤건 전술에서 코트 제일 앞선을 달리는 역할이 맡겨졌어요.',
    tags: ['AMATEUR_PROSPECT', 'ROOKIE_WALL'],
    c1Label: '전력 질주 속공 가담과 림 어택',
    c1Desc: '누구보다 먼저 상대 코트로 달려가 쉬운 득점을 올려요.',
    c1Summary: 'PHY +2, INS +1 · 감독 신뢰도 +5',
    c1Stats: { phy: 2, ins: 1 },
    c1Trust: 5,
    c1Draft: 3,
    c2Label: '트레일러 3점슛 라인 대기 및 스페이싱',
    c2Desc: '수비가 골밑으로 몰릴 때 아크 정면에서 오픈 3점슛을 꽂아요.',
    c2Summary: 'OUT +2, PLY +1 · 스카우트 주가 +4',
    c2Stats: { out: 2, ply: 1 },
    c2Trust: 4,
    c2Draft: 4,
  },
  {
    category: 'POSITION',
    code: 'POS_04',
    title: '블라인드 사이드 스크린 & 픽앤팝 세팅',
    subtitle: '2대2 게임 정밀도 향상',
    description: '수비수의 사각지대를 노리는 스크린 각도와 팝아웃 타이밍을 세밀하게 교정하는 비디오 세션이 열렸어요.',
    tags: ['BENCH_SPARK', 'PRO_STAR'],
    allowedPositions: ['SF', 'PF', 'C'],
    preferredPositions: ['PF', 'C'],
    c1Label: '픽앤팝 3점슛 릴리스 속도 단축',
    c1Desc: '스크린 직후 반 박자 빠르게 솟아올라 외곽포를 터뜨려요.',
    c1Summary: 'OUT +2, INS +1 · 스카우트 주가 +4',
    c1Stats: { out: 2, ins: 1 },
    c1Trust: 4,
    c1Draft: 4,
    c2Label: '단단한 스크린 콘택트와 롤인 리바운드',
    c2Desc: '몸싸움으로 볼핸들러의 길을 열어주고 공격 리바운드를 따내요.',
    c2Summary: 'REB +2, DEF +1 · 감독 신뢰도 +6',
    c2Stats: { reb: 2, def: 1 },
    c2Trust: 6,
    c2Draft: 2,
  },
  {
    category: 'POSITION',
    code: 'POS_05',
    title: '위크사이드 헬프 디펜스 & 리커버리',
    subtitle: '수비 로테이션 코어 역할',
    description: '반대편 골밑 돌파를 저지한 뒤 곧바로 코너 슈터에게 복귀하는 고난도 로테이션 수비 임무가 주어졌어요.',
    tags: ['CHAMPIONSHIP_HUNT', 'VETERAN_LEADER'],
    allowedPositions: ['SF', 'PF', 'C'],
    preferredPositions: ['PF', 'C'],
    c1Label: '폭발적인 클로즈아웃과 패스 레인 차단',
    c1Desc: '넓은 수비 범위로 상대의 킥아웃 패스를 가로채요.',
    c1Summary: 'DEF +2, PLY +1 · 감독 신뢰도 +6',
    c1Stats: { def: 2, ply: 1 },
    c1Trust: 6,
    c1Draft: 3,
    c2Label: '골밑 수직 수비(Verticality)와 보드 장악',
    c2Desc: '파울 없이 림을 지키고 수비 리바운드를 확실히 건져내요.',
    c2Summary: 'REB +2, PHY +1 · 감독 신뢰도 +5',
    c2Stats: { reb: 2, phy: 1 },
    c2Trust: 5,
    c2Draft: 2,
  },
  {
    category: 'POSITION',
    code: 'POS_06',
    title: '포스트업 더블팀 대처와 스킵 패스',
    subtitle: '코트 비전 업그레이드',
    description: '페인트존 근처에서 볼을 잡을 때마다 상대가 즉각 더블팀 함정 수비를 걸어오고 있어요.',
    tags: ['PRIME_ACE', 'HOT_STREAK'],
    allowedPositions: ['SF', 'PF', 'C'],
    preferredPositions: ['PF', 'C'],
    c1Label: '반대편 코너로 찔러주는 대각선 스킵 패스',
    c1Desc: '더블팀을 역이용해 노마크 동료에게 완벽한 3점 찬스를 선물해요.',
    c1Summary: 'PLY +2, OUT +1 · 감독 신뢰도 +6',
    c1Stats: { ply: 2, out: 1 },
    c1Trust: 6,
    c1Draft: 3,
    c2Label: '파워 드리블과 페이드어웨이로 직접 격파',
    c2Desc: '두 명이 막아도 기어코 득점을 올리는 에이스의 위용을 보여줘요.',
    c2Summary: 'INS +2, OUT +1 · 스카우트 주가 +5',
    c2Stats: { ins: 2, out: 1 },
    c2Trust: 3,
    c2Draft: 5,
  },

  // COACH_TACTICS -> TACTICAL_CLASH (6)
  {
    category: 'TACTICAL_CLASH',
    code: 'TAC_01',
    title: '감독님의 심야 비디오 분석실 호출',
    subtitle: '1대1 전술 피드백 세션',
    description: '원정 경기 후 감독님이 호텔 회의실로 따로 불러 최근 5경기의 샷 셀렉션과 수비 위치 선정 영상을 보여줬어요.',
    tags: ['ROOKIE_WALL', 'AMATEUR_PROSPECT'],
    c1Label: '감독님의 피드백을 완벽 수용해 팀 전술에 맞춤',
    c1Desc: '무리한 터프샷을 줄이고 약속된 패턴 플레이의 완성도를 높여요.',
    c1Summary: 'PLY +1, DEF +1 · 감독 신뢰도 +9',
    c1Stats: { ply: 1, def: 1 },
    c1Trust: 9,
    c1Draft: 2,
    c2Label: '내 공격 본능과 클러치 해결사 역할을 적극 어필',
    c2Desc: '접전 상황에서 내가 왜 공을 잡아야 하는지 데이터로 설득해요.',
    c2Summary: 'INS +1, OUT +1 · 스카우트 주가 +5',
    c2Stats: { ins: 1, out: 1 },
    c2Trust: 2,
    c2Draft: 5,
  },
  {
    category: 'TACTICAL_CLASH',
    code: 'TAC_02',
    title: '새로 부임한 수석코치의 모션 오펜스 개혁',
    subtitle: '전술 시스템 전면 개편',
    description: '유럽 농구 스타일의 끊임없는 오프볼 무브와 0.5초 패스 판단을 요구하는 새로운 공격 시스템이 도입되었어요.',
    tags: ['PRO_STAR', 'BENCH_SPARK'],
    c1Label: '오프볼 스크린과 컷인 타이밍을 가장 먼저 마스터',
    c1Desc: '공이 없을 때도 수비를 흔드는 움직임으로 코치진의 신뢰를 얻어요.',
    c1Summary: 'PLY +2, INS +1 · 감독 신뢰도 +7',
    c1Stats: { ply: 2, ins: 1 },
    c1Trust: 7,
    c1Draft: 3,
    c2Label: '캐치앤슛 3점 정확도를 극한으로 끌어올림',
    c2Desc: '패스가 배달되는 즉시 림을 가르는 스나이퍼로 자리매김해요.',
    c2Summary: 'OUT +2, DEF +1 · 스카우트 주가 +4',
    c2Stats: { out: 2, def: 1 },
    c2Trust: 5,
    c2Draft: 4,
  },
  {
    category: 'TACTICAL_CLASH',
    code: 'TAC_03',
    title: '풀코트 프레스 & 트랩 수비 스페셜 패키지',
    subtitle: '4쿼터 역전용 비밀 병기',
    description: '지고 있는 경기 후반 흐름을 뒤집기 위해 하프라인부터 강하게 압박하는 프레스 전술 훈련이 진행되었어요.',
    tags: ['BENCH_SPARK', 'CHAMPIONSHIP_HUNT'],
    allowedPositions: ['PG', 'SG', 'SF'],
    preferredPositions: ['PG', 'SG'],
    c1Label: '최전방에서 볼핸들러를 질식시키는 압박 수비',
    c1Desc: '지치지 않는 체력으로 상대 가드의 턴오버를 유발해요.',
    c1Summary: 'DEF +2, PHY +1 · 감독 신뢰도 +6',
    c1Stats: { def: 2, phy: 1 },
    c1Trust: 6,
    c1Draft: 3,
    c2Label: '스틸 직후 속공 피니시와 트레일러 패스 연결',
    c2Desc: '가로채기를 곧바로 득점으로 연결하는 공수 전환에 집중해요.',
    c2Summary: 'INS +1, PLY +2 · 스카우트 주가 +4',
    c2Stats: { ins: 1, ply: 2 },
    c2Trust: 4,
    c2Draft: 4,
  },
  {
    category: 'TACTICAL_CLASH',
    code: 'TAC_04',
    title: '데이터 분석팀의 샷 차트 최적화 제안',
    subtitle: '기대득점(eFG%) 극대화 프로젝트',
    description: '구단 데이터 분석팀이 긴 2점 미드레인지를 줄이고 코너 3점과 림 어택 비중을 85%까지 늘리자고 제안했어요.',
    tags: ['CONTRACT_YEAR', 'PRO_STAR'],
    c1Label: '데이터 분석을 수용해 3점슛과 림 어택만 정밀 타격',
    c1Desc: '최고 효율 구간에서만 슛을 던져 야투율을 대폭 끌어올려요.',
    c1Summary: 'OUT +2, INS +1 · 감독 신뢰도 +6',
    c1Stats: { out: 2, ins: 1 },
    c1Trust: 6,
    c1Draft: 4,
    c2Label: '플레이오프 승부처를 대비해 미드레인지 풀업도 유지',
    c2Desc: '수비가 골밑과 3점만 막을 때를 대비해 전천후 득점력을 갈고닦아요.',
    c2Summary: 'INS +1, OUT +1, PLY +1 · 스카우트 주가 +5',
    c2Stats: { ins: 1, out: 1, ply: 1 },
    c2Trust: 4,
    c2Draft: 5,
  },
  {
    category: 'TACTICAL_CLASH',
    code: 'TAC_05',
    title: '상대 에이스 전담 마크맨 긴급 호출',
    subtitle: '수비 스페셜 미션',
    description: '연승을 달리는 리그 득점 선두와의 맞대결을 앞두고 감독님이 "오늘 상대 에이스를 네가 잠가달라"고 지시했어요.',
    tags: ['CHAMPIONSHIP_HUNT', 'PRIME_ACE'],
    c1Label: '공격 힘을 아끼고 40분 내내 그림자 수비에 올인',
    c1Desc: '상대 에이스의 야투율을 30%대로 묶어내며 팀 승리를 지켜요.',
    c1Summary: 'DEF +2, REB +1 · 감독 신뢰도 +9',
    c1Stats: { def: 2, reb: 1 },
    c1Trust: 9,
    c1Draft: 3,
    c2Label: '수비뿐만 아니라 맞불 득점으로 상대 에이스의 체력 소모 유도',
    c2Desc: '공격에서도 끊임없이 몰아붙여 공수 양면에서 판정승을 거둬요.',
    c2Summary: 'INS +1, OUT +1, DEF +1 · 스카우트 주가 +6',
    c2Stats: { ins: 1, out: 1, def: 1 },
    c2Trust: 5,
    c2Draft: 6,
  },
  {
    category: 'TACTICAL_CLASH',
    code: 'TAC_06',
    title: '세컨드 유닛 리더(벤치 에이스) 겸임 요청',
    subtitle: '로테이션 스태거링 전술',
    description: '주전들이 벤치에서 쉬는 2쿼터 초반 5분 동안 코트에 남아 세컨드 유닛의 공격을 전담 지휘해 달라는 요청을 받았어요.',
    tags: ['BENCH_SPARK', 'VETERAN_LEADER'],
    c1Label: '벤치 멤버들의 찬스를 살려주는 리딩에 집중',
    c1Desc: '식스맨 동료들의 득점을 도우며 팀 전체 사기를 끌어올려요.',
    c1Summary: 'PLY +2, DEF +1 · 감독 신뢰도 +8',
    c1Stats: { ply: 2, def: 1 },
    c1Trust: 8,
    c1Draft: 3,
    c2Label: '2쿼터 초반 공격권을 독점해 폭발적인 연속 득점 가동',
    c2Desc: '짧은 시간 안에 순식간에 10점을 몰아치는 폭발력을 보여줘요.',
    c2Summary: 'INS +2, OUT +1 · 스카우트 주가 +5',
    c2Stats: { ins: 2, out: 1 },
    c2Trust: 4,
    c2Draft: 5,
  },

  // LOCKER_ROOM (6)
  {
    category: 'LOCKER_ROOM',
    code: 'LCK_01',
    title: '3연패 후 라커룸 선수단 긴급 미팅',
    subtitle: '팀 케미스트리 분수령',
    description: '아쉬운 역전패가 이어지자 라커룸 분위기가 무겁게 가라앉았어요. 누군가 분위기를 반전시켜야 할 시점이에요.',
    tags: ['VETERAN_LEADER', 'PRIME_ACE'],
    c1Label: '차분하게 내 실수부터 인정하며 원팀 결속 독려',
    c1Desc: '솔선수범하는 리더십으로 동료들과 코칭스태프의 깊은 신뢰를 얻어요.',
    c1Summary: 'PLY +1, DEF +1 · 감독 신뢰도 +8',
    c1Stats: { ply: 1, def: 1 },
    c1Trust: 8,
    c1Draft: 3,
    c2Label: '내일 새벽 6시 자율 슈팅 훈련에 전원 동참 제안',
    c2Desc: '말보다 땀방울로 연패를 끊자며 팀 전체의 훈련 열기를 깨워요.',
    c2Summary: 'OUT +2, PHY +1 · 감독 신뢰도 +6',
    c2Stats: { out: 2, phy: 1 },
    c2Trust: 6,
    c2Draft: 3,
  },
  {
    category: 'LOCKER_ROOM',
    code: 'LCK_02',
    title: '베테랑 선배의 시그니처 풋워크 비급 전수',
    subtitle: '라커룸 멘토링 이벤트',
    description: '은퇴를 앞둔 팀 내 베테랑 선배가 훈련이 끝난 뒤 남아 자신만의 피벗 타이밍과 파울 유도 노하우를 알려주겠다고 해요.',
    tags: ['AMATEUR_PROSPECT', 'ROOKIE_WALL'],
    c1Label: '인사이드 페이크와 파울 유도 기술을 끝까지 전수받음',
    c1Desc: '수비수의 무게중심을 무너뜨리는 노련한 골밑 기술을 흡수해요.',
    c1Summary: 'INS +2, PLY +1 · 감독 신뢰도 +5',
    c1Stats: { ins: 2, ply: 1 },
    c1Trust: 5,
    c1Draft: 3,
    c2Label: '긴 시즌을 부상 없이 버티는 리바운드 위치 선정 노하우 학습',
    c2Desc: '점프력 대신 낙구 지점 예측으로 보드를 장악하는 법을 배워요.',
    c2Summary: 'REB +2, DEF +1 · 감독 신뢰도 +6',
    c2Stats: { reb: 2, def: 1 },
    c2Trust: 6,
    c2Draft: 2,
  },
  {
    category: 'LOCKER_ROOM',
    code: 'LCK_03',
    title: '신인 후배와의 1대1 야간 코트 스파링',
    subtitle: '선후배 선의의 경쟁',
    description: '패기 넘치는 팀 내 루키가 훈련 종료 후 11점 내기 1대1 대결을 정중하게 신청해 왔어요.',
    tags: ['PRO_STAR', 'VETERAN_LEADER'],
    c1Label: '한 치의 양보 없는 실전 수비와 점퍼로 프로의 벽을 보여줌',
    c1Desc: '압도적인 실력으로 승리한 뒤 후배에게 따뜻한 조언까지 건네요.',
    c1Summary: 'OUT +1, DEF +2 · 감독 신뢰도 +6',
    c1Stats: { out: 1, def: 2 },
    c1Trust: 6,
    c1Draft: 3,
    c2Label: '새로운 돌파 스텝을 실험하며 함께 공격 기술 연구',
    c2Desc: '승패보다 서로의 새로운 무기를 점검하는 유익한 시간으로 만들어요.',
    c2Summary: 'INS +2, PLY +1 · 스카우트 주가 +4',
    c2Stats: { ins: 2, ply: 1 },
    c2Trust: 4,
    c2Draft: 4,
  },
  {
    category: 'LOCKER_ROOM',
    code: 'LCK_04',
    title: '원정 비행기 안에서의 전술 보드 토론',
    subtitle: '장거리 원정길 팀워크',
    description: '연속 원정 경기로 이동하는 비행기 안에서 팀의 핵심 동료들과 다음 상대의 드롭백 수비 파훼법을 논의했습니다.',
    tags: ['HOT_STREAK', 'CHAMPIONSHIP_HUNT'],
    c1Label: '앨리웁 롭 패스와 백도어 컷 수신호 맞추기',
    c1Desc: '눈빛만 봐도 통하는 골밑 침투 호흡을 완벽히 맞춰요.',
    c1Summary: 'INS +2, PLY +1 · 감독 신뢰도 +6',
    c1Stats: { ins: 2, ply: 1 },
    c1Trust: 6,
    c1Draft: 3,
    c2Label: '트랜지션 트레일러 3점슛 스팟 약속',
    c2Desc: '속공 상황에서 가장 확률 높은 45도 외곽 스팟을 선점하기로 해요.',
    c2Summary: 'OUT +2, PLY +1 · 스카우트 주가 +4',
    c2Stats: { out: 2, ply: 1 },
    c2Trust: 5,
    c2Draft: 4,
  },
  {
    category: 'LOCKER_ROOM',
    code: 'LCK_05',
    title: '주전 경쟁자와의 출전 시간 분배 갈등 해소',
    subtitle: '라커룸 케미스트리 관리',
    description: '같은 포지션의 동료와 출전 시간이 겹치며 미묘한 긴장감이 흐르고 있어요. 어떻게 풀어나갈까요?',
    tags: ['BENCH_SPARK', 'CONTRACT_YEAR'],
    c1Label: '함께 뛰는 투가드/스몰볼 조합의 시너지를 코치진에 제안',
    c1Desc: '경쟁 대신 공존 해법을 찾아 두 선수 모두 코트에 서는 시간을 늘려요.',
    c1Summary: 'PLY +2, DEF +1 · 감독 신뢰도 +8',
    c1Stats: { ply: 2, def: 1 },
    c1Trust: 8,
    c1Draft: 3,
    c2Label: '팀 연습경기에서 압도적인 공수 퍼포먼스로 실력 증명',
    c2Desc: '코트 위 결과로 누가 주전 적임자인지 깔끔하게 보여줘요.',
    c2Summary: 'INS +1, OUT +2 · 스카우트 주가 +5',
    c2Stats: { ins: 1, out: 2 },
    c2Trust: 4,
    c2Draft: 5,
  },
  {
    category: 'LOCKER_ROOM',
    code: 'LCK_06',
    title: '플레이오프 진출 기념 선수단 만찬 주최',
    subtitle: '원팀 사기 진작 이벤트',
    description: '시즌 막바지 순위 경쟁을 앞두고 팀원들과 스태프들을 위한 단합 만찬 자리가 마련되었어요.',
    tags: ['PRIME_ACE', 'VETERAN_LEADER'],
    c1Label: '언성 히어로 동료들과 트레이너 스태프들에게 감사 인사 전달',
    c1Desc: '보이지 않는 곳에서 헌신하는 팀원들을 챙겨 라커룸 결속력을 극대화해요.',
    c1Summary: 'PLY +1, DEF +1, REB +1 · 감독 신뢰도 +8',
    c1Stats: { ply: 1, def: 1, reb: 1 },
    c1Trust: 8,
    c1Draft: 3,
    c2Label: '우승 반지를 향한 강렬한 출사표로 승부욕 자극',
    c2Desc: '에이스다운 카리스마로 선수단 전체의 목표 의식을 깨워요.',
    c2Summary: 'INS +1, OUT +1, PHY +1 · 스카우트 주가 +5',
    c2Stats: { ins: 1, out: 1, phy: 1 },
    c2Trust: 5,
    c2Draft: 5,
  },

  // INJURY_RECOVERY (6)
  {
    category: 'LOAD_MANAGEMENT',
    code: 'INJ_01',
    title: '스포츠 과학 수면 & 크라이오테라피 루틴 도입',
    subtitle: '백투백 일정 피로 관리',
    description: '빡빡한 원정 연전으로 근육 피로도가 높아진 상황이에요. 구단 메디컬팀이 최신 냉각 치료와 수면 코칭을 제안했어요.',
    tags: ['INJURY_PRONE', 'PRO_STAR'],
    c1Label: '철저한 크라이오테라피와 식단으로 회복 속도 극대화',
    c1Desc: '시즌 끝까지 지치지 않는 탄탄한 내구성과 컨디션을 확보해요.',
    c1Summary: 'PHY +2, DEF +1 · 감독 신뢰도 +5',
    c1Stats: { phy: 2, def: 1 },
    c1Trust: 5,
    c1Draft: 3,
    c2Label: '회복 시간 중 상대 수비 전술 영상 분석 병행',
    c2Desc: '몸을 쉬는 동안 농구 지능과 패스 길을 연구해요.',
    c2Summary: 'PLY +2, PHY +1 · 감독 신뢰도 +6',
    c2Stats: { ply: 2, phy: 1 },
    c2Trust: 6,
    c2Draft: 3,
  },
  {
    category: 'LOAD_MANAGEMENT',
    code: 'INJ_02',
    title: '착지 메커니즘 & 발목 안정성 교정 클리닉',
    subtitle: '생체역학 부상 예방 프로그램',
    description: '점프 후 착지할 때 한쪽 무릎과 발목에 하중이 쏠리는 습관을 교정하기 위한 코어 밸런스 프로그램이 열렸어요.',
    tags: ['INJURY_PRONE', 'AMATEUR_PROSPECT'],
    c1Label: '하체 코어와 고관절 유연성 강화에 집중',
    c1Desc: '어떤 접촉 후에도 안전하게 착지하는 밸런스를 완성해요.',
    c1Summary: 'PHY +2, REB +1 · 감독 신뢰도 +5',
    c1Stats: { phy: 2, reb: 1 },
    c1Trust: 5,
    c1Draft: 3,
    c2Label: '충격을 줄이는 플로터와 소프트 터치 마무리 연마',
    c2Desc: '무리한 충돌 없이도 득점하는 기술적 피니시를 장착해요.',
    c2Summary: 'INS +2, OUT +1 · 스카우트 주가 +4',
    c2Stats: { ins: 2, out: 1 },
    c2Trust: 4,
    c2Draft: 4,
  },
  {
    category: 'LOAD_MANAGEMENT',
    code: 'INJ_03',
    title: '가벼운 손가락 타박상과 슈팅 릴리스 미세 조정',
    subtitle: '부상 위기를 기회로',
    description: '경기 중 비주력 손가락에 가벼운 테이핑을 하게 되었어요. 트레이너는 휴식을 권하지만 슈팅 감각을 유지하고 싶어요.',
    tags: ['HOT_STREAK', 'PRIME_ACE'],
    c1Label: '가이드 핸드 간섭을 줄이는 원핸드 정석 릴리스 교정',
    c1Desc: '오히려 슛 회전이 더 깔끔해지며 외곽슛 정확도가 한 단계 도약해요!',
    c1Summary: 'OUT +2, PLY +1 · 스카우트 주가 +5',
    c1Stats: { out: 2, ply: 1 },
    c1Trust: 5,
    c1Draft: 5,
    c2Label: '무리하지 않고 하체 웨이트와 수비 풋워크에 전념',
    c2Desc: '손가락이 완치될 때까지 하체 힘과 수비 에너지를 비축해요.',
    c2Summary: 'PHY +2, DEF +1 · 감독 신뢰도 +6',
    c2Stats: { phy: 2, def: 1 },
    c2Trust: 6,
    c2Draft: 2,
  },
  {
    category: 'LOAD_MANAGEMENT',
    code: 'INJ_04',
    title: '베테랑 전담 필라테스 & 관절 가동성 세션',
    subtitle: '롱런 커리어 케어',
    description: '시즌 중반 뻐근해진 허리와 햄스트링을 풀어주기 위해 전문 모빌리티 코치와 세션을 진행해요.',
    tags: ['VETERAN_LEADER', 'INJURY_PRONE'],
    c1Label: '코어 안정성과 민첩성 회복 프로그램 완주',
    c1Desc: '전성기 못지않은 첫 스텝 반응 속도를 되찾아요.',
    c1Summary: 'PHY +2, DEF +1 · 감독 신뢰도 +5',
    c1Stats: { phy: 2, def: 1 },
    c1Trust: 5,
    c1Draft: 3,
    c2Label: '체력 소모를 줄이는 노련한 위치 선정과 패스 게임 연구',
    c2Desc: '최소한의 움직임으로 최대 효율을 내는 도사 플레이를 체화해요.',
    c2Summary: 'PLY +2, REB +1 · 감독 신뢰도 +6',
    c2Stats: { ply: 2, reb: 1 },
    c2Trust: 6,
    c2Draft: 3,
  },
  {
    category: 'LOAD_MANAGEMENT',
    code: 'INJ_05',
    title: '맞춤형 카본 인솔 & 농구화 쿠셔닝 피팅',
    subtitle: '장비 생체역학 최적화',
    description: '용품사 엔지니어가 내 발 아치와 점프 압력 분포를 스캔해 전용 카본 인솔을 제작해 가져왔어요.',
    tags: ['PRO_STAR', 'CONTRACT_YEAR'],
    c1Label: '반발력을 극대화한 카본 플레이트 세팅 선택',
    c1Desc: '림 어택과 리바운드 경합에서 탄력이 눈에 띄게 살아나요.',
    c1Summary: 'PHY +1, REB +2 · 스카우트 주가 +4',
    c1Stats: { phy: 1, reb: 2 },
    c1Trust: 4,
    c1Draft: 4,
    c2Label: '접지력과 급제동 안정성을 높인 로우컷 세팅 선택',
    c2Desc: '스텝백 점퍼와 수비 방향 전환이 한결 예리해져요.',
    c2Summary: 'OUT +1, DEF +2 · 감독 신뢰도 +5',
    c2Stats: { out: 1, def: 2 },
    c2Trust: 5,
    c2Draft: 4,
  },
  {
    category: 'LOAD_MANAGEMENT',
    code: 'INJ_06',
    title: '시즌 막바지 로드 매니지먼트(출전 시간 조절) 면담',
    subtitle: '플레이오프 대비 컨디션 조율',
    description: '트레이너가 큰 경기를 앞두고 체력을 비축하기 위해 훈련 강도를 조절하자고 제안했어요.',
    tags: ['CHAMPIONSHIP_HUNT', 'VETERAN_LEADER'],
    c1Label: '트레이너 권고대로 체력을 비축해 폭발력 충전',
    c1Desc: '완벽하게 회복된 신체 에너지로 중요한 일전을 준비해요.',
    c1Summary: 'PHY +2, INS +1 · 감독 신뢰도 +5',
    c1Stats: { phy: 2, ins: 1 },
    c1Trust: 5,
    c1Draft: 3,
    c2Label: '출전은 유지하되 세트 오펜스 슈팅 위주로 에너지 절약',
    c2Desc: '경기 감각을 잃지 않으면서 효율적인 외곽포에 집중해요.',
    c2Summary: 'OUT +2, PLY +1 · 감독 신뢰도 +6',
    c2Stats: { out: 2, ply: 1 },
    c2Trust: 6,
    c2Draft: 3,
  },

  // MEDIA_SPONSOR (6)
  {
    category: 'MEDIA_SPOTLIGHT',
    code: 'MED_01',
    title: '전국 생중계 프라임타임 수훈선수 인터뷰',
    subtitle: '미디어 스포트라이트',
    description: '강팀과의 맞대결 직후 방송사 카메라와 마이크가 코트 한가운데로 몰려와 소감을 묻고 있어요.',
    tags: ['HOT_STREAK', 'PRIME_ACE'],
    c1Label: '감독님의 전술과 동료들의 스크린 덕분이라며 공을 돌림',
    c1Desc: '겸손하고 성숙한 인터뷰로 라커룸과 감독님의 절대적 지지를 얻어요.',
    c1Summary: 'PLY +2, DEF +1 · 감독 신뢰도 +8',
    c1Stats: { ply: 2, def: 1 },
    c1Trust: 8,
    c1Draft: 3,
    c2Label: '"오늘 코트 위에서 나를 막을 수 있는 수비는 없었다" 자신감 표출',
    c2Desc: '스타성 넘치는 어록으로 전국 팬들과 스카우트들의 화제를 독차지해요.',
    c2Summary: 'INS +1, OUT +2 · 스카우트 주가 +7',
    c2Stats: { ins: 1, out: 2 },
    c2Trust: 3,
    c2Draft: 7,
  },
  {
    category: 'MEDIA_SPOTLIGHT',
    code: 'MED_02',
    title: '글로벌 스포츠 매거진 커버스토리 화보 촬영',
    subtitle: '리그 아이콘 등극',
    description: '유명 농구 전문지에서 이번 호 표지 모델과 심층 인터뷰를 요청해 왔어요.',
    tags: ['PRO_STAR', 'CONTRACT_YEAR'],
    c1Label: '새벽 체육관 훈련 루틴을 공개하며 워크에식 강조',
    c1Desc: '성실한 연습벌레 이미지가 각인되며 구단 프런트의 평가가 치솟아요.',
    c1Summary: 'OUT +1, PHY +2 · 감독 신뢰도 +6 · 주가 +4',
    c1Stats: { out: 1, phy: 2 },
    c1Trust: 6,
    c1Draft: 4,
    c2Label: '코트 위 화려한 하이라이트 스킬 쇼케이스 촬영',
    c2Desc: '팬들과 스카우트들에게 강렬한 스타성을 각인시켜요.',
    c2Summary: 'INS +2, PLY +1 · 스카우트 주가 +6',
    c2Stats: { ins: 2, ply: 1 },
    c2Trust: 3,
    c2Draft: 6,
  },
  {
    category: 'MEDIA_SPOTLIGHT',
    code: 'MED_03',
    title: '유소년 농구 클리닉 일일 코치 초청',
    subtitle: '지역사회 공헌 이벤트',
    description: '휴식일에 지역 유소년 농구 꿈나무들에게 기본기를 가르쳐주는 재능기부 행사가 열렸어요.',
    tags: ['AMATEUR_PROSPECT', 'VETERAN_LEADER'],
    c1Label: '아이들에게 패스와 팀워크의 즐거움을 열정적으로 지도',
    c1Desc: '기본기를 다시 되새기며 코트 위 시야가 한층 넓어져요.',
    c1Summary: 'PLY +2, OUT +1 · 감독 신뢰도 +6',
    c1Stats: { ply: 2, out: 1 },
    c1Trust: 6,
    c1Draft: 3,
    c2Label: '덩크와 림 어택 쇼케이스로 아이들에게 잊지 못할 추억 선물',
    c2Desc: '밝은 에너지를 충전하며 신체 활력과 팬들의 호응을 얻어요.',
    c2Summary: 'INS +2, PHY +1 · 스카우트 주가 +4',
    c2Stats: { ins: 2, phy: 1 },
    c2Trust: 4,
    c2Draft: 4,
  },
  {
    category: 'MEDIA_SPOTLIGHT',
    code: 'MED_04',
    title: '스포츠 다큐멘터리 밀착 카메라 촬영 요청',
    subtitle: '비하인드 더 코트',
    description: '스트리밍 플랫폼 제작진이 일주일간 내 훈련과 경기 준비 과정을 다큐멘터리로 담고 싶다고 제안했어요.',
    tags: ['ROOKIE_WALL', 'HOT_STREAK'],
    c1Label: '훈련장 출입만 허용하고 경기 준비 루틴에 100% 몰입',
    c1Desc: '흔들림 없는 집중력으로 코치진의 신뢰와 경기력을 모두 챙겨요.',
    c1Summary: 'DEF +2, OUT +1 · 감독 신뢰도 +7',
    c1Stats: { def: 2, out: 1 },
    c1Trust: 7,
    c1Draft: 3,
    c2Label: '적극적으로 촬영에 임해 내 열정과 스토리를 전 세계에 홍보',
    c2Desc: '다큐멘터리 예고편이 화제를 모으며 전국적인 인지도가 급상승해요.',
    c2Summary: 'INS +1, PLY +2 · 스카우트 주가 +6',
    c2Stats: { ins: 1, ply: 2 },
    c2Trust: 3,
    c2Draft: 6,
  },
  {
    category: 'MEDIA_SPOTLIGHT',
    code: 'MED_05',
    title: '농구 분석 팟캐스트의 저평가 논란 반박',
    subtitle: '비평가들의 시선 극복',
    description: '유명 농구 평론가가 방송에서 내 플레이 스타일의 한계를 지적해 팬들 사이에서 갑론을박이 벌어졌어요.',
    tags: ['BENCH_SPARK', 'CONTRACT_YEAR'],
    c1Label: '말 대신 다음 경기 완벽한 공수 마진과 수비로 침묵시킴',
    c1Desc: '코트 위에서 실력으로 증명해 감독님과 평론가 모두의 찬사를 받아요.',
    c1Summary: 'DEF +2, REB +1 · 감독 신뢰도 +7',
    c1Stats: { def: 2, reb: 1 },
    c1Trust: 7,
    c1Draft: 4,
    c2Label: '약점으로 지적받은 외곽슛과 돌파를 보란 듯이 폭발시킴',
    c2Desc: '비판을 연료 삼아 공격 스킬을 한 단계 업그레이드해요.',
    c2Summary: 'INS +1, OUT +2 · 스카우트 주가 +6',
    c2Stats: { ins: 1, out: 2 },
    c2Trust: 4,
    c2Draft: 6,
  },
  {
    category: 'MEDIA_SPOTLIGHT',
    code: 'MED_06',
    title: '글로벌 스포츠 음료 브랜드 CF 모델 제안',
    subtitle: '상업적 가치 폭발',
    description: '대형 스포츠 음료 브랜드에서 시즌 중 반나절 CF 촬영과 후원 계약을 제안해 왔어요.',
    tags: ['PRIME_ACE', 'PRO_STAR'],
    c1Label: '팀 훈련 일정에 지장이 없는 심야 시간대로 촬영 최소화',
    c1Desc: '프로다운 자기관리로 후원사와 구단 양쪽의 신뢰를 지켜내요.',
    c1Summary: 'PHY +1, DEF +2 · 감독 신뢰도 +6',
    c1Stats: { phy: 1, def: 2 },
    c1Trust: 6,
    c1Draft: 4,
    c2Label: '화려한 클러치 슛 퍼포먼스 컨셉으로 메인 광고 촬영',
    c2Desc: 'CF가 대히트를 치며 리그 대표 스타로 자리매김해요.',
    c2Summary: 'OUT +2, INS +1 · 스카우트 주가 +6',
    c2Stats: { out: 2, ins: 1 },
    c2Trust: 3,
    c2Draft: 6,
  },

  // RIVALRY (6)
  {
    category: 'RIVAL_SHOWDOWN',
    code: 'RIV_01',
    title: '동기 라이벌의 도발적인 매치업 예고',
    subtitle: '자존심을 건 정면충돌',
    description: '같은 해 주목받았던 라이벌 선수가 경기 전 인터뷰에서 "이번 맞대결에서 누가 진짜 에이스인지 보여주겠다"고 선언했어요.',
    tags: ['HOT_STREAK', 'AMATEUR_PROSPECT'],
    c1Label: '일대일 공수 맞대결을 자청해 코트 위에서 정면 제압',
    c1Desc: '불꽃 튀는 에이스 대결에서 판정승을 거두며 주가를 높여요.',
    c1Summary: 'INS +2, DEF +1 · 스카우트 주가 +6',
    c1Stats: { ins: 2, def: 1 },
    c1Trust: 4,
    c1Draft: 6,
    c2Label: '개인의 자존심보다 철저한 팀 플레이로 완승 견인',
    c2Desc: '동료들을 살리는 이타적인 리딩으로 상대 팀을 무너뜨려요.',
    c2Summary: 'PLY +2, OUT +1 · 감독 신뢰도 +7',
    c2Stats: { ply: 2, out: 1 },
    c2Trust: 7,
    c2Draft: 4,
  },
  {
    category: 'RIVAL_SHOWDOWN',
    code: 'RIV_02',
    title: '디펜딩 챔피언 에이스와의 쇼케이스 매치',
    subtitle: '리그 최강자와의 시험대',
    description: '리그 1위 팀의 간판스타와 매치업되는 빅매치에 수많은 스카우트와 기자들이 집결했어요.',
    tags: ['PRO_STAR', 'CHAMPIONSHIP_HUNT'],
    c1Label: '과감한 외곽 풀업 3점과 돌파로 득점 맞불',
    c1Desc: '최강자를 상대로도 전혀 주눅 들지 않는 공격력을 증명해요.',
    c1Summary: 'OUT +2, INS +1 · 스카우트 주가 +6',
    c1Stats: { out: 2, ins: 1 },
    c1Trust: 4,
    c1Draft: 6,
    c2Label: '집요한 몸싸움과 박스아웃으로 상대 리듬 파괴',
    c2Desc: '거친 수비와 리바운드로 대어를 낚는 일등공신이 되어요.',
    c2Summary: 'DEF +2, REB +1 · 감독 신뢰도 +7',
    c2Stats: { def: 2, reb: 1 },
    c2Trust: 7,
    c2Draft: 4,
  },
  {
    category: 'RIVAL_SHOWDOWN',
    code: 'RIV_03',
    title: '원정 경기 관중들의 거센 야유와 압박',
    subtitle: '적지에서의 멘탈 테스트',
    description: '전통의 라이벌 구단 원정 경기, 자유투 라인에 설 때마다 경기장이 떠나갈 듯한 야유가 쏟아지고 있어요.',
    tags: ['ROOKIE_WALL', 'PRIME_ACE'],
    c1Label: '야유를 즐기듯 림만 응시하며 침착하게 연속 득점 성공',
    c1Desc: '강철 같은 심장으로 원정 경기장을 조용한 도서관으로 만들어요.',
    c1Summary: 'OUT +2, INS +1 · 스카우트 주가 +5',
    c1Stats: { out: 2, ins: 1 },
    c1Trust: 5,
    c1Draft: 5,
    c2Label: '수비와 허슬 플레이로 팀 분위기를 먼저 끌어올림',
    c2Desc: '루즈볼 다이빙과 리바운드로 동료들의 투지를 깨워요.',
    c2Summary: 'REB +2, PHY +1 · 감독 신뢰도 +7',
    c2Stats: { reb: 2, phy: 1 },
    c2Trust: 7,
    c2Draft: 3,
  },
  {
    category: 'RIVAL_SHOWDOWN',
    code: 'RIV_04',
    title: '이전 소속팀(혹은 나를 지나친 구단)과의 맞대결',
    subtitle: '복수전 모티베이션',
    description: '과거 나를 스카우트하지 않았거나 인연이 엇갈렸던 구단과의 경기가 다가왔어요. 어느 때보다 투지가 불타올라요.',
    tags: ['CONTRACT_YEAR', 'BENCH_SPARK'],
    c1Label: '상대 벤치 앞에서 폭발적인 3점포와 림 어택 작렬',
    c1Desc: '나를 놓친 것이 얼마나 큰 실수였는지 득점력으로 각인시켜요.',
    c1Summary: 'INS +2, OUT +1 · 스카우트 주가 +6',
    c1Stats: { ins: 2, out: 1 },
    c1Trust: 4,
    c1Draft: 6,
    c2Label: '냉정함을 유지하며 어시스트와 수비로 완벽한 팀 승리 완성',
    c2Desc: '감정에 휩쓸리지 않는 성숙한 경기 운영으로 감독님을 감탄시켜요.',
    c2Summary: 'PLY +2, DEF +1 · 감독 신뢰도 +8',
    c2Stats: { ply: 2, def: 1 },
    c2Trust: 8,
    c2Draft: 4,
  },
  {
    category: 'RIVAL_SHOWDOWN',
    code: 'RIV_05',
    title: '올스타/대표팀 발탁 경쟁자와의 기록 레이스',
    subtitle: '시즌 개인 타이틀 경쟁',
    description: '포지션 최고 자리를 놓고 경쟁 중인 선수와 시즌 평균 스탯이 소수점 단위로 박빙을 이루고 있어요.',
    tags: ['PRIME_ACE', 'HOT_STREAK'],
    c1Label: '공격 적극성을 끌어올려 득점과 야투 효율에서 우위 점령',
    c1Desc: '과감한 마무리를 통해 리그 최고 공격수 타이틀을 굳혀요.',
    c1Summary: 'INS +2, OUT +1 · 스카우트 주가 +5',
    c1Stats: { ins: 2, out: 1 },
    c1Trust: 4,
    c1Draft: 5,
    c2Label: '리바운드와 어시스트, 수비까지 올라운드 공헌도로 압도',
    c2Desc: '득점 이상의 전방위 영향력으로 투표인단의 마음을 사로잡아요.',
    c2Summary: 'PLY +1, DEF +1, REB +1 · 감독 신뢰도 +7',
    c2Stats: { ply: 1, def: 1, reb: 1 },
    c2Trust: 7,
    c2Draft: 5,
  },
  {
    category: 'RIVAL_SHOWDOWN',
    code: 'RIV_06',
    title: '경기 중 거친 파울과 트래시토크 신경전',
    subtitle: '코트 위 평정심 유지',
    description: '상대 수비수가 거친 스크린과 신경질적인 트래시토크로 내 평정심을 흔들려 하고 있어요.',
    tags: ['PRO_STAR', 'VETERAN_LEADER'],
    c1Label: '미소로 응수한 뒤 곧바로 앤드원(And-1) 플레이로 응징',
    c1Desc: '흥분하는 대신 압도적인 기술로 상대에게 파울 트러블을 안겨요.',
    c1Summary: 'INS +2, PLY +1 · 감독 신뢰도 +6',
    c1Stats: { ins: 2, ply: 1 },
    c1Trust: 6,
    c1Draft: 4,
    c2Label: '더욱 단단한 박스아웃과 정면 수비로 상대를 완전히 지워버림',
    c2Desc: '정당한 피지컬 수비로 상대의 기세를 꺾어놓아요.',
    c2Summary: 'DEF +2, PHY +1 · 감독 신뢰도 +7',
    c2Stats: { def: 2, phy: 1 },
    c2Trust: 7,
    c2Draft: 3,
  },

  // OFFCOURT_LIFE (6)
  {
    category: 'OFF_COURT_BRAND',
    code: 'OFF_01',
    title: '비시즌/휴식기 전담 영양사 채용과 식단 개편',
    subtitle: '프로페셔널 자기관리',
    description: '체지방률을 낮추고 후반전 스태미나를 유지하기 위해 저탄수·고단백 맞춤 식단 프로그램을 시작했어요.',
    tags: ['INJURY_PRONE', 'PRO_STAR'],
    c1Label: '민첩성과 지구력을 높이는 린 매스업(Lean Mass) 식단',
    c1Desc: '몸이 한결 가벼워지며 4쿼터에도 지치지 않는 스피드를 얻어요.',
    c1Summary: 'PHY +2, DEF +1 · 감독 신뢰도 +5',
    c1Stats: { phy: 2, def: 1 },
    c1Trust: 5,
    c1Draft: 3,
    c2Label: '골밑 몸싸움을 버티는 파워 벌크업 식단',
    c2Desc: '단단한 상체 프레임으로 골밑 콘택트와 리바운드 경합에서 우위를 점해요.',
    c2Summary: 'REB +2, INS +1 · 감독 신뢰도 +5',
    c2Stats: { reb: 2, ins: 1 },
    c2Trust: 5,
    c2Draft: 3,
  },
  {
    category: 'OFF_COURT_BRAND',
    code: 'OFF_02',
    title: '스포츠 심리 상담 & 클러치 명상 루틴',
    subtitle: '멘탈 퍼포먼스 코칭',
    description: '중요한 자유투나 클러치 슛 순간 심박수를 낮추고 몰입 상태(Zone)에 들어가는 이미지 트레이닝을 배워요.',
    tags: ['ROOKIE_WALL', 'CHAMPIONSHIP_HUNT'],
    c1Label: '승부처 슛 릴리스 시각화 명상에 집중',
    c1Desc: '접전 상황에서도 흔들림 없이 림을 가르는 슈팅 집중력을 얻어요.',
    c1Summary: 'OUT +2, PLY +1 · 스카우트 주가 +4',
    c1Stats: { out: 2, ply: 1 },
    c1Trust: 5,
    c1Draft: 4,
    c2Label: '실책 후 빠르게 잊고 다음 수비에 몰입하는 회복탄력성 훈련',
    c2Desc: '기복 없는 안정감으로 감독님의 두터운 신임을 받아요.',
    c2Summary: 'DEF +2, PLY +1 · 감독 신뢰도 +7',
    c2Stats: { def: 2, ply: 1 },
    c2Trust: 7,
    c2Draft: 3,
  },
  {
    category: 'OFF_COURT_BRAND',
    code: 'OFF_03',
    title: '해외 리그/NBA 경기 필름 라이브러리 구축',
    subtitle: '농구 연구가 라이프스타일',
    description: '숙소에서 여가 시간마다 세계 최정상 선수들의 풋워크와 픽앤롤 리딩 영상을 프레임 단위로 분석하고 있어요.',
    tags: ['AMATEUR_PROSPECT', 'BENCH_SPARK'],
    excludedPositions: ['C'],
    c1Label: '최정상 가드들의 픽앤롤 포켓 패스와 헤지테이션 연구',
    c1Desc: '수비 타이밍을 뺏는 완급 조절과 패스 시야를 체득해요.',
    c1Summary: 'PLY +2, INS +1 · 감독 신뢰도 +6',
    c1Stats: { ply: 2, ins: 1 },
    c1Trust: 6,
    c1Draft: 4,
    c2Label: '엘리트 3&D 윙어들의 오프볼 동선과 수비 스탠스 연구',
    c2Desc: '팀 전술 어디에나 녹아드는 공수 밸런스를 갖춰요.',
    c2Summary: 'OUT +1, DEF +2 · 감독 신뢰도 +7',
    c2Stats: { out: 1, def: 2 },
    c2Trust: 7,
    c2Draft: 3,
  },
  {
    category: 'OFF_COURT_BRAND',
    code: 'OFF_04',
    title: '모교 농구부 방문 및 후배들과의 합동 훈련',
    subtitle: '초심을 되찾는 시간',
    description: '잠시 짬을 내어 처음 농구공을 잡았던 모교 체육관을 찾아 후배들에게 훈련 장비와 간식을 선물했어요.',
    tags: ['VETERAN_LEADER', 'PRIME_ACE'],
    c1Label: '후배들과 함께 기본기 드리블과 슈팅 1,000개 완주',
    c1Desc: '초심으로 돌아가 땀을 흘리며 슈팅 밸런스가 한층 견고해져요.',
    c1Summary: 'OUT +2, INS +1 · 감독 신뢰도 +5',
    c1Stats: { out: 2, ins: 1 },
    c1Trust: 5,
    c1Draft: 3,
    c2Label: '후배들에게 프로 무대의 수비와 리바운드 마인드셋 강연',
    c2Desc: '스스로의 책임감과 리더십을 다잡는 계기가 되어요.',
    c2Summary: 'DEF +1, REB +2 · 감독 신뢰도 +6',
    c2Stats: { def: 1, reb: 2 },
    c2Trust: 6,
    c2Draft: 3,
  },
  {
    category: 'OFF_COURT_BRAND',
    code: 'OFF_05',
    title: '외국어 & 글로벌 전술 용어 집중 스터디',
    subtitle: '더 넓은 무대를 향한 준비',
    description: '외국인 코치·동료들과의 소통은 물론 향후 해외/NBA 무대 진출을 위해 농구 전술 영어 공부를 시작했어요.',
    tags: ['AMATEUR_PROSPECT', 'CONTRACT_YEAR'],
    c1Label: '코트 위 수비 콜플레이와 전술 소통 능력 극대화',
    c1Desc: '외국인 선수들과의 2대2 호흡과 수비 로테이션이 완벽해져요.',
    c1Summary: 'PLY +2, DEF +1 · 감독 신뢰도 +6 · 주가 +4',
    c1Stats: { ply: 2, def: 1 },
    c1Trust: 6,
    c1Draft: 4,
    c2Label: '해외 스카우트 면담 대비 인터뷰 및 워크아웃 루틴 준비',
    c2Desc: '글로벌 스카우트들에게 준비된 유망주라는 인상을 심어줘요.',
    c2Summary: 'OUT +2, INS +1 · 스카우트 주가 +6',
    c2Stats: { out: 2, ins: 1 },
    c2Trust: 4,
    c2Draft: 6,
  },
  {
    category: 'OFF_COURT_BRAND',
    code: 'OFF_06',
    title: '개인 체육관 야간 열쇠(Gym Rat) 특권 획득',
    subtitle: '24시간 농구 몰입',
    description: '구단 관리인이 내 성실함에 감동해 심야에도 연습 체육관을 자유롭게 쓸 수 있는 전용 출입 카드를 건네주었어요.',
    tags: ['ROOKIE_WALL', 'HOT_STREAK'],
    c1Label: '슈팅 머신과 함께 매일 밤 코너·윙 3점슛 500개 적중',
    c1Desc: '눈을 감고도 림을 찾을 수 있을 만큼 외곽 슛감이 무르익어요.',
    c1Summary: 'OUT +2, INS +1 · 스카우트 주가 +5',
    c1Stats: { out: 2, ins: 1 },
    c1Trust: 5,
    c1Draft: 5,
    c2Label: '웨이트룸과 민첩성 사다리 훈련으로 피지컬 완성',
    c2Desc: '남들보다 한 발 더 뛰는 체력과 수비 기동력을 다져요.',
    c2Summary: 'PHY +2, DEF +1 · 감독 신뢰도 +6',
    c2Stats: { phy: 2, def: 1 },
    c2Trust: 6,
    c2Draft: 3,
  },

  // TRAINING_BREAKTHROUGH (6)
  {
    category: 'SCOUTING_SHOWCASE',
    code: 'TRN_01',
    title: '유로스텝 & 리버스 레이업 각도 개안',
    subtitle: '림 어택 피니시 진화',
    description: '골밑 블록슛을 피해 림 반대편으로 흘려 넣는 하이글래스 스핀 기술이 손끝에 완벽히 익었어요.',
    tags: ['HOT_STREAK', 'AMATEUR_PROSPECT'],
    allowedPositions: ['PG', 'SG', 'SF', 'PF'],
    preferredPositions: ['PG', 'SG', 'SF'],
    c1Label: '강한 콘택트 후에도 밸런스를 잃지 않는 바디 컨트롤 완성',
    c1Desc: '장신 빅맨 앞에서도 확률 높은 인사이드 득점을 올려요.',
    c1Summary: 'INS +2, PHY +1 · 스카우트 주가 +5',
    c1Stats: { ins: 2, phy: 1 },
    c1Trust: 5,
    c1Draft: 5,
    c2Label: '도움 수비가 올 때 골밑 동료에게 빼주는 드롭오프 패스 결합',
    c2Desc: '돌파와 패스 두 가지 선택지로 상대 수비를 딜레마에 빠뜨려요.',
    c2Summary: 'INS +1, PLY +2 · 감독 신뢰도 +6',
    c2Stats: { ins: 1, ply: 2 },
    c2Trust: 6,
    c2Draft: 4,
  },
  {
    category: 'SCOUTING_SHOWCASE',
    code: 'TRN_02',
    title: '원모션 퀵릴리스 3점슛 메커니즘 완성',
    subtitle: '슈팅 폼 각성',
    description: '하체에서 올라오는 반동을 끊김 없이 손끝으로 전달해 릴리스 시간을 0.15초 단축하는 데 성공했어요.',
    tags: ['PRO_STAR', 'PRIME_ACE'],
    c1Label: '드리블 후 즉각 올라가는 풀업 3점슛 정밀도 극대화',
    c1Desc: '수비수가 손을 들기도 전에 림을 통과하는 외곽 무기를 장착해요.',
    c1Summary: 'OUT +2, INS +1 · 스카우트 주가 +6',
    c1Stats: { out: 2, ins: 1 },
    c1Trust: 5,
    c1Draft: 6,
    c2Label: '스크린을 타고 돌아 나오는 무빙 캐치앤슛 밸런스 강화',
    c2Desc: '팀 전술 패턴에서 가장 믿음직한 마무리 슈터로 거듭나요.',
    c2Summary: 'OUT +2, PLY +1 · 감독 신뢰도 +7',
    c2Stats: { out: 2, ply: 1 },
    c2Trust: 7,
    c2Draft: 4,
  },
  {
    category: 'SCOUTING_SHOWCASE',
    code: 'TRN_03',
    title: '림 바운스 궤적 예측 & 세컨드 점프 각성',
    subtitle: '리바운드 보드 지배력 향상',
    description: '슛이 림에 맞는 각도만 봐도 공이 어디로 튈지 먼저 읽고 두 번째 점프를 가장 빠르게 띄우는 감각을 깨우쳤어요.',
    tags: ['BENCH_SPARK', 'CHAMPIONSHIP_HUNT'],
    preferredPositions: ['PF', 'C'],
    c1Label: '공격 리바운드 후 즉각 풋백 득점으로 연결하는 탄력 훈련',
    c1Desc: '귀중한 세컨드 찬스 득점으로 팀의 사기를 끌어올려요.',
    c1Summary: 'REB +2, INS +1 · 감독 신뢰도 +6',
    c1Stats: { reb: 2, ins: 1 },
    c1Trust: 6,
    c1Draft: 4,
    c2Label: '수비 리바운드 확보 후 아울렛 장거리 패스 연결',
    c2Desc: '리바운드와 동시에 속공을 시작하는 트랜지션 기점이 되어요.',
    c2Summary: 'REB +2, PLY +1 · 감독 신뢰도 +7',
    c2Stats: { reb: 2, ply: 1 },
    c2Trust: 7,
    c2Draft: 3,
  },
  {
    category: 'SCOUTING_SHOWCASE',
    code: 'TRN_04',
    title: '라이브 드리블 포켓 패스 & 로브 패스 마스터',
    subtitle: '플레이메이킹 시야 확장',
    description: '드리블 리듬을 죽이지 않고 수비수 두 명 사이 좁은 틈으로 찔러 넣는 원핸드 패스 감각이 절정에 달했어요.',
    tags: ['PRIME_ACE', 'VETERAN_LEADER'],
    allowedPositions: ['PG', 'SG', 'SF'],
    preferredPositions: ['PG', 'SG'],
    c1Label: '픽앤롤 빅맨의 입맛에 딱 맞는 어시스트 배달',
    c1Desc: '코트 위 동료들의 야투율을 함께 끌어올리는 야전사령관이 되어요.',
    c1Summary: 'PLY +2, OUT +1 · 감독 신뢰도 +7',
    c1Stats: { ply: 2, out: 1 },
    c1Trust: 7,
    c1Draft: 4,
    c2Label: '패스 페이크로 수비를 속인 뒤 직접 미드레인지 점퍼 마무리',
    c2Desc: '패스와 득점을 자유자재로 오가는 예측 불가 공격을 펼쳐요.',
    c2Summary: 'PLY +1, INS +2 · 스카우트 주가 +5',
    c2Stats: { ply: 1, ins: 2 },
    c2Trust: 5,
    c2Draft: 5,
  },
  {
    category: 'SCOUTING_SHOWCASE',
    code: 'TRN_05',
    title: '수비 스탠스 무게중심 & 핸드 체킹 타이밍 완성',
    subtitle: '락다운 디펜더 각성',
    description: '상대 공격수의 골반 움직임을 읽고 파울 없이 드리블 동선을 차단하는 수비 풋워크에 눈을 떴어요.',
    tags: ['ROOKIE_WALL', 'CONTRACT_YEAR'],
    c1Label: '1대1 온볼 수비와 스틸 타이밍 극대화',
    c1Desc: '상대 볼핸들러가 가장 꺼리는 질식 수비수로 성장해요.',
    c1Summary: 'DEF +2, PHY +1 · 감독 신뢰도 +7',
    c1Stats: { def: 2, phy: 1 },
    c1Trust: 7,
    c1Draft: 4,
    c2Label: '수비 성공 직후 리바운드 단속과 박스아웃 철저',
    c2Desc: '수비 포제션을 완벽히 끝맺는 든든한 보드 장악력을 보여줘요.',
    c2Summary: 'DEF +1, REB +2 · 감독 신뢰도 +7',
    c2Stats: { def: 1, reb: 2 },
    c2Trust: 7,
    c2Draft: 3,
  },
  {
    category: 'SCOUTING_SHOWCASE',
    code: 'TRN_06',
    title: '스텝백 카운터 무브 & 체인지 오브 페이스 완성',
    subtitle: '아이솔레이션 시그니처 장착',
    description: '전력 질주하다가 순식간에 멈춰 서며 수비수와 1.5m 공간을 창출하는 스텝백과 헤지테이션 카운터가 완성되었어요.',
    tags: ['HOT_STREAK', 'CONTRACT_YEAR'],
    allowedPositions: ['PG', 'SG', 'SF', 'PF'],
    preferredPositions: ['PG', 'SG', 'SF'],
    c1Label: '스텝백 3점슛과 미드레인지 점퍼 연계 완성',
    c1Desc: '샷클락이 쫓기는 순간에도 언제든 슛 공간을 만들어내요.',
    c1Summary: 'OUT +2, INS +1 · 스카우트 주가 +6',
    c1Stats: { out: 2, ins: 1 },
    c1Trust: 5,
    c1Draft: 6,
    c2Label: '스텝백 페이크 후 다시 림을 찢는 크로스오버 돌파',
    c2Desc: '수비수가 슛을 막으러 뛰어들 때 곧바로 림을 공략해요.',
    c2Summary: 'INS +2, PLY +1 · 스카우트 주가 +6',
    c2Stats: { ins: 2, ply: 1 },
    c2Trust: 5,
    c2Draft: 6,
  },

  // GUARD SPECIALIZED (5) - PG / SG
  {
    category: 'ROLE_ADAPTATION',
    code: 'GRD_01',
    title: '픽앤롤 스네이크 드리블 & 포켓 패스 교정',
    subtitle: '가드 전술 리딩 심화 세션',
    description: '상대 드롭백 수비를 흔들기 위해 스크린 직후 수비수를 등에 업는 스네이크 드리블과 롤맨 포켓 패스 타이밍을 집중 점검했습니다.',
    tags: ['PRIME_ACE', 'PRO_STAR'],
    allowedPositions: ['PG', 'SG'],
    preferredPositions: ['PG', 'SG'],
    c1Label: '롤맨의 보폭에 맞춘 바운스 포켓 패스 정교화',
    c1Desc: '턴오버를 최소화하며 빅맨의 손쉬운 림 마무리 비율을 끌어올립니다.',
    c1Summary: 'PLY +2, DEF +1 · 감독 신뢰도 +7',
    c1Stats: { ply: 2, def: 1 },
    c1Trust: 7,
    c1Draft: 4,
    c2Label: '스네이크 드리블 직후 플로터와 미드레인지 풀업 공략',
    c2Desc: '드롭백 수비가 물러선 공간을 직접 타격해 득점 주도권을 쥡니다.',
    c2Summary: 'INS +2, OUT +1 · 스카우트 주가 +5',
    c2Stats: { ins: 2, out: 1 },
    c2Trust: 4,
    c2Draft: 5,
  },
  {
    category: 'TACTICAL_CLASH',
    code: 'GRD_02',
    title: '풀코트 압박 돌파 & 하프코트 템포 조율',
    subtitle: '백코트 경기 운영 과제',
    description: '상대 팀이 경기 초반부터 엔드라인 풀코트 프레스로 볼 운반을 방해하며 팀의 공격 템포를 흔들고 있습니다.',
    tags: ['ROOKIE_WALL', 'CHAMPIONSHIP_HUNT'],
    allowedPositions: ['PG', 'SG'],
    preferredPositions: ['PG', 'SG'],
    c1Label: '침착한 리트리트 드리블과 안정적인 템포 제어',
    c1Desc: '하프라인을 안정적으로 넘긴 뒤 세트 오펜스를 정돈해 실책을 줄입니다.',
    c1Summary: 'PLY +2, PHY +1 · 감독 신뢰도 +7',
    c1Stats: { ply: 2, phy: 1 },
    c1Trust: 7,
    c1Draft: 3,
    c2Label: '트랩 수비 틈새를 찢는 가속 돌파로 역습 전환',
    c2Desc: '압박을 정면으로 뚫어내며 수적 우위 속공 찬스를 직접 만듭니다.',
    c2Summary: 'PHY +2, INS +1 · 스카우트 주가 +5',
    c2Stats: { phy: 2, ins: 1 },
    c2Trust: 5,
    c2Draft: 5,
  },
  {
    category: 'SCOUTING_SHOWCASE',
    code: 'GRD_03',
    title: '오프더드리블 스텝백 3점 리듬 완성',
    subtitle: '백코트 슈팅 창조력 점검',
    description: '샷클락 5초 미만 상황에서 스스로 슈팅 공간을 만들어내는 사이드스텝·스텝백 3점슛 루틴을 코치진 앞에서 시연했습니다.',
    tags: ['HOT_STREAK', 'CONTRACT_YEAR'],
    allowedPositions: ['PG', 'SG'],
    preferredPositions: ['PG', 'SG'],
    c1Label: '하체 밸런스를 지키는 풀업 캐치 리듬 정착',
    c1Desc: '기복 없는 슈팅 폼으로 외곽 성공률을 안정적으로 끌어올립니다.',
    c1Summary: 'OUT +2, PLY +1 · 감독 신뢰도 +6',
    c1Stats: { out: 2, ply: 1 },
    c1Trust: 6,
    c1Draft: 4,
    c2Label: '딥 쓰리 레인지 확장으로 수비 라인 강제 견인',
    c2Desc: '아크 1미터 뒤에서 던지는 장거리포로 팀 스페이싱을 넓힙니다.',
    c2Summary: 'OUT +2, INS +1 · 스카우트 주가 +6',
    c2Stats: { out: 2, ins: 1 },
    c2Trust: 4,
    c2Draft: 6,
  },
  {
    category: 'LOCKER_ROOM',
    code: 'GRD_04',
    title: '백코트 투가드 라인업 볼 점유율 조율',
    subtitle: '파트너 가드와의 역할 분담',
    description: '코칭스태프가 두 명의 가드를 동시 기용하는 투가드 라인업을 가동하면서 온볼 리딩과 오프볼 스페이싱 비중을 조율하게 됐습니다.',
    tags: ['BENCH_SPARK', 'PRO_STAR'],
    allowedPositions: ['PG', 'SG'],
    preferredPositions: ['PG', 'SG'],
    c1Label: '오프볼 스크린 활용과 캐치앤슛 비중 확대 수용',
    c1Desc: '동료 가드의 돌파 공간을 열어주며 백코트 공존 효율을 높입니다.',
    c1Summary: 'OUT +2, DEF +1 · 감독 신뢰도 +8',
    c1Stats: { out: 2, def: 1 },
    c1Trust: 8,
    c1Draft: 3,
    c2Label: '핵심 클러치 구간 메인 볼핸들러 권한 확보 요청',
    c2Desc: '승부처 공격 설계를 직접 맡아 야전사령관 입지를 공고히 합니다.',
    c2Summary: 'PLY +2, INS +1 · 스카우트 주가 +5',
    c2Stats: { ply: 2, ins: 1 },
    c2Trust: 5,
    c2Draft: 5,
  },
  {
    category: 'RIVAL_SHOWDOWN',
    code: 'GRD_05',
    title: '상대 빅맨 스위치 헌팅 매치업 공략',
    subtitle: '미스매치 아이솔레이션 대결',
    description: '상대 벤치가 스위치 수비를 고수하면서 발이 느린 상대 센터가 아크 정면에서 당신과 1대1로 맞붙는 구도가 반복되고 있습니다.',
    tags: ['PRIME_ACE', 'CHAMPIONSHIP_HUNT'],
    allowedPositions: ['PG', 'SG'],
    preferredPositions: ['PG', 'SG'],
    c1Label: '헬프 수비를 끌어낸 뒤 코너 슈터에게 킥아웃',
    c1Desc: '미스매치로 수비 균형을 무너뜨려 팀 전체 오픈 3점을 양산합니다.',
    c1Summary: 'PLY +2, OUT +1 · 감독 신뢰도 +7',
    c1Stats: { ply: 2, out: 1 },
    c1Trust: 7,
    c1Draft: 4,
    c2Label: '스피드 크로스오버로 빅맨을 제치고 림 직격',
    c2Desc: '발이 느린 수비수를 정면 돌파하며 상대 수비 전술을 무력화합니다.',
    c2Summary: 'INS +2, PHY +1 · 스카우트 주가 +6',
    c2Stats: { ins: 2, phy: 1 },
    c2Trust: 4,
    c2Draft: 6,
  },

  // WING SPECIALIZED (5) - SG / SF
  {
    category: 'ROLE_ADAPTATION',
    code: 'WNG_01',
    title: '코너 3&D 클로즈아웃 & 외곽 스페이싱 특화',
    subtitle: '현대 농구 핵심 윙 역할 점검',
    description: '양쪽 코너에서 수비를 묶어두다가 수비 전환 시 상대 외곽 슈터의 슛을 끝까지 견제하는 3&D 윙 임무가 강조되고 있습니다.',
    tags: ['BENCH_SPARK', 'CHAMPIONSHIP_HUNT'],
    allowedPositions: ['SG', 'SF'],
    preferredPositions: ['SG', 'SF'],
    c1Label: '코너 3점 릴리스 안정화와 패스 레인 차단 집중',
    c1Desc: '어떤 라인업에도 즉시 투입 가능한 고효율 공수 겸장 윙으로 자리 잡습니다.',
    c1Summary: 'OUT +2, DEF +1 · 감독 신뢰도 +8',
    c1Stats: { out: 2, def: 1 },
    c1Trust: 8,
    c1Draft: 4,
    c2Label: '클로즈아웃 수비를 역이용하는 원드리블 풀업 돌파',
    c2Desc: '슈터 견제를 뚫고 페인트존까지 파고드는 공격 다양성을 더합니다.',
    c2Summary: 'INS +2, OUT +1 · 스카우트 주가 +5',
    c2Stats: { ins: 2, out: 1 },
    c2Trust: 5,
    c2Draft: 5,
  },
  {
    category: 'RIVAL_SHOWDOWN',
    code: 'WNG_02',
    title: '상대 에이스 윙과의 정면 아이솔레이션 맞대결',
    subtitle: '프런트코트-백코트 경계 승부',
    description: '리그 정상급 장신 윙 스코어러와의 맞대결에서 감독님이 공수 양면의 직접 매치업을 지시했습니다.',
    tags: ['PRIME_ACE', 'HOT_STREAK'],
    allowedPositions: ['SG', 'SF'],
    preferredPositions: ['SG', 'SF'],
    c1Label: '긴 팔과 사이드 스텝으로 상대 미드레인지 봉쇄',
    c1Desc: '상대 에이스의 리듬을 끊어내며 수비 집중력을 입증합니다.',
    c1Summary: 'DEF +2, PHY +1 · 감독 신뢰도 +8',
    c1Stats: { def: 2, phy: 1 },
    c1Trust: 8,
    c1Draft: 4,
    c2Label: '윙 아이솔레이션 정면 승부로 득점 화력 대결',
    c2Desc: '강한 1대1 돌파와 풀업 점퍼로 코트 주도권을 빼앗아 옵니다.',
    c2Summary: 'INS +2, OUT +1 · 스카우트 주가 +6',
    c2Stats: { ins: 2, out: 1 },
    c2Trust: 4,
    c2Draft: 6,
  },
  {
    category: 'TACTICAL_CLASH',
    code: 'WNG_03',
    title: '오프볼 핀다운 컬 & 플레어 스크린 동선 최적화',
    subtitle: '무빙 슈터 전술 패턴 완성',
    description: '볼 없이 베이스라인과 45도를 오가며 빅맨의 핀다운 스크린을 타고 나오는 전술 패턴이 팀의 핵심 공격 옵션으로 채택됐습니다.',
    tags: ['AMATEUR_PROSPECT', 'PRO_STAR'],
    allowedPositions: ['SG', 'SF'],
    preferredPositions: ['SG', 'SF'],
    c1Label: '스크린 직후 원스텝 캐치앤슛 타이밍 숙달',
    c1Desc: '불필요한 드리블을 줄이고 수비가 따라붙기 전 외곽포를 꽂습니다.',
    c1Summary: 'OUT +2, PHY +1 · 감독 신뢰도 +7',
    c1Stats: { out: 2, phy: 1 },
    c1Trust: 7,
    c1Draft: 4,
    c2Label: '수비 추격을 따돌리는 백도어 컬 컷과 림 마무리',
    c2Desc: '외곽을 과도하게 견제하는 수비 뒤공간을 찔러 쉬운 득점을 올립니다.',
    c2Summary: 'INS +2, PLY +1 · 스카우트 주가 +5',
    c2Stats: { ins: 2, ply: 1 },
    c2Trust: 5,
    c2Draft: 5,
  },
  {
    category: 'POSITION',
    code: 'WNG_04',
    title: '1번부터 4번까지 소화하는 멀티 스위치 수비',
    subtitle: '스위처블 윙 수비수 진화',
    description: '상대 픽앤롤 공격에 맞서 가드부터 파워포워드까지 포지션 구분 없이 스위치 수비를 소화하는 핵심 수비 축을 맡게 됐습니다.',
    tags: ['CHAMPIONSHIP_HUNT', 'CONTRACT_YEAR'],
    allowedPositions: ['SG', 'SF'],
    preferredPositions: ['SG', 'SF'],
    c1Label: '포스트 미스매치 프런팅 수비와 박스아웃 보강',
    c1Desc: '체격이 큰 포워드를 상대로도 골밑 자리를 쉽게 내주지 않습니다.',
    c1Summary: 'DEF +2, REB +1 · 감독 신뢰도 +8',
    c1Stats: { def: 2, reb: 1 },
    c1Trust: 8,
    c1Draft: 4,
    c2Label: '빠른 횡이동과 패스 길 차단으로 트랜지션 유도',
    c2Desc: '스위치 직후 스틸을 만들어내며 팀의 속공 리듬을 살립니다.',
    c2Summary: 'DEF +2, PHY +1 · 스카우트 주가 +5',
    c2Stats: { def: 2, phy: 1 },
    c2Trust: 6,
    c2Draft: 5,
  },
  {
    category: 'SCOUTING_SHOWCASE',
    code: 'WNG_05',
    title: '트랜지션 윙 레인 피니시 & 트레일러 선택',
    subtitle: '속공 마무리 결정력 점검',
    description: '수비 리바운드 직후 양쪽 사이드 레인을 전력 질주해 속공을 마무리하는 트랜지션 효율이 스카우트들의 주목을 받고 있습니다.',
    tags: ['ROOKIE_WALL', 'HOT_STREAK'],
    allowedPositions: ['SG', 'SF'],
    preferredPositions: ['SG', 'SF'],
    c1Label: '사이드 레인 트레일러 3점슛과 코너 스페이싱',
    c1Desc: '속공 가담 시 외곽에서 정확히 마무리하며 공격 흐름을 넓힙니다.',
    c1Summary: 'OUT +2, PLY +1 · 감독 신뢰도 +6',
    c1Stats: { out: 2, ply: 1 },
    c1Trust: 6,
    c1Draft: 4,
    c2Label: '수비수 콘택트를 이겨내는 유로스텝 림 어택',
    c2Desc: '앤드원 파울을 유도하는 과감한 속공 돌파로 경기 분위기를 바꿉니다.',
    c2Summary: 'INS +2, PHY +1 · 스카우트 주가 +6',
    c2Stats: { ins: 2, phy: 1 },
    c2Trust: 5,
    c2Draft: 6,
  },

  // BIG MAN SPECIALIZED (5) - PF / C
  {
    category: 'TACTICAL_CLASH',
    code: 'BIG_01',
    title: '픽앤롤 드롭 커버리지 vs 하드 헤지 수비 선택',
    subtitle: '프런트코트 수비 시스템 조율',
    description: '상대 가드의 픽앤롤 공격에 맞서 페인트존을 지키는 드롭백 수비와 외곽까지 튀어나가는 헤지 수비 중 기준을 정해야 합니다.',
    tags: ['PRO_STAR', 'CHAMPIONSHIP_HUNT'],
    allowedPositions: ['PF', 'C'],
    preferredPositions: ['PF', 'C'],
    c1Label: '골밑 림 보호와 리바운드 사수를 위한 정교한 드롭백',
    c1Desc: '돌파 경로와 롭 패스를 동시에 차단하며 페인트존 실점을 줄입니다.',
    c1Summary: 'DEF +2, REB +1 · 감독 신뢰도 +8',
    c1Stats: { def: 2, reb: 1 },
    c1Trust: 8,
    c1Draft: 3,
    c2Label: '3점 라인 밖까지 압박하는 공격적 헤지 앤 리커버',
    c2Desc: '넓은 수비 기동력을 증명하며 현대 농구형 빅맨 가치를 높입니다.',
    c2Summary: 'DEF +2, PHY +1 · 스카우트 주가 +5',
    c2Stats: { def: 2, phy: 1 },
    c2Trust: 6,
    c2Draft: 5,
  },
  {
    category: 'SCOUTING_SHOWCASE',
    code: 'BIG_02',
    title: '로우포스트 훅샷 & 업앤언더 풋워크 연마',
    subtitle: '골밑 정통 스코어링 완성',
    description: '전담 빅맨 코치와 함께 로우 블록에서 수비수의 중심을 무너뜨리는 드롭스텝, 베이비 훅, 업앤언더 연계 풋워크를 집중 훈련했습니다.',
    tags: ['PRIME_ACE', 'AMATEUR_PROSPECT'],
    allowedPositions: ['PF', 'C'],
    preferredPositions: ['PF', 'C'],
    c1Label: '양손 마무리 훅샷과 안정적인 포스트 자리 잡기',
    c1Desc: '미스매치가 생길 때마다 확실한 골밑 2점을 보장하는 축이 됩니다.',
    c1Summary: 'INS +2, REB +1 · 감독 신뢰도 +7',
    c1Stats: { ins: 2, reb: 1 },
    c1Trust: 7,
    c1Draft: 4,
    c2Label: '페이스업 미드레인지 점퍼와 스핀 무브 카운터 확장',
    c2Desc: '포스트와 미드레인지를 오가며 상대 빅맨을 림 밖으로 끌어냅니다.',
    c2Summary: 'INS +2, OUT +1 · 스카우트 주가 +6',
    c2Stats: { ins: 2, out: 1 },
    c2Trust: 5,
    c2Draft: 6,
  },
  {
    category: 'ROLE_ADAPTATION',
    code: 'BIG_03',
    title: '하이포스트 쇼트롤 4대3 패싱 허브 임무',
    subtitle: '컨트롤 타워 빅맨 진화',
    description: '상대가 팀의 주전 가드에게 블리츠 더블팀을 걸자, 자유투 라인 부근에서 공을 받아 4대3 공격을 전개하는 쇼트롤 허브 역할이 주어졌습니다.',
    tags: ['HOT_STREAK', 'VETERAN_LEADER'],
    allowedPositions: ['PF', 'C'],
    preferredPositions: ['PF', 'C'],
    c1Label: '코너 슈터와 베이스라인 컷인을 살리는 패스 전개',
    c1Desc: '높은 타점에서 코트 전체를 조망하며 팀 오펜스의 윤활유가 됩니다.',
    c1Summary: 'PLY +2, REB +1 · 감독 신뢰도 +8',
    c1Stats: { ply: 2, reb: 1 },
    c1Trust: 8,
    c1Draft: 4,
    c2Label: '하이포스트 캐치 직후 원드리블 덩크와 플로터 마무리',
    c2Desc: '도움 수비가 주저하는 틈을 타 직접 페인트존을 폭격합니다.',
    c2Summary: 'INS +2, PLY +1 · 스카우트 주가 +5',
    c2Stats: { ins: 2, ply: 1 },
    c2Trust: 5,
    c2Draft: 5,
  },
  {
    category: 'RIVAL_SHOWDOWN',
    code: 'BIG_04',
    title: '리그 최정상 리바운더와의 골밑 보드 경합',
    subtitle: '페인트존 육탄전 승부',
    description: '거구의 상대 센터가 공격 리바운드로 경기 흐름을 장악하려 들자, 코칭스태프가 박스아웃과 골밑 제공권 장악을 최우선 과제로 주문했습니다.',
    tags: ['CONTRACT_YEAR', 'BENCH_SPARK'],
    allowedPositions: ['PF', 'C'],
    preferredPositions: ['PF', 'C'],
    c1Label: '철저한 로우 바디 박스아웃으로 상대 보드 원천 봉쇄',
    c1Desc: '세컨드 찬스 실점을 막아내며 팀 수비 안정감을 끌어올립니다.',
    c1Summary: 'REB +2, DEF +1 · 감독 신뢰도 +8',
    c1Stats: { reb: 2, def: 1 },
    c1Trust: 8,
    c1Draft: 3,
    c2Label: '공격 리바운드 경합 가담과 풋백 덩크 맞불',
    c2Desc: '상대 골밑을 정면으로 두드리며 리바운드 주도권을 탈환합니다.',
    c2Summary: 'REB +2, INS +1 · 스카우트 주가 +5',
    c2Stats: { reb: 2, ins: 1 },
    c2Trust: 5,
    c2Draft: 5,
  },
  {
    category: 'LOAD_MANAGEMENT',
    code: 'BIG_05',
    title: '림 프로텍션 수직성 & 파울 트러블 관리',
    subtitle: '빅맨 수비 규율 정비',
    description: '상대 돌파수들이 블록슛을 노리는 타이밍에 몸을 부딪혀 파울을 유도하는 패턴이 잦아지며 파울 관리가 과제로 떠올랐습니다.',
    tags: ['ROOKIE_WALL', 'CHAMPIONSHIP_HUNT'],
    allowedPositions: ['PF', 'C'],
    preferredPositions: ['PF', 'C'],
    c1Label: '두 팔을 수직으로 유지하는 버티컬리티 규율 정착',
    c1Desc: '불필요한 파울을 줄이고 4쿼터 승부처까지 코트에 남습니다.',
    c1Summary: 'DEF +2, PHY +1 · 감독 신뢰도 +8',
    c1Stats: { def: 2, phy: 1 },
    c1Trust: 8,
    c1Draft: 4,
    c2Label: '위크사이드 헬프 블록 타이밍으로 림 장악력 과시',
    c2Desc: '압도적인 블록 존재감으로 상대의 페인트존 진입 자체를 억제합니다.',
    c2Summary: 'DEF +2, REB +1 · 스카우트 주가 +5',
    c2Stats: { def: 2, reb: 1 },
    c2Trust: 5,
    c2Draft: 5,
  },
];

const PRO_LEAGUES: LeagueId[] = [
  'KBL',
  'B_LEAGUE',
  'NBL',
  'EUROLEAGUE',
  'GLEAGUE',
  'NBA',
];

// 프로 무대 전용 시나리오 (고교·대학 아마추어 단계에서 원정 비행기·글로벌 음료 CF·전담 영양사 등 몰입 깨짐 원천 차단)
const PRO_ONLY_CODES = new Set<string>([
  'TAC_04', // 구단 데이터 분석팀
  'LCK_03', // 신인 후배 스파링
  'LCK_04', // 원정 비행기
  'INJ_01', // 크라이오테라피
  'INJ_04', // 베테랑 필라테스
  'INJ_05', // 카본 인솔 피팅
  'MED_02', // 글로벌 스포츠 매거진 커버
  'MED_06', // 글로벌 스포츠 음료 CF
  'OFF_01', // 전담 영양사 채용
]);

const MIN_AGE_BY_CODE: Record<string, number> = {
  LCK_03: 22,
  INJ_04: 26,
  OFF_04: 22,
};

const STAT_KO_LABEL: Record<keyof PlayerStats, string> = {
  ins: '인사이드(INS)',
  out: '외곽 슈팅(OUT)',
  ply: '플레이메이킹(PLY)',
  def: '수비력(DEF)',
  reb: '리바운드(REB)',
  phy: '피지컬(PHY)',
};

const OPPOSITE_STAT: Record<keyof PlayerStats, keyof PlayerStats> = {
  ins: 'phy',
  out: 'def',
  ply: 'ins',
  def: 'out',
  reb: 'ply',
  phy: 'out',
};

function getPrimaryStatKey(stats?: Partial<PlayerStats>): keyof PlayerStats {
  if (!stats) return 'ins';
  let bestKey: keyof PlayerStats = 'ins';
  let bestVal = -99;
  for (const key of Object.keys(stats) as (keyof PlayerStats)[]) {
    const val = stats[key] ?? 0;
    if (val > bestVal) {
      bestVal = val;
      bestKey = key;
    }
  }
  return bestKey;
}

// 6대 대표 2부작 연쇄 스토리(Chain Event) 정의 — 선택의 성공/실패가 다음 시즌 스토리로 이어집니다
const CHAIN_FOLLOWUPS: Record<
  string,
  { successChain: CareerEvent; failureChain: CareerEvent }
> = {
  RIV_01: {
    successChain: {
      id: 'EVT_CHAIN_RIV_01_REMATCH',
      title: '라이벌의 복수전 도전장',
      subtitle: '지난 시즌 정면승부 승리의 후속편',
      description:
        '지난 시즌 맞대결에서 완패했던 라이벌이 비시즌 피나는 특훈 끝에 새로운 무기를 장착하고 돌아왔어요. 전국 생중계 리매치에서 다시 한번 격차를 증명할 차례예요.',
      category: 'RIVAL_SHOWDOWN',
      choices: [
        {
          label: '정공법으로 다시 한번 에이스 대결을 수락한다',
          description: '더 강해진 라이벌의 공격을 정면으로 받아치며 완전히 상하 관계를 각인시켜요.',
          effectSummary: '성공 시 INS +2, DEF +2, 주가 +8 · 실패 시 신뢰도 -5, 주가 -4',
          riskTier: 'HIGH_RISK',
          successCheck: { statKey: 'ins', difficulty: 2, baseProb: 0.62, label: '인사이드(INS) 기반' },
          successOutcome: {
            narrative: '리매치에서도 압도적인 공수 퍼포먼스로 라이벌을 제압하며 확실한 에이스 서열을 정리했어요!',
            statChanges: { ins: 2, def: 2 },
            trustDelta: 6,
            draftStockDelta: 8,
          },
          failureOutcome: {
            narrative: '한층 날카로워진 라이벌의 반격에 고전하며 아쉬운 패배를 허용했어요.',
            statChanges: { def: -1 },
            trustDelta: -5,
            draftStockDelta: -4,
          },
        },
        {
          label: '개인 대결 대신 팀 수비 함정으로 라이벌을 묶는다',
          description: '자존심 싸움을 피하고 팀 전술로 실리적인 승리를 챙겨요.',
          effectSummary: '확정 · PLY +2, DEF +1 · 신뢰도 +6 (주가 변동 없음)',
          riskTier: 'SAFE',
          statChanges: { ply: 2, def: 1 },
          trustDelta: 6,
        },
      ],
    },
    failureChain: {
      id: 'EVT_CHAIN_RIV_01_REDEMPTION',
      title: '절치부심 · 라이벌 설욕전',
      subtitle: '지난 시즌 패배를 딛고 일어설 기회',
      description:
        '지난 시즌 라이벌에게 당했던 굴욕을 잊지 않고 겨우내 비디오를 돌려보며 약점을 파고들었어요. 드디어 설욕의 무대가 열렸어요.',
      category: 'RIVAL_SHOWDOWN',
      choices: [
        {
          label: '비시즌 갈고닦은 카운터 무브로 정면 설욕!',
          description: '라이벌의 수비 습관을 역이용해 코트 위에서 통쾌하게 되갚아줘요.',
          effectSummary: '성공 시 INS +3, OUT +1, 신뢰도 +7, 주가 +8 · 실패 시 주가 -4',
          riskTier: 'HIGH_RISK',
          successCheck: { statKey: 'out', difficulty: 1, baseProb: 0.66, label: '외곽 슈팅(OUT) 기반' },
          successOutcome: {
            narrative: '완벽한 설욕전! 라이벌 앞에서 결정적인 연속 득점을 꽂아 넣으며 평가를 단숨에 뒤집었어요!',
            statChanges: { ins: 3, out: 1 },
            trustDelta: 7,
            draftStockDelta: 8,
          },
          failureOutcome: {
            narrative: '의욕이 앞서 슛 셀렉션이 흔들리며 아쉽게 설욕 기회를 놓쳤어요.',
            trustDelta: -3,
            draftStockDelta: -4,
          },
        },
        {
          label: '감정을 비우고 수비·리바운드 궂은일로 승리에 헌신',
          description: '화려함보다 투지로 팀의 승리를 지켜내요.',
          effectSummary: '확정 · DEF +2, REB +1 · 신뢰도 +7',
          riskTier: 'SAFE',
          statChanges: { def: 2, reb: 1 },
          trustDelta: 7,
        },
      ],
    },
  },
  MED_01: {
    successChain: {
      id: 'EVT_CHAIN_MED_01_SPOTLIGHT',
      title: '전국구 스타의 무게 · 집중 견제 돌파',
      subtitle: '지난 시즌 화제의 인터뷰 후속편',
      description:
        '지난 시즌 당당한 어록이 전국 팬들의 시선을 사로잡은 뒤, 이제 모든 원정 경기에서 상대 수비가 나를 최우선 타깃으로 거칠게 견제해요.',
      category: 'MEDIA_SPOTLIGHT',
      choices: [
        {
          label: '야유 속에서 더블팀을 찢는 슈퍼스타 쇼타임!',
          description: '모두의 시선을 즐기며 압도적인 클러치 퍼포먼스로 응답해요.',
          effectSummary: '성공 시 OUT +2, PLY +2, 주가 +8 · 실패 시 신뢰도 -5, 주가 -5',
          riskTier: 'HIGH_RISK',
          successCheck: { statKey: 'out', difficulty: 3, baseProb: 0.6, label: '외곽 슈팅(OUT) 기반' },
          successOutcome: {
            narrative: '원정 관중석의 야유를 환호로 바꿔버렸어요! 명실상부 리그 최고 흥행 카드로 올라섰어요.',
            statChanges: { out: 2, ply: 2 },
            trustDelta: 5,
            draftStockDelta: 8,
          },
          failureOutcome: {
            narrative: '거친 더블팀 압박에 턴오버가 속출하며 언론의 비판에 직면했어요.',
            statChanges: { ply: -1 },
            trustDelta: -5,
            draftStockDelta: -5,
          },
        },
        {
          label: '집중 견제를 역이용해 동료 찬스를 살리는 성숙한 대응',
          description: '스포트라이트를 팀원들과 나누며 코트 위 지배력을 키워요.',
          effectSummary: '확정 · PLY +2, DEF +1 · 신뢰도 +7',
          riskTier: 'SAFE',
          statChanges: { ply: 2, def: 1 },
          trustDelta: 7,
        },
      ],
    },
    failureChain: {
      id: 'EVT_CHAIN_MED_01_APOLOGY',
      title: '논란을 실력으로 잠재울 시간',
      subtitle: '과했던 자신감 발언의 후폭풍 극복',
      description:
        '지난 시즌 패기 넘쳤던 인터뷰가 부진과 겹치며 조롱거리가 되었어요. 묵묵히 코트 위 결과로 여론을 뒤집을 기회가 왔어요.',
      category: 'MEDIA_SPOTLIGHT',
      choices: [
        {
          label: '빅매치에서 폭발적인 득점으로 비판론자들을 침묵시킨다',
          description: '말 대신 숫자와 하이라이트로 모든 논란을 종결해요.',
          effectSummary: '성공 시 INS +2, OUT +2, 주가 +9 · 실패 시 신뢰도 -4',
          riskTier: 'HIGH_RISK',
          successCheck: { statKey: 'ins', difficulty: 1, baseProb: 0.65, label: '인사이드(INS) 기반' },
          successOutcome: {
            narrative: '비판을 완벽히 잠재운 대폭발! 팬들과 기자들 모두 당신의 멘탈에 박수를 보냈어요.',
            statChanges: { ins: 2, out: 2 },
            trustDelta: 6,
            draftStockDelta: 9,
          },
          failureOutcome: {
            narrative: '부담감을 떨치지 못해 야투 난조에 빠졌지만, 그래도 끝까지 포기하지 않았어요.',
            trustDelta: -4,
            draftStockDelta: -2,
          },
        },
        {
          label: '진심 어린 겸손한 인터뷰와 성실한 수비로 신뢰 회복',
          description: '태도의 변화로 코칭스태프와 팬들의 마음을 되돌려요.',
          effectSummary: '확정 · DEF +2, PHY +1 · 신뢰도 +8',
          riskTier: 'SAFE',
          statChanges: { def: 2, phy: 1 },
          trustDelta: 8,
        },
      ],
    },
  },
  TAC_01: {
    successChain: {
      id: 'EVT_CHAIN_TAC_01_KEYS',
      title: '감독 신뢰 테스트 · 클러치 전권 위임',
      subtitle: '심야 비디오 세션 이후 찾아온 기회',
      description:
        '지난 시즌 자신의 공격 철학을 데이터로 설득했던 용기를 높이 산 감독님이, 이번 시즌 승부처 마지막 2분 공격 조율 전권을 맡겨보겠다고 제안했어요.',
      category: 'TACTICAL_CLASH',
      choices: [
        {
          label: '승부처 공격 전권을 당당히 수락하고 코트를 지휘한다',
          description: '실패하면 책임이 따르지만, 해내면 명실상부 팀의 야전사령관이 돼요.',
          effectSummary: '성공 시 PLY +2, OUT +2, 신뢰도 +10 · 실패 시 신뢰도 -7',
          riskTier: 'HIGH_RISK',
          successCheck: { statKey: 'ply', difficulty: 2, baseProb: 0.64, label: '플레이메이킹(PLY) 기반' },
          successOutcome: {
            narrative: '완벽한 클러치 리딩으로 연이어 역전승을 합작하며 감독님의 절대적 신임을 얻었어요!',
            statChanges: { ply: 2, out: 2 },
            trustDelta: 10,
            draftStockDelta: 6,
          },
          failureOutcome: {
            narrative: '승부처 실책이 나오며 감독님이 다시 보수적인 세트 오펜스로 돌아갔어요.',
            trustDelta: -7,
            draftStockDelta: -3,
          },
        },
        {
          label: '감독님과 사인을 공유하며 절반의 역할부터 단계적으로 수행',
          description: '리스크를 줄이고 안정적으로 전술 영향력을 넓혀가요.',
          effectSummary: '확정 · PLY +1, INS +1 · 신뢰도 +6',
          riskTier: 'SAFE',
          statChanges: { ply: 1, ins: 1 },
          trustDelta: 6,
        },
      ],
    },
    failureChain: {
      id: 'EVT_CHAIN_TAC_01_REBUILD_TRUST',
      title: '냉각된 감독과의 관계 회복',
      subtitle: '전술 이견 이후 찾아온 화해의 계기',
      description:
        '지난 시즌 전술 갈등 이후 감독님과 미묘한 거리감이 남아있어요. 팀 미팅에서 먼저 손을 내밀어 관계를 풀어볼 시점이에요.',
      category: 'TACTICAL_CLASH',
      choices: [
        {
          label: '훈련장에 가장 먼저 출근해 감독님 전술을 100% 체화한다',
          description: '행동으로 팀 퍼스트 정신을 증명해 신뢰를 단번에 회복해요.',
          effectSummary: '확정 · DEF +1, PLY +1 · 신뢰도 +10',
          riskTier: 'SAFE',
          statChanges: { def: 1, ply: 1 },
          trustDelta: 10,
        },
        {
          label: '연습경기에서 내 방식의 파괴력을 다시 증명해 보인다',
          description: '실력으로 코칭스태프를 설득하는 정면 승부예요.',
          effectSummary: '성공 시 INS +2, OUT +1, 신뢰도 +7 · 실패 시 신뢰도 -8',
          riskTier: 'HIGH_RISK',
          successCheck: { statKey: 'ins', difficulty: 2, baseProb: 0.6, label: '인사이드(INS) 기반' },
          successOutcome: {
            narrative: '연습경기를 지배하며 감독님으로부터 "네 판단이 맞았다"는 인정을 받아냈어요!',
            statChanges: { ins: 2, out: 1 },
            trustDelta: 7,
            draftStockDelta: 5,
          },
          failureOutcome: {
            narrative: '무리한 개인 플레이가 반복되며 로테이션 우선순위가 밀릴 위기에 놓였어요.',
            trustDelta: -8,
            draftStockDelta: -3,
          },
        },
      ],
    },
  },
  TAC_04: {
    successChain: {
      id: 'EVT_CHAIN_TAC_04_COUNTER',
      title: '상대 수비의 데이터 역공 파훼',
      subtitle: '전천후 미드레인지 전략의 진가',
      description:
        '상대 팀들이 우리의 3점·골밑 위주 패턴을 데이터로 완벽히 봉쇄하기 시작했어요. 지난 시즌 준비해 둔 미드레인지 카운터가 빛을 발할 순간이에요.',
      category: 'TACTICAL_CLASH',
      choices: [
        {
          label: '엘보우 풀업 미드레인지로 상대 드롭백 수비를 해체한다',
          description: '데이터의 빈틈을 찌르는 완벽한 카운터 공격을 펼쳐요.',
          effectSummary: '성공 시 INS +2, OUT +2, 주가 +7 · 실패 시 OUT -1',
          riskTier: 'HIGH_RISK',
          successCheck: { statKey: 'out', difficulty: 2, baseProb: 0.65, label: '외곽 슈팅(OUT) 기반' },
          successOutcome: {
            narrative: '상대 수비 전술을 완전히 무력화하며 리그에서 가장 막기 힘든 스코어러로 극찬받았어요!',
            statChanges: { ins: 2, out: 2 },
            trustDelta: 6,
            draftStockDelta: 7,
          },
          failureOutcome: {
            narrative: '기대만큼 미드레인지 적중률이 나오지 않아 다시 슛 셀렉션을 점검해야 했어요.',
            statChanges: { out: -1 },
            trustDelta: -3,
          },
        },
        {
          label: '스크린과 킥아웃 패스로 오픈 찬스를 차분히 재설계',
          description: '무리하지 않고 팀 전체의 슈팅 효율을 끌어올려요.',
          effectSummary: '확정 · PLY +2 · 신뢰도 +6',
          riskTier: 'SAFE',
          statChanges: { ply: 2 },
          trustDelta: 6,
        },
      ],
    },
    failureChain: {
      id: 'EVT_CHAIN_TAC_04_RESET',
      title: '샷 차트 전면 재정비 세션',
      subtitle: '비효율 슈팅 구간 교정',
      description:
        '지난 시즌 고집했던 무리한 미드레인지 야투율이 발목을 잡았어요. 분석팀과 다시 머리를 맞대고 슈팅 효율을 끌어올려야 해요.',
      category: 'TACTICAL_CLASH',
      choices: [
        {
          label: '코너 3점과 림 어택에 집중하는 고효율 루틴으로 전환',
          description: '자존심을 내려놓고 검증된 현대 농구 효율을 받아들여요.',
          effectSummary: '확정 · OUT +2, INS +1 · 신뢰도 +7',
          riskTier: 'SAFE',
          statChanges: { out: 2, ins: 1 },
          trustDelta: 7,
        },
      ],
    },
  },
  INJ_03: {
    successChain: {
      id: 'EVT_CHAIN_INJ_03_SHOOTOUT',
      title: '교정된 원핸드 릴리스 · 슛감 상승',
      subtitle: '손가락 부상 위기에서 탄생한 새 슈팅 폼',
      description:
        '지난 시즌 부상 중에 교정한 깔끔한 원핸드 릴리스가 완전히 몸에 배며 연습 경기마다 3점슛이 빗발치고 있어요.',
      category: 'LOAD_MANAGEMENT',
      choices: [
        {
          label: '올스타/리그 슈팅 쇼케이스에 도전해 이름을 알린다',
          description: '완성된 슈팅 메커니즘을 전국 무대에서 증명해 보여요.',
          effectSummary: '성공 시 OUT +3, 주가 +8 · 실패 시 주가 -3',
          riskTier: 'HIGH_RISK',
          successCheck: { statKey: 'out', difficulty: 1, baseProb: 0.68, label: '외곽 슈팅(OUT) 기반' },
          successOutcome: {
            narrative: '신들린 3점 행진으로 관중을 열광시키며 리그 정상급 슈터로 공인받았어요!',
            statChanges: { out: 3 },
            trustDelta: 5,
            draftStockDelta: 8,
          },
          failureOutcome: {
            narrative: '긴장 탓에 초반 슛이 짧았지만, 교정된 폼 자체는 호평을 받았어요.',
            statChanges: { out: 1 },
            draftStockDelta: -3,
          },
        },
        {
          label: '쇼케이스 대신 실전 무빙 캐치앤슛 안정화에 집중',
          description: '시즌 내내 흔들리지 않는 기복 없는 슛감을 다져요.',
          effectSummary: '확정 · OUT +2, PHY +1 · 신뢰도 +5',
          riskTier: 'SAFE',
          statChanges: { out: 2, phy: 1 },
          trustDelta: 5,
        },
      ],
    },
    failureChain: {
      id: 'EVT_CHAIN_INJ_03_RECOVERY',
      title: '테이핑 해제와 슛 밸런스 회복',
      subtitle: '완치 후 되찾는 감각',
      description:
        '지난 시즌 무리했던 손가락이 드디어 완전히 회복되었어요. 기본기부터 차근차근 슛감을 되살려야 해요.',
      category: 'LOAD_MANAGEMENT',
      choices: [
        {
          label: '하루 300개 정석 자유투·폼 슈팅으로 감각 완전 회복',
          description: '서두르지 않고 기본기를 되찾아 오히려 더 탄탄한 슛감을 얻어요.',
          effectSummary: '확정 · OUT +2, PHY +1 · 신뢰도 +5',
          riskTier: 'SAFE',
          statChanges: { out: 2, phy: 1 },
          trustDelta: 5,
        },
      ],
    },
  },
  LCK_05: {
    successChain: {
      id: 'EVT_CHAIN_LCK_05_DYNASTY',
      title: '완벽한 공존 · 리그 최강 원투펀치',
      subtitle: '주전 경쟁을 넘어선 라커룸 리더십',
      description:
        '지난 시즌 갈등을 현명하게 풀어낸 동료와 환상적인 호흡을 맞추기 시작했어요. 두 사람이 함께 코트에 설 때마다 팀 마진이 폭등하고 있어요.',
      category: 'LOCKER_ROOM',
      choices: [
        {
          label: '두 사람의 2대2 하이-로우 시그니처 패턴을 완성한다',
          description: '리그가 두려워하는 원투펀치 공격 옵션을 구축해요.',
          effectSummary: '성공 시 PLY +2, INS +2, 신뢰도 +8 · 실패 시 신뢰도 +2',
          riskTier: 'HIGH_RISK',
          successCheck: { statKey: 'ply', difficulty: 1, baseProb: 0.7, label: '플레이메이킹(PLY) 기반' },
          successOutcome: {
            narrative: '눈빛만 봐도 통하는 완벽한 2대2 게임 완성! 구단 팬들이 열광하는 듀오가 되었어요.',
            statChanges: { ply: 2, ins: 2 },
            trustDelta: 8,
            draftStockDelta: 5,
          },
          failureOutcome: {
            narrative: '패턴 완성도는 조금 아쉬웠지만 서로를 존중하는 라커룸 분위기는 탄탄하게 유지되었어요.',
            statChanges: { ply: 1 },
            trustDelta: 2,
          },
        },
        {
          label: '수비 로테이션 호흡을 먼저 다져 빈틈없는 라인업 구축',
          description: '공수 겸장 라인업으로 안정감을 극대화해요.',
          effectSummary: '확정 · DEF +2, REB +1 · 신뢰도 +7',
          riskTier: 'SAFE',
          statChanges: { def: 2, reb: 1 },
          trustDelta: 7,
        },
      ],
    },
    failureChain: {
      id: 'EVT_CHAIN_LCK_05_TENSION',
      title: '주전 자리 재경쟁 · 코트 위의 증명',
      subtitle: '어색해진 라커룸 분위기를 실력으로 정리할 시점',
      description:
        '지난 시즌 포지션 경쟁자와 갈등이 완벽히 해소되지 않았어요. 팀 훈련 캠프에서 누가 진짜 코어인지 다시 가려야 해요.',
      category: 'LOCKER_ROOM',
      choices: [
        {
          label: '먼저 대화를 청해 역할 분담을 합의하고 팀워크를 택한다',
          description: '성숙한 리더십으로 라커룸 갈등을 봉합해요.',
          effectSummary: '확정 · PLY +1, DEF +1 · 신뢰도 +9',
          riskTier: 'SAFE',
          statChanges: { ply: 1, def: 1 },
          trustDelta: 9,
        },
        {
          label: '청백전에서 압도적인 스탯으로 주전 자리를 못 박는다',
          description: '실력으로 모든 논쟁을 끝내는 승부수예요.',
          effectSummary: '성공 시 INS +2, OUT +2, 주가 +6 · 실패 시 신뢰도 -6',
          riskTier: 'HIGH_RISK',
          successCheck: { statKey: 'ins', difficulty: 2, baseProb: 0.62, label: '인사이드(INS) 기반' },
          successOutcome: {
            narrative: '청백전을 완전히 지배하며 감독님과 동료 모두를 실력으로 납득시켰어요!',
            statChanges: { ins: 2, out: 2 },
            trustDelta: 5,
            draftStockDelta: 6,
          },
          failureOutcome: {
            narrative: '지나친 승부욕으로 무리한 슛이 늘어나며 코치진의 표정이 굳어졌어요.',
            trustDelta: -6,
          },
        },
      ],
    },
  },
};

function enrichSeedChoices(s: (typeof SCENARIO_SEEDS)[number]): CareerEventChoice[] {
  const c1Primary = getPrimaryStatKey(s.c1Stats);
  const c2Primary = getPrimaryStatKey(s.c2Stats);
  const c1TradeoffStat = OPPOSITE_STAT[c1Primary];
  const isProScenario = PRO_ONLY_CODES.has(s.code);
  const chainEntry = CHAIN_FOLLOWUPS[s.code];

  // 선택지 1: 안정형 또는 트레이드오프형 (100% 확정 결과, 과도한 공짜 버프 대신 명확한 방향성/소폭 트레이드오프)
  const c1StatsBalanced: Partial<PlayerStats> = {};
  const c1Keys = Object.keys(s.c1Stats || {}) as (keyof PlayerStats)[];
  if (c1Keys.length >= 2) {
    c1StatsBalanced[c1Keys[0]] = Math.min(2, s.c1Stats?.[c1Keys[0]] ?? 1);
    c1StatsBalanced[c1Keys[1]] = 1;
  } else {
    c1StatsBalanced[c1Primary] = 2;
  }
  const hasC1Tradeoff = s.code.endsWith('02') || s.code.endsWith('04') || s.code.endsWith('06');
  if (hasC1Tradeoff && !c1StatsBalanced[c1TradeoffStat]) {
    c1StatsBalanced[c1TradeoffStat] = -1;
  }

  const c1StatParts = (Object.keys(c1StatsBalanced) as (keyof PlayerStats)[]).map(
    (k) => `${k.toUpperCase()} ${(c1StatsBalanced[k] ?? 0) > 0 ? `+${c1StatsBalanced[k]}` : c1StatsBalanced[k]}`
  );
  const c1TrustAdj = Math.max(3, Math.min(8, s.c1Trust));
  const c1DraftAdj = Math.max(1, Math.min(4, s.c1Draft));

  const safeOrTradeoffChoice: CareerEventChoice = {
    label: s.c1Label,
    description: s.c1Desc,
    riskTier: hasC1Tradeoff ? 'BALANCED' : 'SAFE',
    effectSummary: `${hasC1Tradeoff ? '트레이드오프 확정' : '안정 확정'} · ${c1StatParts.join(', ')} · 신뢰도 +${c1TrustAdj}`,
    statChanges: c1StatsBalanced,
    trustDelta: c1TrustAdj,
    draftStockDelta: c1DraftAdj,
    nextChainEvent: chainEntry ? chainEntry.successChain : undefined,
  };

  // 선택지 2: 도전형 (실제 능력치 기반 확률 판정 + 성공 시 고보상 / 실패 시 실질 페널티 + 연쇄 스토리)
  const c2SuccessStats: Partial<PlayerStats> = { ...(s.c2Stats || {}) };
  c2SuccessStats[c2Primary] = Math.max(2, (c2SuccessStats[c2Primary] ?? 1) + 1);
  const c2SuccessParts = (Object.keys(c2SuccessStats) as (keyof PlayerStats)[]).map(
    (k) => `${k.toUpperCase()} +${c2SuccessStats[k]}`
  );
  const c2SuccessDraft = Math.min(9, Math.max(5, s.c2Draft + 2));
  const c2SuccessCash = isProScenario ? 25000 : 0;

  const c2FailStats: Partial<PlayerStats> = { [c2Primary]: -1 };
  const c2FailTrust = -5;
  const c2FailDraft = -4;

  const highRiskChoice: CareerEventChoice = {
    label: s.c2Label,
    description: s.c2Desc,
    riskTier: 'HIGH_RISK',
    effectSummary: `성공 시 ${c2SuccessParts.join(', ')}, 주가 +${c2SuccessDraft}${
      c2SuccessCash > 0 ? ', 보너스 +$25K' : ''
    }${chainEntry ? ' (연쇄 스토리)' : ''} · 실패 시 ${c2Primary.toUpperCase()} -1, 신뢰도 ${c2FailTrust}`,
    successCheck: {
      statKey: c2Primary,
      difficulty: 2,
      baseProb: 0.62,
      minProb: 0.25,
      maxProb: 0.9,
      label: `${STAT_KO_LABEL[c2Primary]} 기반 판정`,
    },
    successOutcome: {
      narrative: `과감한 승부수가 완벽하게 통했어요! 코칭스태프와 스카우트 모두가 당신의 결단력에 감탄했어요.`,
      statChanges: c2SuccessStats,
      trustDelta: Math.max(4, s.c2Trust),
      draftStockDelta: c2SuccessDraft,
      cashDelta: c2SuccessCash,
      nextChainEvent: chainEntry ? chainEntry.successChain : undefined,
    },
    failureOutcome: {
      narrative: `기대만큼 결과가 따라주지 않아 리듬이 흔들렸어요. 감독님의 신뢰도와 스카우트 평가가 소폭 하락했어요.`,
      statChanges: c2FailStats,
      trustDelta: c2FailTrust,
      draftStockDelta: c2FailDraft,
      nextChainEvent: chainEntry ? chainEntry.failureChain : undefined,
    },
    // 폴백용 기본값 (하위 호환성 유지)
    statChanges: c2SuccessStats,
    trustDelta: s.c2Trust,
    draftStockDelta: c2SuccessDraft,
  };

  const choices: CareerEventChoice[] = [safeOrTradeoffChoice, highRiskChoice];

  // 일부 핵심 프로/특훈 시나리오에는 자금 투자형 및 능력치·특성·관계도 전용 3번째 선택지 추가
  if (isProScenario && (s.category === 'LOAD_MANAGEMENT' || s.category === 'OFF_COURT_BRAND')) {
    choices.push({
      label: '사비를 투자해 전문 컨설턴트·트레이너를 개인 초빙한다 (-$15K)',
      description: '보유 현금을 과감히 투자해 리스크 없이 피지컬과 기량 보너스를 확보합니다.',
      riskTier: 'BALANCED',
      cashDelta: -15000,
      effectSummary: '가용 자산 -$15K · PHY +2 · 감독 신뢰 +6 확정',
      statChanges: { phy: 2, [c1Primary]: 1 },
      trustDelta: 6,
      draftStockDelta: 5,
    });
  } else if (s.category === 'TACTICAL_CLASH' || s.category === 'ROLE_ADAPTATION') {
    choices.push({
      label: '전술 영상 브리핑으로 코칭스태프와 맞춤 해법 합의',
      description: '높은 패스·전술 이해도(PLY)를 바탕으로 팀 전술과 개인 강점을 동시에 살리는 방안을 도출합니다.',
      riskTier: 'SAFE',
      isExclusiveChoice: true,
      requirements: {
        minStat: { ply: 74 },
        label: '전용 분기 · 패스(PLY) 74+',
      },
      effectSummary: 'PLY +2 · 감독 신뢰 +8 · 라커룸 +4 확정',
      statChanges: { ply: 2, [c1Primary]: 1 },
      relationshipChanges: { lockerRoom: 4 },
      trustDelta: 8,
      draftStockDelta: 4,
    });
  } else if (s.category === 'RIVAL_SHOWDOWN' || s.category === 'MEDIA_SPOTLIGHT') {
    choices.push({
      label: '승부처 퍼포먼스로 정면 돌파해 스포트라이트 독점',
      description: '압박감을 즐기는 승부사 기질로 여론과 매치업 주도권을 한 번에 가져옵니다.',
      riskTier: 'SAFE',
      isExclusiveChoice: true,
      requirements: {
        requiredTrait: 'CLUTCH_PERFORMER',
        label: "전용 분기 · 특성 '승부사' 보유",
      },
      effectSummary: '언론·팬심 +8 · 핵심 스탯 +2 · 감독 신뢰 +4 확정',
      statChanges: { [c2Primary]: 2 },
      relationshipChanges: { mediaFan: 8 },
      trustDelta: 4,
      draftStockDelta: 5,
    });
  } else if (s.category === 'LOCKER_ROOM' || s.category === 'FRONT_OFFICE') {
    choices.push({
      label: '베테랑급 소통으로 선수단과 구단 가교 역할 수행',
      description: '라커룸 내부 결속력을 바탕으로 갈등을 중재하고 팀 분위기를 한 단계 끌어올립니다.',
      riskTier: 'SAFE',
      isExclusiveChoice: true,
      requirements: {
        minRelationship: { lockerRoom: 70 },
        label: '전용 분기 · 라커룸 70+',
      },
      effectSummary: '라커룸 +8 · 프런트 +6 · DEF +1 · 감독 신뢰 +6 확정',
      statChanges: { [c1Primary]: 1, def: 1 },
      relationshipChanges: { lockerRoom: 8, frontOffice: 6 },
      trustDelta: 6,
      draftStockDelta: 3,
    });
  }

  return choices;
}

export const ENCOUNTER_SCENARIO_POOL: EncounterScenarioTemplate[] =
  SCENARIO_SEEDS.map((s) => ({
    id: `EVT_COMB_${s.code}`,
    category: s.category,
    title: s.title,
    subtitle: s.subtitle,
    description: s.description,
    allowedLeagues: PRO_ONLY_CODES.has(s.code) ? PRO_LEAGUES : undefined,
    allowedPositions: s.allowedPositions,
    excludedPositions: s.excludedPositions,
    preferredPositions: s.preferredPositions,
    minAge: MIN_AGE_BY_CODE[s.code],
    preferredTags: s.tags,
    choices: enrichSeedChoices(s),
  }));

/**
 * 확률 판정 선택지의 실시간 성공 확률(0~100 정수 %) 산출
 * - 선수의 해당 능력치 vs 리그 기준치(LDR) + 난이도 보정
 * - 감독 신뢰도 및 승부사(CLUTCH_PERFORMER) 특성 가산
 */
export function calculateEncounterSuccessChance(
  career: CareerState,
  choice: CareerEventChoice
): number {
  if (!choice.successCheck) return 100;
  const check = choice.successCheck;
  const playerStat = career.stats[check.statKey] ?? career.ovr;
  const leagueLdr = LEAGUE_CONFIG[career.league]?.ldr ?? 68;
  const target = leagueLdr + check.difficulty;

  const baseProb = check.baseProb ?? 0.62;
  const statDiffBonus = (playerStat - target) * 0.018;
  const trustBonus = (career.coachTrust - 55) * 0.0022;
  const clutchBonus = (career.traits || []).includes('CLUTCH_PERFORMER')
    ? 0.06
    : 0;

  const prob = clampNum(
    baseProb + statDiffBonus + trustBonus + clutchBonus,
    check.minProb ?? 0.22,
    check.maxProb ?? 0.92
  );
  return Math.round(prob * 100);
}

/**
 * 인카운터 선택지 결과를 확률 판정 및 트레이드오프에 따라 결정적으로 해석합니다.
 */
export function resolveEncounterChoiceOutcome(
  career: CareerState,
  event: CareerEvent,
  choice: CareerEventChoice,
  rng: () => number = Math.random
): {
  result: EncounterResolutionResult;
  nextChainEvent: CareerEvent | null;
  arcAdvance?: CareerEventChoice['arcAdvance'];
} {
  if (!choice.successCheck || !choice.successOutcome || !choice.failureOutcome) {
    const statChanges = choice.statChanges || {};
    const relationshipChanges: Partial<RelationshipMetrics> | undefined =
      choice.relationshipChanges ? { ...choice.relationshipChanges } : undefined;
    const trustDelta = choice.trustDelta || 0;
    const draftStockDelta = choice.draftStockDelta || 0;
    const potentialDelta = choice.potentialDelta || 0;
    const cashDelta = choice.cashDelta || 0;
    const nextChainEvent = choice.nextChainEvent || null;
    const arcAdvance = choice.arcAdvance;
    return {
      result: {
        eventId: event.id,
        eventTitle: event.title,
        choiceLabel: choice.label,
        wasProbabilistic: false,
        successChancePct: 100,
        rolledSuccess: true,
        outcomeTier: 'GUARANTEED',
        narrative: choice.description,
        statChanges,
        relationshipChanges,
        trustDelta,
        draftStockDelta,
        potentialDelta,
        cashDelta,
        arcProgressNote: arcAdvance?.summary,
        chainedNextSeasonTitle: nextChainEvent?.title,
      },
      nextChainEvent,
      arcAdvance,
    };
  }

  const chancePct = calculateEncounterSuccessChance(career, choice);
  const roll = rng() * 100;
  const succeeded = roll < chancePct;
  const isCritical = succeeded && roll < chancePct * 0.2;

  const branch = succeeded ? choice.successOutcome : choice.failureOutcome;
  const statChanges: Partial<PlayerStats> = { ...(branch.statChanges || {}) };
  const relationshipChanges: Partial<RelationshipMetrics> = {
    ...(choice.relationshipChanges || {}),
    ...(branch.relationshipChanges || {}),
  };

  // 대성공(상위 20% 롤) 시 핵심 능력치 +1 추가 보너스
  if (isCritical) {
    const key = choice.successCheck.statKey;
    statChanges[key] = (statChanges[key] ?? 0) + 1;
  }

  const trustDelta = (branch.trustDelta || 0) + (isCritical ? 2 : 0);
  const draftStockDelta = (branch.draftStockDelta || 0) + (isCritical ? 2 : 0);
  const potentialDelta = branch.potentialDelta || 0;
  const cashDelta = (branch.cashDelta || 0) + (choice.cashDelta || 0);
  const nextChainEvent = branch.nextChainEvent || null;
  const arcAdvance = branch.arcAdvance || choice.arcAdvance;

  const hasRelationship = Object.values(relationshipChanges).some(
    (v) => typeof v === 'number' && v !== 0
  );

  return {
    result: {
      eventId: event.id,
      eventTitle: event.title,
      choiceLabel: choice.label,
      wasProbabilistic: true,
      successChancePct: chancePct,
      rolledSuccess: succeeded,
      outcomeTier: isCritical
        ? 'CRITICAL_SUCCESS'
        : succeeded
        ? 'SUCCESS'
        : 'FAILURE',
      narrative: isCritical
        ? `대성공 · ${branch.narrative} 기대 이상의 활약으로 핵심 능력치가 추가로 +1 상승했습니다.`
        : branch.narrative,
      statChanges,
      relationshipChanges: hasRelationship ? relationshipChanges : undefined,
      trustDelta,
      draftStockDelta,
      potentialDelta,
      cashDelta,
      arcProgressNote: arcAdvance?.summary,
      chainedNextSeasonTitle: nextChainEvent?.title,
    },
    nextChainEvent,
    arcAdvance,
  };
}

export function rollCombinatorialEncounter(
  career: CareerState,
  rng: () => number = Math.random
): CareerEvent {
  if (career.pendingChainEvent) {
    return career.pendingChainEvent;
  }

  const storyArcEvent = rollStoryArcEvent(career, rng);
  if (storyArcEvent) {
    return storyArcEvent;
  }

  const seenIds = new Set(career.seenEventIds || []);
  const recentCategories = (career.recentEventCategories || []).slice(-2);
  const contextTags = extractCareerContextTags(career);

  // 0) 리그/연령/포지션 컨텍스트 적합성 필터 (고교생 프로 이벤트·포지션 불일치 이벤트 원천 차단)
  const contextEligible = ENCOUNTER_SCENARIO_POOL.filter((s) => {
    if (s.allowedLeagues && !s.allowedLeagues.includes(career.league)) {
      return false;
    }
    if (s.excludedPositions?.includes(career.primaryPos)) {
      return false;
    }
    if (s.allowedPositions && !s.allowedPositions.includes(career.primaryPos)) {
      return false;
    }
    if (typeof s.minAge === 'number' && career.age < s.minAge) {
      return false;
    }
    if (typeof s.maxAge === 'number' && career.age > s.maxAge) {
      return false;
    }
    return true;
  });

  const basePool =
    contextEligible.length > 0 ? contextEligible : ENCOUNTER_SCENARIO_POOL;

  // 1) 미경험(Zero Duplicate) + 최근 2시즌 카테고리 쿨다운 적용
  let candidates = basePool.filter(
    (s) => !seenIds.has(s.id) && !recentCategories.includes(s.category)
  );

  // 만약 모든 후보가 소진되었으면 쿨다운만 유지하고 미경험 필터 완화
  if (candidates.length === 0) {
    candidates = basePool.filter(
      (s) => !recentCategories.includes(s.category)
    );
  }
  if (candidates.length === 0) {
    candidates = [...basePool];
  }

  // 2) 커리어 컨텍스트 태그 및 포지션 선호도에 따라 가중치 정렬/선택
  const scored = candidates.map((s) => {
    const tagMatches = (s.preferredTags || []).filter((t) =>
      contextTags.includes(t)
    ).length;
    const primaryPosBonus = s.preferredPositions?.includes(career.primaryPos)
      ? 1.8
      : 0;
    const secondaryPosBonus =
      career.secondaryPos && s.preferredPositions?.includes(career.secondaryPos)
        ? 0.6
        : 0;
    return {
      scenario: s,
      weight: 1 + tagMatches * 1.5 + primaryPosBonus + secondaryPosBonus,
    };
  });

  const totalWeight = scored.reduce((sum, item) => sum + item.weight, 0);
  let pick = rng() * totalWeight;
  let chosen = scored[0].scenario;

  for (const item of scored) {
    pick -= item.weight;
    if (pick <= 0) {
      chosen = item.scenario;
      break;
    }
  }

  return {
    id: chosen.id,
    title: chosen.title,
    subtitle: chosen.subtitle,
    description: chosen.description,
    category: chosen.category,
    choices: chosen.choices,
  };
}

