import { canUseProTradeSystem } from '../config/balanceConfig';
import { LEAGUE_CONFIG } from '../data/leagues';
import { getTeamById, SANGMU_TEAM } from '../data/teams';
import {
  CareerRetrospective,
  CareerState,
  ContractType,
  HallOfFameEntry,
  LeagueId,
  LegacyEvaluation,
  RecordBookState,
  TeamInfo,
} from '../types/game';
import { stripLeadingEmoji } from '../utils/formatters';
import {
  normalizeRecordBook,
  syncRecordBookWithHof,
} from '../engine/recordBookEngine';
import {
  getEffectiveRelationships,
  getEffectiveStoryArcs,
} from '../engine/progressionEngine';
import {
  evaluatePlayerBadges,
  reconcilePlaystyleForPosition,
} from '../engine/statCalculator';

const LEGACY_TEAM_TO_LEAGUE: Record<string, LeagueId> = {
  OVR_CHIBA: 'B_LEAGUE',
  OVR_ALVARK: 'B_LEAGUE',
  OVR_SYDNEY: 'NBL',
  OVR_MELBOURNE: 'NBL',
  OVR_PARTIZAN: 'EUROLEAGUE',
  OVR_REALMADRID: 'EUROLEAGUE',
};

export function migrateLegacyLeagueId(
  league?: string | null,
  teamId?: string | null
): LeagueId {
  if (league === 'OVERSEAS') {
    if (teamId && LEGACY_TEAM_TO_LEAGUE[teamId]) {
      return LEGACY_TEAM_TO_LEAGUE[teamId];
    }
    const lookedUp = teamId ? getTeamById(teamId) : undefined;
    if (lookedUp) return lookedUp.league;
    return 'B_LEAGUE';
  }
  if (
    league === 'HIGH_SCHOOL' ||
    league === 'U_LEAGUE' ||
    league === 'NCAA' ||
    league === 'KBL' ||
    league === 'B_LEAGUE' ||
    league === 'NBL' ||
    league === 'EUROLEAGUE' ||
    league === 'GLEAGUE' ||
    league === 'NBA'
  ) {
    return league;
  }
  return 'KBL';
}

export function migrateLegacyContractType(
  contractType?: string | null,
  league?: LeagueId
): ContractType {
  if (contractType === 'OVERSEAS_CONTRACT') {
    if (league === 'EUROLEAGUE') return 'EUROLEAGUE_CONTRACT';
    if (league === 'NBL') return 'NBL_CONTRACT';
    return 'BLEAGUE_CONTRACT';
  }
  if (contractType === 'NBA_SUPERMAX') {
    return 'NBA_MAX';
  }
  if (contractType === 'NBL_NEXT_STARS') {
    return 'NBL_CONTRACT';
  }
  return (contractType as ContractType) || 'AMATEUR';
}

export function stripLegacyTeamMascot(name: string): string {
  if (name.includes('국군체육부대')) return SANGMU_TEAM.name;
  return name.replace(/\s*\([^)]+\)$/, '');
}

export function normalizeTeamInfo(team: TeamInfo): TeamInfo {
  if (team.id === 'KOR_NAT_TEAM') {
    return {
      ...team,
      primaryColor: '#0047A0',
      secondaryColor: '#CD2E3A',
      espnAbbr: 'KOR',
      logoUrl: '/logos/NAT_KOR.svg',
    };
  }
  const latest = getTeamById(team.id);
  if (latest && latest.id === team.id) {
    return {
      ...team,
      league: latest.league,
      name: latest.name,
      shortName: latest.shortName,
      logoUrl: latest.logoUrl || team.logoUrl,
    };
  }
  const migratedLeague = migrateLegacyLeagueId(team.league, team.id);
  if (migratedLeague === 'U_LEAGUE' || team.id === SANGMU_TEAM.id) {
    return {
      ...team,
      league: migratedLeague,
      name: stripLegacyTeamMascot(team.name),
    };
  }
  return {
    ...team,
    league: migratedLeague,
  };
}

function cleanLegacyTitle(title: string): string {
  return stripLeadingEmoji(title)
    .replace(/^GOAT\s*\(역대 최고 농구 황제\)$/, '역대 최고 선수 (GOAT)')
    .replace(/^네이스미스 명예의 전당 퍼스트 발롯$/, '명예의 전당 퍼스트 발롯')
    .replace(/^자랑스러운 NBA 올스타 & 챔피언$/, 'NBA 올스타 · 챔피언')
    .replace(/^당당한 NBA 정식 리거 & 베테랑$/, 'NBA 정식 리거')
    .replace(/^KBL & 아시아 올타임 레전드$/, 'KBL · 아시아 최정상급 선수')
    .replace(/^든든한 프로 베테랑$/, '프로 베테랑');
}

function normalizeLegacyEvaluation(
  ev: LegacyEvaluation | null
): LegacyEvaluation | null {
  if (!ev) return null;
  return {
    ...ev,
    tierTitle: cleanLegacyTitle(ev.tierTitle),
    tierEmoji: '',
    honoredTeam: normalizeTeamInfo(ev.honoredTeam),
  };
}

