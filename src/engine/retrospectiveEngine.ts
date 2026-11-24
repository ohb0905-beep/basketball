import { LEAGUE_CONFIG } from '../data/leagues';
import { getTeamById } from '../data/teams';
import {
  CareerRetrospective,
  CareerState,
  ChampionshipRecord,
  HallOfFameEntry,
  InternationalTournamentRecord,
  LeagueId,
  LegacyEvaluation,
  RecordBookState,
  RetirementReason,
  RetrospectiveBrokenRecord,
  RetrospectiveSeasonPoint,
  SeasonBoxScore,
  TeamStintSummary,
  TrophyCabinetEntry,
  TrophyCabinetItem,
} from '../types/game';

export const RETIREMENT_REASON_LABELS: Record<RetirementReason, string> = {
  VOLUNTARY_HONOR: '명예 은퇴',
  LEGEND_FAREWELL_TOUR: '고별 투어 완주 은퇴',
  OUT_OF_LEAGUE: '현역 커리어 마감',
  CRITICAL_INJURY: '부상 극복 후 은퇴',
  AGE_40_MANDATORY: '베테랑 정년 은퇴',
};

const LEAGUE_PRESTIGE_WEIGHT: Record<LeagueId, number> = {
  NBA: 1.55,
  EUROLEAGUE: 1.25,
  NBL: 1.1,
  B_LEAGUE: 1.05,
  KBL: 1.05,
  GLEAGUE: 0.95,
  NCAA: 0.85,
  U_LEAGUE: 0.72,
  HIGH_SCHOOL: 0.6,
};

/**
 * 연속 소속 구단 구간(Team Stints) 집계
 * - 동일 구단(teamId)에서 연속으로 뛴 시즌들을 하나의 구간으로 묶되,
 *   타 구단 이적 후 친정팀으로 복귀하면 별도의 구간으로 분리해 커리어 이적 여정을 정확히 복원합니다.
 */
export function buildTeamStints(
  seasonLogs: SeasonBoxScore[],
  teamRatingsMap?: Record<string, number>
): TeamStintSummary[] {
  if (!seasonLogs || seasonLogs.length === 0) return [];

  const stints: TeamStintSummary[] = [];

  interface Accumulator {
    teamId: string;
    teamName: string;
    teamShortName: string;
    league: LeagueId;
    startYear: number;
    endYear: number;
    seasons: number;
    gp: number;
    weightedPts: number;
    weightedReb: number;
    weightedAst: number;
    peakOvr: number;
    championships: number;
    mvps: number;
    finalsMvps: number;
    allStars: number;
  }

  let current: Accumulator | null = null;

  const flush = (acc: Accumulator) => {
    const teamObj = getTeamById(acc.teamId, teamRatingsMap);
    const denom = Math.max(1, acc.gp);
    stints.push({
      id: `STINT_${stints.length + 1}_${acc.teamId}_${acc.startYear}`,
      teamId: acc.teamId,
      teamName: acc.teamName,
      teamShortName: acc.teamShortName,
      league: acc.league,
      leagueShortName: LEAGUE_CONFIG[acc.league]?.shortName || acc.league,
      primaryColor: teamObj?.primaryColor || '#191f28',
      secondaryColor: teamObj?.secondaryColor || '#f2f4f6',
      logoUrl: teamObj?.logoUrl,
      startYear: acc.startYear,
      endYear: acc.endYear,
      seasons: acc.seasons,
      gp: acc.gp,
      avgPpg: Number((acc.weightedPts / denom).toFixed(1)),
      avgRpg: Number((acc.weightedReb / denom).toFixed(1)),
      avgApg: Number((acc.weightedAst / denom).toFixed(1)),
      peakOvr: acc.peakOvr,
      championships: acc.championships,
      mvps: acc.mvps,
      finalsMvps: acc.finalsMvps,
      allStars: acc.allStars,
      isMilitaryTeam: teamObj?.isMilitaryTeam,
    });
  };

  for (const log of seasonLogs) {
    if (current && current.teamId === log.teamId && current.league === log.league) {
      current.endYear = log.year;
      current.seasons += 1;
      current.gp += log.gp;
      current.weightedPts += log.ppg * log.gp;
      current.weightedReb += log.rpg * log.gp;
      current.weightedAst += log.apg * log.gp;
      current.peakOvr = Math.max(current.peakOvr, log.ovr);
      if (log.wonChampionship) current.championships += 1;
      if (log.wonMvp) current.mvps += 1;
      if (log.wonFinalsMvp) current.finalsMvps += 1;
      if (log.allStarSelected) current.allStars += 1;
    } else {
      if (current) flush(current);
      current = {
        teamId: log.teamId,
        teamName: log.teamName,
        teamShortName: log.teamShortName,
        league: log.league,
        startYear: log.year,
        endYear: log.year,
        seasons: 1,
        gp: log.gp,
        weightedPts: log.ppg * log.gp,
        weightedReb: log.rpg * log.gp,
        weightedAst: log.apg * log.gp,
        peakOvr: log.ovr,
        championships: log.wonChampionship ? 1 : 0,
        mvps: log.wonMvp ? 1 : 0,
        finalsMvps: log.wonFinalsMvp ? 1 : 0,
        allStars: log.allStarSelected ? 1 : 0,
      };
    }
  }

  if (current) flush(current);

  return stints;
}

