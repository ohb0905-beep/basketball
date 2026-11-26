import type { CareerState, PlayoffBracketState, PlayoffSeriesMatchup, StandingEntry } from '../types/game';
import { simulateSingleSeries } from './playoffEngine';
import { getSeriesSeedModifiers } from './playoffStrength';

export type DecisiveGameKind = 'CLINCH' | 'ELIMINATION' | 'WINNER_TAKES_ALL';

/** 다음 경기가 결정전(어느 쪽이든 winsNeeded-1승)이면 그 상황을, 아니면 null을 돌려줍니다. */
export function getDecisiveGameContext(
  series: PlayoffSeriesMatchup,
  playerTeamId: string
): { gameNo: number; playerWins: number; oppWins: number; kind: DecisiveGameKind } | null {
  if (series.winnerId) return null;
  const playerIsHigher = series.higherSeed.team.id === playerTeamId;
  const playerWins = playerIsHigher ? series.higherSeedWins : series.lowerSeedWins;
  const oppWins = playerIsHigher ? series.lowerSeedWins : series.higherSeedWins;
  const decisive = series.winsNeeded - 1;
  if (playerWins > decisive || oppWins > decisive) return null;
  const playerPoint = playerWins === decisive;
  const oppPoint = oppWins === decisive;
  if (!playerPoint && !oppPoint) return null;
  const kind = playerPoint && oppPoint ? 'WINNER_TAKES_ALL' : playerPoint ? 'CLINCH' : 'ELIMINATION';
  return { gameNo: playerWins + oppWins + 1, playerWins, oppWins, kind };
}

export function getPlayerFinalsSeries(bracket: PlayoffBracketState): PlayoffSeriesMatchup | null {
  const last = bracket.rounds[bracket.rounds.length - 1];
  return last?.find((s) => s.involvesPlayer) ?? null;
}

function replaceFinalsSeries(
  bracket: PlayoffBracketState,
  next: PlayoffSeriesMatchup
): PlayoffBracketState {
  const lastIdx = bracket.rounds.length - 1;
  const rounds = bracket.rounds.map((list, i) =>
    i === lastIdx ? list.map((s) => (s.involvesPlayer ? next : s)) : list
  );
  return { ...bracket, rounds };
}

/** 선수 결승 시리즈를 결정전 직전까지 시뮬하고 라이브 중계 대기 상태로 만듭니다. */
export function simulateFinalsToDecisiveGame(
  bracket: PlayoffBracketState,
  career: CareerState,
  rng: () => number = Math.random
): PlayoffBracketState {
  const series = getPlayerFinalsSeries(bracket);
  if (!series) return bracket;
  const simulated = simulateSingleSeries(
    series,
    career,
    rng,
    'DECISIVE_GAME',
    getSeriesSeedModifiers(bracket, series)
  );
  return {
    ...replaceFinalsSeries(bracket, simulated),
    pendingFinalsLiveGame: !simulated.winnerId,
  };
}

/** 결승 라이브 경기 결과를 브래킷에 반영합니다. 시리즈가 끝나면 우승/준우승까지 확정합니다. */
export function resolveFinalsLiveGameInBracket(
  bracket: PlayoffBracketState,
  career: CareerState,
  _standings: StandingEntry[],
  playerWon: boolean,
  scoreLine: string,
  rng: () => number = Math.random
): { bracket: PlayoffBracketState; seriesFinished: boolean } {
  const series = getPlayerFinalsSeries(bracket);
  // 이미 끝난 시리즈에 같은 경기가 다시 들어오면 그대로 둡니다.
  if (!series || series.winnerId) return { bracket, seriesFinished: false };

  const playerId = career.team.id;
  const playerIsHigher = series.higherSeed.team.id === playerId;
  const oppEntry = playerIsHigher ? series.lowerSeed : series.higherSeed;
  const ctx = bracket.pendingFinalsLiveGame ? getDecisiveGameContext(series, playerId) : null;

  // 결정전 상태가 아닌데 호출되면(1.3.2 라이브) 예전처럼 이 경기가 시리즈를 결정하고 패자는 winsNeeded-1승으로 둡니다.
  const loserWins = series.winsNeeded - 1;
  const playerWins = ctx
    ? ctx.playerWins + (playerWon ? 1 : 0)
    : playerWon ? series.winsNeeded : loserWins;
  const oppWins = ctx
    ? ctx.oppWins + (playerWon ? 0 : 1)
    : playerWon ? loserWins : series.winsNeeded;
  const seriesDone = playerWins >= series.winsNeeded || oppWins >= series.winsNeeded;

  const next: PlayoffSeriesMatchup = {
    ...series,
    higherSeedWins: playerIsHigher ? playerWins : oppWins,
    lowerSeedWins: playerIsHigher ? oppWins : playerWins,
    winnerId: seriesDone ? (playerWon ? playerId : oppEntry.team.id) : null,
    summaryLog: [
      ...series.summaryLog,
      `${ctx ? ctx.gameNo : playerWins + oppWins}차전 실시간 중계: ${scoreLine}`,
    ],
  };

  if (!seriesDone) {
    return {
      bracket: simulateFinalsToDecisiveGame(replaceFinalsSeries(bracket, next), career, rng),
      seriesFinished: false,
    };
  }
  return {
    bracket: {
      ...replaceFinalsSeries(bracket, next),
      championTeamId: next.winnerId,
      playerEliminated: !playerWon,
      playoffResultLabel: playerWon ? '리그 우승' : '파이널 준우승',
      pendingFinalsLiveGame: false,
    },
    seriesFinished: true,
  };
}
