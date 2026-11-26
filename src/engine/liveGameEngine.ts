import {
  AsianGamesMatchLog,
  CareerState,
  ClutchChoiceId,
  ClutchScenarioType,
  InternationalMedalType,
  InternationalTournamentType,
  LiveCourtPlay,
  LiveGameState,
  LivePlayerBoxSnapshot,
  LiveQuarterLog,
  LiveTacticId,
  TeamInfo,
} from '../types/game';
import { LEAGUE_CONFIG } from '../data/leagues';
import {
  INTERNATIONAL_TOURNAMENT_CONFIG,
  LEAGUE_BALANCE_META,
  LIVE_GAME_CONFIG,
  clampNum,
} from '../config/balanceConfig';
import {
  calculateBiomechanicalProfile,
  calculateHeightMismatchPenalty,
  calculateOvr,
} from './statCalculator';
import { getFinalsSeriesBestOf } from './standingsEngine';
import {
  isInternationalLiveGame,
  getLiveGameTournamentType,
} from './internationalEngine';
import { evaluateRealisticFinalsMvp } from './playoffEngine';
import type { DecisiveGameKind } from './finalsSeries';

/**
 * 결승전(리그 파이널, 컨퍼런스 파이널 7차전, 국제대회 결승전/3·4위전) 실시간 쿼터별 중계 상태를 생성합니다.
 */
export function createLiveFinalGame(
  career: CareerState,
  opponentTeam: TeamInfo,
  gameType: LiveGameState['gameType'],
  options?: {
    tournamentType?: InternationalTournamentType;
    tournamentYear?: number;
    preMatches?: AsianGamesMatchLog[];
    finalsContext?: {
      gameNo: number;
      playerWins: number;
      oppWins: number;
      kind: DecisiveGameKind;
    };
  }
): LiveGameState {
  const isInternational = isInternationalLiveGame(gameType);
  const tournamentType: InternationalTournamentType | undefined = isInternational
    ? options?.tournamentType ||
      (gameType === 'ASIAN_GAMES_FINAL' ? 'ASIAN_GAMES' : 'ASIA_CUP')
    : undefined;
  const tournamentYear: number | undefined = isInternational
    ? options?.tournamentYear ?? career.seasonYear
    : undefined;
  const tourneyCfg = tournamentType
    ? INTERNATIONAL_TOURNAMENT_CONFIG[tournamentType]
    : null;

  // 라이브 경기에서는 simulateLiveQuarter()가 주인공의 개인 기여도(playerCourtLift)를 별도 반영하므로
  // 대표팀 기본 전력(baseKorRating)을 사용해 주인공 OVR 이중 가산을 방지합니다.
  const korRating = tourneyCfg ? Math.round(tourneyCfg.baseKorRating) : 78;

  const playerTeam: TeamInfo = isInternational
    ? {
        id: 'KOR_NAT_TEAM',
        name: '대한민국 남자농구 국가대표팀',
        shortName: '대한민국',
        city: '서울',
        league: career.league,
        rating: korRating,
        primaryColor: '#0047A0',
        secondaryColor: '#CD2E3A',
        espnAbbr: 'KOR',
        logoUrl: '/logos/NAT_KOR.svg',
        prestigeDesc: `${
          tourneyCfg?.name || '국제대회'
        } 본선 무대에 출전한 대한민국 남자농구 국가대표팀입니다.`,
        direction: 'CONTENDER',
      }
    : career.team;

  const isBronzeMatch = gameType === 'INTERNATIONAL_BRONZE';
  const displayYear = tournamentYear ?? career.seasonYear;
  const showExemptionFinalTag =
    !career.militaryExempt &&
    career.militaryServiceSeasonsLeft === 0 &&
    ((tournamentType === 'ASIAN_GAMES' && !isBronzeMatch) ||
      tournamentType === 'OLYMPICS');
  const finalsBestOf = getFinalsSeriesBestOf(career.league);
  const tiedSeriesWins = Math.floor(finalsBestOf / 2);
  const leagueShort = LEAGUE_CONFIG[career.league].shortName;
  // 단판 결승(BO1)은 결정전 문맥이 있어도 기존 결승전 문구를 씁니다.
  const finalsCtx =
    gameType === 'LEAGUE_FINALS' && finalsBestOf > 1 ? options?.finalsContext : undefined;

  const title = isInternational
    ? isBronzeMatch
      ? `${displayYear} ${tourneyCfg?.name || '국제대회'} 3·4위전 (동메달 결정전${
          showExemptionFinalTag ? ' · 병역특례' : ''
        })`
      : `${displayYear} ${tourneyCfg?.name || '국제대회'} 결승전${
          showExemptionFinalTag ? ' (병역특례 결정전)' : ''
        }`
    : gameType === 'CONF_FINALS_GAME7'
    ? `${leagueShort} 컨퍼런스 파이널 7차전`
    : finalsCtx
    ? `${leagueShort} 파이널 ${finalsCtx.gameNo}차전 ${
        finalsCtx.kind === 'CLINCH'
          ? '(우승 매치포인트)'
          : finalsCtx.kind === 'ELIMINATION'
          ? '(벼랑 끝 승부)'
          : '(최종전)'
      }`
    : finalsBestOf > 1
    ? `${leagueShort} 파이널 ${finalsBestOf}차전 (최종 매치포인트)`
    : `${leagueShort} 챔피언십 파이널 결승전`;

  const subtitle = isInternational
    ? `${playerTeam.name} vs ${opponentTeam.name}`
    : gameType === 'CONF_FINALS_GAME7'
    ? `${playerTeam.name} vs ${opponentTeam.name} · 시리즈 3승 3패 동률 최종전`
    : finalsCtx
    ? `${playerTeam.name} vs ${opponentTeam.name} · 시리즈 ${finalsCtx.playerWins}승 ${finalsCtx.oppWins}패`
    : finalsBestOf > 1
    ? `${playerTeam.name} vs ${opponentTeam.name} · 시리즈 ${tiedSeriesWins}승 ${tiedSeriesWins}패 동률 최종전`
    : `${playerTeam.name} vs ${opponentTeam.name} · 단판 우승 결정전`;

  const foulLimit = isInternational
    ? LIVE_GAME_CONFIG.asianGamesFoulLimit
    : LEAGUE_BALANCE_META[career.league].foulLimit;
  const initialStamina = clampNum(
    Math.round(84 + ((career.stats?.phy ?? 65) - 65) * 0.45),
    78,
    100
  );

  return {
    gameType,
    internationalTournamentType: tournamentType,
    internationalTournamentName: tourneyCfg?.name,
    internationalTournamentYear: tournamentYear,
    internationalPreMatches: options?.preMatches,
    title,
    subtitle,
    playerTeam,
    opponentTeam,
    quarter: 0,
    isFinished: false,
    teamScore: 0,
    oppScore: 0,
    currentTactic: 'UNSELFISH_PASS',
    momentum: 'NEUTRAL',
    foulLimit,
    fouledOut: false,
    overtimeCount: 0,
    pendingClutchPossession: false,
    clutchPossessionResolved: false,
    clutchConvertedInGame: false,
    playerStats: {
      pts: 0,
      reb: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      fgm: 0,
      fga: 0,
      tpm: 0,
      tpa: 0,
      fouls: 0,
      stamina: initialStamina,
    },
    quarterLogs: [],
  };
}