export function mapSeasonLogToPoint(log: SeasonBoxScore): RetrospectiveSeasonPoint {
  return {
    seasonNumber: log.seasonNumber,
    year: log.year,
    age: log.age,
    league: log.league,
    leagueShortName: LEAGUE_CONFIG[log.league]?.shortName || log.leagueName,
    teamId: log.teamId,
    teamName: log.teamName,
    teamShortName: log.teamShortName,
    role: log.role,
    ovr: log.ovr,
    gp: log.gp,
    mpg: Number(log.mpg.toFixed(1)),
    ppg: Number(log.ppg.toFixed(1)),
    rpg: Number(log.rpg.toFixed(1)),
    apg: Number(log.apg.toFixed(1)),
    spg: Number(log.spg.toFixed(1)),
    bpg: Number(log.bpg.toFixed(1)),
    fgPct: Number(log.fgPct.toFixed(1)),
    tpPct: Number(log.tpPct.toFixed(1)),
    wins: log.wins,
    losses: log.losses,
    teamRank: log.teamRank ?? 0,
    totalLeagueTeams: log.totalLeagueTeams ?? 0,
    playoffResult: log.playoffResult || '정규시즌 마감',
    wonChampionship: log.wonChampionship,
    wonMvp: log.wonMvp,
    wonFinalsMvp: Boolean(log.wonFinalsMvp),
    wonDpoy: Boolean(log.wonDpoy),
    wonSixthMan: Boolean(log.wonSixthMan),
    wonMip: Boolean(log.wonMip),
    wonRookieOfYear: Boolean(log.wonRookieOfYear),
    allStarSelected: log.allStarSelected,
    allLeagueTeam: log.allLeagueTeam || null,
    singleGameHighPts: log.singleGameHighPts,
    headline: log.headline,
  };
}

/**
 * 인생 최고의 시즌 선정 (리그 위상 + 우승/MVP/파이널 MVP + 개인 생산성 + OVR 가중 평가)
 */
export function selectPeakSeason(
  seasons: RetrospectiveSeasonPoint[]
): RetrospectiveSeasonPoint | null {
  if (!seasons || seasons.length === 0) return null;

  let best = seasons[0];
  let bestScore = -Infinity;

  for (const s of seasons) {
    const prestige = LEAGUE_PRESTIGE_WEIGHT[s.league] || 1.0;
    const rawStatScore =
      s.ppg * 1.45 +
      s.rpg * 0.9 +
      s.apg * 1.15 +
      s.spg * 1.6 +
      s.bpg * 1.6 +
      s.ovr * 0.55;
    const honorBonus =
      (s.wonChampionship ? 20 : 0) +
      (s.wonFinalsMvp ? 18 : 0) +
      (s.wonMvp ? 22 : 0) +
      (s.wonDpoy ? 11 : 0) +
      (s.allLeagueTeam === 1 ? 9 : s.allLeagueTeam === 2 ? 5 : 0) +
      (s.allStarSelected ? 6 : 0);
    const totalScore = (rawStatScore + honorBonus) * prestige;

    if (totalScore > bestScore) {
      bestScore = totalScore;
      best = s;
    }
  }

  return best;
}

