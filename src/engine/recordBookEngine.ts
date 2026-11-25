import { LEAGUE_CONFIG } from '../data/leagues';
import { LEAGUE_BALANCE_META } from '../config/balanceConfig';
import {
  CareerMilestone,
  CareerState,
  HallOfFameEntry,
  HofCompendiumSummary,
  LeagueId,
  LeagueRecordCategory,
  LeagueRecordChase,
  LeagueRecordEntry,
  LegacyTierId,
  RecordBookState,
  RecordBreakEvent,
  SeasonBoxScore,
} from '../types/game';

interface BaselineRecordSpec {
  category: LeagueRecordCategory;
  label: string;
  unit: string;
  value: number;
  holderName: string;
  teamName: string;
  year: number;
}

const LEAGUE_BASELINE_RECORDS: Record<LeagueId, BaselineRecordSpec[]> = {
  NBA: [
    {
      category: 'CAREER_POINTS',
      label: '통산 득점',
      unit: '점',
      value: 38387,
      holderName: '카림 압둘-자바',
      teamName: 'LA 레이커스',
      year: 1989,
    },
    {
      category: 'SINGLE_GAME_POINTS',
      label: '단일 경기 최다 득점',
      unit: '점',
      value: 62,
      holderName: '코비 브라이언트',
      teamName: 'LA 레이커스',
      year: 2006,
    },
    {
      category: 'SEASON_PPG',
      label: '단일 시즌 평균 득점',
      unit: 'PPG',
      value: 34.0,
      holderName: '마이클 조던',
      teamName: '시카고 불스',
      year: 1987,
    },
    {
      category: 'SEASON_RPG',
      label: '단일 시즌 평균 리바운드',
      unit: 'RPG',
      value: 15.6,
      holderName: '데니스 로드맨',
      teamName: '시카고 불스',
      year: 1998,
    },
    {
      category: 'SEASON_APG',
      label: '단일 시즌 평균 어시스트',
      unit: 'APG',
      value: 12.2,
      holderName: '존 스톡턴',
      teamName: '유타 재즈',
      year: 1995,
    },
    {
      category: 'CHAMPIONSHIPS',
      label: '최다 우승',
      unit: '회',
      value: 6,
      holderName: '마이클 조던',
      teamName: '시카고 불스',
      year: 1998,
    },
    {
      category: 'MVPS',
      label: '최다 정규시즌 MVP',
      unit: '회',
      value: 5,
      holderName: '빌 러셀',
      teamName: '보스턴 셀틱스',
      year: 1965,
    },
    {
      category: 'FINALS_MVPS',
      label: '최다 파이널 MVP',
      unit: '회',
      value: 6,
      holderName: '마이클 조던',
      teamName: '시카고 불스',
      year: 1998,
    },
  ],
  KBL: [
    {
      category: 'CAREER_POINTS',
      label: '통산 득점',
      unit: '점',
      value: 13231,
      holderName: '서장훈',
      teamName: '서울 삼성',
      year: 2013,
    },
    {
      category: 'SINGLE_GAME_POINTS',
      label: '단일 경기 최다 득점',
      unit: '점',
      value: 52,
      holderName: '허재',
      teamName: '부산 기아',
      year: 1998,
    },
    {
      category: 'SEASON_PPG',
      label: '단일 시즌 평균 득점',
      unit: 'PPG',
      value: 26.8,
      holderName: '문경은',
      teamName: '서울 SK',
      year: 2003,
    },
    {
      category: 'SEASON_RPG',
      label: '단일 시즌 평균 리바운드',
      unit: 'RPG',
      value: 13.4,
      holderName: '김주성',
      teamName: '원주 DB',
      year: 2008,
    },
    {
      category: 'SEASON_APG',
      label: '단일 시즌 평균 어시스트',
      unit: 'APG',
      value: 9.2,
      holderName: '강동희',
      teamName: '부산 기아',
      year: 1999,
    },
    {
      category: 'CHAMPIONSHIPS',
      label: '최다 우승',
      unit: '회',
      value: 5,
      holderName: '양동근',
      teamName: '울산 현대모비스',
      year: 2019,
    },
    {
      category: 'MVPS',
      label: '최다 정규시즌 MVP',
      unit: '회',
      value: 4,
      holderName: '양동근',
      teamName: '울산 현대모비스',
      year: 2016,
    },
    {
      category: 'FINALS_MVPS',
      label: '최다 파이널 MVP',
      unit: '회',
      value: 3,
      holderName: '양동근',
      teamName: '울산 현대모비스',
      year: 2015,
    },
  ],
  B_LEAGUE: [
    {
      category: 'CAREER_POINTS',
      label: '통산 득점',
      unit: '점',
      value: 8950,
      holderName: '닉 파지카스',
      teamName: '가와사키 브레이브 썬더스',
      year: 2024,
    },
    {
      category: 'SINGLE_GAME_POINTS',
      label: '단일 경기 최다 득점',
      unit: '점',
      value: 53,
      holderName: '다반테 가드너',
      teamName: '시호스 미카와',
      year: 2020,
    },
    {
      category: 'SEASON_PPG',
      label: '단일 시즌 평균 득점',
      unit: 'PPG',
      value: 27.1,
      holderName: '닉 파지카스',
      teamName: '가와사키 브레이브 썬더스',
      year: 2017,
    },
    {
      category: 'SEASON_RPG',
      label: '단일 시즌 평균 리바운드',
      unit: 'RPG',
      value: 13.8,
      holderName: '잭 쿨리',
      teamName: '류큐 골든킹스',
      year: 2023,
    },
    {
      category: 'SEASON_APG',
      label: '단일 시즌 평균 어시스트',
      unit: 'APG',
      value: 8.5,
      holderName: '카와무라 유키',
      teamName: '요코하마 비-코르세어스',
      year: 2023,
    },
    {
      category: 'CHAMPIONSHIPS',
      label: '최다 우승',
      unit: '회',
      value: 2,
      holderName: '히에지마 마코토',
      teamName: '우쓰노미야 브렉스',
      year: 2022,
    },
    {
      category: 'MVPS',
      label: '최다 정규시즌 MVP',
      unit: '회',
      value: 2,
      holderName: '토가시 유키',
      teamName: '치바 제츠',
      year: 2023,
    },
  ],
  NBL: [
    {
      category: 'CAREER_POINTS',
      label: '통산 득점',
      unit: '점',
      value: 8500,
      holderName: '앤드류 게이즈',
      teamName: '멜버른 타이거스',
      year: 2005,
    },
    {
      category: 'SINGLE_GAME_POINTS',
      label: '단일 경기 최다 득점',
      unit: '점',
      value: 59,
      holderName: '브라이스 코튼',
      teamName: '퍼스 와일드캐츠',
      year: 2024,
    },
    {
      category: 'SEASON_PPG',
      label: '단일 시즌 평균 득점',
      unit: 'PPG',
      value: 28.6,
      holderName: '브라이스 코튼',
      teamName: '퍼스 와일드캐츠',
      year: 2025,
    },
    {
      category: 'SEASON_RPG',
      label: '단일 시즌 평균 리바운드',
      unit: 'RPG',
      value: 12.6,
      holderName: '앤드류 보것',
      teamName: '시드니 킹스',
      year: 2019,
    },
    {
      category: 'SEASON_APG',
      label: '단일 시즌 평균 어시스트',
      unit: 'APG',
      value: 7.8,
      holderName: '캐스퍼 웨어',
      teamName: '시드니 킹스',
      year: 2020,
    },
    {
      category: 'CHAMPIONSHIPS',
      label: '최다 우승',
      unit: '회',
      value: 6,
      holderName: '데미안 마틴',
      teamName: '퍼스 와일드캐츠',
      year: 2020,
    },
    {
      category: 'MVPS',
      label: '최다 정규시즌 MVP',
      unit: '회',
      value: 5,
      holderName: '브라이스 코튼',
      teamName: '퍼스 와일드캐츠',
      year: 2025,
    },
  ],
  EUROLEAGUE: [
    {
      category: 'CAREER_POINTS',
      label: '통산 득점',
      unit: '점',
      value: 5200,
      holderName: '마이크 제임스',
      teamName: 'AS 모나코',
      year: 2025,
    },
    {
      category: 'SINGLE_GAME_POINTS',
      label: '단일 경기 최다 득점',
      unit: '점',
      value: 50,
      holderName: '나이젤 헤이즈-데이비스',
      teamName: '페네르바체',
      year: 2024,
    },
    {
      category: 'SEASON_PPG',
      label: '단일 시즌 평균 득점',
      unit: 'PPG',
      value: 22.8,
      holderName: '셰인 라킨',
      teamName: '아나돌루 에페스',
      year: 2020,
    },
    {
      category: 'SEASON_RPG',
      label: '단일 시즌 평균 리바운드',
      unit: 'RPG',
      value: 10.6,
      holderName: '월터 타바레스',
      teamName: '레알 마드리드',
      year: 2022,
    },
    {
      category: 'SEASON_APG',
      label: '단일 시즌 평균 어시스트',
      unit: 'APG',
      value: 9.1,
      holderName: '닉 칼라테스',
      teamName: '파나티나이코스',
      year: 2020,
    },
    {
      category: 'CHAMPIONSHIPS',
      label: '최다 우승',
      unit: '회',
      value: 4,
      holderName: '카일 하인즈',
      teamName: 'CSKA 모스크바',
      year: 2019,
    },
    {
      category: 'MVPS',
      label: '최다 정규시즌 MVP',
      unit: '회',
      value: 2,
      holderName: '바실리예 미치치',
      teamName: '아나돌루 에페스',
      year: 2022,
    },
    {
      category: 'FINALS_MVPS',
      label: '최다 파이널 포 MVP',
      unit: '회',
      value: 3,
      holderName: '바실리스 스파눌리스',
      teamName: '올림피아코스',
      year: 2013,
    },
  ],
  GLEAGUE: [
    {
      category: 'CAREER_POINTS',
      label: '통산 득점',
      unit: '점',
      value: 4200,
      holderName: '안토니오 블레이크니',
      teamName: '윈디시티 불스',
      year: 2021,
    },
    {
      category: 'SINGLE_GAME_POINTS',
      label: '단일 경기 최다 득점',
      unit: '점',
      value: 53,
      holderName: '제이든 하디',
      teamName: '텍사스 레전즈',
      year: 2023,
    },
    {
      category: 'SEASON_PPG',
      label: '단일 시즌 평균 득점',
      unit: 'PPG',
      value: 28.2,
      holderName: '칼릭 존스',
      teamName: '윈디시티 불스',
      year: 2023,
    },
    {
      category: 'SEASON_RPG',
      label: '단일 시즌 평균 리바운드',
      unit: 'RPG',
      value: 13.6,
      holderName: '오스카 시브웨',
      teamName: '인디애나 매드앤츠',
      year: 2024,
    },
    {
      category: 'SEASON_APG',
      label: '단일 시즌 평균 어시스트',
      unit: 'APG',
      value: 10.4,
      holderName: '트레본 듀발',
      teamName: '사우스베이 레이커스',
      year: 2022,
    },
    {
      category: 'CHAMPIONSHIPS',
      label: '최다 우승',
      unit: '회',
      value: 2,
      holderName: '크리스 클레몬스',
      teamName: '리오그란데 밸리',
      year: 2022,
    },
    {
      category: 'MVPS',
      label: '최다 정규시즌 MVP',
      unit: '회',
      value: 2,
      holderName: '맥 맥클렁',
      teamName: '오세올라 매직',
      year: 2024,
    },
  ],
  NCAA: [
    {
      category: 'CAREER_POINTS',
      label: '통산 득점',
      unit: '점',
      value: 2850,
      holderName: 'J.J. 레딕',
      teamName: '듀크 대학교',
      year: 2006,
    },
    {
      category: 'SINGLE_GAME_POINTS',
      label: '단일 경기 최다 득점',
      unit: '점',
      value: 46,
      holderName: '트레이 영',
      teamName: '오클라호마 대학교',
      year: 2018,
    },
    {
      category: 'SEASON_PPG',
      label: '단일 시즌 평균 득점',
      unit: 'PPG',
      value: 27.4,
      holderName: '잭 이디',
      teamName: '퍼듀 대학교',
      year: 2024,
    },
    {
      category: 'SEASON_RPG',
      label: '단일 시즌 평균 리바운드',
      unit: 'RPG',
      value: 13.2,
      holderName: '아만도 바콧',
      teamName: '노스캐롤라이나 대학교',
      year: 2022,
    },
    {
      category: 'SEASON_APG',
      label: '단일 시즌 평균 어시스트',
      unit: 'APG',
      value: 9.5,
      holderName: '자 모란트',
      teamName: '머레이 주립대',
      year: 2019,
    },
    {
      category: 'CHAMPIONSHIPS',
      label: '최다 우승',
      unit: '회',
      value: 2,
      holderName: '조아킴 노아',
      teamName: '플로리다 대학교',
      year: 2007,
    },
    {
      category: 'MVPS',
      label: '최다 올해의 선수',
      unit: '회',
      value: 2,
      holderName: '잭 이디',
      teamName: '퍼듀 대학교',
      year: 2024,
    },
  ],
  U_LEAGUE: [
    {
      category: 'CAREER_POINTS',
      label: '통산 득점',
      unit: '점',
      value: 1320,
      holderName: '김선형',
      teamName: '중앙대학교',
      year: 2011,
    },
    {
      category: 'SINGLE_GAME_POINTS',
      label: '단일 경기 최다 득점',
      unit: '점',
      value: 44,
      holderName: '허웅',
      teamName: '연세대학교',
      year: 2014,
    },
    {
      category: 'SEASON_PPG',
      label: '단일 시즌 평균 득점',
      unit: 'PPG',
      value: 24.5,
      holderName: '오세근',
      teamName: '중앙대학교',
      year: 2010,
    },
    {
      category: 'SEASON_RPG',
      label: '단일 시즌 평균 리바운드',
      unit: 'RPG',
      value: 13.0,
      holderName: '김종규',
      teamName: '경희대학교',
      year: 2013,
    },
    {
      category: 'SEASON_APG',
      label: '단일 시즌 평균 어시스트',
      unit: 'APG',
      value: 8.8,
      holderName: '허훈',
      teamName: '연세대학교',
      year: 2017,
    },
    {
      category: 'CHAMPIONSHIPS',
      label: '최다 우승',
      unit: '회',
      value: 3,
      holderName: '이승현',
      teamName: '고려대학교',
      year: 2014,
    },
    {
      category: 'MVPS',
      label: '최다 정규시즌 MVP',
      unit: '회',
      value: 2,
      holderName: '박정현',
      teamName: '고려대학교',
      year: 2019,
    },
  ],
  HIGH_SCHOOL: [
    {
      category: 'CAREER_POINTS',
      label: '통산 득점',
      unit: '점',
      value: 1450,
      holderName: '송교창',
      teamName: '삼일고등학교',
      year: 2015,
    },
    {
      category: 'SINGLE_GAME_POINTS',
      label: '단일 경기 최다 득점',
      unit: '점',
      value: 42,
      holderName: '여준석',
      teamName: '용산고등학교',
      year: 2021,
    },
    {
      category: 'SEASON_PPG',
      label: '단일 시즌 평균 득점',
      unit: 'PPG',
      value: 24.8,
      holderName: '이현중',
      teamName: '삼일고등학교',
      year: 2018,
    },
    {
      category: 'SEASON_RPG',
      label: '단일 시즌 평균 리바운드',
      unit: 'RPG',
      value: 13.5,
      holderName: '하윤기',
      teamName: '삼일고등학교',
      year: 2017,
    },
    {
      category: 'SEASON_APG',
      label: '단일 시즌 평균 어시스트',
      unit: 'APG',
      value: 8.5,
      holderName: '변준형',
      teamName: '제물포고등학교',
      year: 2014,
    },
    {
      category: 'CHAMPIONSHIPS',
      label: '최다 우승',
      unit: '회',
      value: 3,
      holderName: '김태훈',
      teamName: '용산고등학교',
      year: 2022,
    },
    {
      category: 'MVPS',
      label: '최다 전국대회 MVP',
      unit: '회',
      value: 2,
      holderName: '여준석',
      teamName: '용산고등학교',
      year: 2021,
    },
  ],
  US_HIGH_SCHOOL: [
    { category: 'CAREER_POINTS', label: '통산 득점', unit: '점', value: 2600, holderName: '전미 프렙 역대 기록', teamName: '전미 프렙 서킷', year: 2019 },
    { category: 'SINGLE_GAME_POINTS', label: '단일 경기 최다 득점', unit: '점', value: 55, holderName: '전미 프렙 역대 기록', teamName: '전미 프렙 서킷', year: 2017 },
    { category: 'SEASON_PPG', label: '단일 시즌 평균 득점', unit: 'PPG', value: 30.5, holderName: '전미 프렙 역대 기록', teamName: '전미 프렙 서킷', year: 2018 },
    { category: 'SEASON_RPG', label: '단일 시즌 평균 리바운드', unit: 'RPG', value: 14.5, holderName: '전미 프렙 역대 기록', teamName: '전미 프렙 서킷', year: 2016 },
    { category: 'SEASON_APG', label: '단일 시즌 평균 어시스트', unit: 'APG', value: 9.5, holderName: '전미 프렙 역대 기록', teamName: '전미 프렙 서킷', year: 2020 },
    { category: 'CHAMPIONSHIPS', label: '최다 우승', unit: '회', value: 3, holderName: '전미 프렙 역대 기록', teamName: '전미 프렙 서킷', year: 2022 },
    { category: 'MVPS', label: '최다 전미 고교 MVP', unit: '회', value: 2, holderName: '전미 프렙 역대 기록', teamName: '전미 프렙 서킷', year: 2021 },
  ],
};