function buildFinalOutcome(
  liveGame: LiveGameState,
  career: CareerState,
  teamScore: number,
  oppScore: number,
  playerStats: LiveGameState['playerStats'],
  customClutchNote?: string
): NonNullable<LiveGameState['finalOutcome']> {
  const won = teamScore > oppScore;
  const gameScore =
    playerStats.pts +
    playerStats.reb * 1.2 +
    playerStats.ast * 1.5 +
    (playerStats.stl + playerStats.blk) * 2;
  const wonFinalsMvp =
    liveGame.gameType === 'LEAGUE_FINALS' &&
    evaluateRealisticFinalsMvp(career, won, gameScore);

  const isInternational = isInternationalLiveGame(liveGame.gameType);
  const tournamentType = getLiveGameTournamentType(liveGame);
  const tourneyCfg = tournamentType
    ? INTERNATIONAL_TOURNAMENT_CONFIG[tournamentType]
    : null;
  const isBronzeMatch = liveGame.gameType === 'INTERNATIONAL_BRONZE';

  let medal: InternationalMedalType | undefined;
  if (isInternational) {
    if (isBronzeMatch) {
      medal = won ? 'BRONZE' : 'FOURTH';
    } else {
      medal = won ? 'GOLD' : 'SILVER';
    }
  }

  const wonTournamentMvp =
    isInternational && !isBronzeMatch && won && gameScore >= 24;

  const grantedMilitaryExemption = Boolean(
    isInternational &&
      tourneyCfg &&
      ((tourneyCfg.militaryExemptionMinMedal === 'GOLD' && medal === 'GOLD') ||
        (tourneyCfg.militaryExemptionMinMedal === 'BRONZE' &&
          (medal === 'GOLD' || medal === 'SILVER' || medal === 'BRONZE')))
  );

  let baseHeadline = '';
  if (isInternational && tourneyCfg) {
    const exemptionSuffix =
      grantedMilitaryExemption && !career.militaryExempt ? ' · 병역특례 획득' : '';
    const mvpSuffix = wonTournamentMvp ? ' · 대회 MVP' : '';
    if (isBronzeMatch) {
      baseHeadline = won
        ? `${tourneyCfg.shortName} 동메달 획득 — 대한민국, ${liveGame.opponentTeam.shortName}에 ${teamScore}-${oppScore} 승리 (${career.name} ${playerStats.pts}점${exemptionSuffix})`
        : `${tourneyCfg.shortName} 4위 마감 — 대한민국, ${liveGame.opponentTeam.shortName}에 ${teamScore}-${oppScore} 석패`;
    } else {
      baseHeadline = won
        ? `${tourneyCfg.shortName} 금메달 확정 — ${career.name} ${playerStats.pts}점 ${playerStats.reb}리바운드 ${playerStats.ast}도움${mvpSuffix}${exemptionSuffix}`
        : `${tourneyCfg.shortName} 은메달 — 대한민국, ${liveGame.opponentTeam.shortName}에 ${teamScore}-${oppScore} 석패${exemptionSuffix}`;
    }
  } else if (liveGame.gameType === 'CONF_FINALS_GAME7') {
    baseHeadline = won
      ? `컨퍼런스 파이널 7차전 승리 — ${liveGame.playerTeam.name}, ${liveGame.opponentTeam.name}에 ${teamScore}-${oppScore} 승리로 파이널 진출`
      : `컨퍼런스 파이널 7차전 패배 — ${liveGame.playerTeam.name}, ${teamScore}-${oppScore} 석패로 시즌 마감`;
  } else {
    baseHeadline = won
      ? `챔피언십 우승 — ${liveGame.playerTeam.name}, ${liveGame.opponentTeam.name} 제압 (${career.name} ${playerStats.pts}점${
          wonFinalsMvp ? ' · 파이널 MVP' : ''
        })`
      : `파이널 준우승 — ${liveGame.playerTeam.name}, 최종전 ${teamScore}-${oppScore} 석패`;
  }

  return {
    won,
    wonFinalsMvp,
    wonTournamentMvp,
    medal,
    grantedMilitaryExemption,
    clutchHeroSuccess: Boolean(liveGame.clutchConvertedInGame),
    headline: customClutchNote ? `${baseHeadline} · ${customClutchNote}` : baseHeadline,
  };
}

function splitPointsIntoBuckets(
  total: number,
  buckets: number,
  rng: () => number
): number[] {
  if (buckets <= 0) return [];
  if (total <= 0) return Array(buckets).fill(0);
  const weights = Array.from({ length: buckets }, () => 0.65 + rng() * 0.7);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const result = weights.map((w) => Math.floor((total * w) / weightSum));
  let remainder = total - result.reduce((a, b) => a + b, 0);
  let idx = 0;
  while (remainder > 0) {
    result[idx % buckets] += 1;
    remainder -= 1;
    idx += 1;
  }
  return result;
}

const THREE_PT_SPOTS: [number, number][] = [
  [3, 20],  // 좌측 코너 (3점 아크 밖 x < 8.8)
  [97, 20], // 우측 코너 (3점 아크 밖 x > 91.2)
  [10, 72], // 좌측 윙 (3점 아크 밖)
  [90, 72], // 우측 윙 (3점 아크 밖)
  [50, 91], // 탑 오브 더 키 (3점 아크 밖 y > 84)
];

const TWO_PT_SPOTS: [number, number][] = [
  [44, 21], // 좌측 로우포스트
  [56, 21], // 우측 로우포스트
  [50, 26], // 페인트존 중앙
  [30, 38], // 좌측 엘보우 미드레인지
  [70, 38], // 우측 엘보우 미드레인지
];

function pickSpot(spots: [number, number][], rng: () => number): [number, number] {
  return spots[Math.floor(rng() * spots.length)] || spots[0];
}

interface DraftQuarterAction {
  actor: LiveCourtPlay['actor'];
  type: LiveCourtPlay['type'];
  showOnCourt: boolean;
  shotPoints: number; // 반드시 0, 1, 2, 3 중 하나
  courtBadge?: string;
  x: number;
  y: number;
  fromX?: number;
  fromY?: number;
  dPts: number;
  dFgm: number;
  dFga: number;
  dTpm: number;
  dTpa: number;
  dAst: number;
  dStl: number;
  dBlk: number;
  dFoul: number;
  buildText: (clock: string, teamScoreAfter: number, oppScoreAfter: number) => string;
}

function buildQuarterClocks(
  count: number,
  isOvertime: boolean,
  triggerClutchPossession: boolean
): string[] {
  const endSec = triggerClutchPossession ? 18 : 8;
  const startSec = isOvertime ? 268 : 665;
  if (count <= 1) {
    const m = Math.floor(endSec / 60);
    const s = endSec % 60;
    return [`${m}:${s < 10 ? '0' : ''}${s}`];
  }
  const clocks: string[] = [];
  for (let i = 0; i < count; i++) {
    const ratio = i / (count - 1);
    const sec = Math.max(endSec, Math.round(startSec - (startSec - endSec) * ratio));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    clocks.push(`${m}:${s < 10 ? '0' : ''}${s}`);
  }
  return clocks;
}