/**
 * 우승 연대기 (프로/아마추어 리그 우승 + 국제대회 금메달)
 */
export function buildChampionshipChronicle(
  seasonLogs: SeasonBoxScore[],
  internationalHistory: InternationalTournamentRecord[] = [],
  teamRatingsMap?: Record<string, number>
): { championships: ChampionshipRecord[]; bestPlayoffNote: string | null } {
  const championships: ChampionshipRecord[] = [];

  for (const log of seasonLogs) {
    if (!log.wonChampionship) continue;
    const teamObj = getTeamById(log.teamId, teamRatingsMap);
    const leagueShort = LEAGUE_CONFIG[log.league]?.shortName || log.leagueName;
    championships.push({
      id: `CHAMP_${log.year}_${log.teamId}`,
      year: log.year,
      age: log.age,
      titleLabel: `${leagueShort} 우승`,
      leagueOrTournament: leagueShort,
      teamName: log.teamName,
      teamId: log.teamId,
      league: log.league,
      primaryColor: teamObj?.primaryColor || '#191f28',
      secondaryColor: teamObj?.secondaryColor || '#f2f4f6',
      logoUrl: teamObj?.logoUrl,
      isInternational: false,
      wonFinalsMvp: Boolean(log.wonFinalsMvp),
      statSummary: `${log.ppg.toFixed(1)} PPG · ${log.rpg.toFixed(1)} RPG · ${log.apg.toFixed(1)} APG`,
    });
  }

  for (const intl of internationalHistory) {
    if (intl.result !== 'GOLD') continue;
    championships.push({
      id: `INTL_GOLD_${intl.year}_${intl.tournamentType}`,
      year: intl.year,
      age: intl.age,
      titleLabel: `${intl.tournamentName} 금메달`,
      leagueOrTournament: intl.tournamentName,
      teamName: '대한민국 국가대표',
      teamId: 'KOR_NAT_TEAM',
      primaryColor: '#0047a0',
      secondaryColor: '#cd2e3a',
      logoUrl: '/logos/NAT_KOR.svg',
      isInternational: true,
      wonFinalsMvp: Boolean(intl.wonMvp),
      statSummary: `${(intl.avgPts ?? 0).toFixed(1)} PPG · ${(intl.avgReb ?? 0).toFixed(1)} RPG · ${(intl.avgAst ?? 0).toFixed(1)} APG`,
    });
  }

  championships.sort((a, b) => a.year - b.year);

  let bestPlayoffNote: string | null = null;
  if (championships.length === 0 && seasonLogs.length > 0) {
    const playoffPriority = (res?: string): number => {
      if (!res) return 0;
      if (res.includes('리그 우승')) return 6;
      if (res.includes('준우승')) return 5;
      if (
        res.includes('컨퍼런스 파이널') ||
        res.includes('컨퍼런스 결승') ||
        res.includes('파이널 포') ||
        res.includes('세미파이널') ||
        res.includes('4강')
      ) {
        return 4;
      }
      if (
        res.includes('컨퍼런스 준결승') ||
        res.includes('2R') ||
        res.includes('2라운드') ||
        res.includes('6강') ||
        (res.includes('8강') && !res.includes('1R'))
      ) {
        return 3;
      }
      if (
        res.includes('1R') ||
        res.includes('1라운드') ||
        res.includes('플레이인') ||
        res.includes('PO 진출') ||
        res.includes('플레이오프 진출') ||
        res.includes('토너먼트 진출')
      ) {
        return 2;
      }
      return 1;
    };

    const sorted = [...seasonLogs].sort((a, b) => {
      const pDiff = playoffPriority(b.playoffResult) - playoffPriority(a.playoffResult);
      if (pDiff !== 0) return pDiff;
      const winPctA = a.wins / Math.max(1, a.wins + a.losses);
      const winPctB = b.wins / Math.max(1, b.wins + b.losses);
      return winPctB - winPctA;
    });
    const bestRun = sorted[0];
    if (bestRun) {
      const lgShort = LEAGUE_CONFIG[bestRun.league]?.shortName || bestRun.leagueName;
      bestPlayoffNote = `${bestRun.year}년 ${bestRun.teamName}(${lgShort}) · ${bestRun.playoffResult || '정규시즌 마감'} (${bestRun.wins}승 ${bestRun.losses}패)`;
    }
  }

  return { championships, bestPlayoffNote };
}