export const LEGACY_TIER_CATALOG: {
  id: LegacyTierId;
  title: string;
  criteria: string;
}[] = [
  {
    id: 'GOAT',
    title: '역대 최고 선수 (GOAT)',
    criteria: 'NBA MVP 3회 · 우승 3회 · 파이널 MVP 2회',
  },
  {
    id: 'FIRST_BALLOT_HOF',
    title: '명예의 전당 퍼스트 발롯',
    criteria: 'NBA MVP·FMVP 1회 / All-NBA 퍼스트 3회 / 올스타 10회 / 25,000득점 중 1개 충족',
  },
  {
    id: 'NBA_ALL_STAR',
    title: 'NBA 올스타 · 챔피언',
    criteria: 'NBA 올스타·우승 1회 또는 NBA 통산 6,000득점',
  },
  {
    id: 'NBA_VETERAN',
    title: 'NBA 정식 리거',
    criteria: 'NBA 120경기 이상 또는 NBA 통산 1,500득점',
  },
  {
    id: 'ASIA_KBL_LEGEND',
    title: 'KBL · 아시아 최정상급 선수',
    criteria: '우승 2회 또는 MVP 1회 / 통산 6,500득점',
  },
  {
    id: 'PRO_VETERAN',
    title: '프로 베테랑',
    criteria: '6시즌 이상 활동 또는 통산 2,200득점',
  },
  {
    id: 'COURT_CHALLENGER',
    title: '코트의 도전자',
    criteria: '커리어 완주 기본 등급',
  },
];