function generateQuarterCourtPlays(params: {
  quarter: number;
  qLabel: string;
  isOvertime: boolean;
  playerName: string;
  playerTeamShort: string;
  oppTeamShort: string;
  startTeamScore: number;
  startOppScore: number;
  myQScore: number;
  oppQScore: number;
  qPts: number;
  qTpm: number;
  qTpa: number;
  qFgm: number;
  qFga: number;
  freeThrows: number;
  qReb: number;
  qAst: number;
  qStl: number;
  qBlk: number;
  addedFoul: number;
  fouledOutNow: boolean;
  isAlreadyFouledOut: boolean;
  foulLimit: number;
  triggerClutchPossession: boolean;
  prevPlayerStats: LivePlayerBoxSnapshot;
  updatedPlayerStats: LivePlayerBoxSnapshot;
  rng: () => number;
}): LiveCourtPlay[] {
  const {
    quarter,
    qLabel,
    isOvertime,
    playerName,
    playerTeamShort,
    oppTeamShort,
    startTeamScore,
    startOppScore,
    myQScore,
    oppQScore,
    qPts,
    qTpm,
    qTpa,
    qFgm,
    qFga,
    freeThrows,
    qReb,
    qAst,
    qStl,
    qBlk,
    addedFoul,
    fouledOutNow,
    isAlreadyFouledOut,
    foulLimit,
    triggerClutchPossession,
    prevPlayerStats,
    updatedPlayerStats,
    rng,
  } = params;

  const actions: DraftQuarterAction[] = [];
  let remainingTeamBudget = myQScore;

  if (!isAlreadyFouledOut) {
    const madeThrees = qTpm;
    const madeTwos = Math.max(0, qFgm - qTpm);
    const totalMisses = Math.max(0, qFga - qFgm);
    const missedThrees = Math.max(0, qTpa - qTpm);
    const missedTwos = Math.max(0, totalMisses - missedThrees);

    // 1) 내 선수 3점 성공 (실제 1포제션 +3)
    for (let i = 0; i < madeThrees; i++) {
      const [x, y] = pickSpot(THREE_PT_SPOTS, rng);
      const pts = Math.min(3, remainingTeamBudget);
      remainingTeamBudget -= pts;
      const spotLabel = y <= 28 ? '코너 3점슛' : y >= 82 ? '탑 3점슛' : '윙 3점슛';
      actions.push({
        actor: 'PLAYER',
        type: 'THREE_MAKE',
        showOnCourt: true,
        shotPoints: pts,
        courtBadge: `+${pts}`,
        x,
        y,
        dPts: 3,
        dFgm: 1,
        dFga: 1,
        dTpm: 1,
        dTpa: 1,
        dAst: 0,
        dStl: 0,
        dBlk: 0,
        dFoul: 0,
        buildText: (clock) => `${qLabel} ${clock} · ${playerName}, ${spotLabel} 성공 (+${pts})`,
      });
    }

    // 2) 내 선수 2점 성공 (실제 1포제션 +2)
    for (let i = 0; i < madeTwos; i++) {
      const [x, y] = pickSpot(TWO_PT_SPOTS, rng);
      const pts = Math.min(2, remainingTeamBudget);
      remainingTeamBudget -= pts;
      const moveLabel = y <= 28 ? '페인트존 돌파 마무리' : '미드레인지 점퍼';
      actions.push({
        actor: 'PLAYER',
        type: 'TWO_MAKE',
        showOnCourt: true,
        shotPoints: pts,
        courtBadge: `+${pts}`,
        x,
        y,
        dPts: 2,
        dFgm: 1,
        dFga: 1,
        dTpm: 0,
        dTpa: 0,
        dAst: 0,
        dStl: 0,
        dBlk: 0,
        dFoul: 0,
        buildText: (clock) => `${qLabel} ${clock} · ${playerName}, ${moveLabel} 성공 (+${pts})`,
      });
    }

    // 3) 내 선수 자유투 (1~2점 단위)
    let remFt = freeThrows;
    while (remFt > 0) {
      const trip = remFt >= 2 ? 2 : 1;
      remFt -= trip;
      const pts = Math.min(trip, remainingTeamBudget);
      remainingTeamBudget -= pts;
      actions.push({
        actor: 'PLAYER',
        type: 'FT',
        showOnCourt: true,
        shotPoints: pts,
        courtBadge: `+${pts}`,
        x: 50,
        y: 46,
        dPts: trip,
        dFgm: 0,
        dFga: 0,
        dTpm: 0,
        dTpa: 0,
        dAst: 0,
        dStl: 0,
        dBlk: 0,
        dFoul: 0,
        buildText: (clock) =>
          `${qLabel} ${clock} · ${playerName}, 자유투 ${trip === 2 ? '2구 모두 성공' : '성공'} (+${pts})`,
      });
    }

    // 4) 대표 야투 실패 (최대 2개 표시, 잔여 실패 시도는 마지막 실패 턴에 합산)
    const shownMissCount = Math.min(2, totalMisses);
    let remMiss3 = missedThrees;
    let remMiss2 = missedTwos;
    for (let i = 0; i < shownMissCount; i++) {
      const isLastMiss = i === shownMissCount - 1;
      const isThreeMiss = remMiss3 > 0;
      const [x, y] = isThreeMiss ? pickSpot(THREE_PT_SPOTS, rng) : pickSpot(TWO_PT_SPOTS, rng);
      const take3 = isLastMiss ? remMiss3 : isThreeMiss ? 1 : 0;
      const take2 = isLastMiss ? remMiss2 : isThreeMiss ? 0 : 1;
      remMiss3 -= take3;
      remMiss2 -= take2;
      actions.push({
        actor: 'PLAYER',
        type: 'MISS',
        showOnCourt: true,
        shotPoints: 0,
        courtBadge: 'MISS',
        x,
        y,
        dPts: 0,
        dFgm: 0,
        dFga: take3 + take2,
        dTpm: 0,
        dTpa: take3,
        dAst: 0,
        dStl: 0,
        dBlk: 0,
        dFoul: 0,
        buildText: (clock) =>
          isThreeMiss
            ? `${qLabel} ${clock} · ${playerName}, 외곽 3점 시도 림 외면`
            : `${qLabel} ${clock} · ${playerName}, 점퍼 시도 불발`,
      });
    }

    // 5) 어시스트 (최대 2턴 표시, 잔여 어시스트는 마지막 어시스트 턴에 합산)
    if (qAst > 0) {
      const shownAstCount = Math.min(2, qAst);
      let remAst = qAst;
      for (let i = 0; i < shownAstCount; i++) {
        const isLastAst = i === shownAstCount - 1;
        const takeAst = isLastAst ? remAst : 1;
        remAst -= takeAst;
        const canThree = remainingTeamBudget >= 3 && rng() < 0.45;
        const assistPts = canThree ? 3 : remainingTeamBudget >= 2 ? 2 : 0;
        remainingTeamBudget -= assistPts;
        const [toX, toY] = assistPts === 3 ? pickSpot(THREE_PT_SPOTS, rng) : pickSpot(TWO_PT_SPOTS, rng);
        actions.push({
          actor: 'PLAYER',
          type: 'ASSIST',
          showOnCourt: true,
          shotPoints: assistPts,
          courtBadge: assistPts > 0 ? `AST +${assistPts}` : 'AST',
          fromX: 50,
          fromY: 56,
          x: toX,
          y: toY,
          dPts: 0,
          dFgm: 0,
          dFga: 0,
          dTpm: 0,
          dTpa: 0,
          dAst: takeAst,
          dStl: 0,
          dBlk: 0,
          dFoul: 0,
          buildText: (clock) =>
            assistPts === 3
              ? `${qLabel} ${clock} · ${playerName} 킥아웃 어시스트, 동료 3점슛 성공 (+3)`
              : assistPts === 2
              ? `${qLabel} ${clock} · ${playerName} 어시스트, 동료 골밑 마무리 (+2)`
              : `${qLabel} ${clock} · ${playerName}, 수비를 흔드는 패스 전개`,
        });
      }
    }

    // 6) 블록 / 스틸 수비 하이라이트
    if (qBlk > 0) {
      actions.push({
        actor: 'PLAYER',
        type: 'BLOCK',
        showOnCourt: true,
        shotPoints: 0,
        courtBadge: 'BLK',
        x: 50,
        y: 22,
        dPts: 0,
        dFgm: 0,
        dFga: 0,
        dTpm: 0,
        dTpa: 0,
        dAst: 0,
        dStl: 0,
        dBlk: qBlk,
        dFoul: 0,
        buildText: (clock) => `${qLabel} ${clock} · ${playerName}, 골밑 블록슛으로 상대 공격 저지`,
      });
    }
    if (qStl > 0) {
      actions.push({
        actor: 'PLAYER',
        type: 'STEAL',
        showOnCourt: true,
        shotPoints: 0,
        courtBadge: 'STL',
        x: 34,
        y: 46,
        dPts: 0,
        dFgm: 0,
        dFga: 0,
        dTpm: 0,
        dTpa: 0,
        dAst: 0,
        dStl: qStl,
        dBlk: 0,
        dFoul: 0,
        buildText: (clock) => `${qLabel} ${clock} · ${playerName}, 패스 길목을 끊는 스틸 성공`,
      });
    }
  }

  // 액션이 너무 많으면(10개 초과) 초반 액션 순서를 유지하며 적당히 섞고, 파울아웃은 말미에 배치
  for (let i = actions.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [actions[i], actions[j]] = [actions[j], actions[i]];
  }

  // 파울 아웃 발생 시 말미 직전에 추가
  if (fouledOutNow && !isAlreadyFouledOut) {
    actions.push({
      actor: 'PLAYER',
      type: 'FOUL',
      showOnCourt: true,
      shotPoints: 0,
      courtBadge: 'FOUL',
      x: 50,
      y: 34,
      dPts: 0,
      dFgm: 0,
      dFga: 0,
      dTpm: 0,
      dTpa: 0,
      dAst: 0,
      dStl: 0,
      dBlk: 0,
      dFoul: addedFoul,
      buildText: (clock) =>
        `${qLabel} ${clock} · ${playerName} 개인 ${foulLimit}반칙 파울 아웃으로 코트 퇴장`,
    });
  } else if (addedFoul > 0 && actions.length > 0) {
    // 일반 파울은 중반 턴에 스탯 반영
    actions[Math.floor(actions.length / 2)].dFoul += addedFoul;
  }

  // 내 선수 포제션이 적거나 파울 아웃 상태일 때 팀/상대 전광판 흐름 턴 보강 (최소 5턴 확보)
  const makeTeamTick = (label: 'EARLY' | 'MID' | 'LATE'): DraftQuarterAction => ({
    actor: 'TEAMMATE',
    type: 'TEAM_TICK',
    showOnCourt: false,
    shotPoints: 0,
    x: 50,
    y: 50,
    dPts: 0,
    dFgm: 0,
    dFga: 0,
    dTpm: 0,
    dTpa: 0,
    dAst: 0,
    dStl: 0,
    dBlk: 0,
    dFoul: 0,
    buildText: (clock, ts, os) => {
      if (isAlreadyFouledOut) {
        return label === 'LATE'
          ? `${qLabel} ${clock} · 벤치에서 지켜본 ${qLabel} 종료 (${ts}:${os})`
          : `${qLabel} ${clock} · 양 팀 공방전 이어지며 스코어 ${ts}:${os}`;
      }
      if (label === 'LATE') {
        return triggerClutchPossession
          ? `${qLabel} ${clock} · ${ts}:${os} 접전, 마지막 포제션 돌입`
          : `${qLabel} ${clock} · ${qLabel} 종료 (${ts}:${os})`;
      }
      if (label === 'EARLY') {
        return `${qLabel} ${clock} · ${playerTeamShort}·${oppTeamShort} 초반 탐색전 (${ts}:${os})`;
      }
      return `${qLabel} ${clock} · 양 팀 로테이션 공방전 진행 (${ts}:${os})`;
    },
  });

  if (actions.length === 0) {
    actions.push(
      makeTeamTick('EARLY'),
      makeTeamTick('MID'),
      makeTeamTick('MID'),
      makeTeamTick('MID'),
      makeTeamTick('LATE')
    );
  } else {
    // 최소 4개 중간 턴을 유지하고 항상 쿼터 마무리 전광판 정산 턴 1개 추가
    while (actions.length < 4) {
      const insertAt = Math.min(actions.length, Math.max(1, Math.floor(actions.length / 2)));
      actions.splice(insertAt, 0, makeTeamTick('MID'));
    }
    actions.push(makeTeamTick('LATE'));
  }

  const totalTurns = actions.length;
  const clocks = buildQuarterClocks(totalTurns, isOvertime, triggerClutchPossession);

  // 배경 팀 득점(내 선수 코트 포제션 외 동료 득점) 및 상대 팀 득점은
  // 턴 0이 내 선수 슛일 경우 턴 0에 0을 배정해 '쿼터 시작 0ms 스코어 선행 점프'를 원천 차단!
  const bgTeamTotal = Math.max(0, remainingTeamBudget);
  const bgOppTotal = Math.max(0, oppQScore);

  const firstIsPlayerShot = actions[0].showOnCourt;
  const bgStartIdx = firstIsPlayerShot && totalTurns > 1 ? 1 : 0;
  const bgSlotCount = totalTurns - bgStartIdx;
  const bgTeamSlots = splitPointsIntoBuckets(bgTeamTotal, bgSlotCount, rng);
  const bgOppSlots = splitPointsIntoBuckets(bgOppTotal, bgSlotCount, rng);
  const rebSlots = splitPointsIntoBuckets(qReb, totalTurns, rng);

  const plays: LiveCourtPlay[] = [];
  let runTeam = startTeamScore;
  let runOpp = startOppScore;
  const runStats: LivePlayerBoxSnapshot = { ...prevPlayerStats };

  for (let i = 0; i < totalTurns; i++) {
    const act = actions[i];
    const bgIdx = i - bgStartIdx;
    const elapsedTeam = bgIdx >= 0 ? bgTeamSlots[bgIdx] || 0 : 0;
    const elapsedOpp = bgIdx >= 0 ? bgOppSlots[bgIdx] || 0 : 0;

    // 슛이 날아가는 동안 전광판은 경과 시간 스코어를 표시하고, 림 도달 후 shotPoints(0~3)만 증가
    const teamScoreBefore = runTeam + elapsedTeam;
    const oppScoreBefore = runOpp + elapsedOpp;
    const teamScoreAfter = teamScoreBefore + act.shotPoints;
    const oppScoreAfter = oppScoreBefore;

    runTeam = teamScoreAfter;
    runOpp = oppScoreAfter;

    const isLast = i === totalTurns - 1;
    if (isLast) {
      Object.assign(runStats, updatedPlayerStats);
    } else {
      runStats.pts = Math.min(updatedPlayerStats.pts, runStats.pts + act.dPts);
      runStats.fgm = Math.min(updatedPlayerStats.fgm, runStats.fgm + act.dFgm);
      runStats.fga = Math.min(updatedPlayerStats.fga, runStats.fga + act.dFga);
      runStats.tpm = Math.min(updatedPlayerStats.tpm, runStats.tpm + act.dTpm);
      runStats.tpa = Math.min(updatedPlayerStats.tpa, runStats.tpa + act.dTpa);
      runStats.reb = Math.min(updatedPlayerStats.reb, runStats.reb + (rebSlots[i] || 0));
      runStats.ast = Math.min(updatedPlayerStats.ast, runStats.ast + act.dAst);
      runStats.stl = Math.min(updatedPlayerStats.stl, runStats.stl + act.dStl);
      runStats.blk = Math.min(updatedPlayerStats.blk, runStats.blk + act.dBlk);
      runStats.fouls = Math.min(updatedPlayerStats.fouls, runStats.fouls + act.dFoul);
      const progressRatio = (i + 1) / totalTurns;
      runStats.stamina = Math.round(
        prevPlayerStats.stamina +
          (updatedPlayerStats.stamina - prevPlayerStats.stamina) * progressRatio
      );
    }

    const clock = clocks[i];
    plays.push({
      id: `Q${quarter}_P${i + 1}`,
      clock,
      actor: act.actor,
      type: act.type,
      showOnCourt: act.showOnCourt,
      shotPoints: act.shotPoints,
      courtBadge: act.courtBadge,
      x: act.x,
      y: act.y,
      fromX: act.fromX,
      fromY: act.fromY,
      teamScoreBefore,
      oppScoreBefore,
      teamDelta: elapsedTeam + act.shotPoints,
      oppDelta: elapsedOpp,
      teamScoreAfter,
      oppScoreAfter,
      playerStatsAfter: { ...runStats },
      text: act.buildText(clock, teamScoreAfter, oppScoreAfter),
    });
  }

  return plays;
}