/**
 * 트로피 진열장 집계 (각 부문별 개수 + 수상 연도/소속팀 상세)
 */
export function buildTrophyCabinet(
  seasonLogs: SeasonBoxScore[],
  internationalHistory: InternationalTournamentRecord[] = [],
  brokenRecords: RetrospectiveBrokenRecord[] = []
): TrophyCabinetItem[] {
  const pushEntry = (
    map: Record<string, TrophyCabinetEntry[]>,
    key: string,
    entry: TrophyCabinetEntry
  ) => {
    if (!map[key]) map[key] = [];
    map[key].push(entry);
  };

  const buckets: Record<string, TrophyCabinetEntry[]> = {};

  for (const log of seasonLogs) {
    const lg = LEAGUE_CONFIG[log.league]?.shortName || log.leagueName;
    if (log.wonChampionship) {
      pushEntry(buckets, 'CHAMPIONSHIP', {
        year: log.year,
        leagueShortName: lg,
        teamName: log.teamName,
        note: log.wonFinalsMvp ? '파이널 MVP 동시 석권' : undefined,
      });
    }
    if (log.wonFinalsMvp) {
      pushEntry(buckets, 'FINALS_MVP', {
        year: log.year,
        leagueShortName: lg,
        teamName: log.teamName,
      });
    }
    if (log.wonMvp) {
      pushEntry(buckets, 'MVP', {
        year: log.year,
        leagueShortName: lg,
        teamName: log.teamName,
        note: `${log.ppg.toFixed(1)} PPG · ${log.apg.toFixed(1)} APG`,
      });
    }
    if (log.wonDpoy) {
      pushEntry(buckets, 'DPOY', {
        year: log.year,
        leagueShortName: lg,
        teamName: log.teamName,
      });
    }
    if (log.wonSixthMan) {
      pushEntry(buckets, 'SIXTH_MAN', {
        year: log.year,
        leagueShortName: lg,
        teamName: log.teamName,
      });
    }
    if (log.wonMip) {
      pushEntry(buckets, 'MIP', {
        year: log.year,
        leagueShortName: lg,
        teamName: log.teamName,
      });
    }
    if (log.wonRookieOfYear) {
      pushEntry(buckets, 'ROY', {
        year: log.year,
        leagueShortName: lg,
        teamName: log.teamName,
      });
    }
    if (log.allLeagueTeam) {
      pushEntry(buckets, 'ALL_LEAGUE', {
        year: log.year,
        leagueShortName: lg,
        teamName: log.teamName,
        note: `올-리그 ${log.allLeagueTeam}팀`,
      });
    }
    if (log.allStarSelected) {
      pushEntry(buckets, 'ALL_STAR', {
        year: log.year,
        leagueShortName: lg,
        teamName: log.teamName,
      });
    }
  }

  for (const intl of internationalHistory) {
    if (intl.result === 'GOLD' || intl.result === 'SILVER' || intl.result === 'BRONZE') {
      const medalLabel =
        intl.result === 'GOLD' ? '금메달' : intl.result === 'SILVER' ? '은메달' : '동메달';
      pushEntry(buckets, 'INTL_MEDAL', {
        year: intl.year,
        leagueShortName: intl.tournamentName,
        teamName: '대한민국 국가대표',
        note: intl.wonMvp ? `${medalLabel} · 대회 MVP` : medalLabel,
      });
    }
  }

  for (const rec of brokenRecords) {
    pushEntry(buckets, 'LEAGUE_RECORD', {
      year: rec.year,
      leagueShortName: rec.leagueShortName,
      teamName: rec.teamName,
      note: `${rec.label} (${rec.formattedValue})`,
    });
  }

  const catalog: Array<{
    id: string;
    label: string;
    accent: TrophyCabinetItem['accent'];
  }> = [
    { id: 'CHAMPIONSHIP', label: '리그 우승', accent: 'gold' },
    { id: 'FINALS_MVP', label: '파이널 MVP', accent: 'gold' },
    { id: 'MVP', label: '정규시즌 MVP', accent: 'gold' },
    { id: 'ALL_STAR', label: '올스타 선정', accent: 'accent' },
    { id: 'ALL_LEAGUE', label: '올-리그 팀', accent: 'accent' },
    { id: 'DPOY', label: '올해의 수비수', accent: 'ok' },
    { id: 'SIXTH_MAN', label: '식스맨상', accent: 'neutral' },
    { id: 'MIP', label: '기량발전상', accent: 'neutral' },
    { id: 'ROY', label: '신인왕', accent: 'neutral' },
    { id: 'INTL_MEDAL', label: '국가대표 메달', accent: 'ok' },
    { id: 'LEAGUE_RECORD', label: '역대 리그 신기록', accent: 'accent' },
  ];

  return catalog
    .map((item) => ({
      id: item.id,
      label: item.label,
      count: buckets[item.id]?.length || 0,
      accent: item.accent,
      entries: buckets[item.id] || [],
    }))
    .filter((item) => item.count > 0);
}

