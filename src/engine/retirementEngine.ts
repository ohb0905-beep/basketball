import {
  CareerState,
  HallOfFameEntry,
  LegacyEvaluation,
  LegacyTierId,
  PlayerStats,
  RetirementReason,
  StatDelta,
  TeamInfo,
} from '../types/game';
import { getTeamById } from '../data/teams';

/**
 * 5. 나이에 따른 에이징 커브 (매 시즌 결산 시 자동 차감)
 * - 30~32세 (베테랑기): 매년 PHY -1 ~ -2 감소 (단, 노련미로 PLY +1 보정 가능)
 * - 33~35세 (노쇠화 진행): 매년 PHY -3 ~ -5, INS/DEF/REB -1 ~ -3 감소
 * - 36~39세 (황혼기): 매년 전 스탯 -3 ~ -6 급감
 */
export function applyAgingCurve(
  age: number,
  prev: PlayerStats,
  rng: () => number = Math.random
): { nextStats: PlayerStats; delta: StatDelta } {
  const randInt = (min: number, max: number) =>
    Math.floor(rng() * (max - min + 1)) + min;
  const clamp = (v: number) => Math.max(35, Math.min(99, v));

  const nextStats: PlayerStats = { ...prev };
  const delta: StatDelta = { ins: 0, out: 0, ply: 0, def: 0, reb: 0, phy: 0 };

  if (age >= 30 && age <= 32) {
    const phyDrop = -randInt(1, 2);
    const plyBoost = rng() < 0.75 ? 1 : 0;
    nextStats.phy = clamp(prev.phy + phyDrop);
    nextStats.ply = clamp(prev.ply + plyBoost);
    delta.phy = nextStats.phy - prev.phy;
    delta.ply = nextStats.ply - prev.ply;
  } else if (age >= 33 && age <= 35) {
    const phyDrop = -randInt(3, 5);
    const insDrop = -randInt(1, 3);
    const defDrop = -randInt(1, 3);
    const rebDrop = -randInt(1, 3);
    const outDrop = rng() < 0.35 ? -1 : 0;

    nextStats.phy = clamp(prev.phy + phyDrop);
    nextStats.ins = clamp(prev.ins + insDrop);
    nextStats.def = clamp(prev.def + defDrop);
    nextStats.reb = clamp(prev.reb + rebDrop);
    nextStats.out = clamp(prev.out + outDrop);

    delta.phy = nextStats.phy - prev.phy;
    delta.ins = nextStats.ins - prev.ins;
    delta.def = nextStats.def - prev.def;
    delta.reb = nextStats.reb - prev.reb;
    delta.out = nextStats.out - prev.out;
  } else if (age >= 36) {
    const keys: (keyof PlayerStats)[] = ['ins', 'out', 'ply', 'def', 'reb', 'phy'];
    for (const k of keys) {
      const drop = -randInt(3, 6);
      nextStats[k] = clamp(prev[k] + drop);
      delta[k] = nextStats[k] - prev[k];
    }
  }

  return { nextStats, delta };
}

/**
 * 5대 은퇴 조건 중 시즌 직후 체크:
 * ① 자율 명예 은퇴 가능 여부 (만 31세 이상 또는 통산 10시즌 이상)
 * ② 레전드 은퇴 투어 선언 가능 여부 (만 34세 이상 & 우승 1회 이상 또는 올스타 3회 이상 또는 MVP 1회 이상)
 * ③ 방출 및 구단 오퍼 부재 (만 32세 이상 & NBA OVR < 73 / KBL·타리그 OVR < 58)
 * ⑤ 만 40세 정년 은퇴
 */
export function checkRetirementEligibility(career: CareerState): {
  canRetireVoluntarily: boolean;
  canDeclareFarewellTour: boolean;
  isOutOfLeague: boolean;
  isMandatoryAge40: boolean;
} {
  const canRetireVoluntarily = career.age >= 31 || career.seasonsPlayed >= 10;

  const hasLegendResume =
    career.totals.championships >= 1 ||
    career.totals.allStars >= 3 ||
    career.totals.mvps >= 1;

  const canDeclareFarewellTour =
    career.age >= 34 &&
    hasLegendResume &&
    !career.isFarewellTour &&
    !career.farewellTourCompleted;

  const isOutOfLeague =
    career.age >= 32 &&
    ((career.league === 'NBA' && career.ovr < 73) ||
      (career.league !== 'NBA' && career.ovr < 58));

  const isMandatoryAge40 = career.age >= 40;

  return {
    canRetireVoluntarily,
    canDeclareFarewellTour,
    isOutOfLeague,
    isMandatoryAge40,
  };
}