function normalizeRetrospective(
  retro?: CareerRetrospective | null
): CareerRetrospective | null {
  if (!retro) return null;
  return {
    ...retro,
    championships: (retro.championships || []).map((champ) => {
      if (champ.isInternational || champ.logoUrl === '/logos/kor_flag.svg') {
        return {
          ...champ,
          isInternational: true,
          teamId: 'KOR_NAT_TEAM',
          logoUrl: '/logos/NAT_KOR.svg',
          primaryColor: '#0047a0',
          secondaryColor: '#cd2e3a',
        };
      }
      return champ;
    }),
    jerseyCeremony: retro.jerseyCeremony
      ? {
          ...retro.jerseyCeremony,
          honoredTeam: normalizeTeamInfo(retro.jerseyCeremony.honoredTeam),
        }
      : retro.jerseyCeremony,
  };
}

export function normalizeHofList(
  hofList?: HallOfFameEntry[] | null
): HallOfFameEntry[] {
  if (!Array.isArray(hofList)) return [];
  return hofList.map((entry) => ({
    ...entry,
    legacyTitle: cleanLegacyTitle(entry.legacyTitle),
    legacyEmoji: '',
    iconicTeam: normalizeTeamInfo(entry.iconicTeam),
    retrospective: normalizeRetrospective(entry.retrospective) ?? undefined,
  }));
}