const ALL_LEAGUE_IDS: LeagueId[] = [
  'NBA',
  'EUROLEAGUE',
  'NBL',
  'B_LEAGUE',
  'KBL',
  'GLEAGUE',
  'NCAA',
  'U_LEAGUE',
  'HIGH_SCHOOL',
  'US_HIGH_SCHOOL',
];

export function createInitialRecordBook(): RecordBookState {
  const result = {} as RecordBookState;
  for (const league of ALL_LEAGUE_IDS) {
    result[league] = LEAGUE_BASELINE_RECORDS[league].map((spec) => ({
      id: `REC_${league}_${spec.category}`,
      league,
      category: spec.category,
      label: spec.label,
      unit: spec.unit,
      value: spec.value,
      holderName: spec.holderName,
      teamName: spec.teamName,
      year: spec.year,
      isUserRecord: false,
    }));
  }
  return result;
}

export function normalizeRecordBook(
  existing?: Partial<RecordBookState> | null
): RecordBookState {
  const base = createInitialRecordBook();
  if (!existing) return base;

  for (const league of ALL_LEAGUE_IDS) {
    const savedList = existing[league];
    if (!Array.isArray(savedList)) continue;
    base[league] = base[league].map((defaultEntry) => {
      const match = savedList.find((e) => e.category === defaultEntry.category);
      if (!match || typeof match.value !== 'number') return defaultEntry;
      if (match.isUserRecord && match.value > defaultEntry.value) {
        return {
          ...defaultEntry,
          value: match.value,
          holderName: match.holderName,
          teamName: match.teamName,
          year: match.year,
          isUserRecord: true,
          playerId: match.playerId,
        };
      }
      return defaultEntry;
    });
  }
  return base;
}

