/**
 * 오프시즌 계약 · 드래프트 컴바인 · 드래프트 지명 액션
 * (useCareerStore.ts에서 동작 변경 없이 그대로 옮긴 코드입니다.)
 */
import {
  DRAFT_SCOUTING_CONFIG,
  clampNum,
} from '../../config/balanceConfig';
import {
  LEAGUE_CONFIG,
} from '../../data/leagues';
import {
  getTeamById,
  selectBestFitTeamForPlayer,
} from '../../data/teams';
import {
  calculateOffseasonTradeAcceptProb,
  calculateProjectedNbaPick,
  createInitialCombineState,
  determineTeamRolePromise,
  executeDraftResolution,
  generateOffseasonOptions,
  ROLE_PROMISE_LABELS,
} from '../../engine/draftEngine';
import {
  getEffectiveRelationships,
  syncCareerRelationships,
} from '../../engine/progressionEngine';
import {
  calculateRoleAndMpg,
  generateDraftRivals,
  getContractDefaultSalary,
} from '../../engine/seasonSimulator';
import {
  calculateOvr,
  enforceBiomechanicalCaps,
} from '../../engine/statCalculator';
import {
  CareerState,
  ContractType,
  OffseasonOption,
  PlayerStats,
} from '../../types/game';
import {
  buildTeamTransferRelationships,
  clampStat,
} from '../careerStoreHelpers';
import type {
  CareerStoreGet,
  CareerStoreSet,
  CareerStoreState,
} from '../careerStoreTypes';

export type OffseasonActions = Pick<CareerStoreState, 'selectOffseasonOption' | 'runCombineDrill' | 'completeCombineInterview' | 'withdrawFromDraft' | 'proceedToDraftLive' | 'finalizeDraftSigning'>;

