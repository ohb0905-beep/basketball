/**
 * 커리어 이벤트 선택 액션
 * (useCareerStore.ts에서 동작 변경 없이 그대로 옮긴 코드입니다.)
 */
import {
  DRAFT_SCOUTING_CONFIG,
  ECONOMY_CONFIG,
  INTERNATIONAL_TOURNAMENT_CONFIG,
  clampNum,
} from '../../config/balanceConfig';
import {
  createSangmuEnlistmentEvent,
  getMilitaryEnlistAgeForLeague,
} from '../../data/events';
import {
  getTeamsByLeague,
  SANGMU_TEAM,
} from '../../data/teams';
import {
  generateOffseasonOptions,
  getBaseTradeAcceptProb,
  preferPositionFitTeams,
  ROLE_PROMISE_LABELS,
} from '../../engine/draftEngine';
import {
  resolveEncounterChoiceOutcome,
} from '../../engine/encounterEngine';
import {
  createLiveFinalGame,
  simulateInternationalTournament,
} from '../../engine/playoffEngine';
import {
  applyRelationshipDelta,
  getEffectiveRelationships,
  getEffectiveStoryArcs,
} from '../../engine/progressionEngine';
import {
  checkEncounterChoiceUnlock,
} from '../../engine/storyArcEngine';
import {
  evaluateCareerLegacy,
} from '../../engine/retirementEngine';
import {
  calculateRoleAndMpg,
} from '../../engine/seasonSimulator';
import {
  applyAgeAdjustedEventStatChanges,
  calculateOvr,
  enforceBiomechanicalCaps,
  evaluatePlayerBadges,
  getPlaystyleInfo,
  reconcilePlaystyleForPosition,
} from '../../engine/statCalculator';
import {
  CareerState,
  EncounterResolutionResult,
  InternationalTournamentRecord,
  InternationalTournamentType,
  PlayerStats,
} from '../../types/game';
import {
  formatCurrencyDetailed,
} from '../../utils/formatters';
import {
  getEffectiveCashBalance,
  buildTeamTransferRelationships,
  dequeueNextPendingEvent,
  clampStat,
} from '../careerStoreHelpers';
import type {
  CareerStoreGet,
  CareerStoreSet,
  CareerStoreState,
  ToastMessage,
} from '../careerStoreTypes';

export type EventActions = Pick<CareerStoreState, 'resolveEventChoice'>;