/**
 * 리그별 시즌 평균 기록(PPG/RPG/APG) 등재 최소 출전 경기 수
 * (정규시즌 총 경기 수 × 리그 최소 출장률 비율)
 */
export function getMinGpForSeasonRecord(league: LeagueId): number {
  const games = LEAGUE_CONFIG[league]?.games ?? 30;
  const ratio = LEAGUE_BALANCE_META[league]?.minAttendanceRatio ?? 0.65;
  return Math.max(1, Math.ceil(games * ratio));
}

function aggregateLeagueCareerStats(
  career: Pick<CareerState, 'seasonLogs'>,
  league: LeagueId
) {
  const logs = career.seasonLogs.filter((l) => l.league === league);
  const minGp = getMinGpForSeasonRecord(league);
  let points = 0;
  let championships = 0;
  let mvps = 0;
  let finalsMvps = 0;
  let singleGameHighPts = 0;
  let bestPpg = 0;
  let bestRpg = 0;
  let bestApg = 0;

  for (const l of logs) {
    points += Math.round(l.ppg * l.gp);
    if (l.wonChampionship) championships += 1;
    if (l.wonMvp) mvps += 1;
    if (l.wonFinalsMvp) finalsMvps += 1;
    if (l.singleGameHighPts > singleGameHighPts) singleGameHighPts = l.singleGameHighPts;
    if (l.gp >= minGp) {
      if (l.ppg > bestPpg) bestPpg = l.ppg;
      if (l.rpg > bestRpg) bestRpg = l.rpg;
      if (l.apg > bestApg) bestApg = l.apg;
    }
  }

  return {
    points,
    championships,
    mvps,
    finalsMvps,
    singleGameHighPts,
    bestPpg: Number(bestPpg.toFixed(1)),
    bestRpg: Number(bestRpg.toFixed(1)),
    bestApg: Number(bestApg.toFixed(1)),
  };
}