/**
 * 실시간 결승전 중계의 다음 쿼터(1Q -> 2Q -> 3Q -> 4Q -> 동점 시 OT1~3)를 시뮬레이션합니다.
 * - 점수 조작 0%: 1~4쿼터 누적 실제 스코어를 있는 그대로 보존합니다.
 * - 4쿼터 종료 직전 실제 점수 차가 ±3점 이내(|teamScore - oppScore| <= 3)이고 퇴장(파울 아웃) 상태가 아닐 때만
 *   자연스럽게 '클러치 마지막 1포제션 선택지(공격/수비/자유투 분기)'를 발동합니다!
 * - 점수 차가 4점 이상이면 클러치 없이 자연스럽게 경기가 종료됩니다.
 * - 동점으로 쿼터(또는 클러치)가 끝나면 최대 3차 연장(OT)까지 진행합니다.
 */
/**
 * 리그 평균 능력치(모든 스탯 = LDR) 선수가 중립 전술·표준 체력으로 한 쿼터를 뛸 때의 기대 기여도.
 * simulateLiveQuarter 의 선수 득점/야투/어시스트/스틸·블록 산식의 기댓값과 같은 형태로 계산합니다.
 */
export function getReplacementLevelQuarterImpact(
  ldr: number,
  minutesFactor: number,
  isOvertime: boolean
): { lift: number; stocks: number } {
  const fga = (isOvertime ? 1.8 : 3.25) * minutesFactor * (0.76 + (2 * ldr) / 280);
  const fgProb =
    clampNum(0.44, 0.24, 0.72) * LIVE_GAME_CONFIG.replacementStaminaFactor;
  const threeShare = ldr >= 56 ? clampNum((ldr - 42) / 105, 0.12, 0.55) : 0;
  const fieldPts = fga * fgProb * ((1 - threeShare) * 2 + threeShare * 0.85 * 3);
  const ftProb = clampNum(0.62 + (ldr - 50) * 0.006, 0.55, 0.93);
  const ftPts = 0.28 * minutesFactor * (isOvertime ? 0.55 : 1.0) * 2 * ftProb;
  const ast =
    (0.4 + (ldr / 100) * 1.85) * minutesFactor * (isOvertime ? 0.55 : 1.0);
  const stocks =
    clampNum((ldr / 100) * 0.42 * minutesFactor, 0.03, 0.62) +
    clampNum((ldr / 100) * 0.36 * minutesFactor, 0.02, 0.52);
  return {
    lift: fieldPts + ftPts - fga * 0.85 + ast * 1.35,
    stocks,
  };
}