export function createEventActions(
  set: CareerStoreSet,
  get: CareerStoreGet
): EventActions {
  return {
    resolveEventChoice: (choice) => {
      const { career } = get();
      if (!career) return;

      if (choice.triggerRetirement) {
        const legacyEval = evaluateCareerLegacy(career);
        set({
          career: {
            ...career,
            pendingEvent: null,
            retirementReason: choice.triggerRetirement,
            legacyEvaluation: legacyEval,
          },
          lastEncounterOutcome: null,
          view: 'RETIREMENT',
        });
        return;
      }

      const unlockStatus = checkEncounterChoiceUnlock(career, choice);
      if (!unlockStatus.unlocked) {
        get().showToast(
          '전용 분기 조건 미충족',
          unlockStatus.missingSummary || '능력치 또는 특성 조건을 충족해야 선택할 수 있습니다.',
          'amber'
        );
        return;
      }

      const currentCash = getEffectiveCashBalance(career);
      if (choice.cashDelta && choice.cashDelta < 0 && currentCash < Math.abs(choice.cashDelta)) {
        get().showToast(
          '보유 자산 부족',
          `필요 비용 ${formatCurrencyDetailed(Math.abs(choice.cashDelta))} (현재 ${formatCurrencyDetailed(currentCash)})`,
          'amber'
        );
        return;
      }

      const currentEvent = career.pendingEvent;
      const {
        result: outcome,
        nextChainEvent,
        arcAdvance,
      } = resolveEncounterChoiceOutcome(
        career,
        currentEvent || {
          id: 'EVT_GENERIC',
          title: '커리어 이벤트',
          subtitle: '',
          description: '',
          category: 'COACH',
          choices: [choice],
        },
        choice
      );

      const bypassAgeCap = Boolean(
        choice.bypassAgeStatCap || choice.triggerVeteranReinvention
      );
      const ageAdjusted = bypassAgeCap
        ? {
            adjustedChanges: { ...outcome.statChanges },
            suppressedPhysicalCount: 0,
            convertedTrustBonus: 0,
            grantedAgingShield: false,
          }
        : applyAgeAdjustedEventStatChanges(
            career.age,
            career.stats,
            outcome.statChanges
          );
      const rawStats: PlayerStats = { ...career.stats };
      for (const k of Object.keys(
        ageAdjusted.adjustedChanges
      ) as (keyof PlayerStats)[]) {
        const diff = ageAdjusted.adjustedChanges[k] || 0;
        rawStats[k] = clampStat(rawStats[k] + diff);
      }

      const nextPrimary = choice.switchPrimaryPos || career.primaryPos;
      const nextSecondary = choice.unlockSecondaryPos || career.secondaryPos;
      const nextStats = enforceBiomechanicalCaps(
        rawStats,
        career.heightCm,
        nextPrimary
      );
      const nextOvr = calculateOvr(nextStats, nextPrimary, career.heightCm);
      const effectivePotentialDelta =
        career.age >= 31
          ? Math.min(0, outcome.potentialDelta)
          : outcome.potentialDelta;
      const nextPotential = Math.min(
        98,
        Math.max(60, career.potential + effectivePotentialDelta)
      );
      let nextTrust = Math.max(
        10,
        Math.min(
          100,
          career.coachTrust + outcome.trustDelta + ageAdjusted.convertedTrustBonus
        )
      );
      const nextStock = Math.max(
        10,
        Math.min(100, career.draftStock + outcome.draftStockDelta)
      );
      const nextCashBalance = Math.max(0, currentCash + outcome.cashDelta);
      const nextCampAgingShield = Boolean(
        career.campAgingShield || ageAdjusted.grantedAgingShield
      );
      const nextMilitaryExempt =
        career.militaryExempt || Boolean(choice.grantMilitaryExemption);
      const nextMilestones = [...career.milestones];

      let nextLeague = career.league;
      let nextTeam = career.team;
      let nextContractType = career.contractType;
      let nextContractYearsLeft = career.contractYearsLeft;
      let nextAnnualSalary = career.annualSalary;
      let nextMilitaryServiceLeft = career.militaryServiceSeasonsLeft;
      let nextPrevTeam = career.previousTeamBeforeMilitary;
      let nextPromisedRole = career.promisedRole;
      let nextPlaystyle = reconcilePlaystyleForPosition(
        career.playstyle,
        nextStats,
        nextPrimary
      );
      let nextVeteranReinvented = career.veteranReinvented || false;

      if (choice.triggerVeteranReinvention) {
        nextVeteranReinvented = true;
        const isBigPos = nextPrimary === 'PF' || nextPrimary === 'C';
        const candidateStyle = isBigPos
          ? nextStats.out >= 70
            ? 'STRETCH_BIG'
            : 'ALL_ROUNDER'
          : nextStats.ply >= nextStats.out
          ? 'PLAYMAKER'
          : 'THREE_AND_D';
        nextPlaystyle = reconcilePlaystyleForPosition(
          candidateStyle,
          nextStats,
          nextPrimary
        );
        const reinventStyleInfo = getPlaystyleInfo(nextPlaystyle, nextPrimary);
        nextMilestones.push({
          id: `MS_VET_REINVENT_${Date.now()}`,
          year: career.seasonYear,
          age: career.age,
          title: '베테랑 플레이 스타일 진화 완료',
          description: `운동능력 저하를 노련한 기술로 극복하며 ${reinventStyleInfo.label} 역할로 재정립했습니다.`,
          type: 'SPECIAL',
          teamName: career.team.name,
        });
      }

      if (choice.grantMilitaryExemption && !career.militaryExempt) {
        nextMilestones.push({
          id: `MS_MILITARY_${Date.now()}`,
          year: career.seasonYear,
          age: career.age,
          title: '아시안게임 금메달 · 병역특례 획득',
          description:
            '결승전 활약으로 금메달을 목에 걸며 병역 문제를 해결했습니다.',
          type: 'AWARD',
          teamName: '대한민국 국가대표팀',
        });
      }

      if (choice.enlistSangmu) {
        nextPrevTeam = career.team;
        nextLeague = 'KBL';
        nextTeam = SANGMU_TEAM;
        nextContractType = 'MILITARY_SERVICE';
        nextContractYearsLeft = 2;
        nextAnnualSalary = ECONOMY_CONFIG.sangmuAnnualSalaryUsd;
        nextMilitaryServiceLeft = 2;

        nextMilestones.push({
          id: `MS_SANGMU_ENLIST_${Date.now()}`,
          year: career.seasonYear,
          age: career.age,
          title: '국군체육부대 상무 입대 (2시즌 복무)',
          description:
            '문경 상무 농구단에 입대하여 2시즌간 KBL 무대에서 복무합니다.',
          type: 'MILITARY',
          teamName: SANGMU_TEAM.name,
        });
      }

      // 시즌 중반 트레이드 데드라인 구단 협상 판정 (무조건 즉시 이적 폐지 → 시장 가치·약속 위반·계약 기간 기반 협상)
      const veteranNote =
        ageAdjusted.suppressedPhysicalCount > 0
          ? ' (베테랑 구간 보정: 신체 스탯 상승 대신 차기 시즌 노쇠화 방어 버프 및 코칭스태프 신뢰도 +2로 전환)'
          : '';
      let finalOutcome: EncounterResolutionResult = {
        ...outcome,
        narrative: `${outcome.narrative}${veteranNote}`,
        statChanges: ageAdjusted.adjustedChanges,
        potentialDelta: effectivePotentialDelta,
        trustDelta: outcome.trustDelta + ageAdjusted.convertedTrustBonus,
      };
      let nextSeasonsOnTeam = career.seasonsOnCurrentTeam ?? 0;
      let midTradeResult: 'NONE' | 'ACCEPTED' | 'REJECTED' = 'NONE';
      const isMidSeasonTradeAttempt = Boolean(
        choice.negotiateMidSeasonTrade || choice.executeTradeToContender
      );

      if (isMidSeasonTradeAttempt) {
        const trCfg = DRAFT_SCOUTING_CONFIG.trade;
        const acceptProb = clampNum(
          getBaseTradeAcceptProb(career, true),
          0.22,
          0.9
        );
        const acceptPct = Math.round(acceptProb * 100);
        const sameLeagueTeams = getTeamsByLeague(
          career.league,
          career.teamRatingsMap
        ).filter((t) => t.id !== career.team.id);

        if (Math.random() < acceptProb && sameLeagueTeams.length > 0) {
          const contenders = sameLeagueTeams.filter(
            (t) =>
              t.direction === 'CONTENDER' || t.direction === 'PLAYOFF_HUNT'
          );
          const tradePool =
            contenders.length > 0
              ? preferPositionFitTeams(contenders, career)
              : sameLeagueTeams;
          const pickedContender =
            tradePool[Math.floor(Math.random() * tradePool.length)];

          if (pickedContender) {
            const oldTeamName = career.team.name;
            nextTeam = pickedContender;
            nextSeasonsOnTeam = 0;
            nextPromisedRole =
              career.ovr >= pickedContender.rating + 2
                ? 'ACE_FIRST_OPTION'
                : career.ovr >= pickedContender.rating - 1
                ? 'STARTER_GUARANTEE'
                : 'SIXTH_MAN_CORE';
            nextTrust =
              nextPromisedRole === 'ACE_FIRST_OPTION'
                ? 62
                : nextPromisedRole === 'STARTER_GUARANTEE'
                ? 56
                : 50;
            midTradeResult = 'ACCEPTED';
            nextMilestones.push({
              id: `MS_MID_TRADE_${Date.now()}`,
              year: career.seasonYear,
              age: career.age,
              title: `트레이드 데드라인 이적: ${pickedContender.name}`,
              description: `${oldTeamName} 프런트와의 협상 끝에 ${pickedContender.name}로 이적했습니다 (${ROLE_PROMISE_LABELS[nextPromisedRole]}).`,
              type: 'SPECIAL',
              teamName: pickedContender.name,
            });
            finalOutcome = {
              ...outcome,
              wasProbabilistic: true,
              successChancePct: acceptPct,
              rolledSuccess: true,
              outcomeTier: 'SUCCESS',
              narrative: `구단 간 트레이드 협상이 타결되었습니다. ${oldTeamName}을 떠나 ${pickedContender.name}에 합류하며 새 팀에서 ${ROLE_PROMISE_LABELS[nextPromisedRole]} 역할을 맡게 됩니다.`,
              trustDelta: nextTrust - career.coachTrust,
            };
          }
        } else {
          midTradeResult = 'REJECTED';
          nextTrust = Math.max(10, career.coachTrust + trCfg.rejectedTrustPenalty);
          finalOutcome = {
            ...outcome,
            wasProbabilistic: true,
            successChancePct: acceptPct,
            rolledSuccess: false,
            outcomeTier: 'FAILURE',
            narrative: `${career.team.shortName} 단장이 상대 구단과의 조건 불일치를 이유로 트레이드 요청을 반려했습니다. 잔여 시즌을 원소속팀에서 치르게 되며 코칭스태프 신뢰도가 하락했습니다.`,
            statChanges: {},
            trustDelta: trCfg.rejectedTrustPenalty,
            draftStockDelta: 0,
          };
        }
      }

      // 4년 주기 국제대회 본선 토너먼트(조별리그 → 8강 → 4강) 및 결승/3·4위전 실시간 라이브 중계 진입
      let nextLiveGame = career.liveGame || null;
      let nextSeasonPhase = career.seasonPhase || 'OFFSEASON';
      let nextSeasonLogs = [...career.seasonLogs];
      let nextInternationalHistory = career.internationalHistory || [];
      let nextInternationalSummary = career.lastInternationalSummary ?? null;
      let nextTotalsForIntl = { ...career.totals };
      let agToastTitle: string | null = null;
      let agToastDesc: string | null = null;
      let agToastTone: ToastMessage['tone'] = 'emerald';

      const requestedTournamentType: InternationalTournamentType | null =
        choice.enterInternationalTournament ||
        (choice.enterAsianGamesTournament || choice.startAsianGamesFinal
          ? 'ASIAN_GAMES'
          : null);
      const requestedTournamentYear =
        choice.internationalTournamentYear ?? career.seasonYear;

      if (requestedTournamentType) {
        const tourney = simulateInternationalTournament(
          career,
          requestedTournamentType
        );
        const tourneyCfg = INTERNATIONAL_TOURNAMENT_CONFIG[requestedTournamentType];
        const matchSummaries = tourney.matches.map(
          (m) =>
            `${m.stageLabel} 대한민국 ${m.korScore}:${m.oppScore} ${m.opponentName} (${
              m.won ? '승' : '패'
            } · ${m.playerPts}점 ${m.playerReb}리바운드 ${m.playerAst}도움)`
        );

        if (nextSeasonLogs.length > 0) {
          const lastIdx = nextSeasonLogs.length - 1;
          nextSeasonLogs[lastIdx] = {
            ...nextSeasonLogs[lastIdx],
            narrativeLog: [
              tourney.summaryHeadline,
              ...matchSummaries,
              ...nextSeasonLogs[lastIdx].narrativeLog,
            ],
          };
        }

        if (tourney.reachedFinals && tourney.finalOpponent) {
          const liveType =
            requestedTournamentType === 'ASIAN_GAMES'
              ? 'ASIAN_GAMES_FINAL'
              : 'INTERNATIONAL_FINAL';
          nextLiveGame = createLiveFinalGame(
            career,
            tourney.finalOpponent,
            liveType,
            {
              tournamentType: requestedTournamentType,
              tournamentYear: requestedTournamentYear,
              preMatches: tourney.matches,
            }
          );
          nextSeasonPhase = 'LIVE_FINAL_BROADCAST';
          nextMilestones.push({
            id: `MS_INTL_FINAL_${requestedTournamentType}_${requestedTournamentYear}_${Date.now()}`,
            year: requestedTournamentYear,
            age: career.age,
            title: `${requestedTournamentYear} ${tourneyCfg.shortName} 결승 진출 (vs ${tourney.finalOpponent.shortName})`,
            description: `${matchSummaries.join(' / ')} · 결승전 실시간 중계에서 금메달에 도전합니다.`,
            type: 'SPECIAL',
            teamName: '대한민국 국가대표팀',
          });
          agToastTitle = `${tourneyCfg.shortName} 결승전 실시간 중계 입장`;
          agToastDesc = tourney.summaryHeadline;
          agToastTone = 'orange';
        } else if (tourney.reachedBronzeMatch && tourney.bronzeOpponent) {
          nextLiveGame = createLiveFinalGame(
            career,
            tourney.bronzeOpponent,
            'INTERNATIONAL_BRONZE',
            {
              tournamentType: requestedTournamentType,
              tournamentYear: requestedTournamentYear,
              preMatches: tourney.matches,
            }
          );
          nextSeasonPhase = 'LIVE_FINAL_BROADCAST';
          nextMilestones.push({
            id: `MS_INTL_BRONZE_${requestedTournamentType}_${requestedTournamentYear}_${Date.now()}`,
            year: requestedTournamentYear,
            age: career.age,
            title: `${requestedTournamentYear} ${tourneyCfg.shortName} 3·4위전 진출 (vs ${tourney.bronzeOpponent.shortName})`,
            description: `${matchSummaries.join(' / ')} · 동메달 결정전 실시간 중계에 나섭니다.`,
            type: 'SPECIAL',
            teamName: '대한민국 국가대표팀',
          });
          agToastTitle = `${tourneyCfg.shortName} 동메달 결정전 중계 입장`;
          agToastDesc = tourney.summaryHeadline;
          agToastTone = 'amber';
        } else {
          nextLiveGame = null;
          nextSeasonPhase = 'OFFSEASON';
          const isGroupElim = tourney.eliminatedStage === 'GROUP';
          const totalGames = Math.max(1, tourney.matches.length);
          const elimRecord: InternationalTournamentRecord = {
            id: `INTL_${requestedTournamentType}_${requestedTournamentYear}_${Date.now()}`,
            year: requestedTournamentYear,
            age: career.age,
            tournamentType: requestedTournamentType,
            tournamentName: tourneyCfg.name,
            result: isGroupElim ? 'GROUP' : 'QUARTERFINAL',
            wonMvp: false,
            grantedMilitaryExemption: false,
            avgPts: Number(
              (
                tourney.matches.reduce((s, m) => s + m.playerPts, 0) /
                totalGames
              ).toFixed(1)
            ),
            avgReb: Number(
              (
                tourney.matches.reduce((s, m) => s + m.playerReb, 0) /
                totalGames
              ).toFixed(1)
            ),
            avgAst: Number(
              (
                tourney.matches.reduce((s, m) => s + m.playerAst, 0) /
                totalGames
              ).toFixed(1)
            ),
            matches: tourney.matches,
            summaryHeadline: tourney.summaryHeadline,
          };
          nextInternationalHistory = [
            elimRecord,
            ...nextInternationalHistory.filter(
              (r) =>
                !(
                  r.year === requestedTournamentYear &&
                  r.tournamentType === requestedTournamentType
                )
            ),
          ];
          nextInternationalSummary = elimRecord;
          nextTotalsForIntl = {
            ...nextTotalsForIntl,
            internationalCaps:
              (nextTotalsForIntl.internationalCaps || 0) + tourney.matches.length,
          };

          nextMilestones.push({
            id: `MS_INTL_${isGroupElim ? 'GROUP' : 'QF'}_${requestedTournamentType}_${requestedTournamentYear}_${Date.now()}`,
            year: requestedTournamentYear,
            age: career.age,
            title: `${requestedTournamentYear} ${tourneyCfg.shortName} ${
              isGroupElim ? '조별리그 마감' : '8강 마감'
            }`,
            description: `${matchSummaries.join(' / ')} · ${tourney.summaryHeadline}`,
            type: requestedTournamentType === 'ASIAN_GAMES' ? 'MILITARY' : 'SPECIAL',
            teamName: '대한민국 국가대표팀',
          });
          agToastTitle = `${tourneyCfg.shortName} ${
            isGroupElim ? '조별리그 탈락' : '8강 탈락'
          }`;
          agToastDesc = tourney.summaryHeadline;
          agToastTone = 'amber';
        }
      }

      const resolvedPendingChain =
        nextChainEvent ||
        (career.pendingChainEvent &&
        currentEvent &&
        career.pendingChainEvent.id === currentEvent.id
          ? null
          : career.pendingChainEvent || null);

      const didChangeTeamInEvent = Boolean(
        choice.enlistSangmu || midTradeResult === 'ACCEPTED'
      );
      const nextRelationships = didChangeTeamInEvent
        ? buildTeamTransferRelationships(
            career,
            choice.enlistSangmu ? 55 : nextTrust
          )
        : applyRelationshipDelta(
            getEffectiveRelationships(career),
            outcome.relationshipChanges,
            nextTrust - career.coachTrust
          );
      // 감독 신뢰도 단일 진실 소스 동기화
      nextTrust = nextRelationships.coachTrust;

      const nextRole = didChangeTeamInEvent
        ? calculateRoleAndMpg({
            ...career,
            ovr: nextOvr,
            stats: nextStats,
            primaryPos: nextPrimary,
            secondaryPos: nextSecondary,
            league: nextLeague,
            team: nextTeam,
            contractType: nextContractType,
            coachTrust: nextTrust,
            promisedRole: nextPromisedRole,
          }).role
        : choice.grantRotationThisSeason && career.role.includes('가비지')
        ? '벤치 로테이션'
        : career.role;

      const nextStoryArcs = getEffectiveStoryArcs(career);
      if (arcAdvance) {
        const prevArc = nextStoryArcs[arcAdvance.arcId];
        nextStoryArcs[arcAdvance.arcId] = {
          ...prevArc,
          stage: Math.max(prevArc.stage, arcAdvance.nextStage),
          completed: Boolean(
            arcAdvance.completed || arcAdvance.nextStage >= prevArc.maxStage
          ),
          lastTriggeredYear: career.seasonYear,
          branchTag: arcAdvance.branchTag || prevArc.branchTag,
          summary: arcAdvance.summary,
        };
        if (arcAdvance.completed) {
          nextMilestones.push({
            id: `MS_ARC_${arcAdvance.arcId}_${Date.now()}`,
            year: career.seasonYear,
            age: career.age,
            title: `스토리 아크 완결 · ${prevArc.title}`,
            description: arcAdvance.summary,
            type: 'SPECIAL',
            teamName: nextTeam.name,
          });
        }
      }

      let updatedBase: CareerState = {
        ...career,
        primaryPos: nextPrimary,
        secondaryPos: nextSecondary,
        playstyle: nextPlaystyle,
        veteranReinvented: nextVeteranReinvented,
        veteranReinventionOffered:
          career.veteranReinventionOffered ||
          career.pendingEvent?.id === 'EVT_VETERAN_REINVENTION',
        stats: nextStats,
        ovr: nextOvr,
        peakOvr: Math.max(career.peakOvr, nextOvr),
        potential: nextPotential,
        coachTrust: nextTrust,
        draftStock: nextStock,
        cashBalance: nextCashBalance,
        campAgingShield: nextCampAgingShield,
        relationships: nextRelationships,
        storyArcs: nextStoryArcs,
        league: nextLeague,
        team: nextTeam,
        role: nextRole,
        contractType: nextContractType,
        contractYearsLeft: nextContractYearsLeft,
        annualSalary: nextAnnualSalary,
        promisedRole: nextPromisedRole,
        brokenRolePromise:
          didChangeTeamInEvent ? false : career.brokenRolePromise,
        seasonsOnCurrentTeam:
          choice.enlistSangmu ? 0 : nextSeasonsOnTeam,
        tradeRequestedThisYear:
          career.tradeRequestedThisYear || isMidSeasonTradeAttempt,
        coachChanceRotationYear: choice.grantRotationThisSeason
          ? career.seasonYear
          : career.coachChanceRotationYear ?? null,
        agentAdviceShown:
          career.agentAdviceShown || Boolean(choice.markAgentAdviceDismissed),
        militaryExempt: nextMilitaryExempt,
        militaryServiceSeasonsLeft: nextMilitaryServiceLeft,
        previousTeamBeforeMilitary: nextPrevTeam,
        pendingChainEvent: resolvedPendingChain,
        liveGame: nextLiveGame,
        seasonPhase: nextSeasonPhase,
        seasonLogs: nextSeasonLogs,
        internationalHistory: nextInternationalHistory,
        lastInternationalSummary: nextInternationalSummary,
        totals: nextTotalsForIntl,
        badges: evaluatePlayerBadges(
          nextStats,
          nextSecondary,
          career.growthDna,
          nextPlaystyle,
          career.traits,
          nextPrimary
        ),
        milestones: nextMilestones,
        pendingEvent: null,
      };

      // 입대 직전 마지막 특례 대회를 고사하거나 8강 탈락으로 즉시 오프시즌에 복귀한 경우 상무 입대 영장 연계
      const wasInternationalCallup = Boolean(
        currentEvent &&
          (currentEvent.id === 'EVT_ASIAN_GAMES_GOLD' ||
            currentEvent.id.startsWith('EVT_INTL_'))
      );
      if (
        wasInternationalCallup &&
        !nextLiveGame &&
        !updatedBase.militaryExempt &&
        updatedBase.militaryServiceSeasonsLeft === 0 &&
        updatedBase.age >= getMilitaryEnlistAgeForLeague(updatedBase.league)
      ) {
        updatedBase.pendingEvent = createSangmuEnlistmentEvent(updatedBase);
        updatedBase.pendingEventQueue = [];
      }

      const isInternationalAction = Boolean(requestedTournamentType);
      // 국제대회 액션이 요약 모달 없이 바로 끝난 경우(혹은 결과 모달을 띄우지 않는 경우) 대기 큐 선두 이벤트를 즉시 활성화
      if (
        isInternationalAction &&
        !nextLiveGame &&
        !updatedBase.pendingEvent &&
        !updatedBase.lastInternationalSummary
      ) {
        updatedBase = dequeueNextPendingEvent(updatedBase);
      }

      const refreshedOptions = updatedBase.offseasonLocked
        ? generateOffseasonOptions(updatedBase)
        : [];

      const outcomeTone: ToastMessage['tone'] = agToastTitle
        ? agToastTone
        : finalOutcome.outcomeTier === 'CRITICAL_SUCCESS'
        ? 'orange'
        : finalOutcome.outcomeTier === 'FAILURE'
        ? 'rose'
        : 'emerald';

      set({
        career: {
          ...updatedBase,
          offseasonOptions: refreshedOptions,
        },
        lastEncounterOutcome: isInternationalAction ? null : finalOutcome,
        toast: {
          id: `TOAST_${Date.now()}`,
          title:
            agToastTitle ||
            (choice.triggerVeteranReinvention
              ? '베테랑 플레이 스타일 진화 완료'
              : choice.enlistSangmu
              ? '국군체육부대 상무 입대'
              : midTradeResult === 'ACCEPTED'
              ? `${nextTeam.name} 트레이드 협상 타결`
              : midTradeResult === 'REJECTED'
              ? '구단 프런트가 트레이드 요청을 반려했습니다'
              : finalOutcome.outcomeTier === 'CRITICAL_SUCCESS'
              ? '대성공 · 기대 이상의 결과'
              : finalOutcome.outcomeTier === 'FAILURE'
              ? '판정 실패 · 리스크 발생'
              : '선택 결과 반영 완료'),
          description: agToastDesc || finalOutcome.narrative,
          tone: outcomeTone,
        },
      });
    },
  };
}