/**
 * 시즌/포스트시즌 종료 시 역대 리그 기록 경신 여부를 검사하고 RecordBook과 마일스톤을 갱신
 */
export function checkAndApplyRecordBreaks(
  recordBook: RecordBookState,
  career: CareerState,
  seasonLog: SeasonBoxScore
): {
  nextBook: RecordBookState;
  brokenRecords: RecordBreakEvent[];
  milestones: CareerMilestone[];
} {
  const league = seasonLog.league;
  const normalized = normalizeRecordBook(recordBook);
  const entries = normalized[league].map((e) => ({ ...e }));
  const agg = aggregateLeagueCareerStats(career, league);
  const minGp = getMinGpForSeasonRecord(league);

  const candidates: Record<LeagueRecordCategory, number> = {
    CAREER_POINTS: agg.points,
    SINGLE_GAME_POINTS: seasonLog.singleGameHighPts,
    SEASON_PPG: seasonLog.gp >= minGp ? Number(seasonLog.ppg.toFixed(1)) : 0,
    SEASON_RPG: seasonLog.gp >= minGp ? Number(seasonLog.rpg.toFixed(1)) : 0,
    SEASON_APG: seasonLog.gp >= minGp ? Number(seasonLog.apg.toFixed(1)) : 0,
    CHAMPIONSHIPS: agg.championships,
    MVPS: agg.mvps,
    FINALS_MVPS: agg.finalsMvps,
  };

  const brokenRecords: RecordBreakEvent[] = [];
  const milestones: CareerMilestone[] = [];
  const leagueShort = LEAGUE_CONFIG[league]?.shortName || league;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const candidateVal = candidates[entry.category];
    if (candidateVal > entry.value) {
      const wasSamePlayer = entry.isUserRecord && entry.playerId === career.id;
      const previousValue = entry.value;
      const previousHolder = entry.holderName;

      entries[i] = {
        ...entry,
        value: candidateVal,
        holderName: career.name,
        teamName: seasonLog.teamName,
        year: seasonLog.year,
        isUserRecord: true,
        playerId: career.id,
      };

      brokenRecords.push({
        league,
        category: entry.category,
        label: entry.label,
        unit: entry.unit,
        previousValue,
        previousHolder,
        newValue: candidateVal,
        holderName: career.name,
        teamName: seasonLog.teamName,
        year: seasonLog.year,
      });

      const formattedNew =
        entry.unit === '점' || entry.unit === '회'
          ? `${candidateVal.toLocaleString()}${entry.unit}`
          : `${candidateVal.toFixed(1)} ${entry.unit}`;
      const formattedPrev =
        entry.unit === '점' || entry.unit === '회'
          ? `${previousValue.toLocaleString()}${entry.unit}`
          : `${previousValue.toFixed(1)} ${entry.unit}`;

      milestones.push({
        id: `REC_BREAK_${league}_${entry.category}_${seasonLog.year}_${Math.round(candidateVal * 10)}`,
        year: seasonLog.year,
        age: seasonLog.age,
        title: `${leagueShort} 역대 ${entry.label} 신기록`,
        description: wasSamePlayer
          ? `본인의 종전 기록(${formattedPrev})을 넘어 ${formattedNew}로 리그 역대 기록을 다시 경신했습니다.`
          : `${previousHolder}의 종전 기록(${formattedPrev})을 경신하고 ${formattedNew}로 역대 1위에 올랐습니다.`,
        type: 'RECORD',
        teamName: seasonLog.teamName,
      });
    }
  }

  return {
    nextBook: {
      ...normalized,
      [league]: entries,
    },
    brokenRecords,
    milestones,
  };
}

