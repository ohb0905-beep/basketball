import { LEAGUE_CONFIG } from '../data/leagues';
import { CareerState, SeasonBoxScore } from '../types/game';

export type ReactionTone = 'HYPE' | 'EXPECT' | 'SHOCK' | 'CRITIC';

export interface FanComment {
  id: string;
  initial: string;
  nickname: string;
  tone: ReactionTone;
  toneLabel: string;
  text: string;
  baseLikes: number;
  timeAgo: string;
}

export interface SeasonReactionBundle {
  outlet: string;
  headline: string;
  summary: string;
  comments: FanComment[];
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pick<T>(arr: T[], seed: number, offset = 0): T {
  return arr[(seed + offset) % arr.length];
}

const OUTLETS_BY_LEAGUE: Record<string, string[]> = {
  NBA: ['ESPN 코리아', '디 애슬레틱', '바스켓볼 데일리'],
  GLEAGUE: ['G리그 인사이더', '스카우팅 리포트'],
  NCAA: ['NCAA 매드니스 데일리', '드래프트 익스프레스'],
  KBL: ['점프볼', '바스켓코리아', '루키 더 바스켓'],
  OVERSEAS: ['유로훕스 코리아', '글로벌 바스켓'],
  U_LEAGUE: ['대학농구 저널', '점프볼 캠퍼스'],
  HIGH_SCHOOL: ['유망주 스카우트', '고교농구 리포트'],
};

const FAN_NICKNAMES = [
  { initial: '민', name: '코트매니아' },
  { initial: '준', name: '클러치타임' },
  { initial: '현', name: '박스스코어러' },
  { initial: '서', name: '3점라인밖' },
  { initial: '태', name: '슬램덩커' },
  { initial: '지', name: '픽앤롤장인' },
  { initial: '우', name: '림프로텍터' },
  { initial: '도', name: '스카우트노트' },
  { initial: '하', name: '버저비터' },
  { initial: '성', name: '풀코트프레스' },
];

export function buildSeasonReactionFeed(
  career: CareerState,
  season: SeasonBoxScore
): SeasonReactionBundle {
  const seed = hashSeed(
    `${career.name}-${season.year}-${season.teamName}-${season.ppg.toFixed(1)}-${season.wins}`
  );
  const leagueShort = LEAGUE_CONFIG[season.league]?.shortName || season.league;
  const outlets = OUTLETS_BY_LEAGUE[season.league] || ['바스켓볼 데일리'];
  const outlet = pick(outlets, seed, 1);

  const winPct =
    season.wins + season.losses > 0
      ? season.wins / (season.wins + season.losses)
      : 0.5;
  const isChampion = Boolean(season.wonChampionship);
  const isMvp = Boolean(season.wonMvp);
  const isRoy = Boolean(season.wonRookieOfYear);
  const isAllStar = Boolean(season.allStarSelected);
  const isScoringExplosion = season.ppg >= 24;
  const isInjuredHeavy = season.injuredGamesMissed >= 10;
  const isBenchRole = season.mpg < 18;
  const isSlump = season.fgPct < 41 && season.mpg >= 20;

  const summary = `${season.teamName} · ${season.wins}승 ${season.losses}패 · ${season.ppg.toFixed(1)}득점 ${season.rpg.toFixed(1)}리바 ${season.apg.toFixed(1)}도움`;

  const comments: FanComment[] = [];
  const usedIdx = new Set<number>();
  const takeNick = (offset: number) => {
    let idx = (seed + offset * 3) % FAN_NICKNAMES.length;
    while (usedIdx.has(idx)) {
      idx = (idx + 1) % FAN_NICKNAMES.length;
    }
    usedIdx.add(idx);
    return FAN_NICKNAMES[idx];
  };

  // Comment 1: Primary achievement / performance
  const n1 = takeNick(1);
  if (isChampion && isMvp) {
    comments.push({
      id: `${season.year}-c1`,
      initial: n1.initial,
      nickname: n1.name,
      tone: 'HYPE',
      toneLabel: '열광',
      text: `MVP에 우승까지 다 쓸어버렸네. ${season.year}년은 그냥 ${career.name}의 해다.`,
      baseLikes: 84 + (seed % 70),
      timeAgo: '방금 전',
    });
  } else if (isChampion) {
    comments.push({
      id: `${season.year}-c1`,
      initial: n1.initial,
      nickname: n1.name,
      tone: 'HYPE',
      toneLabel: '열광',
      text: `${season.teamName} 우승 진짜 미쳤다. 마지막까지 집중력 안 놓은 ${career.name}이 다 했다.`,
      baseLikes: 62 + (seed % 58),
      timeAgo: '방금 전',
    });
  } else if (isMvp) {
    comments.push({
      id: `${season.year}-c1`,
      initial: n1.initial,
      nickname: n1.name,
      tone: 'HYPE',
      toneLabel: '열광',
      text: `평균 ${season.ppg.toFixed(1)}점에 팀 ${season.wins}승 이끌었으면 만장일치 MVP급이지.`,
      baseLikes: 54 + (seed % 46),
      timeAgo: '2분 전',
    });
  } else if (isRoy) {
    comments.push({
      id: `${season.year}-c1`,
      initial: n1.initial,
      nickname: n1.name,
      tone: 'HYPE',
      toneLabel: '열광',
      text: `신인왕 축하! 첫 시즌부터 ${season.ppg.toFixed(1)}점 박는 거 보면 천장 자체가 다르다.`,
      baseLikes: 41 + (seed % 34),
      timeAgo: '3분 전',
    });
  } else if (isScoringExplosion) {
    comments.push({
      id: `${season.year}-c1`,
      initial: n1.initial,
      nickname: n1.name,
      tone: 'HYPE',
      toneLabel: '열광',
      text: `${leagueShort}에서 경기당 ${season.ppg.toFixed(1)}점이 말이 되나. 상대 수비가 아예 못 막네.`,
      baseLikes: 38 + (seed % 32),
      timeAgo: '4분 전',
    });
  } else if (isBenchRole) {
    comments.push({
      id: `${season.year}-c1`,
      initial: n1.initial,
      nickname: n1.name,
      tone: 'EXPECT',
      toneLabel: '기대',
      text: `출전 시간 ${season.mpg.toFixed(1)}분밖에 못 받았는데 투입될 때마다 에너지가 확실히 다름.`,
      baseLikes: 14 + (seed % 18),
      timeAgo: '5분 전',
    });
  } else {
    comments.push({
      id: `${season.year}-c1`,
      initial: n1.initial,
      nickname: n1.name,
      tone: 'EXPECT',
      toneLabel: '기대',
      text: `${season.ppg.toFixed(1)}점 ${season.rpg.toFixed(1)}리바 ${season.apg.toFixed(1)}도움이면 팀 핵심 맞지. 다음 시즌 더 터질 듯.`,
      baseLikes: 21 + (seed % 24),
      timeAgo: '3분 전',
    });
  }

  // Comment 2: Context-driven (injury / efficiency / career high / all-star)
  const n2 = takeNick(2);
  if (isInjuredHeavy) {
    comments.push({
      id: `${season.year}-c2`,
      initial: n2.initial,
      nickname: n2.name,
      tone: 'SHOCK',
      toneLabel: '우려',
      text: `${season.injuredGamesMissed}경기 결장만 아니었어도 팀 성적 훨씬 높았을 텐데... 비시즌 몸 관리 꼭 챙기자.`,
      baseLikes: 19 + (seed % 22),
      timeAgo: '11분 전',
    });
  } else if (season.singleGameHighPts >= 40) {
    comments.push({
      id: `${season.year}-c2`,
      initial: n2.initial,
      nickname: n2.name,
      tone: 'SHOCK',
      toneLabel: '충격',
      text: `한 경기 ${season.singleGameHighPts}점 폭발했을 때 직관했는데 아직도 소름 돋는다.`,
      baseLikes: 33 + (seed % 29),
      timeAgo: '9분 전',
    });
  } else if (isSlump) {
    comments.push({
      id: `${season.year}-c2`,
      initial: n2.initial,
      nickname: n2.name,
      tone: 'CRITIC',
      toneLabel: '비판',
      text: `야투율 ${season.fgPct.toFixed(1)}%는 좀 아쉽다. 무리한 슛 셀렉션만 줄여도 효율 확 오를 텐데.`,
      baseLikes: 16 + (seed % 19),
      timeAgo: '14분 전',
    });
  } else if (isAllStar) {
    comments.push({
      id: `${season.year}-c2`,
      initial: n2.initial,
      nickname: n2.name,
      tone: 'HYPE',
      toneLabel: '열광',
      text: `올스타 선정 당연한 결과지. 야투율 ${season.fgPct.toFixed(1)}%로 이 볼륨 뽑는 선수가 몇 명이나 되냐.`,
      baseLikes: 28 + (seed % 26),
      timeAgo: '8분 전',
    });
  } else {
    comments.push({
      id: `${season.year}-c2`,
      initial: n2.initial,
      nickname: n2.name,
      tone: 'EXPECT',
      toneLabel: '기대',
      text: `3점 ${season.tpPct.toFixed(1)}%에 야투 ${season.fgPct.toFixed(1)}%면 밸런스 깔끔하네. 한 단계만 더 올라가자.`,
      baseLikes: 15 + (seed % 17),
      timeAgo: '12분 전',
    });
  }

  // Comment 3: Team result / future outlook
  const n3 = takeNick(3);
  if (winPct >= 0.65 && !isChampion) {
    comments.push({
      id: `${season.year}-c3`,
      initial: n3.initial,
      nickname: n3.name,
      tone: 'CRITIC',
      toneLabel: '아쉬움',
      text: `정규 ${season.teamRank}위 찍고 우승 못 한 건 아쉽지만 내년엔 진짜 반지 끼자.`,
      baseLikes: 22 + (seed % 20),
      timeAgo: '19분 전',
    });
  } else if (winPct < 0.4) {
    comments.push({
      id: `${season.year}-c3`,
      initial: n3.initial,
      nickname: n3.name,
      tone: 'CRITIC',
      toneLabel: '비판',
      text: `팀 성적 ${season.wins}승 ${season.losses}패 실화냐... 프런트 보강 안 하면 ${career.name} 이적해도 할 말 없다.`,
      baseLikes: 25 + (seed % 23),
      timeAgo: '24분 전',
    });
  } else if (season.league === 'HIGH_SCHOOL' || season.league === 'U_LEAGUE' || season.league === 'NCAA') {
    comments.push({
      id: `${season.year}-c3`,
      initial: n3.initial,
      nickname: n3.name,
      tone: 'EXPECT',
      toneLabel: '기대',
      text: `프로 스카우트들 벌써 줄 서겠네. 드래프트 나오면 상위권 지명 유력해 보인다.`,
      baseLikes: 18 + (seed % 21),
      timeAgo: '27분 전',
    });
  } else {
    comments.push({
      id: `${season.year}-c3`,
      initial: n3.initial,
      nickname: n3.name,
      tone: 'EXPECT',
      toneLabel: '기대',
      text: `다음 오프시즌 행보가 제일 궁금하다. ${season.teamName} 잔류할지 새 도전할지 지켜보자.`,
      baseLikes: 12 + (seed % 16),
      timeAgo: '31분 전',
    });
  }

  return {
    outlet,
    headline: season.headline,
    summary,
    comments,
  };
}