/**
 * 해당 선수가 보유한 역대 리그 신기록 추출
 */
export function extractPlayerBrokenRecords(
  career: Pick<CareerState, 'id' | 'name'>,
  recordBook?: RecordBookState | null
): RetrospectiveBrokenRecord[] {
  if (!recordBook) return [];
  const results: RetrospectiveBrokenRecord[] = [];
  const leagues = Object.keys(recordBook) as LeagueId[];

  for (const league of leagues) {
    const entries = recordBook[league] || [];
    for (const rec of entries) {
      if (!rec.isUserRecord) continue;
      const matchesPlayer = rec.playerId
        ? rec.playerId === career.id
        : rec.holderName === career.name;
      if (!matchesPlayer) continue;
      const isInt = rec.unit === '점' || rec.unit === '회';
      const formattedValue = isInt
        ? `${rec.value.toLocaleString()}${rec.unit}`
        : `${rec.value.toFixed(1)} ${rec.unit}`;
      results.push({
        league,
        leagueShortName: LEAGUE_CONFIG[league]?.shortName || league,
        label: rec.label,
        formattedValue,
        year: rec.year,
        teamName: rec.teamName,
      });
    }
  }

  return results;
}

function buildOpeningStatement(
  career: CareerState,
  stints: TeamStintSummary[],
  evaluation: LegacyEvaluation
): string {
  const firstStint = stints[0];
  const originTeam = firstStint ? firstStint.teamName : career.team.name;
  const nbaSeasons = career.seasonLogs.filter((l) => l.league === 'NBA').length;

  if (evaluation.tierId === 'GOAT') {
    return `${originTeam}에서 출발해 NBA 정상에 여러 차례 오르며 한 시대를 대표하는 선수로 이름을 남겼습니다.`;
  }
  if (evaluation.jerseyRetired) {
    return `${originTeam} 코트에서 출발해 ${evaluation.honoredTeam.name}의 상징적인 등번호 #${career.jerseyNumber}로 영원히 기억될 여정이었습니다.`;
  }
  if (nbaSeasons >= 5) {
    return `${originTeam}에서 꿈을 키운 뒤 세계 최고 무대 NBA에서 ${nbaSeasons}시즌을 누비며 뚜렷한 발자취를 남겼습니다.`;
  }
  if (career.totals.championships >= 1) {
    return `${originTeam}에서의 첫 걸음부터 정상 등극의 환희까지, ${career.seasonsPlayed}시즌 동안 멈추지 않고 코트를 지켰습니다.`;
  }
  return `${originTeam}에서 시작해 ${career.seasonsPlayed}시즌 동안 묵묵히 코트를 누비며 자신만의 농구 이야기를 써 내려갔습니다.`;
}