/**
 * 구단 영구결번(Jersey Retirement) 헌액 & 6단계 레거시 등급 심사
 */
export function evaluateCareerLegacy(career: CareerState): LegacyEvaluation {
  // 구단별 누적 기록 집계하여 가장 큰 족적을 남긴 구단 선정
  const teamMap = new Map<
    string,
    {
      teamId: string;
      seasons: number;
      points: number;
      championships: number;
      mvps: number;
      allStars: number;
      impactScore: number;
    }
  >();

  for (const log of career.seasonLogs) {
    const prev = teamMap.get(log.teamId) || {
      teamId: log.teamId,
      seasons: 0,
      points: 0,
      championships: 0,
      mvps: 0,
      allStars: 0,
      impactScore: 0,
    };
    const seasonPts = Math.round(log.ppg * log.gp);
    const leagueBonus = log.league === 'NBA' ? 1.5 : 1.0;

    prev.seasons += 1;
    prev.points += seasonPts;
    if (log.wonChampionship) prev.championships += 1;
    if (log.wonMvp) prev.mvps += 1;
    if (log.allStarSelected) prev.allStars += 1;
    prev.impactScore +=
      (seasonPts * 0.1 +
        (log.wonChampionship ? 300 : 0) +
        (log.wonMvp ? 400 : 0) +
        (log.allStarSelected ? 120 : 0)) *
      leagueBonus;

    teamMap.set(log.teamId, prev);
  }

  let honoredTeam: TeamInfo = career.team;
  let honoredTeamSeasons = Math.max(1, career.seasonLogs.length);
  let honoredTeamPoints = career.totals.points;
  let bestTeamRecord = {
    championships: career.totals.championships,
    mvps: career.totals.mvps,
    allStars: career.totals.allStars,
  };

  if (teamMap.size > 0) {
    const sorted = Array.from(teamMap.values()).sort(
      (a, b) => b.impactScore - a.impactScore
    );
    const top = sorted[0];
    const foundTeam = getTeamById(top.teamId);
    if (foundTeam) {
      honoredTeam = foundTeam;
    }
    honoredTeamSeasons = top.seasons;
    honoredTeamPoints = top.points;
    bestTeamRecord = {
      championships: top.championships,
      mvps: top.mvps,
      allStars: top.allStars,
    };
  }

  // 영구결번 조건: 가장 큰 족적을 남긴 구단에서 (우승 + 올스타 2회 이상) 또는 MVP 수상, 혹은 통산 12,000득점 이상
  const jerseyRetired =
    (bestTeamRecord.championships >= 1 && bestTeamRecord.allStars >= 2) ||
    career.totals.mvps >= 1 ||
    career.totals.points >= 12000;

  // 레거시 점수 계산
  const legacyScore = Math.round(
    career.totals.points * 0.12 +
      career.totals.nbaPoints * 0.18 +
      career.totals.rebounds * 0.08 +
      career.totals.assists * 0.12 +
      career.totals.nbaChampionships * 850 +
      (career.totals.championships - career.totals.nbaChampionships) * 280 +
      career.totals.nbaMvps * 1100 +
      (career.totals.mvps - career.totals.nbaMvps) * 320 +
      career.totals.nbaAllStars * 320 +
      (career.totals.allStars - career.totals.nbaAllStars) * 110 +
      career.peakOvr * 15
  );

  let tierId: LegacyTierId = 'COURT_CHALLENGER';
  let tierTitle = '🌱 코트의 도전자';
  let tierEmoji = '🌱';
  let summaryComment =
    '비록 화려한 스포트라이트는 짧았지만, 벤치 끝자리에서 흘린 땀방울만큼은 누구보다 진실했어요.';

  if (
    (career.totals.nbaMvps >= 2 && career.totals.nbaChampionships >= 2) ||
    legacyScore >= 9500
  ) {
    tierId = 'GOAT';
    tierTitle = '🐐 GOAT (역대 최고 농구 황제)';
    tierEmoji = '🐐';
    summaryComment =
      '농구 역사의 모든 페이지를 새로 써 내려간 위대한 전설이에요! 당신의 이름은 영원히 코트 위에 살아 숨 쉴 거예요.';
  } else if (
    career.totals.nbaMvps >= 1 ||
    career.totals.nbaChampionships >= 2 ||
    career.totals.nbaAllStars >= 5 ||
    legacyScore >= 5800
  ) {
    tierId = 'FIRST_BALLOT_HOF';
    tierTitle = '🏛️ 네이스미스 명예의 전당 퍼스트 발롯';
    tierEmoji = '🏛️';
    summaryComment =
      '세계 최고의 무대 NBA를 지배하며 시대를 풍미한 슈퍼스타예요! 첫 투표 만에 만장일치급으로 명예의 전당에 헌액되었어요.';
  } else if (
    career.totals.nbaAllStars >= 1 ||
    career.totals.nbaPoints >= 4500 ||
    career.totals.nbaGp >= 250
  ) {
    tierId = 'NBA_ALL_STAR';
    tierTitle = '⭐ 자랑스러운 NBA 올스타 & 리거';
    tierEmoji = '⭐';
    summaryComment =
      '바늘구멍 같은 NBA 무대에서 당당히 살아남아 세계 최정상 선수들과 어깨를 나란히 한 자랑스러운 커리어예요!';
  } else if (
    career.totals.championships >= 2 ||
    career.totals.mvps >= 1 ||
    career.totals.points >= 6500 ||
    legacyScore >= 2600
  ) {
    tierId = 'ASIA_KBL_LEGEND';
    tierTitle = '👑 KBL & 아시아 올타임 레전드';
    tierEmoji = '👑';
    summaryComment =
      '한국과 아시아 농구 코트를 평정하며 수많은 팬들에게 잊지 못할 명승부를 선물한 불멸의 레전드예요!';
  } else if (career.seasonsPlayed >= 6 || career.totals.points >= 2200) {
    tierId = 'PRO_VETERAN';
    tierTitle = '💼 든든한 프로 베테랑';
    tierEmoji = '💼';
    summaryComment =
      '오랜 세월 프로 코트를 누비며 팀의 소금 같은 역할을 해낸 모범적인 베테랑 선수로 기억될 거예요.';
  }

  return {
    tierId,
    tierTitle,
    tierEmoji,
    legacyScore,
    summaryComment,
    jerseyRetired,
    honoredTeam,
    honoredTeamSeasons,
    honoredTeamPoints,
  };
}