export function simulateLiveQuarter(
  liveGame: LiveGameState,
  career: CareerState,
  tactic?: LiveTacticId,
  rng: () => number = Math.random
): LiveGameState {
  if (liveGame.isFinished || liveGame.pendingClutchPossession) return liveGame;

  const chosenTactic = tactic || liveGame.currentTactic || 'UNSELFISH_PASS';
  const nextQ = liveGame.quarter + 1;
  const isOvertime = nextQ > 4;
  const overtimeCount = isOvertime ? nextQ - 4 : 0;
  const stats = career.stats;
  const ovr = calculateOvr(stats, career.primaryPos, career.heightCm);
  const leagueMeta = LEAGUE_BALANCE_META[career.league];
  const isInternational = isInternationalLiveGame(liveGame.gameType);
  const tournamentType = getLiveGameTournamentType(liveGame);
  const foulLimit =
    liveGame.foulLimit ??
    (isInternational
      ? LIVE_GAME_CONFIG.asianGamesFoulLimit
      : leagueMeta.foulLimit);
  const ldr =
    tournamentType
      ? INTERNATIONAL_TOURNAMENT_CONFIG[tournamentType].ldr
      : leagueMeta.playerBaselineOvr;
  const mismatch = calculateHeightMismatchPenalty(
    career.heightCm,
    career.primaryPos
  );
  const bio = calculateBiomechanicalProfile(career.heightCm, career.primaryPos);

  const mod =
    LIVE_GAME_CONFIG.tacticMods[chosenTactic] ||
    LIVE_GAME_CONFIG.tacticMods.UNSELFISH_PASS;
  const traits = career.traits || [];
  const hasClutchTrait = traits.includes('CLUTCH_PERFORMER');
  const hasSniperTrait = traits.includes('SNIPER');
  const hasIronMan =
    traits.includes('IRON_STAMINA') || career.growthDna === 'IRONMAN';

  // 정규시즌 출전시간(MPG)에 비례해 결승전 플레이어 볼륨(출전 비중)을 자연스럽게 연동
  const latestLog = career.seasonLogs[career.seasonLogs.length - 1];
  const seasonMpg = latestLog ? latestLog.mpg : 28.0;
  const roleMinutesFactor = clampNum(seasonMpg / 32.0, 0.28, 1.18);

  const isAlreadyFouledOut = Boolean(
    liveGame.fouledOut || liveGame.playerStats.fouls >= foulLimit
  );
  const inFoulTrouble =
    !isAlreadyFouledOut && liveGame.playerStats.fouls >= foulLimit - 1;
  const foulTroubleMinutesMult = inFoulTrouble ? 0.65 : 1.0;

  const curStamina = liveGame.playerStats.stamina;
  // 연속 체력 효능 곡선 (계단식 점프 대신 부드러운 선형 보간)
  const staminaFactor = clampNum(0.74 + (curStamina / 100) * 0.28, 0.74, 1.02);
  const momentumBonus =
    liveGame.momentum === 'HOT'
      ? 0.045
      : liveGame.momentum === 'COLD'
      ? -0.038
      : 0;
  const fourthQuarterClutch = nextQ >= 4 && hasClutchTrait ? 0.06 : 0;

  let qFga = 0;
  let qFgm = 0;
  let qTpa = 0;
  let qTpm = 0;
  let freeThrows = 0;
  let qPts = 0;
  let qReb = 0;
  let qAst = 0;
  let qStl = 0;
  let qBlk = 0;
  let nextFouls = liveGame.playerStats.fouls;
  let fouledOutNow = isAlreadyFouledOut;
  let nextStamina = curStamina;
  let foulOutQuarterShare = 1.0;

  if (!isAlreadyFouledOut) {
    // 1) 파울아웃 여부를 먼저 판정해, 쿼터 중반 퇴장 시 해당 쿼터 출전 비중(foulOutQuarterShare)을 스탯·체력·기여도에 일관 축소 적용
    const effectiveFoulRisk =
      mod.foulRisk *
      (inFoulTrouble ? 0.55 : 1.0) *
      clampNum(0.6 + roleMinutesFactor * 0.4, 0.6, 1.1) *
      (isOvertime ? 0.55 : 1.0);
    const addedFoul = rng() < effectiveFoulRisk ? 1 : 0;
    nextFouls = Math.min(foulLimit, liveGame.playerStats.fouls + addedFoul);
    if (nextFouls >= foulLimit) {
      fouledOutNow = true;
      foulOutQuarterShare = 0.35 + rng() * 0.3;
    }
  }

  const activeQuarterMinutesMult = foulTroubleMinutesMult * foulOutQuarterShare;

  if (!isAlreadyFouledOut) {
    const baseFga =
      (isOvertime ? 1.8 : 3.25) * roleMinutesFactor * activeQuarterMinutesMult;
    qFga = Math.max(
      seasonMpg < 12 || fouledOutNow ? 0 : 1,
      Math.round(
        baseFga *
          mod.usageMult *
          (0.76 + (stats.ins + stats.out) / 280) *
          (0.85 + rng() * 0.3)
      )
    );

    const rawFgProb =
      clampNum(
        0.44 +
          ((stats.ins + stats.out) / 2 - ldr) * 0.0045 +
          mod.fgBonus +
          momentumBonus +
          fourthQuarterClutch -
          mismatch.fgPctPenalty * 0.008,
        0.24,
        0.72
      ) * staminaFactor;

    for (let i = 0; i < qFga; i++) {
      const isThreeAttempt =
        stats.out >= 56 &&
        rng() <
          clampNum(
            (stats.out - 42) / 105 + (hasSniperTrait ? 0.1 : 0),
            0.12,
            0.55
          );
      if (isThreeAttempt) {
        qTpa++;
        if (rng() < rawFgProb * 0.85) {
          qFgm++;
          qTpm++;
        }
      } else if (rng() < rawFgProb) {
        qFgm++;
      }
    }

    const ftProb = clampNum(0.62 + (stats.out - 50) * 0.006, 0.55, 0.93);
    const ftVolumeMult =
      roleMinutesFactor * activeQuarterMinutesMult * (isOvertime ? 0.55 : 1.0);
    const ftTrips =
      (rng() < 0.28 * ftVolumeMult ? 1 : 0) +
      (chosenTactic === 'ACE_HERO' && rng() < 0.36 * ftVolumeMult ? 1 : 0);
    for (let t = 0; t < ftTrips; t++) {
      if (rng() < ftProb) freeThrows++;
      if (rng() < ftProb) freeThrows++;
    }
    qPts = qFgm * 2 + qTpm + freeThrows;

    qReb = Math.max(
      0,
      Math.round(
        (0.55 + (stats.reb / 100) * 2.15) *
          roleMinutesFactor *
          activeQuarterMinutesMult *
          mismatch.rebMultiplier *
          (isOvertime ? 0.55 : 1.0) *
          (0.6 + rng() * 0.8)
      )
    );
    qAst = Math.max(
      0,
      Math.round(
        (0.4 + (stats.ply / 100) * 1.85) *
          roleMinutesFactor *
          activeQuarterMinutesMult *
          mod.astBonus *
          (isOvertime ? 0.55 : 1.0) *
          (0.6 + rng() * 0.8)
      )
    );
    qStl =
      rng() <
      clampNum(
        ((stats.def / 100) * 0.42 +
          (chosenTactic === 'LOCKDOWN_DEFENSE' ? 0.16 : 0)) *
          roleMinutesFactor *
          activeQuarterMinutesMult *
          (isOvertime ? 0.55 : 1.0),
        0.03,
        0.62
      )
        ? 1
        : 0;
    qBlk =
      rng() <
      clampNum(
        (stats.def / 100) *
          0.36 *
          mismatch.blkMultiplier *
          roleMinutesFactor *
          activeQuarterMinutesMult *
          (isOvertime ? 0.55 : 1.0),
        0.02,
        0.52
      )
        ? 1
        : 0;

    const drain = Math.round(
      mod.staminaDrain *
        (0.55 + roleMinutesFactor * 0.45) *
        foulOutQuarterShare *
        (hasIronMan ? 0.72 : 1.0) *
        bio.staminaDrainMultiplier *
        (isOvertime ? 0.55 : 1.0)
    );
    nextStamina = clampNum(curStamina - drain, 10, 100);
  }

  // 리그/국제대회별 실제 경기 템포 기반 팀/상대 쿼터 득점 산출 (강제 스코어 조작 0%, 홈/원정 완전 대칭)
  const teamRating =
    career.teamRatingsMap?.[liveGame.playerTeam.id] ?? liveGame.playerTeam.rating;
  const intlTempoCfg =
    isInternational && tournamentType
      ? INTERNATIONAL_TOURNAMENT_CONFIG[tournamentType]
      : null;
  const baseTeamQuarterPts = intlTempoCfg
    ? isOvertime
      ? intlTempoCfg.liveOvertimeBasePts
      : intlTempoCfg.liveQuarterBasePts
    : isOvertime
    ? leagueMeta.liveOvertimeBasePts
    : leagueMeta.liveQuarterBasePts;
  const baseOppQuarterPts = intlTempoCfg
    ? isOvertime
      ? intlTempoCfg.liveOvertimeBasePts
      : intlTempoCfg.liveQuarterBasePts
    : isOvertime
    ? leagueMeta.liveOvertimeBasePts
    : leagueMeta.liveOppQuarterBasePts;

  // 두 팀 평균 전력이 리그 LDR보다 높을수록 경기 템포(양 팀 득점)가 함께 올라갑니다. (한쪽에만 주지 않음)
  const paceRatingOffset =
    ((teamRating + liveGame.opponentTeam.rating) / 2 - ldr) * 0.22;

  // [대칭 보정] 선수 기여도는 '같은 역할·출전 비중을 맡은 리그 평균 선수'의 기대 기여도 대비 차이로만 반영합니다.
  // 상대 팀에도 리그 평균 수준의 선수가 같은 역할을 수행한다고 보는 것과 같아,
  // 평균 선수는 승패에 중립적이고 실력이 리그 평균을 넘어설수록 팀 승률이 올라갑니다.
  const replacement = getReplacementLevelQuarterImpact(
    ldr,
    roleMinutesFactor * activeQuarterMinutesMult,
    isOvertime
  );
  const midQuarterFoulOutPenalty =
    !isAlreadyFouledOut && fouledOutNow
      ? LIVE_GAME_CONFIG.fouledOutLiftPenalty * (1 - foulOutQuarterShare)
      : 0;
  const midQuarterFoulOutDefPenalty =
    !isAlreadyFouledOut && fouledOutNow
      ? LIVE_GAME_CONFIG.fouledOutDefPenalty * (1 - foulOutQuarterShare)
      : 0;
  const playerCourtLift = isAlreadyFouledOut
    ? -LIVE_GAME_CONFIG.fouledOutLiftPenalty
    : qPts - qFga * 0.85 + qAst * 1.35 - replacement.lift - midQuarterFoulOutPenalty;
  const myQScore = Math.max(
    isOvertime ? 4 : 11,
    isAlreadyFouledOut ? 0 : qPts + (qAst > 0 ? 2 : 0),
    Math.round(
      baseTeamQuarterPts +
        paceRatingOffset +
        playerCourtLift * LIVE_GAME_CONFIG.playerImpactWeight +
        (rng() - 0.5) * 8.5
    )
  );

  const oppAdvantage = (liveGame.opponentTeam.rating - teamRating) * 0.24;
  const defSuppression = isAlreadyFouledOut
    ? -LIVE_GAME_CONFIG.fouledOutDefPenalty
    : mod.defBonus * roleMinutesFactor * activeQuarterMinutesMult +
      (stats.def - ldr) * 0.08 * roleMinutesFactor * activeQuarterMinutesMult +
      (qStl + qBlk - replacement.stocks) * 1.35 -
      bio.perimeterDefPenalty * 0.14 * roleMinutesFactor * activeQuarterMinutesMult -
      midQuarterFoulOutDefPenalty;
  let oppQScore = Math.max(
    isOvertime ? 4 : 11,
    Math.round(
      baseOppQuarterPts +
        paceRatingOffset +
        oppAdvantage -
        defSuppression * LIVE_GAME_CONFIG.defImpactWeight +
        (rng() - 0.5) * 8.5
    )
  );

  const nextTeamScore = liveGame.teamScore + myQScore;
  let nextOppScore = liveGame.oppScore + oppQScore;

  // 최대 연장(3OT)까지도 동점이면 마지막 서든데스 2점으로 자연 결착
  if (
    isOvertime &&
    overtimeCount >= LIVE_GAME_CONFIG.maxOvertimePeriods &&
    nextTeamScore === nextOppScore
  ) {
    const teamEdge = teamRating + (ovr - ldr) * 0.3 + (hasClutchTrait ? 3 : 0);
    if (teamEdge >= liveGame.opponentTeam.rating) {
      oppQScore = Math.max(2, oppQScore - 2);
    } else {
      oppQScore += 2;
    }
    nextOppScore = liveGame.oppScore + oppQScore;
  }

  // 🔥 자연 클러치 1포제션 발동 조건:
  // 4쿼터 종료 직전, 파울아웃되지 않았고, 실제 점수 차가 ±3점 이내(|diff| <= 3)일 때만 발동!
  // 스코어는 단 1점도 조작하지 않고 실제 누적 점수를 그대로 유지합니다.
  const scoreDiff = nextTeamScore - nextOppScore;
  let triggerClutchPossession = false;
  let clutchScenario: ClutchScenarioType | undefined = undefined;
  let clutchSituationText: string | undefined = undefined;

  if (
    nextQ === 4 &&
    !liveGame.clutchPossessionResolved &&
    !fouledOutNow &&
    Math.abs(scoreDiff) <= LIVE_GAME_CONFIG.clutchMaxPointGap
  ) {
    triggerClutchPossession = true;
    if (scoreDiff < 0) {
      clutchScenario = 'TRAILING';
      clutchSituationText = `4쿼터 종료 14.2초 전, ${nextTeamScore}:${nextOppScore}(${Math.abs(
        scoreDiff
      )}점 차 열세). 마지막 공격권이 ${career.name}에게 주어집니다.`;
    } else if (scoreDiff > 0) {
      clutchScenario = 'LEADING';
      clutchSituationText = `4쿼터 종료 14.2초 전, ${nextTeamScore}:${nextOppScore}(${scoreDiff}점 차 리드). 상대의 마지막 공격을 막아내면 승리가 확정됩니다.`;
    } else {
      clutchScenario = 'TIED';
      clutchSituationText = `4쿼터 종료 14.2초 전, ${nextTeamScore}:${nextOppScore} 동점. 마지막 공격권으로 승부를 끝낼 기회입니다.`;
    }
  }

  const nextMomentum: 'HOT' | 'NEUTRAL' | 'COLD' =
    qPts >= 8 || myQScore - oppQScore >= 5
      ? 'HOT'
      : qFgm === 0 && qFga >= 4
      ? 'COLD'
      : 'NEUTRAL';

  const qLabel = isOvertime ? `OT${overtimeCount}` : `${nextQ}Q`;
  const pbp: string[] = [];

  if (isAlreadyFouledOut) {
    pbp.push(
      `[${qLabel}] ${career.name}이 ${foulLimit}반칙 퇴장으로 벤치에서 경기를 지켜봅니다.`
    );
  } else {
    pbp.push(`[${qLabel}] '${mod.label}' 전술로 쿼터를 시작합니다.`);
    if (fouledOutNow) {
      pbp.push(
        `${career.name}, ${qLabel} 중반 개인 ${foulLimit}반칙 파울 아웃으로 코트를 떠납니다.`
      );
    } else if (inFoulTrouble) {
      pbp.push(
        `개인 반칙 ${liveGame.playerStats.fouls}개로 파울 관리에 들어갑니다.`
      );
    }

    if (qPts >= 7) {
      pbp.push(
        `${career.name}, ${qLabel} ${qPts}득점(${
          qTpm > 0 ? `3점슛 ${qTpm}개 포함` : '인사이드 집중 공략'
        })으로 공격을 이끕니다.`
      );
    } else if (qAst >= 3) {
      pbp.push(
        `${career.name}, 날카로운 패스 전개로 ${qAst}어시스트를 기록합니다.`
      );
    } else if (qPts <= 2 && qFga >= 4) {
      pbp.push(
        `${liveGame.opponentTeam.shortName}의 강한 압박에 ${career.name}의 야투가 침묵합니다 (${qFgm}/${qFga}).`
      );
    } else {
      pbp.push(
        `${career.name}, ${qPts}점 ${qReb}리바운드 ${qAst}어시스트로 흐름을 조율합니다.`
      );
    }
  }

  if (triggerClutchPossession && clutchSituationText) {
    pbp.push(clutchSituationText);
  } else if (nextQ >= 4 && nextTeamScore === nextOppScore) {
    pbp.push(
      `${qLabel} 종료 ${nextTeamScore}:${nextOppScore} 동점, 연장전(OT)으로 돌입합니다.`
    );
  } else if (qBlk > 0 || qStl > 0) {
    pbp.push(
      `${career.name}의 ${
        qBlk > 0 ? '결정적 블록슛' : '스틸'
      }으로 ${liveGame.opponentTeam.shortName}의 흐름을 끊습니다.`
    );
  } else if (myQScore >= oppQScore + 4) {
    pbp.push(
      `${liveGame.playerTeam.shortName}, 쿼터 스코어 ${myQScore}-${oppQScore}로 주도권을 잡습니다.`
    );
  } else {
    pbp.push(
      `누적 스코어 ${nextTeamScore}:${nextOppScore}로 ${qLabel}가 종료됩니다.`
    );
  }

  const prevPlayerStats: LivePlayerBoxSnapshot = { ...liveGame.playerStats };
  const updatedPlayerStats: LivePlayerBoxSnapshot = {
    pts: liveGame.playerStats.pts + qPts,
    reb: liveGame.playerStats.reb + qReb,
    ast: liveGame.playerStats.ast + qAst,
    stl: liveGame.playerStats.stl + qStl,
    blk: liveGame.playerStats.blk + qBlk,
    fgm: liveGame.playerStats.fgm + qFgm,
    fga: liveGame.playerStats.fga + qFga,
    tpm: liveGame.playerStats.tpm + qTpm,
    tpa: liveGame.playerStats.tpa + qTpa,
    fouls: nextFouls,
    stamina: nextStamina,
  };

  const quarterPlays = generateQuarterCourtPlays({
    quarter: nextQ,
    qLabel,
    isOvertime,
    playerName: career.name,
    playerTeamShort: liveGame.playerTeam.shortName,
    oppTeamShort: liveGame.opponentTeam.shortName,
    startTeamScore: liveGame.teamScore,
    startOppScore: liveGame.oppScore,
    myQScore,
    oppQScore,
    qPts,
    qTpm,
    qTpa,
    qFgm,
    qFga,
    freeThrows,
    qReb,
    qAst,
    qStl,
    qBlk,
    addedFoul: Math.max(0, nextFouls - liveGame.playerStats.fouls),
    fouledOutNow,
    isAlreadyFouledOut,
    foulLimit,
    triggerClutchPossession,
    prevPlayerStats,
    updatedPlayerStats,
    rng,
  });

  const logEntry: LiveQuarterLog = {
    quarter: nextQ,
    label: qLabel,
    teamPts: myQScore,
    oppPts: oppQScore,
    playerPts: qPts,
    playerReb: qReb,
    playerAst: qAst,
    startTeamScore: liveGame.teamScore,
    startOppScore: liveGame.oppScore,
    startPlayerStats: prevPlayerStats,
    playByPlay: pbp,
    plays: quarterPlays,
  };

  if (triggerClutchPossession) {
    return {
      ...liveGame,
      quarter: nextQ,
      isFinished: false,
      foulLimit,
      fouledOut: fouledOutNow,
      overtimeCount,
      pendingClutchPossession: true,
      clutchScenario,
      clutchSituationText,
      teamScore: nextTeamScore,
      oppScore: nextOppScore,
      currentTactic: chosenTactic,
      momentum: nextMomentum,
      playerStats: updatedPlayerStats,
      quarterLogs: [...liveGame.quarterLogs, logEntry],
    };
  }

  const isGameFinished = nextQ >= 4 && nextTeamScore !== nextOppScore;

  let finalOutcome: LiveGameState['finalOutcome'] = undefined;
  if (isGameFinished) {
    finalOutcome = buildFinalOutcome(
      liveGame,
      career,
      nextTeamScore,
      nextOppScore,
      updatedPlayerStats
    );
  }

  return {
    ...liveGame,
    quarter: nextQ,
    isFinished: isGameFinished,
    foulLimit,
    fouledOut: fouledOutNow,
    overtimeCount,
    pendingClutchPossession: false,
    teamScore: nextTeamScore,
    oppScore: nextOppScore,
    currentTactic: chosenTactic,
    momentum: nextMomentum,
    playerStats: updatedPlayerStats,
    quarterLogs: [...liveGame.quarterLogs, logEntry],
    finalOutcome,
  };
}