/**
 * 현재 선수가 소속 리그의 역대 기록을 얼마나 추격 중인지 계산
 */
export function getLeagueRecordChases(
  recordBook: RecordBookState,
  career: CareerState,
  targetLeague?: LeagueId
): LeagueRecordChase[] {
  const league = targetLeague || career.league;
  const normalized = normalizeRecordBook(recordBook);
  const agg = aggregateLeagueCareerStats(career, league);

  const currentMap: Record<LeagueRecordCategory, number> = {
    CAREER_POINTS: agg.points,
    SINGLE_GAME_POINTS: agg.singleGameHighPts,
    SEASON_PPG: agg.bestPpg,
    SEASON_RPG: agg.bestRpg,
    SEASON_APG: agg.bestApg,
    CHAMPIONSHIPS: agg.championships,
    MVPS: agg.mvps,
    FINALS_MVPS: agg.finalsMvps,
  };

  return normalized[league].map((entry) => {
    const currentValue = currentMap[entry.category] || 0;
    const remaining = Math.max(0, Number((entry.value - currentValue).toFixed(1)));
    const progressPct =
      entry.value > 0
        ? Math.min(100, Math.round((currentValue / entry.value) * 100))
        : 0;
    const isAlreadyHolder = entry.isUserRecord && entry.playerId === career.id;

    return {
      entry,
      currentValue,
      remaining,
      progressPct,
      isAlreadyHolder,
    };
  });
}