function buildFranchiseTributeMessage(
  playerName: string,
  jerseyNumber: string,
  evaluation: LegacyEvaluation
): string {
  if (evaluation.jerseyRetired) {
    return `${evaluation.honoredTeam.name} 구단은 ${evaluation.honoredTeamSeasons}시즌 동안 팀을 이끌며 ${evaluation.honoredTeamPoints.toLocaleString()}득점, 우승 ${evaluation.honoredTeamChamps}회, MVP ${evaluation.honoredTeamMvps}회를 기록한 ${playerName}의 헌신을 기려 등번호 #${jerseyNumber}를 영구결번으로 헌액합니다.`;
  }
  return `${evaluation.honoredTeam.name} 소속으로 ${evaluation.honoredTeamSeasons}시즌 동안 ${evaluation.honoredTeamPoints.toLocaleString()}득점을 기록하며 구단 역사의 한 페이지를 장식했습니다.`;
}

/**
 * 은퇴 시점 완전한 커리어 회고 스냅샷 생성
 */
export function buildCareerRetrospective(
  career: CareerState,
  reason: RetirementReason,
  evaluation: LegacyEvaluation,
  recordBook?: RecordBookState | null
): CareerRetrospective {
  const stints = buildTeamStints(career.seasonLogs, career.teamRatingsMap);
  const seasons = career.seasonLogs.map(mapSeasonLogToPoint);
  const peakSeason = selectPeakSeason(seasons);
  const { championships, bestPlayoffNote } = buildChampionshipChronicle(
    career.seasonLogs,
    career.internationalHistory || [],
    career.teamRatingsMap
  );
  const brokenRecords = extractPlayerBrokenRecords(career, recordBook);
  const trophies = buildTrophyCabinet(
    career.seasonLogs,
    career.internationalHistory || [],
    brokenRecords
  );

  const gp = Math.max(1, career.totals.gp);
  const startYear =
    seasons.length > 0 ? seasons[0].year : Math.max(2025, career.seasonYear - career.seasonsPlayed);
  const endYear = seasons.length > 0 ? seasons[seasons.length - 1].year : career.seasonYear;

  return {
    version: 1,
    isFallback: false,
    playerName: career.name,
    jerseyNumber: career.jerseyNumber,
    heightCm: career.heightCm,
    primaryPos: career.primaryPos,
    secondaryPos: career.secondaryPos,
    growthDna: career.growthDna,
    playstyle: career.playstyle,
    traits: career.traits || [],
    startYear,
    endYear,
    finalAge: career.age,
    seasonsPlayed: career.seasonsPlayed,
    retirementReason: reason,
    retirementReasonLabel: RETIREMENT_REASON_LABELS[reason] || '공식 은퇴',
    openingStatement: buildOpeningStatement(career, stints, evaluation),
    legacyTierId: evaluation.tierId,
    legacyTitle: evaluation.tierTitle,
    legacyScore: evaluation.legacyScore,
    epitaph: evaluation.summaryComment,
    careerEarnings: career.careerEarnings || 0,
    peakOvr: career.peakOvr,
    totals: {
      gp: career.totals.gp,
      points: career.totals.points,
      rebounds: career.totals.rebounds,
      assists: career.totals.assists,
      steals: career.totals.steals || 0,
      blocks: career.totals.blocks || 0,
      championships: career.totals.championships,
      mvps: career.totals.mvps,
      finalsMvps: career.totals.finalsMvps || 0,
      allStars: career.totals.allStars,
      nbaGp: career.totals.nbaGp,
      nbaPoints: career.totals.nbaPoints,
      nbaChampionships: career.totals.nbaChampionships,
      nbaMvps: career.totals.nbaMvps,
    },
    averages: {
      ppg: Number((career.totals.points / gp).toFixed(1)),
      rpg: Number((career.totals.rebounds / gp).toFixed(1)),
      apg: Number((career.totals.assists / gp).toFixed(1)),
      spg: Number(((career.totals.steals || 0) / gp).toFixed(1)),
      bpg: Number(((career.totals.blocks || 0) / gp).toFixed(1)),
    },
    careerHighs: { ...career.careerHighs },
    stints,
    seasons,
    peakSeason,
    championships,
    bestPlayoffNote,
    trophies,
    brokenRecords,
    jerseyCeremony: {
      jerseyRetired: evaluation.jerseyRetired,
      honoredTeam: evaluation.honoredTeam,
      honoredTeamSeasons: evaluation.honoredTeamSeasons,
      honoredTeamPoints: evaluation.honoredTeamPoints,
      honoredTeamChamps: evaluation.honoredTeamChamps,
      honoredTeamMvps: evaluation.honoredTeamMvps,
      honoredTeamAllStars: evaluation.honoredTeamAllStars,
      tributeMessage: buildFranchiseTributeMessage(
        career.name,
        career.jerseyNumber,
        evaluation
      ),
    },
  };
}