export function createOffseasonActions(
  set: CareerStoreSet,
  get: CareerStoreGet
): OffseasonActions {
  return {
    selectOffseasonOption: (option) => {
      const { career } = get();
      if (!career || option.locked) return;

      if (option.actionType === 'RETIRE_VOLUNTARY') {
        get().triggerRetirement('VOLUNTARY_HONOR');
        return;
      }
      if (option.actionType === 'RETIRE_AGE_40') {
        get().triggerRetirement('AGE_40_MANDATORY');
        return;
      }
      if (option.actionType === 'RETIRE_OUT_OF_LEAGUE') {
        get().triggerRetirement('OUT_OF_LEAGUE');
        return;
      }

      if (option.actionType === 'START_FAREWELL_TOUR') {
        set({
          career: {
            ...career,
            isFarewellTour: true,
            contractType: option.contractType ?? career.contractType,
            contractYearsLeft: 1,
            annualSalary:
              option.annualSalary !== undefined
                ? option.annualSalary
                : career.annualSalary,
            isOutOfLeagueWarning: false,
            offseasonLocked: false,
            offseasonOptions: [],
            seasonPhase: 'REGULAR_SEASON',
            playoffBracket: null,
            liveGame: null,
            tradeRequestedThisYear: false,
            midSeasonEventTriggeredThisYear: false,
            lastInternationalSummary: null,
            milestones: [
              ...career.milestones,
              {
                id: `MS_TOUR_${Date.now()}`,
                year: career.seasonYear,
                age: career.age,
                title: '공식 은퇴 투어 선언',
                description: `${career.team.name}에서의 마지막 시즌 고별 투어를 시작했습니다.`,
                type: 'TOUR',
                teamName: career.team.name,
              },
            ],
          },
          toast: {
            id: `TOAST_${Date.now()}`,
            title: '공식 은퇴 투어 시즌 시작',
            description: '이번 시즌을 마치면 은퇴식과 영구결번 심사가 열립니다.',
            tone: 'amber',
          },
        });
        return;
      }

      if (option.actionType === 'RETURN_KBL_FAREWELL' && option.targetTeam) {
        const returnTrust = 60;
        const returnRel = buildTeamTransferRelationships(career, returnTrust);
        const { role } = calculateRoleAndMpg({
          ...career,
          league: 'KBL',
          team: option.targetTeam,
          contractType: 'KBL_VET',
          coachTrust: returnTrust,
        });
        set({
          career: {
            ...career,
            league: 'KBL',
            team: option.targetTeam,
            contractType: 'KBL_VET',
            contractYearsLeft: 1,
            annualSalary: getContractDefaultSalary('KBL_VET', career.ovr),
            role,
            seasonsOnCurrentTeam: 0,
            coachTrust: returnRel.coachTrust,
            relationships: returnRel,
            brokenRolePromise: false,
            isFarewellTour: true,
            isOutOfLeagueWarning: false,
            offseasonLocked: false,
            offseasonOptions: [],
            pendingEventQueue: [],
            seasonPhase: 'REGULAR_SEASON',
            playoffBracket: null,
            liveGame: null,
            tradeRequestedThisYear: false,
            midSeasonEventTriggeredThisYear: false,
            lastInternationalSummary: null,
            milestones: [
              ...career.milestones,
              {
                id: `MS_KBL_RETURN_${Date.now()}`,
                year: career.seasonYear,
                age: career.age,
                title: `${option.targetTeam.name} 복귀 · 고별 투어 선언`,
                description:
                  '국내 팬들 앞에서 현역 마지막 시즌을 치르기로 결정했습니다.',
                type: 'TOUR',
                teamName: option.targetTeam.name,
              },
            ],
          },
          toast: {
            id: `TOAST_${Date.now()}`,
            title: `${option.targetTeam.name} 합류 완료`,
            description: '현역 마지막 시즌을 시작합니다.',
            tone: 'amber',
          },
        });
        return;
      }

      if (option.actionType === 'ENTER_NBA_DRAFT') {
        const combineState = createInitialCombineState(career);
        set({
          career: {
            ...career,
            combineState,
            draftResult: null,
          },
          view: 'DRAFT_COMBINE',
        });
        return;
      }

      if (option.actionType === 'ENTER_KBL_DRAFT') {
        const draftResult = executeDraftResolution(career, 'KBL');
        set({
          career: {
            ...career,
            draftResult,
          },
          view: 'DRAFT_LIVE',
        });
        return;
      }

      const rawNextTeam = option.targetTeam || career.team;
      const nextTeam =
        getTeamById(rawNextTeam.id, career.teamRatingsMap) || rawNextTeam;
      const nextLeague = option.targetLeague;

      // 오프시즌 계약 중 트레이드 요청 협상 판정
      if (option.actionType === 'REQUEST_TRADE' && option.targetTeam) {
        if (career.tradeRequestedThisYear) {
          get().showToast(
            '트레이드 요청 불가',
            '이번 오프시즌 트레이드 요청이 이미 반려되었습니다. 소속팀 잔류 탭에서 시즌을 진행해 주세요.',
            'amber'
          );
          return;
        }

        const acceptProb =
          option.contenderPath && typeof option.tradeAcceptChancePct === 'number'
            ? option.tradeAcceptChancePct / 100
            : calculateOffseasonTradeAcceptProb(
                career,
                nextTeam,
                option.scoutingScore ?? 70
              );
        if (Math.random() >= acceptProb) {
          const trCfg = DRAFT_SCOUTING_CONFIG.trade;
          const nextRejectedTrust = Math.max(
            15,
            career.coachTrust + trCfg.rejectedTrustPenalty
          );
          const syncedOffseasonReject = syncCareerRelationships(
            career,
            { frontOffice: -6 },
            nextRejectedTrust - career.coachTrust
          );
          const lockedOptions = career.offseasonOptions.map((opt) =>
            opt.actionType === 'REQUEST_TRADE'
              ? {
                  ...opt,
                  locked: true,
                  lockReason: '이번 오프시즌 트레이드 요청이 이미 반려되었습니다.',
                }
              : opt
          );
          set({
            career: {
              ...career,
              tradeRequestedThisYear: true,
              coachTrust: syncedOffseasonReject.coachTrust,
              relationships: syncedOffseasonReject.relationships,
              offseasonOptions: lockedOptions,
            },
            toast: option.contenderPath
              ? {
                  id: `TOAST_${Date.now()}`,
                  title: `${nextTeam.shortName} 우승 도전 이적이 무산되었습니다`,
                  description: '이번 오프시즌 이적 요청이 반려되었습니다. 남은 선택지에서 다음 시즌을 준비하세요.',
                  tone: 'amber',
                }
              : {
                  id: `TOAST_${Date.now()}`,
                  title: `${career.team.shortName} 구단이 트레이드 요청을 반려했습니다`,
                  description: `${nextTeam.shortName}와의 패키지 협상이 결렬되었습니다. 소속팀 잔류 탭에서 기존 계약을 이어가세요.`,
                  tone: 'amber',
                },
          });
          return;
        }
      }

      const isTeamChanged = nextTeam.id !== career.team.id;
      const isExistingContractStay =
        Boolean(option.isExistingContract) &&
        !isTeamChanged &&
        career.contractYearsLeft > 0;
      const nextTrust = isTeamChanged ? 54 : career.coachTrust;
      const nextSalary = isExistingContractStay
        ? career.annualSalary
        : option.annualSalary !== undefined
        ? option.annualSalary
        : getContractDefaultSalary(option.contractType, career.ovr);
      const nextContractTypeVal = isExistingContractStay
        ? career.contractType
        : option.contractType;
      const nextContractYearsVal = isExistingContractStay
        ? career.contractYearsLeft
        : option.contractYears;

      const nextPromisedRole =
        option.promisedRole ||
        determineTeamRolePromise(career, nextTeam, nextContractTypeVal)
          .promisedRole;

      const nextPedigreeSeasons = isTeamChanged
        ? 0
        : career.draftPedigreeSeasonsLeft ?? 0;

      // 만약 KBL 또는 NBA에 최초 입단했는데 아직 해당 리그 라이벌이 없다면 절차적 라이벌 생성
      let nextRivals = career.rivals || [];
      if (
        (nextLeague === 'KBL' || nextLeague === 'NBA') &&
        !nextRivals.some((r) => r.league === nextLeague)
      ) {
        const created = generateDraftRivals(
          career,
          nextLeague,
          nextTeam.id
        );
        nextRivals = [...nextRivals, ...created];
      }

      const { role } = calculateRoleAndMpg({
        ovr: career.ovr,
        team: nextTeam,
        coachTrust: nextTrust,
        secondaryPos: career.secondaryPos,
        contractType: nextContractTypeVal,
        league: nextLeague,
        stats: career.stats,
        primaryPos: career.primaryPos,
        growthDna: career.growthDna,
        traits: career.traits,
        promisedRole: nextPromisedRole,
        draftPedigreePick: isTeamChanged ? null : career.draftPedigreePick,
        draftPedigreeRound: isTeamChanged ? null : career.draftPedigreeRound,
        draftPedigreeSeasonsLeft: nextPedigreeSeasons,
        seasonLogs: career.seasonLogs,
      });

      const nextMilestones = [...career.milestones];
      if (isTeamChanged) {
        nextMilestones.push({
          id: `MS_SIGN_${Date.now()}`,
          year: career.seasonYear,
          age: career.age,
          title: `${nextTeam.name} (${LEAGUE_CONFIG[nextLeague].shortName}) ${
            option.contenderPath
              ? '우승 도전 이적'
              : option.actionType === 'REQUEST_TRADE'
              ? '트레이드 이적'
              : '계약 체결'
          }`,
          description: `약속 역할 ${ROLE_PROMISE_LABELS[nextPromisedRole]} · ${role} 입지로 새 시즌을 시작합니다.`,
          type: 'SPECIAL',
          teamName: nextTeam.name,
        });
      }

      const toastTitle = isTeamChanged
        ? `${nextTeam.name} ${
            option.actionType === 'REQUEST_TRADE'
              ? '트레이드 이적 완료'
              : '계약 체결'
          }`
        : isExistingContractStay && career.contractYearsLeft > 0
        ? `${nextTeam.name} 기존 계약 유지 · 새 시즌 개막`
        : `${nextTeam.name} 새 시즌 준비 완료`;

      const toastDescription =
        isExistingContractStay && career.contractYearsLeft > 0
          ? `잔여 계약 ${career.contractYearsLeft}년 · ${ROLE_PROMISE_LABELS[nextPromisedRole]}`
          : `약속 역할: ${ROLE_PROMISE_LABELS[nextPromisedRole]}`;

      set({
        career: {
          ...career,
          league: nextLeague,
          team: nextTeam,
          contractType: nextContractTypeVal,
          contractYearsLeft: nextContractYearsVal,
          annualSalary: nextSalary,
          twoWaySeasonsUsed:
            nextContractTypeVal === 'TWO_WAY' && isTeamChanged
              ? 0
              : career.twoWaySeasonsUsed,
          draftPedigreePick: isTeamChanged ? null : career.draftPedigreePick,
          draftPedigreeRound: isTeamChanged ? null : career.draftPedigreeRound,
          draftPedigreeSeasonsLeft: nextPedigreeSeasons,
          promisedRole: nextPromisedRole,
          brokenRolePromise: false,
          lastInternationalSummary: null,
          seasonsOnCurrentTeam: isTeamChanged
            ? 0
            : career.seasonsOnCurrentTeam ?? 0,
          tradeRequestedThisYear: false,
          contenderPathTeamId: option.contenderPath
            ? nextTeam.id
            : isTeamChanged
            ? null
            : career.contenderPathTeamId ?? null,
          rivals: nextRivals,
          coachTrust: nextTrust,
          relationships: isTeamChanged
            ? buildTeamTransferRelationships(career, nextTrust)
            : {
                ...getEffectiveRelationships(career),
                coachTrust: nextTrust,
              },
          role,
          isOutOfLeagueWarning: false,
          offseasonLocked: false,
          offseasonOptions: [],
          pendingEventQueue: [],
          seasonPhase: 'REGULAR_SEASON',
          playoffBracket: null,
          liveGame: null,
          milestones: nextMilestones,
        },
        toast: {
          id: `TOAST_${Date.now()}`,
          title: toastTitle,
          description: toastDescription,
          tone: 'orange',
        },
      });
    },

    runCombineDrill: (drillId, label, statKey) => {
      const { career } = get();
      if (!career || !career.combineState) return;
      if (career.combineState.completedDrills.includes(drillId)) return;
      if (career.combineState.completedDrills.length >= 2) return;

      const statVal = career.stats[statKey];
      const gradeBonus = statVal >= 78 ? 6.5 : statVal >= 68 ? 4.0 : 2.0;
      const rawUpdatedStats: PlayerStats = {
        ...career.stats,
        [statKey]: clampStat(career.stats[statKey] + 1),
      };
      const updatedStats = enforceBiomechanicalCaps(
        rawUpdatedStats,
        career.heightCm,
        career.primaryPos
      );
      const actualGain = Math.max(0, updatedStats[statKey] - career.stats[statKey]);
      const prevGains = career.combineState.statGains || {};
      const nextGains: Partial<PlayerStats> = {
        ...prevGains,
        [statKey]: (prevGains[statKey] || 0) + actualGain,
      };
      const updatedOvr = calculateOvr(
        updatedStats,
        career.primaryPos,
        career.heightCm
      );
      const newBonus = career.combineState.combineBonusScore + gradeBonus;

      const { projectedPick, undraftedRisk } = calculateProjectedNbaPick(
        { ...career, ovr: updatedOvr },
        newBonus
      );

      set({
        career: {
          ...career,
          stats: updatedStats,
          ovr: updatedOvr,
          peakOvr: Math.max(career.peakOvr, updatedOvr),
          combineState: {
            ...career.combineState,
            completedDrills: [...career.combineState.completedDrills, drillId],
            combineBonusScore: newBonus,
            projectedPick,
            undraftedRisk,
            statGains: nextGains,
          },
        },
        toast: {
          id: `TOAST_${Date.now()}`,
          title: `${label} 측정 완료`,
          description:
            actualGain > 0
              ? `능력치 +${actualGain} 상승 · 예상 지명 ${projectedPick}순위`
              : `신체 상한 도달 · 예상 지명 ${projectedPick}순위`,
          tone: 'emerald',
        },
      });
    },

    completeCombineInterview: (answerType) => {
      const { career } = get();
      if (
        !career ||
        !career.combineState ||
        career.combineState.interviewCompleted
      )
        return;

      const interviewBonus =
        answerType === 'CONFIDENT'
          ? 4.5
          : answerType === 'TEAM_FIRST'
          ? 3.5
          : 4.0;
      const newBonus = career.combineState.combineBonusScore + interviewBonus;
      const { projectedPick, undraftedRisk } = calculateProjectedNbaPick(
        career,
        newBonus
      );

      const syncedInterview = syncCareerRelationships(career, undefined, 4);
      const actualTrustGain = Math.max(
        0,
        syncedInterview.coachTrust - career.coachTrust
      );
      set({
        career: {
          ...career,
          coachTrust: syncedInterview.coachTrust,
          relationships: syncedInterview.relationships,
          combineState: {
            ...career.combineState,
            interviewCompleted: true,
            combineBonusScore: newBonus,
            projectedPick,
            undraftedRisk,
            trustGain: (career.combineState.trustGain || 0) + actualTrustGain,
          },
        },
        toast: {
          id: `TOAST_${Date.now()}`,
          title: '구단 단장단 면접 완료',
          description: `예상 지명 순위가 ${projectedPick}순위로 조정되었습니다.`,
          tone: 'orange',
        },
      });
    },

    withdrawFromDraft: () => {
      const { career } = get();
      if (!career) return;

      // 컴바인 드릴/면접으로 얻은 임시 스탯·신뢰도 상승분 원복 (반복 철회 스탯 파밍 방지)
      const statGains = career.combineState?.statGains || {};
      const trustGain = career.combineState?.trustGain || 0;
      const rolledBackStats: PlayerStats = { ...career.stats };
      let hadStatRollback = false;
      for (const k of Object.keys(statGains) as (keyof PlayerStats)[]) {
        const g = statGains[k] || 0;
        if (g > 0) {
          rolledBackStats[k] = clampStat(rolledBackStats[k] - g);
          hadStatRollback = true;
        }
      }
      const rolledBackOvr = calculateOvr(
        rolledBackStats,
        career.primaryPos,
        career.heightCm
      );
      const rolledBackTrust = clampNum(career.coachTrust - trustGain, 10, 100);
      const rolledBackRelationships = {
        ...getEffectiveRelationships(career),
        coachTrust: rolledBackTrust,
      };
      const rolledBackCareer: CareerState = {
        ...career,
        stats: rolledBackStats,
        ovr: rolledBackOvr,
        coachTrust: rolledBackTrust,
        relationships: rolledBackRelationships,
        combineState: null,
        draftResult: null,
      };

      // NBA 드래프트 신청을 철회해도 오프시즌 에이전트 데스크 선택권(잔류/타 구단 오퍼/KBL 드래프트 등)을 유지!
      const allOptions = generateOffseasonOptions(rolledBackCareer);
      const remainingOptions = allOptions.filter(
        (opt) => opt.actionType !== 'ENTER_NBA_DRAFT'
      );
      const fallbackOptions: OffseasonOption[] =
        remainingOptions.length > 0
          ? remainingOptions
          : [
              {
                id: 'OPT_WITHDRAW_STAY_FALLBACK',
                title: `${career.team.name} 복귀 및 1시즌 추가 활약`,
                subtitle:
                  'NBA 드래프트 참가를 철회하고 소속팀에서 주전으로 한 시즌 더 실전 기량을 증명합니다.',
                badgeText: '드래프트 철회 · 소속팀 복귀',
                targetLeague: career.league,
                targetTeam: career.team,
                contractType: career.contractType,
                contractYears: Math.max(1, career.contractYearsLeft || 1),
                annualSalary: career.annualSalary,
                actionType: 'STAY_TEAM',
              },
            ];

      const { role } = calculateRoleAndMpg(rolledBackCareer);
      set({
        career: {
          ...rolledBackCareer,
          offseasonLocked: true,
          offseasonOptions: fallbackOptions,
          seasonPhase: 'OFFSEASON',
          role,
        },
        view: 'DASHBOARD',
        toast: {
          id: `TOAST_${Date.now()}`,
          title: 'NBA 드래프트 참가 철회 · 에이전트 데스크 복귀',
          description:
            hadStatRollback || trustGain > 0
              ? '컴바인 기간 중 얻은 임시 상승분이 원복되었습니다. 다음 진로를 선택하세요.'
              : '대학 잔류, KBL 드래프트, 타 리그 계약 오퍼 중 다음 진로를 선택하세요.',
          tone: 'amber',
        },
      });
    },

    proceedToDraftLive: () => {
      const { career } = get();
      if (!career) return;
      const draftResult = executeDraftResolution(career, 'NBA');
      set({
        career: {
          ...career,
          hasEnteredNbaDraft: true,
          draftResult,
        },
        view: 'DRAFT_LIVE',
      });
    },

    finalizeDraftSigning: (choice) => {
      const { career } = get();
      if (!career || !career.draftResult) return;

      const dr = career.draftResult;
      let nextLeague = career.league;
      let nextTeam = career.team;
      let nextContractType: ContractType = career.contractType;
      let nextYears = 2;
      let nextPedigreePick: number | null = null;
      let nextPedigreeRound: 1 | 2 | null = null;
      let nextPedigreeSeasons = 0;
      let nextInitialTrust = 50;
      let milestoneTitle = '';
      let milestoneDesc = '';

      if (dr.draftType === 'KBL' && dr.draftedTeam) {
        nextLeague = 'KBL';
        nextTeam = dr.draftedTeam;
        nextContractType = 'KBL_ROOKIE';
        nextYears = 3;
        nextPedigreePick = dr.pickNumber;
        nextPedigreeRound = dr.round;
        nextPedigreeSeasons = dr.round === 1 ? 2 : 1;
        nextInitialTrust =
          dr.pickNumber && dr.pickNumber <= 3
            ? 70
            : dr.round === 1
            ? 62
            : 48;
        milestoneTitle = `KBL 드래프트 전체 ${dr.pickNumber}순위 지명 (${nextTeam.shortName})`;
        milestoneDesc = `${nextTeam.name}의 지명을 받아 프로 무대에 데뷔했습니다.`;
      } else if (choice === 'NBA_STANDARD' && dr.draftedTeam) {
        nextLeague = 'NBA';
        nextTeam = dr.draftedTeam;
        nextContractType = 'NBA_STANDARD';
        nextYears = 4;
        nextPedigreePick = dr.pickNumber;
        nextPedigreeRound = 1;
        nextPedigreeSeasons = 3;
        nextInitialTrust =
          dr.pickNumber && dr.pickNumber <= 14 ? 72 : 64;
        milestoneTitle = `NBA 드래프트 1라운드 ${dr.pickNumber}순위 지명 (${nextTeam.shortName})`;
        milestoneDesc = `${nextTeam.name}와 정식 NBA 루키 계약을 체결했습니다.`;
      } else if (
        choice === 'TWO_WAY' &&
        (dr.draftedTeam || dr.twoWayOfferTeam)
      ) {
        const targetNbaTeam = (dr.draftedTeam || dr.twoWayOfferTeam)!;
        nextLeague = 'NBA';
        nextTeam = targetNbaTeam;
        nextContractType = 'TWO_WAY';
        nextYears = 1;
        nextPedigreePick = dr.pickNumber;
        nextPedigreeRound = dr.round;
        nextPedigreeSeasons = dr.round === 2 ? 1 : 0;
        nextInitialTrust = 48;
        milestoneTitle = dr.pickNumber
          ? `NBA 드래프트 2라운드 ${dr.pickNumber}순위 지명 (${targetNbaTeam.shortName})`
          : `${targetNbaTeam.shortName} 투웨이 계약 체결`;
        milestoneDesc = `${targetNbaTeam.name} 투웨이 로스터에 합류해 정식 계약 승격에 도전합니다.`;
      } else if (choice === 'GLEAGUE') {
        nextLeague = 'GLEAGUE';
        nextTeam = selectBestFitTeamForPlayer(
          'GLEAGUE',
          career.primaryPos,
          career.secondaryPos,
          career.teamRatingsMap
        );
        nextContractType = 'GLEAGUE_EXHIBIT';
        nextYears = 1;
        nextInitialTrust = 54;
        milestoneTitle = `${nextTeam.name} 트라이아웃 합류`;
        milestoneDesc =
          'G리그 쇼케이스에서 실전 경쟁력을 증명하기로 했습니다.';
      } else {
        nextLeague = 'KBL';
        nextTeam = selectBestFitTeamForPlayer(
          'KBL',
          career.primaryPos,
          career.secondaryPos,
          career.teamRatingsMap
        );
        nextContractType = 'KBL_ROOKIE';
        nextYears = 2;
        nextInitialTrust = 55;
        milestoneTitle = `${nextTeam.name} 입단`;
        milestoneDesc =
          'KBL 무대에서 실전 경쟁력을 증명한 뒤 다시 도전합니다.';
      }

      const syncedTeam =
        getTeamById(nextTeam.id, career.teamRatingsMap) || nextTeam;
      const nextSalary = getContractDefaultSalary(
        nextContractType,
        career.ovr
      );
      const promise = determineTeamRolePromise(
        career,
        syncedTeam,
        nextContractType
      );

      // 프로 드래프트 입단 시 동기 라이벌(1~2명) 절차적 생성
      let nextRivals = career.rivals || [];
      if (
        (nextLeague === 'KBL' || nextLeague === 'NBA') &&
        !nextRivals.some((r) => r.league === nextLeague)
      ) {
        const createdRivals = generateDraftRivals(
          career,
          nextLeague,
          syncedTeam.id
        );
        nextRivals = [...nextRivals, ...createdRivals];
      }

      const { role } = calculateRoleAndMpg({
        ovr: career.ovr,
        team: syncedTeam,
        coachTrust: nextInitialTrust,
        secondaryPos: career.secondaryPos,
        contractType: nextContractType,
        league: nextLeague,
        stats: career.stats,
        primaryPos: career.primaryPos,
        growthDna: career.growthDna,
        traits: career.traits,
        promisedRole: promise.promisedRole,
        draftPedigreePick: nextPedigreePick,
        draftPedigreeRound: nextPedigreeRound,
        draftPedigreeSeasonsLeft: nextPedigreeSeasons,
        seasonLogs: career.seasonLogs,
      });

      set({
        career: {
          ...career,
          league: nextLeague,
          team: syncedTeam,
          contractType: nextContractType,
          contractYearsLeft: nextYears,
          annualSalary: nextSalary,
          twoWaySeasonsUsed:
            nextContractType === 'TWO_WAY' ? 0 : career.twoWaySeasonsUsed,
          draftPedigreePick: nextPedigreePick,
          draftPedigreeRound: nextPedigreeRound,
          draftPedigreeSeasonsLeft: nextPedigreeSeasons,
          promisedRole: promise.promisedRole,
          brokenRolePromise: false,
          seasonsOnCurrentTeam: 0,
          tradeRequestedThisYear: false,
          rivals: nextRivals,
          coachTrust: nextInitialTrust,
          relationships: buildTeamTransferRelationships(
            career,
            nextInitialTrust
          ),
          hasEnteredNbaDraft:
            career.hasEnteredNbaDraft || dr.draftType === 'NBA',
          role,
          combineState: null,
          draftResult: null,
          offseasonLocked: false,
          offseasonOptions: [],
          pendingEventQueue: [],
          seasonPhase: 'REGULAR_SEASON',
          playoffBracket: null,
          liveGame: null,
          milestones: [
            ...career.milestones,
            {
              id: `MS_DRAFT_${Date.now()}`,
              year: career.seasonYear,
              age: career.age,
              title: milestoneTitle,
              description: milestoneDesc,
              type: 'DRAFT',
              teamName: syncedTeam.name,
            },
          ],
        },
        view: 'DASHBOARD',
        toast: {
          id: `TOAST_${Date.now()}`,
          title: milestoneTitle,
          description: `소속 구단: ${syncedTeam.name} · 역할: ${role}`,
          tone: 'orange',
        },
      });
    },
  };
}