function applyCandidateMapToLeagueEntries(
  entries: LeagueRecordEntry[],
  updates: Partial<Record<LeagueRecordCategory, number>>,
  meta: {
    holderName: string;
    teamName: string;
    year: number;
    playerId: string;
  }
): LeagueRecordEntry[] {
  return entries.map((entry) => {
    const val = updates[entry.category];
    if (typeof val === 'number' && val > entry.value) {
      return {
        ...entry,
        value: val,
        holderName: meta.holderName,
        teamName: meta.teamName,
        year: meta.year,
        isUserRecord: true,
        playerId: meta.playerId,
      };
    }
    return entry;
  });
}

/**
 * 구 세이브의 HOF 리스트와 현재 커리어를 RecordBook과 동기화
 * - retrospective.seasons가 있는 HOF 엔트리는 9개 전 리그를 시즌 순서대로 정확히 재생하여
 *   리그별 단일경기 최다 득점·최소 출장 수 충족 평균 기록·통산 기록 달성 연도/구단을 정밀 반영합니다.
 * - 구 세이브(retrospective.seasons 없음)는 타 리그 단일경기 기록이 NBA로 오기입되지 않도록
 *   leagueCareerHighPts 또는 순수 NBA 커리어일 때만 NBA 단일경기 최다 득점을 반영합니다.
 */
export function syncRecordBookWithHof(
  recordBook: RecordBookState | null | undefined,
  hofList: HallOfFameEntry[],
  activeCareer?: CareerState | null
): RecordBookState {
  let nextBook = normalizeRecordBook(recordBook);

  for (const hof of hofList) {
    const retroSeasons = hof.retrospective?.seasons;
    if (Array.isArray(retroSeasons) && retroSeasons.length > 0) {
      const leagueAcc: Partial<
        Record<
          LeagueId,
          { points: number; championships: number; mvps: number; finalsMvps: number }
        >
      > = {};

      for (const s of retroSeasons) {
        const league = s.league;
        if (!nextBook[league]) continue;
        const acc = leagueAcc[league] || {
          points: 0,
          championships: 0,
          mvps: 0,
          finalsMvps: 0,
        };
        acc.points += Math.round(s.ppg * s.gp);
        if (s.wonChampionship) acc.championships += 1;
        if (s.wonMvp) acc.mvps += 1;
        if (s.wonFinalsMvp) acc.finalsMvps += 1;
        leagueAcc[league] = acc;

        const minGp = getMinGpForSeasonRecord(league);
        const updates: Partial<Record<LeagueRecordCategory, number>> = {
          CAREER_POINTS: acc.points,
          SINGLE_GAME_POINTS: s.singleGameHighPts,
          SEASON_PPG: s.gp >= minGp ? Number(s.ppg.toFixed(1)) : 0,
          SEASON_RPG: s.gp >= minGp ? Number(s.rpg.toFixed(1)) : 0,
          SEASON_APG: s.gp >= minGp ? Number(s.apg.toFixed(1)) : 0,
          CHAMPIONSHIPS: acc.championships,
          MVPS: acc.mvps,
          FINALS_MVPS: acc.finalsMvps,
        };

        nextBook = {
          ...nextBook,
          [league]: applyCandidateMapToLeagueEntries(nextBook[league], updates, {
            holderName: hof.name,
            teamName: s.teamName,
            year: s.year,
            playerId: hof.id,
          }),
        };
      }
      continue;
    }

    // 구 세이브 폴백 (retrospective.seasons 부재 시)
    const fallbackYear =
      hof.finalSeasonYear ?? 2026 + Math.max(0, hof.seasonsPlayed);
    const nbaFinalsMvps =
      typeof hof.totals.nbaFinalsMvps === 'number'
        ? hof.totals.nbaFinalsMvps
        : hof.iconicTeam.league === 'NBA'
        ? hof.totals.finalsMvps || 0
        : 0;
    const kblFinalsMvps =
      typeof hof.totals.kblFinalsMvps === 'number'
        ? hof.totals.kblFinalsMvps
        : hof.iconicTeam.league === 'KBL'
        ? hof.totals.finalsMvps || 0
        : 0;

    const nbaUpdates: Partial<Record<LeagueRecordCategory, number>> = {
      CAREER_POINTS: hof.totals.nbaPoints,
      CHAMPIONSHIPS: hof.totals.nbaChampionships,
      MVPS: hof.totals.nbaMvps,
      FINALS_MVPS: nbaFinalsMvps,
    };
    const isPureNbaCareer =
      hof.totals.nbaGp > 0 && hof.totals.nbaGp === hof.totals.gp;
    if (typeof hof.leagueCareerHighPts?.NBA === 'number') {
      nbaUpdates.SINGLE_GAME_POINTS = hof.leagueCareerHighPts.NBA;
    } else if (isPureNbaCareer) {
      nbaUpdates.SINGLE_GAME_POINTS = hof.careerHighPts;
    }

    nextBook = {
      ...nextBook,
      NBA: applyCandidateMapToLeagueEntries(nextBook.NBA, nbaUpdates, {
        holderName: hof.name,
        teamName: hof.iconicTeam.name,
        year: fallbackYear,
        playerId: hof.id,
      }),
    };

    const kblUpdates: Partial<Record<LeagueRecordCategory, number>> = {
      CHAMPIONSHIPS: hof.totals.kblChampionships ?? 0,
      MVPS: hof.totals.kblMvps ?? 0,
      FINALS_MVPS: kblFinalsMvps,
    };
    if (typeof hof.leagueCareerHighPts?.KBL === 'number') {
      kblUpdates.SINGLE_GAME_POINTS = hof.leagueCareerHighPts.KBL;
    }

    nextBook = {
      ...nextBook,
      KBL: applyCandidateMapToLeagueEntries(nextBook.KBL, kblUpdates, {
        holderName: hof.name,
        teamName: hof.iconicTeam.name,
        year: fallbackYear,
        playerId: hof.id,
      }),
    };

    if (hof.leagueCareerHighPts) {
      for (const league of ALL_LEAGUE_IDS) {
        if (league === 'NBA' || league === 'KBL') continue;
        const leagueHigh = hof.leagueCareerHighPts[league];
        if (typeof leagueHigh === 'number' && leagueHigh > 0) {
          nextBook = {
            ...nextBook,
            [league]: applyCandidateMapToLeagueEntries(
              nextBook[league],
              { SINGLE_GAME_POINTS: leagueHigh },
              {
                holderName: hof.name,
                teamName: hof.iconicTeam.name,
                year: fallbackYear,
                playerId: hof.id,
              }
            ),
          };
        }
      }
    }
  }

  // 활성 커리어 역시 시즌 순서대로 누적 재생해 통산 신기록 달성 연도·구단을 정확히 기록
  if (activeCareer && activeCareer.seasonLogs.length > 0) {
    for (let idx = 0; idx < activeCareer.seasonLogs.length; idx++) {
      const log = activeCareer.seasonLogs[idx];
      const slicedCareer: CareerState = {
        ...activeCareer,
        seasonLogs: activeCareer.seasonLogs.slice(0, idx + 1),
      };
      const res = checkAndApplyRecordBreaks(nextBook, slicedCareer, log);
      nextBook = res.nextBook;
    }
  }

  return nextBook;
}