/**
 * 구버전 HallOfFameEntry(retrospective 미포함) 하위 호환 폴백 모델 생성
 */
export function buildFallbackRetrospectiveFromHof(
  entry: HallOfFameEntry
): CareerRetrospective {
  if (entry.retrospective) return entry.retrospective;

  const inductedYear =
    entry.finalSeasonYear ?? 2026 + Math.max(0, entry.seasonsPlayed);
  const startYear = Math.max(2025, inductedYear - Math.max(1, entry.seasonsPlayed));
  const trophies: TrophyCabinetItem[] = [];

  const pushSimple = (
    id: string,
    label: string,
    count: number,
    accent: TrophyCabinetItem['accent']
  ) => {
    if (count <= 0) return;
    trophies.push({
      id,
      label,
      count,
      accent,
      entries: [
        {
          year: inductedYear,
          leagueShortName: LEAGUE_CONFIG[entry.iconicTeam.league]?.shortName || entry.iconicTeam.league,
          teamName: entry.iconicTeam.name,
          note: `통산 ${count}회 달성`,
        },
      ],
    });
  };

  pushSimple('CHAMPIONSHIP', '리그 우승', entry.totals.championships, 'gold');
  pushSimple('FINALS_MVP', '파이널 MVP', entry.totals.finalsMvps || 0, 'gold');
  pushSimple('MVP', '정규시즌 MVP', entry.totals.mvps, 'gold');
  pushSimple('ALL_STAR', '올스타 선정', entry.totals.allStars, 'accent');
  pushSimple('ALL_LEAGUE', '올-리그 팀', entry.totals.allLeagueSelections || 0, 'accent');
  pushSimple('DPOY', '올해의 수비수', entry.totals.dpoys || 0, 'ok');
  pushSimple('SIXTH_MAN', '식스맨상', entry.totals.sixthManAwards || 0, 'neutral');
  pushSimple('MIP', '기량발전상', entry.totals.mips || 0, 'neutral');

  const intlTotal = entry.totals.internationalMedals
    ? entry.totals.internationalMedals.gold +
      entry.totals.internationalMedals.silver +
      entry.totals.internationalMedals.bronze
    : 0;
  pushSimple('INTL_MEDAL', '국가대표 메달', intlTotal, 'ok');

  const singleStint: TeamStintSummary = {
    id: `FALLBACK_STINT_${entry.iconicTeam.id}`,
    teamId: entry.iconicTeam.id,
    teamName: entry.iconicTeam.name,
    teamShortName: entry.iconicTeam.shortName,
    league: entry.iconicTeam.league,
    leagueShortName:
      LEAGUE_CONFIG[entry.iconicTeam.league]?.shortName || entry.iconicTeam.league,
    primaryColor: entry.iconicTeam.primaryColor,
    secondaryColor: entry.iconicTeam.secondaryColor,
    logoUrl: entry.iconicTeam.logoUrl,
    startYear,
    endYear: inductedYear,
    seasons: entry.seasonsPlayed,
    gp: entry.totals.gp,
    avgPpg: entry.careerAverages.ppg,
    avgRpg: entry.careerAverages.rpg,
    avgApg: entry.careerAverages.apg,
    peakOvr: entry.peakOvr,
    championships: entry.totals.championships,
    mvps: entry.totals.mvps,
    finalsMvps: entry.totals.finalsMvps || 0,
    allStars: entry.totals.allStars,
  };

  const championships: ChampionshipRecord[] =
    entry.totals.championships > 0
      ? [
          {
            id: `FALLBACK_CHAMP_${entry.id}`,
            year: inductedYear,
            age: entry.finalAge,
            titleLabel: `통산 우승 ${entry.totals.championships}회`,
            leagueOrTournament:
              LEAGUE_CONFIG[entry.iconicTeam.league]?.shortName || entry.iconicTeam.league,
            teamName: entry.iconicTeam.name,
            teamId: entry.iconicTeam.id,
            league: entry.iconicTeam.league,
            primaryColor: entry.iconicTeam.primaryColor,
            secondaryColor: entry.iconicTeam.secondaryColor,
            logoUrl: entry.iconicTeam.logoUrl,
            isInternational: false,
            wonFinalsMvp: (entry.totals.finalsMvps || 0) > 0,
            statSummary: `통산 ${entry.careerAverages.ppg} PPG · ${entry.careerAverages.rpg} RPG · ${entry.careerAverages.apg} APG`,
          },
        ]
      : [];

  return {
    version: 1,
    isFallback: true,
    playerName: entry.name,
    jerseyNumber: entry.jerseyNumber,
    heightCm: entry.heightCm,
    primaryPos: entry.primaryPos,
    secondaryPos: entry.secondaryPos,
    traits: entry.traits || [],
    startYear,
    endYear: inductedYear,
    finalAge: entry.finalAge,
    seasonsPlayed: entry.seasonsPlayed,
    retirementReason: entry.retirementReason,
    retirementReasonLabel: RETIREMENT_REASON_LABELS[entry.retirementReason] || '공식 은퇴',
    openingStatement: entry.epitaph,
    legacyTierId: entry.legacyTierId,
    legacyTitle: entry.legacyTitle,
    legacyScore: entry.legacyScore,
    epitaph: entry.epitaph,
    careerEarnings: entry.careerEarnings || 0,
    peakOvr: entry.peakOvr,
    totals: {
      gp: entry.totals.gp,
      points: entry.totals.points,
      rebounds: entry.totals.rebounds,
      assists: entry.totals.assists,
      steals: 0,
      blocks: 0,
      championships: entry.totals.championships,
      mvps: entry.totals.mvps,
      finalsMvps: entry.totals.finalsMvps || 0,
      allStars: entry.totals.allStars,
      nbaGp: entry.totals.nbaGp,
      nbaPoints: entry.totals.nbaPoints,
      nbaChampionships: entry.totals.nbaChampionships,
      nbaMvps: entry.totals.nbaMvps,
    },
    averages: {
      ppg: entry.careerAverages.ppg,
      rpg: entry.careerAverages.rpg,
      apg: entry.careerAverages.apg,
      spg: 0,
      bpg: 0,
    },
    careerHighs: {
      points: entry.careerHighPts,
      rebounds: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      pointsContext: '단일 경기 최고 득점 기록',
    },
    stints: [singleStint],
    seasons: [],
    peakSeason: null,
    championships,
    bestPlayoffNote: null,
    trophies,
    brokenRecords: [],
    jerseyCeremony: {
      jerseyRetired: entry.jerseyRetired,
      honoredTeam: entry.iconicTeam,
      honoredTeamSeasons: entry.seasonsPlayed,
      honoredTeamPoints: entry.totals.points,
      honoredTeamChamps: entry.totals.championships,
      honoredTeamMvps: entry.totals.mvps,
      honoredTeamAllStars: entry.totals.allStars,
      tributeMessage: entry.jerseyRetired
        ? `${entry.iconicTeam.name} 구단은 ${entry.name}의 위대한 헌신을 기려 등번호 #${entry.jerseyNumber}를 영구결번으로 헌액합니다.`
        : `${entry.iconicTeam.name} 소속으로 빛나는 프로 경력을 남겼습니다.`,
    },
  };
}