export function normalizeCareerSave(
  career: CareerState | null
): CareerState | null {
  if (!career) return null;
  const isStuckAfterOffseasonSelection =
    !career.offseasonLocked &&
    career.seasonPhase === 'OFFSEASON' &&
    !career.retirementReason;

  // 구 세이브의 세부 지표 / 진화형 배지 / 롤백된 특수 계약 필드는 안전하게 제거
  const rawCareer = career as CareerState & Record<string, unknown>;
  const {
    secondaryMetrics: _legacySecondary,
    tieredBadges: _legacyTieredBadges,
    badgeTrackers: _legacyTrackers,
    hasNbaOutClause: _legacyNbaOut,
    buyoutFeeUsd: _legacyBuyout,
    isRookieScaleContract: _legacyRookieScale,
    ...cleanCareerRest
  } = rawCareer;
  void _legacySecondary;
  void _legacyTieredBadges;
  void _legacyTrackers;
  void _legacyNbaOut;
  void _legacyBuyout;
  void _legacyRookieScale;

  const normalizedTeam = normalizeTeamInfo(career.team);
  const migratedLeague = migrateLegacyLeagueId(career.league, normalizedTeam.id);
  const migratedContract = migrateLegacyContractType(
    career.contractType,
    migratedLeague
  );

  const hydratedRelationships = getEffectiveRelationships(career);
  const hydratedStoryArcs = getEffectiveStoryArcs(career);

  const rawSettlement = career.pendingSeasonSettlement as
    | (NonNullable<CareerState['pendingSeasonSettlement']> &
        Record<string, unknown>)
    | null
    | undefined;
  const cleanedSettlement = rawSettlement
    ? (() => {
        const {
          nextSecondaryMetrics: _s1,
          nextBadgeTrackers: _s2,
          nextTieredBadges: _s3,
          newlyPromotedBadges: _s4,
          ...restSettlement
        } = rawSettlement;
        void _s1;
        void _s2;
        void _s3;
        void _s4;
        return restSettlement;
      })()
    : null;

  const reconciledPlaystyle = reconcilePlaystyleForPosition(
    career.playstyle,
    career.stats,
    career.primaryPos
  );
  const reconciledBadges = career.stats
    ? evaluatePlayerBadges(
        career.stats,
        career.secondaryPos ?? null,
        career.growthDna,
        reconciledPlaystyle,
        career.traits,
        career.primaryPos
      )
    : (career.badges || []).map((b) => stripLeadingEmoji(b));

  const allowProTrade = canUseProTradeSystem({
    league: migratedLeague,
    contractType: migratedContract,
    isMilitaryTeam: normalizedTeam.isMilitaryTeam,
    teamId: normalizedTeam.id,
  });

  const normalizedSettlement = cleanedSettlement
    ? {
        ...cleanedSettlement,
        brokenRolePromise: allowProTrade
          ? Boolean(cleanedSettlement.brokenRolePromise)
          : false,
      }
    : null;

  return {
    ...(cleanCareerRest as CareerState),
    league: migratedLeague,
    contractType: migratedContract,
    brokenRolePromise: allowProTrade ? Boolean(career.brokenRolePromise) : false,
    playstyle: reconciledPlaystyle,
    seasonPhase: isStuckAfterOffseasonSelection
      ? 'REGULAR_SEASON'
      : career.seasonPhase,
    team: normalizedTeam,
    previousTeamBeforeMilitary: career.previousTeamBeforeMilitary
      ? normalizeTeamInfo(career.previousTeamBeforeMilitary)
      : null,
    badges: reconciledBadges,
    relationships: hydratedRelationships,
    storyArcs: hydratedStoryArcs,
    pendingSeasonSettlement: normalizedSettlement,
    currentStandings: (career.currentStandings || []).map((entry) => ({
      ...entry,
      team: normalizeTeamInfo(entry.team),
    })),
    rivals: (career.rivals || []).map((rival) => ({
      ...rival,
      league: migrateLegacyLeagueId(rival.league, rival.teamId),
    })),
    offseasonOptions: (career.offseasonOptions || [])
      .filter((opt) => (opt.actionType as string) !== 'EXERCISE_NBA_OUT')
      .map((opt) => {
        const rawOpt = opt as typeof opt & Record<string, unknown>;
        const {
          buyoutTotalUsd: _o1,
          nbaTeamContributionUsd: _o2,
          playerBuyoutCostUsd: _o3,
          isRfaOfferSheet: _o4,
          isSupermaxOffer: _o5,
          includesNbaOutClause: _o6,
          isNextStarsProgram: _o7,
          ...cleanOpt
        } = rawOpt;
        void _o1;
        void _o2;
        void _o3;
        void _o4;
        void _o5;
        void _o6;
        void _o7;

        const normalizedTargetTeam = opt.targetTeam
          ? normalizeTeamInfo(opt.targetTeam)
          : opt.targetTeam;
        const optLeague: LeagueId = opt.targetLeague
          ? migrateLegacyLeagueId(opt.targetLeague, normalizedTargetTeam?.id)
          : normalizedTargetTeam?.league || migratedLeague;
        const optContract = opt.contractType
          ? migrateLegacyContractType(opt.contractType, optLeague)
          : opt.contractType;
        const rawAction = opt.actionType as string;
        const normalizedActionType =
          rawAction === 'REQUEST_BUYOUT' || rawAction === 'REQUEST_MUTUAL_RELEASE'
            ? 'REQUEST_TRADE'
            : opt.actionType;
        return {
          ...(cleanOpt as typeof opt),
          actionType: normalizedActionType,
          title: opt.title
            .replace(/\[5성 슈퍼 유망주 특별 오퍼\]\s*/g, '')
            .replace(
              /\s*\((독수리|호랑이|청룡|사자|황소|코끼리|불사조|백마|곰|천마|불곰|상무 농구단)\)/g,
              ''
            ),
          targetLeague: optLeague,
          contractType: optContract,
          targetTeam: normalizedTargetTeam,
        };
      }),
    seasonLogs: (career.seasonLogs || []).map((log) => {
      const logLeague = migrateLegacyLeagueId(log.league, log.teamId);
      const wasLegacyOverseas = (log.league as string) === 'OVERSEAS';
      return {
        ...log,
        league: logLeague,
        leagueName: wasLegacyOverseas
          ? LEAGUE_CONFIG[logLeague]?.name || log.leagueName
          : log.leagueName,
        teamName:
          logLeague === 'U_LEAGUE' || log.teamId === SANGMU_TEAM.id
            ? stripLegacyTeamMascot(log.teamName)
            : log.teamName,
      };
    }),
    milestones: (career.milestones || []).map((m) => ({
      ...m,
      title: stripLeadingEmoji(m.title),
    })),
    playoffBracket: isStuckAfterOffseasonSelection
      ? null
      : career.playoffBracket
      ? {
          ...career.playoffBracket,
          league: migrateLegacyLeagueId(
            career.playoffBracket.league,
            normalizedTeam.id
          ),
          rounds: career.playoffBracket.rounds.map((round) =>
            round.map((match) => ({
              ...match,
              higherSeed: {
                ...match.higherSeed,
                team: normalizeTeamInfo(match.higherSeed.team),
              },
              lowerSeed: {
                ...match.lowerSeed,
                team: normalizeTeamInfo(match.lowerSeed.team),
              },
            }))
          ),
        }
      : null,
    liveGame: isStuckAfterOffseasonSelection
      ? null
      : career.liveGame
      ? {
          ...career.liveGame,
          playerTeam: normalizeTeamInfo(career.liveGame.playerTeam),
          opponentTeam: normalizeTeamInfo(career.liveGame.opponentTeam),
        }
      : null,
    legacyEvaluation: normalizeLegacyEvaluation(career.legacyEvaluation),
  };
}

export function migratePersistedPayload(payload: {
  career?: CareerState | null;
  hofList?: HallOfFameEntry[];
  recordBook?: RecordBookState | null;
  skipRecordSync?: boolean;
}): {
  career: CareerState | null;
  hofList: HallOfFameEntry[];
  recordBook: RecordBookState;
} {
  const career = normalizeCareerSave(payload.career ?? null);
  const hofList = normalizeHofList(payload.hofList);
  const recordBook = payload.skipRecordSync
    ? normalizeRecordBook(payload.recordBook)
    : syncRecordBookWithHof(payload.recordBook, hofList, career);
  return { career, hofList, recordBook };
}