/**
 * 명예의 전당 도감(수집률, 티어별 달성, 영구결번 구단, 신기록 보유 수) 집계
 */
export function buildHofCompendium(
  hofList: HallOfFameEntry[],
  recordBook: RecordBookState
): HofCompendiumSummary {
  const tiersUnlocked: Record<LegacyTierId, number> = {
    GOAT: 0,
    FIRST_BALLOT_HOF: 0,
    NBA_ALL_STAR: 0,
    NBA_VETERAN: 0,
    ASIA_KBL_LEGEND: 0,
    PRO_VETERAN: 0,
    COURT_CHALLENGER: 0,
  };

  const posSet = new Set<string>();
  const retiredTeamSet = new Set<string>();
  let retiredJerseysCount = 0;

  for (const entry of hofList) {
    tiersUnlocked[entry.legacyTierId] =
      (tiersUnlocked[entry.legacyTierId] || 0) + 1;
    posSet.add(entry.primaryPos);
    if (entry.jerseyRetired) {
      retiredJerseysCount += 1;
      retiredTeamSet.add(entry.iconicTeam.name);
    }
  }

  const normalized = normalizeRecordBook(recordBook);
  let userBrokenRecordsCount = 0;
  let totalRecordSlots = 0;
  for (const league of ALL_LEAGUE_IDS) {
    for (const rec of normalized[league]) {
      totalRecordSlots += 1;
      if (rec.isUserRecord) userBrokenRecordsCount += 1;
    }
  }

  const unlockedTierCount = Object.values(tiersUnlocked).filter((c) => c > 0).length;

  return {
    totalInductees: hofList.length,
    bestFiveFilled: posSet.size,
    retiredJerseysCount,
    retiredTeams: Array.from(retiredTeamSet),
    userBrokenRecordsCount,
    totalRecordSlots,
    tiersUnlocked,
    unlockedTierCount,
    totalTiers: LEGACY_TIER_CATALOG.length,
  };
}