/**
 * 🔥 4쿼터 실제 ±3점 이내 접전 '클러치 마지막 1포제션' 판정 (실제 2점/3점/자유투/수비 점수만 정확히 가산!)
 * - 절대 점수를 텔레포트 조작하지 않습니다. 동점이 되면 자연스럽게 연장전(OT)으로 진입합니다!
 */
export function resolveClutchPossession(
  liveGame: LiveGameState,
  career: CareerState,
  choice: ClutchChoiceId,
  rng: () => number = Math.random
): LiveGameState {
  if (!liveGame.pendingClutchPossession || liveGame.isFinished) {
    return liveGame;
  }

  const stats = career.stats;
  const tournamentType = getLiveGameTournamentType(liveGame);
  const ldr =
    tournamentType
      ? INTERNATIONAL_TOURNAMENT_CONFIG[tournamentType].ldr
      : LEAGUE_CONFIG[career.league].ldr;
  const traits = career.traits || [];
  const hasClutchTrait = traits.includes('CLUTCH_PERFORMER');
  const hasSniperTrait = traits.includes('SNIPER');
  const bio = calculateBiomechanicalProfile(career.heightCm, career.primaryPos);

  const staminaMod = clampNum(
    ((liveGame.playerStats.stamina - 45) / 100) * 0.14,
    -0.08,
    0.05
  );
  const clutchBonus = hasClutchTrait ? 0.12 : 0;

  const nextStats = { ...liveGame.playerStats };
  let nextTeamScore = liveGame.teamScore;
  let nextOppScore = liveGame.oppScore;
  const deficit = nextOppScore - nextTeamScore; // >0이면 열세, <0이면 리드, 0이면 동점
  let clutchPlayLine = '';
  let customClutchNote = '';
  let clutchConverted = false;

  if (choice === 'ISO_WINNER') {
    // 3~4점 열세면 3점슛 시도, 1~2점 열세 또는 동점이면 선수 성향(OUT vs INS)에 따라 3점 또는 2점 돌파 선택
    const isThreeShot = deficit >= 3 || (stats.out >= stats.ins + 4 && rng() < 0.65);
    const shotPoints = isThreeShot ? 3 : 2;
    const attackSkill = isThreeShot
      ? stats.out * 0.78 + stats.ply * 0.22
      : stats.ins * 0.72 + stats.phy * 0.28;
    const successProb = clampNum(
      (isThreeShot ? 0.41 : 0.5) +
        (attackSkill - ldr) * 0.011 +
        clutchBonus +
        (isThreeShot && hasSniperTrait ? 0.06 : 0) +
        staminaMod -
        bio.positionalPhysicsStrain * 0.12,
      LIVE_GAME_CONFIG.clutchProbMin,
      LIVE_GAME_CONFIG.clutchProbMax
    );

    const succeeded = rng() < successProb;
    nextStats.fga += 1;
    if (isThreeShot) nextStats.tpa += 1;

    if (succeeded) {
      clutchConverted = true;
      nextStats.fgm += 1;
      if (isThreeShot) nextStats.tpm += 1;
      nextStats.pts += shotPoints;
      nextTeamScore += shotPoints;

      if (nextTeamScore > nextOppScore) {
        clutchPlayLine = `4Q 0:01.8 · ${career.name}, 클러치 ${shotPoints}점 위닝샷 성공 (${nextTeamScore}:${nextOppScore})`;
        customClutchNote = `${career.name} 결승 ${shotPoints}점 클러치 슛`;
      } else if (nextTeamScore === nextOppScore) {
        clutchPlayLine = `4Q 0:01.8 · ${career.name}, 동점 클러치 ${shotPoints}점슛 성공 · 연장전 돌입 (${nextTeamScore}:${nextOppScore})`;
        customClutchNote = `${career.name} 동점 클러치 슛`;
      } else {
        clutchPlayLine = `4Q 0:01.8 · ${career.name}, 추격 ${shotPoints}점슛 성공했으나 1점 차 석패 (${nextTeamScore}:${nextOppScore})`;
        customClutchNote = '종료 직전 추격포 (석패)';
      }
    } else {
      clutchPlayLine =
        nextTeamScore === nextOppScore
          ? `4Q 0:01.8 · ${career.name}의 마지막 ${shotPoints}점 슛 림 외면 · 연장전 돌입 (${nextTeamScore}:${nextOppScore})`
          : `4Q 0:01.8 · ${career.name}의 마지막 ${shotPoints}점 슛 불발 (${nextTeamScore}:${nextOppScore})`;
      customClutchNote = '마지막 클러치 슛 불발';
    }
  } else if (choice === 'KICKOUT_ASSIST') {
    const passSkill = stats.ply * 0.72 + liveGame.playerTeam.rating * 0.28;
    const successProb = clampNum(
      0.44 +
        (passSkill - ldr) * 0.011 +
        clutchBonus * 0.75 +
        staminaMod -
        bio.tovRatePenalty * 0.08,
      LIVE_GAME_CONFIG.clutchProbMin,
      LIVE_GAME_CONFIG.clutchProbMax
    );
    const succeeded = rng() < successProb;
    if (succeeded) {
      clutchConverted = true;
      nextStats.ast += 1;
      nextTeamScore += 3;
      if (nextTeamScore > nextOppScore) {
        clutchPlayLine = `4Q 0:01.8 · ${career.name} 코너 킥아웃 패스, 동료 결승 3점슛 성공 (${nextTeamScore}:${nextOppScore})`;
        customClutchNote = `${career.name} 결승 킥아웃 어시스트`;
      } else if (nextTeamScore === nextOppScore) {
        clutchPlayLine = `4Q 0:01.8 · ${career.name} 킥아웃 어시스트로 동점 3점 성공 · 연장전 돌입 (${nextTeamScore}:${nextOppScore})`;
        customClutchNote = '동점 킥아웃 어시스트';
      } else {
        clutchPlayLine = `4Q 0:01.8 · ${career.name} 패스로 동료 3점 성공, 1점 차 석패 (${nextTeamScore}:${nextOppScore})`;
        customClutchNote = '추격 킥아웃 어시스트 (석패)';
      }
    } else {
      clutchPlayLine =
        nextTeamScore === nextOppScore
          ? `4Q 0:01.8 · 코너 3점슛 불발 · 동점 연장전 돌입 (${nextTeamScore}:${nextOppScore})`
          : `4Q 0:01.8 · 코너 동료의 오픈 3점슛 불발로 경기 종료 (${nextTeamScore}:${nextOppScore})`;
      customClutchNote = '마지막 코너 3점 불발';
    }
  } else if (choice === 'LOCKDOWN_STOP') {
    // 리드 상황(1~4점 앞섬): 상대 마지막 공격을 전담 수비로 봉쇄
    const defSkill = stats.def * 0.72 + stats.phy * 0.28;
    const stopProb = clampNum(
      0.54 +
        (defSkill - ldr) * 0.011 +
        clutchBonus * 0.8 +
        staminaMod -
        bio.perimeterDefPenalty * 0.04,
      0.28,
      0.88
    );
    const stopped = rng() < stopProb;
    if (stopped) {
      clutchConverted = true;
      const gotHighlight = rng() < 0.55;
      if (gotHighlight) {
        if (career.primaryPos === 'C' || career.primaryPos === 'PF') {
          nextStats.blk += 1;
        } else {
          nextStats.stl += 1;
        }
      }
      clutchPlayLine = `4Q 0:01.8 · ${career.name}, 상대 마지막 공격 완벽 봉쇄로 승리 확정 (${nextTeamScore}:${nextOppScore})`;
      customClutchNote = `${career.name} 클러치 수비 스톱`;
    } else {
      const lead = nextTeamScore - nextOppScore;
      const oppShotPts = lead >= 3 ? 3 : rng() < 0.45 ? 3 : 2;
      nextOppScore += oppShotPts;
      if (nextTeamScore > nextOppScore) {
        clutchPlayLine = `4Q 0:01.8 · 상대 ${oppShotPts}점슛 허용했으나 리드 수성 (${nextTeamScore}:${nextOppScore})`;
        customClutchNote = '상대 추격포 허용에도 승리 수성';
      } else if (nextTeamScore === nextOppScore) {
        clutchPlayLine = `4Q 0:01.8 · 종료 직전 ${oppShotPts}점 실점 · 동점 연장전 돌입 (${nextTeamScore}:${nextOppScore})`;
        customClutchNote = '종료 직전 동점 실점';
      } else {
        clutchPlayLine = `4Q 0:01.8 · 상대 ${oppShotPts}점 버저비터 허용으로 역전패 (${nextTeamScore}:${nextOppScore})`;
        customClutchNote = '역전 버저비터 허용';
      }
    }
  } else {
    // CLUTCH_FREE_THROWS (리드 상황): 시간 소진 후 상대 파울 작전 유도 → 클러치 자유투 2구
    const ftProb = clampNum(
      0.7 +
        (stats.out - 60) * 0.006 +
        (hasClutchTrait ? 0.08 : 0) +
        staminaMod * 0.6,
      0.55,
      0.97
    );
    const ft1 = rng() < ftProb ? 1 : 0;
    const ft2 = rng() < ftProb ? 1 : 0;
    const ftMade = ft1 + ft2;
    nextStats.pts += ftMade;
    nextTeamScore += ftMade;

    // 상대 마지막 딥쓰리(초장거리 버저비터) 시도
    const leadAfterFt = nextTeamScore - nextOppScore;
    const desperateMake =
      leadAfterFt <= 3 && rng() < clampNum(0.18 + (liveGame.opponentTeam.rating - 82) * 0.008, 0.1, 0.28);
    if (desperateMake) {
      nextOppScore += 3;
    }

    if (nextTeamScore > nextOppScore) {
      if (ftMade === 2) clutchConverted = true;
      clutchPlayLine = `4Q 0:01.8 · ${career.name}, 클러치 자유투 ${ftMade}/2 성공으로 승리 확정 (${nextTeamScore}:${nextOppScore})`;
      customClutchNote = `클러치 자유투 ${ftMade}/2 성공`;
    } else if (nextTeamScore === nextOppScore) {
      clutchPlayLine = `4Q 0:01.8 · 자유투 ${ftMade}/2 후 상대 3점포 허용 · 연장전 돌입 (${nextTeamScore}:${nextOppScore})`;
      customClutchNote = '상대 동점 3점 허용';
    } else {
      clutchPlayLine = `4Q 0:01.8 · 자유투 ${ftMade}/2에 그친 뒤 상대 역전 3점 허용 (${nextTeamScore}:${nextOppScore})`;
      customClutchNote = '자유투 불발 후 역전 3점 허용';
    }
  }

  const updatedLogs = [...liveGame.quarterLogs];
  if (updatedLogs.length > 0) {
    const lastIdx = updatedLogs.length - 1;
    const prevLog = updatedLogs[lastIdx];
    const teamDelta = nextTeamScore - liveGame.teamScore;
    const oppDelta = nextOppScore - liveGame.oppScore;
    const playerShotPts = choice === 'LOCKDOWN_STOP' ? 0 : Math.min(3, Math.max(0, teamDelta));
    const clutchBadge =
      choice === 'LOCKDOWN_STOP'
        ? oppDelta === 0
          ? 'STOP'
          : `-${oppDelta}`
        : choice === 'KICKOUT_ASSIST'
        ? playerShotPts > 0
          ? `AST +${playerShotPts}`
          : 'MISS'
        : playerShotPts > 0
        ? `+${playerShotPts}`
        : 'MISS';
    const clutchPlay: LiveCourtPlay = {
      id: `Q${prevLog.quarter}_CLUTCH`,
      clock: '0:01.8',
      actor:
        choice === 'LOCKDOWN_STOP' && oppDelta > 0
          ? 'OPPONENT'
          : 'PLAYER',
      type: 'CLUTCH',
      showOnCourt: true,
      shotPoints: playerShotPts,
      courtBadge: clutchBadge,
      fromX: choice === 'KICKOUT_ASSIST' ? 50 : undefined,
      fromY: choice === 'KICKOUT_ASSIST' ? 42 : undefined,
      x:
        choice === 'KICKOUT_ASSIST'
          ? 97
          : choice === 'CLUTCH_FREE_THROWS'
          ? 50
          : choice === 'LOCKDOWN_STOP'
          ? 50
          : teamDelta === 3 || deficit >= 3
          ? 90
          : 52,
      y:
        choice === 'KICKOUT_ASSIST'
          ? 20
          : choice === 'CLUTCH_FREE_THROWS'
          ? 46
          : choice === 'LOCKDOWN_STOP'
          ? 24
          : teamDelta === 3 || deficit >= 3
          ? 72
          : 26,
      teamScoreBefore: liveGame.teamScore,
      oppScoreBefore: liveGame.oppScore,
      teamDelta,
      oppDelta,
      teamScoreAfter: nextTeamScore,
      oppScoreAfter: nextOppScore,
      playerStatsAfter: { ...nextStats },
      text: clutchPlayLine,
    };
    updatedLogs[lastIdx] = {
      ...prevLog,
      teamPts: prevLog.teamPts + teamDelta,
      oppPts: prevLog.oppPts + oppDelta,
      playerPts: prevLog.playerPts + (nextStats.pts - liveGame.playerStats.pts),
      playerAst: prevLog.playerAst + (nextStats.ast - liveGame.playerStats.ast),
      playByPlay: [...prevLog.playByPlay, clutchPlayLine],
      plays: [...(prevLog.plays || []), clutchPlay],
    };
  }

  // 동점이 되었다면 경기를 끝내지 않고 연장전(OT) 진행 대기 상태로 전환!
  const updatedLiveForOutcome: LiveGameState = {
    ...liveGame,
    clutchConvertedInGame: Boolean(liveGame.clutchConvertedInGame || clutchConverted),
  };

  if (nextTeamScore === nextOppScore) {
    return {
      ...updatedLiveForOutcome,
      teamScore: nextTeamScore,
      oppScore: nextOppScore,
      isFinished: false,
      pendingClutchPossession: false,
      clutchPossessionResolved: true,
      clutchSituationText: clutchPlayLine,
      playerStats: nextStats,
      quarterLogs: updatedLogs,
    };
  }

  const finalOutcome = buildFinalOutcome(
    updatedLiveForOutcome,
    career,
    nextTeamScore,
    nextOppScore,
    nextStats,
    customClutchNote
  );

  return {
    ...updatedLiveForOutcome,
    teamScore: nextTeamScore,
    oppScore: nextOppScore,
    isFinished: true,
    pendingClutchPossession: false,
    clutchPossessionResolved: true,
    clutchSituationText: clutchPlayLine,
    playerStats: nextStats,
    quarterLogs: updatedLogs,
    finalOutcome,
  };
}

/**
 * 실시간 결승전 경기를 남은 쿼터 모두 즉시 시뮬레이션하여 최종 결과로 이동합니다.
 */
export function skipLiveGameToEnd(
  liveGame: LiveGameState,
  career: CareerState,
  rng: () => number = Math.random
): LiveGameState {
  let current = { ...liveGame };
  let guard = 0;
  while (!current.isFinished && guard < 12) {
    if (current.pendingClutchPossession) {
      let autoChoice: ClutchChoiceId;
      if (current.clutchScenario === 'LEADING') {
        autoChoice =
          career.stats.def >= career.stats.out
            ? 'LOCKDOWN_STOP'
            : 'CLUTCH_FREE_THROWS';
      } else {
        autoChoice =
          career.stats.ply > Math.max(career.stats.ins, career.stats.out) + 5
            ? 'KICKOUT_ASSIST'
            : 'ISO_WINNER';
      }
      current = resolveClutchPossession(current, career, autoChoice, rng);
    } else {
      current = simulateLiveQuarter(
        current,
        career,
        current.currentTactic || 'UNSELFISH_PASS',
        rng
      );
    }
    guard++;
  }
  return {
    ...current,
    wasSkipped: true,
  };
}