export function buildHallOfFameEntry(
  career: CareerState,
  reason: RetirementReason,
  evaluation: LegacyEvaluation
): HallOfFameEntry {
  const gp = Math.max(1, career.totals.gp);
  return {
    id: `HOF_${career.id}_${Date.now()}`,
    inductedAt: new Date().toISOString(),
    name: career.name,
    jerseyNumber: career.jerseyNumber,
    heightCm: career.heightCm,
    primaryPos: career.primaryPos,
    secondaryPos: career.secondaryPos,
    peakOvr: career.peakOvr,
    finalAge: career.age,
    seasonsPlayed: career.seasonsPlayed,
    retirementReason: reason,
    legacyTierId: evaluation.tierId,
    legacyTitle: evaluation.tierTitle,
    legacyEmoji: evaluation.tierEmoji,
    legacyScore: evaluation.legacyScore,
    jerseyRetired: evaluation.jerseyRetired,
    iconicTeam: evaluation.honoredTeam,
    totals: {
      gp: career.totals.gp,
      points: career.totals.points,
      rebounds: career.totals.rebounds,
      assists: career.totals.assists,
      nbaGp: career.totals.nbaGp,
      nbaPoints: career.totals.nbaPoints,
      championships: career.totals.championships,
      nbaChampionships: career.totals.nbaChampionships,
      mvps: career.totals.mvps,
      nbaMvps: career.totals.nbaMvps,
      allStars: career.totals.allStars,
      nbaAllStars: career.totals.nbaAllStars,
    },
    careerAverages: {
      ppg: Number((career.totals.points / gp).toFixed(1)),
      rpg: Number((career.totals.rebounds / gp).toFixed(1)),
      apg: Number((career.totals.assists / gp).toFixed(1)),
    },
    careerHighPts: career.careerHighs.points,
    epitaph: evaluation.summaryComment,
  };
}
