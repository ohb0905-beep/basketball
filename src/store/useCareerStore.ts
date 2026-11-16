'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { rollMidSeasonCrossroadsEvent, rollSeasonEvent } from '../data/events';
import { LEAGUE_CONFIG } from '../data/leagues';
import {
  ALL_TEAMS,
  evolveLeagueTeamRatings,
  getTeamById,
   getTeamsByLeague,
  HIGH_SCHOOL_TEAMS,
  SANGMU_TEAM,
  selectBestFitTeamForPlayer,
} from '../data/teams';
import {
  calculateProjectedNbaPick,
  createInitialCombineState,
  determineTeamRolePromise,
  evaluateHighSchoolProspect,
  executeDraftResolution,
  generateOffseasonOptions,
  ROLE_PROMISE_LABELS,
} from '../engine/draftEngine';
import {
  buildHallOfFameEntry,
  checkRetirementEligibility,
  evaluateCareerLegacy,
} from '../engine/retirementEngine';
import {
  calculateRoleAndMpg,
  generateDraftRivals,
  getContractDefaultSalary,
  simulateSeason,
} from '../engine/seasonSimulator';
import {
  applySpecialCampProgram,
  calculateOvr,
  createInitialStats,
  evaluatePlayerBadges,
  getGrowthDnaInfo,
  getPlaystyleInfo,
  getTraitInfo,
  rollInitialPotential,
  rollInnateTrait,
  rollPlayerDnaAndPlaystyle,
} from '../engine/statCalculator';
import {
  CareerEventChoice,
  CareerState,
  ContractType,
  HallOfFameEntry,
  OffseasonOption,
  PlayerStats,
  Position,
  RetirementReason,
  SpecialCampType,
  TeamInfo,
  TrainingFocus,
  ViewState,
} from '../types/game';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  tone?: 'orange' | 'emerald' | 'amber' | 'slate';
}

interface CareerStoreState {
  view: ViewState;
  career: CareerState | null;
  hofList: HallOfFameEntry[];
  espnLogos: Record<string, string>;
  espnApiConnected: boolean;
  toast: ToastMessage | null;

  // Actions
  setView: (view: ViewState) => void;
  showToast: (title: string, description?: string, tone?: ToastMessage['tone']) => void;
  clearToast: () => void;
  setEspnLogos: (logos: Record<string, string>) => void;

  startNewCareer: (params: {
    name: string;
    jerseyNumber: string;
    heightCm: number;
    primaryPos: Position;
    highSchoolTeamId: string;
  }) => void;

  setTrainingFocus: (focus: TrainingFocus) => void;
  switchPrimaryPosition: (newPos: Position) => void;
  unlockSecondaryPosition: (secPos: Position) => void;
  runSpecialCamp: (campType: SpecialCampType) => void;
  requestTrade: () => void;
  triggerMidSeasonCrossroads: () => void;

  playSeason: () => void;
  resolveEventChoice: (choice: CareerEventChoice) => void;
  selectOffseasonOption: (option: OffseasonOption) => void;

  // Draft Combine & Live Draft Actions
  runCombineDrill: (drillId: string, label: string, statKey: keyof PlayerStats) => void;
  completeCombineInterview: (answerType: 'CONFIDENT' | 'TEAM_FIRST' | 'ANALYTICAL') => void;
  withdrawFromDraft: () => void;
  proceedToDraftLive: () => void;
  finalizeDraftSigning: (choice: 'NBA_STANDARD' | 'TWO_WAY' | 'GLEAGUE' | 'KBL') => void;

  // Retirement Actions
  triggerRetirement: (reason: RetirementReason) => void;
  completeRetirementAndReturnHome: () => void;
  resetActiveCareer: () => void;
}

function clampStat(val: number): number {
  return Math.max(35, Math.min(99, Math.round(val)));
}

export const useCareerStore = create<CareerStoreState>()(
  persist(
    (set, get) => ({
      view: 'HOME',
      career: null,
      hofList: [], // 초기 100% 공석 (더미 데이터 절대 금지)
      espnLogos: {},
      espnApiConnected: false,
      toast: null,

      setView: (view) => set({ view }),

      showToast: (title, description, tone = 'orange') => {
        const id = `TOAST_${Date.now()}`;
        set({ toast: { id, title, description, tone } });
      },

      clearToast: () => set({ toast: null }),

      setEspnLogos: (logos) =>
        set((state) => ({
          espnLogos: { ...state.espnLogos, ...logos },
          espnApiConnected: Object.keys(logos).length > 0,
        })),

      startNewCareer: ({
        name,
        jerseyNumber,
        heightCm,
        primaryPos,
        highSchoolTeamId,
      }) => {
        const hsTeam: TeamInfo =
          HIGH_SCHOOL_TEAMS.find((t) => t.id === highSchoolTeamId) ||
          HIGH_SCHOOL_TEAMS[0];

        const trimmedNum = jerseyNumber.trim();
        const assignedJersey =
          trimmedNum.length > 0
            ? trimmedNum
            : String(Math.floor(Math.random() * 100));

        const initialStats = createInitialStats(primaryPos, heightCm);
        const initialOvr = calculateOvr(initialStats, primaryPos);
        const { growthDna, playstyle } = rollPlayerDnaAndPlaystyle(
          initialStats,
          primaryPos
        );
        const innateTrait = rollInnateTrait(growthDna);
        const traitInfo = getTraitInfo(innateTrait);
        const dnaInfo = getGrowthDnaInfo(growthDna);
        const styleInfo = getPlaystyleInfo(playstyle);

        // 잠재력(Potential) 스펙트럼 전면 개방 (68 ~ 96 연속 분포)
        const potential = rollInitialPotential(
          initialOvr,
          growthDna,
          innateTrait
        );

        const initialRatingsMap: Record<string, number> = {};
        for (const t of ALL_TEAMS) {
          initialRatingsMap[t.id] = t.rating;
        }

        const tempCareer = {
          ovr: initialOvr,
          team: hsTeam,
          coachTrust: 32,
          secondaryPos: null,
          contractType: 'AMATEUR' as const,
          league: 'HIGH_SCHOOL' as const,
          stats: initialStats,
          primaryPos,
          growthDna,
          traits: [innateTrait],
        };
        const { role } = calculateRoleAndMpg(tempCareer);

        const newCareer: CareerState = {
          id: `PLAYER_${Date.now()}`,
          name: name.trim(),
          jerseyNumber: assignedJersey,
          heightCm,
          primaryPos,
          secondaryPos: null,
          growthDna,
          playstyle,
          traits: [innateTrait],
          age: 17,
          seasonYear: 2026,
          seasonsPlayed: 0,
          ovr: initialOvr,
          peakOvr: initialOvr,
          ovrHistory: [initialOvr],
          potential,
          potentialBreakthroughCount: 0,
          stats: initialStats,
          lastSeasonDelta: { ins: 0, out: 0, ply: 0, def: 0, reb: 0, phy: 0 },
          league: 'HIGH_SCHOOL',
          team: hsTeam,
          contractType: 'AMATEUR',
          contractYearsLeft: 3,
          annualSalary: 0,
          careerEarnings: 20000, // 고교 유망주 기본 훈련 장학금($20K) 지원으로 첫 캠프 체험 가능
          twoWaySeasonsUsed: 0,
          draftPedigreePick: null,
          draftPedigreeRound: null,
          draftPedigreeSeasonsLeft: 0,
          promisedRole: 'PROSPECT_DEVELOPMENT',
          brokenRolePromise: false,
          role,
          coachTrust: 32,
          draftStock: 20,
          trainingFocus: 'BALANCED',
          lastCampYear: 0,
          militaryExempt: false,
          militaryServiceSeasonsLeft: 0,
          previousTeamBeforeMilitary: null,
          isFarewellTour: false,
          farewellTourCompleted: false,
          isOutOfLeagueWarning: false,
          agentAdviceShown: false,
          midSeasonEventTriggeredThisYear: false,
          rivals: [],
          teamRatingsMap: initialRatingsMap,
          badges: evaluatePlayerBadges(
            initialStats,
            null,
            growthDna,
            playstyle,
            [innateTrait]
          ),
          seasonLogs: [],
          milestones: [
            {
              id: `MS_DEBUT_${Date.now()}`,
              year: 2026,
              age: 17,
              title: `${hsTeam.name} 농구부 입부 (초기 OVR ${initialOvr} · ${dnaInfo.label})`,
              description: `등번호 #${assignedJersey}번 · [${dnaInfo.label} / ${styleInfo.label} / ${traitInfo.name}] 특성을 지닌 유망주로 농구 인생의 첫발을 내디뎠어요.`,
              type: 'DEBUT',
              teamName: hsTeam.name,
            },
          ],
          careerHighs: {
            points: 0,
            rebounds: 0,
            assists: 0,
            steals: 0,
            blocks: 0,
            pointsContext: '아직 공식 경기 기록이 없어요',
          },
          totals: {
            gp: 0,
            points: 0,
            rebounds: 0,
            assists: 0,
            steals: 0,
            blocks: 0,
            nbaGp: 0,
            nbaPoints: 0,
            championships: 0,
            nbaChampionships: 0,
            mvps: 0,
            nbaMvps: 0,
            finalsMvps: 0,
            dpoys: 0,
            sixthManAwards: 0,
            mips: 0,
            allLeagueSelections: 0,
            allStars: 0,
            nbaAllStars: 0,
          },
          offseasonLocked: false,
          offseasonOptions: [],
          pendingEvent: null,
          combineState: null,
          draftResult: null,
          retirementReason: null,
          legacyEvaluation: null,
        };

        set({
          career: newCareer,
          view: 'DASHBOARD',
          toast: {
            id: `TOAST_${Date.now()}`,
            title: `${hsTeam.name} 입학 완료! (확정 초기 OVR ${initialOvr})`,
            description: `등번호 #${assignedJersey}번 · ${dnaInfo.badge} · ${styleInfo.badge} · ${traitInfo.badge} 부여!`,
            tone: 'orange',
          },
        });
      },

      setTrainingFocus: (focus) => {
        const { career } = get();
        if (!career) return;
        set({
          career: {
            ...career,
            trainingFocus: focus,
          },
          toast: {
            id: `TOAST_${Date.now()}`,
            title: '시즌 중점 훈련 프로그램이 변경되었어요!',
            description: '다음 시즌 결산 시 선택한 훈련 비중이 능력치 성장에 반영돼요.',
            tone: 'emerald',
          },
        });
      },

      switchPrimaryPosition: (newPos) => {
        const { career } = get();
        if (!career || career.primaryPos === newPos) return;
        const newOvr = calculateOvr(career.stats, newPos);
        const newSecondary =
          career.secondaryPos === newPos ? career.primaryPos : career.secondaryPos;
        const { role } = calculateRoleAndMpg({
          ...career,
          primaryPos: newPos,
          ovr: newOvr,
          secondaryPos: newSecondary,
        });

        set({
          career: {
            ...career,
            primaryPos: newPos,
            secondaryPos: newSecondary,
            ovr: newOvr,
            peakOvr: Math.max(career.peakOvr, newOvr),
            role,
            milestones: [
              ...career.milestones,
              {
                id: `MS_POS_${Date.now()}`,
                year: career.seasonYear,
                age: career.age,
                title: `주포지션 ${newPos} 전향 완료`,
                description: `감독님과의 전술 면담을 통해 주포지션을 ${newPos}(으)로 변경했어요 (OVR ${newOvr}).`,
                type: 'SPECIAL',
                teamName: career.team.name,
              },
            ],
          },
          toast: {
            id: `TOAST_${Date.now()}`,
            title: `주포지션을 ${newPos}(으)로 전향했어요!`,
            description: `새로운 포지션 가중치가 적용되어 종합 OVR이 ${newOvr}(으)로 조정되었어요.`,
            tone: 'orange',
          },
        });
      },

      unlockSecondaryPosition: (secPos) => {
        const { career } = get();
        if (!career || career.primaryPos === secPos) return;
        const badges = evaluatePlayerBadges(
          career.stats,
          secPos,
          career.growthDna,
          career.playstyle,
          career.traits
        );
        const { role } = calculateRoleAndMpg({
          ...career,
          secondaryPos: secPos,
        });

        set({
          career: {
            ...career,
            secondaryPos: secPos,
            badges,
            role,
            coachTrust: Math.min(100, career.coachTrust + 5),
            milestones: [
              ...career.milestones,
              {
                id: `MS_DUAL_${Date.now()}`,
                year: career.seasonYear,
                age: career.age,
                title: `듀얼 포지션 (${career.primaryPos}/${secPos}) 장착`,
                description: `멀티 포지션 소화 능력을 인정받아 팀 내 입지 보너스(+2.5)를 획득했어요!`,
                type: 'SPECIAL',
                teamName: career.team.name,
              },
            ],
          },
          toast: {
            id: `TOAST_${Date.now()}`,
            title: `부포지션 ${secPos} 해금 완료!`,
            description: '듀얼 포지션 보너스로 출전 시간 확보가 한결 유리해졌어요.',
            tone: 'emerald',
          },
        });
      },

      runSpecialCamp: (campType) => {
        const { career } = get();
        if (!career) return;
        if (career.lastCampYear === career.seasonYear) {
          get().showToast(
            '이번 시즌에는 이미 특별 훈련 캠프를 수료했어요!',
            '특별 캠프 및 신체 개조는 시즌당 1회만 진행할 수 있어요.',
            'amber'
          );
          return;
        }

        const result = applySpecialCampProgram(career, campType);
        if ((career.careerEarnings || 0) < result.costUsd) {
          get().showToast(
            '보유 자금(누적 연봉)이 부족해요!',
            `해당 캠프에는 $${(result.costUsd / 1000).toFixed(0)}K의 투자 비용이 필요해요.`,
            'amber'
          );
          return;
        }

        const nextOvr = calculateOvr(result.nextStats, career.primaryPos);
        const nextBadges = evaluatePlayerBadges(
          result.nextStats,
          career.secondaryPos,
          career.growthDna,
          career.playstyle,
          career.traits
        );
        const { role } = calculateRoleAndMpg({
          ...career,
          stats: result.nextStats,
          ovr: nextOvr,
        });

        set({
          career: {
            ...career,
            stats: result.nextStats,
            ovr: nextOvr,
            peakOvr: Math.max(career.peakOvr, nextOvr),
            potential: result.nextPotential,
            careerEarnings: Math.max(0, (career.careerEarnings || 0) - result.costUsd),
            draftStock: Math.min(100, career.draftStock + 4),
            lastCampYear: career.seasonYear,
            badges: nextBadges,
            role,
            milestones: [
              ...career.milestones,
              {
                id: `MS_CAMP_${Date.now()}`,
                year: career.seasonYear,
                age: career.age,
                title: `🏋️ 비시즌 특별 캠프 수료 (${
                  campType === 'LEGEND_SKILL_CAMP'
                    ? '레전드 스킬 캠프'
                    : campType === 'BULK_UP'
                    ? '벌크업 신체 개조'
                    : '린매스업 신체 개조'
                })`,
                description: result.summary,
                type: 'SPECIAL',
                teamName: career.team.name,
              },
            ],
          },
          toast: {
            id: `TOAST_${Date.now()}`,
            title: '🏋️ 특별 훈련 캠프 & 신체 개조 완료!',
            description: result.summary,
            tone: 'emerald',
          },
        });
      },

      requestTrade: () => {
        const { career } = get();
        if (!career) return;

        const pool = getTeamsByLeague(career.league, career.teamRatingsMap).filter(
          (t) => t.id !== career.team.id
        );
        if (pool.length === 0) return;

        // 포지션 니즈와 출전 시간이 보장되는 구단으로 트레이드
        const target =
          pool.find((t) => t.neededPositions?.includes(career.primaryPos)) ||
          pool[Math.floor(Math.random() * pool.length)];

        const promise = determineTeamRolePromise(
          career,
          target,
          career.contractType
        );
        const { role } = calculateRoleAndMpg({
          ...career,
          team: target,
          coachTrust: 58,
          promisedRole: promise.promisedRole,
        });

        set({
          career: {
            ...career,
            team: target,
            coachTrust: 58,
            promisedRole: promise.promisedRole,
            brokenRolePromise: false,
            role,
            milestones: [
              ...career.milestones,
              {
                id: `MS_TRADE_${Date.now()}`,
                year: career.seasonYear,
                age: career.age,
                title: `✈️ 공식 트레이드 단행: ${target.name} 이적`,
                description: `출전 시간과 새로운 역할을 찾아 ${target.name} 구단으로 트레이드 이적했어요 (${promise.promisedRoleLabel}).`,
                type: 'SPECIAL',
                teamName: target.name,
              },
            ],
          },
          toast: {
            id: `TOAST_${Date.now()}`,
            title: `✈️ ${target.name}(으)로 트레이드 이적 완료!`,
            description: `새로운 약속 역할: ${promise.promisedRoleLabel} · 입지: ${role}`,
            tone: 'orange',
          },
        });
      },

      triggerMidSeasonCrossroads: () => {
        const { career } = get();
        if (!career || career.pendingEvent || career.midSeasonEventTriggeredThisYear) {
          return;
        }
        const midEvt = rollMidSeasonCrossroadsEvent(career);
        set({
          career: {
            ...career,
            midSeasonEventTriggeredThisYear: true,
            pendingEvent: midEvt,
          },
        });
      },

      playSeason: () => {
        const { career } = get();
        if (!career || career.offseasonLocked) return;

        const sim = simulateSeason(career);
        const bs = sim.boxScore;

        const seasonPts = Math.round(bs.ppg * bs.gp);
        const seasonReb = Math.round(bs.rpg * bs.gp);
        const seasonAst = Math.round(bs.apg * bs.gp);
        const seasonStl = Math.round(bs.spg * bs.gp);
        const seasonBlk = Math.round(bs.bpg * bs.gp);

        const isNba = career.league === 'NBA';
        const nextTotals = {
          gp: career.totals.gp + bs.gp,
          points: career.totals.points + seasonPts,
          rebounds: career.totals.rebounds + seasonReb,
          assists: career.totals.assists + seasonAst,
          steals: career.totals.steals + seasonStl,
          blocks: career.totals.blocks + seasonBlk,
          nbaGp: career.totals.nbaGp + (isNba ? bs.gp : 0),
          nbaPoints: career.totals.nbaPoints + (isNba ? seasonPts : 0),
          championships:
            career.totals.championships + (bs.wonChampionship ? 1 : 0),
          nbaChampionships:
            career.totals.nbaChampionships +
            (isNba && bs.wonChampionship ? 1 : 0),
          mvps: career.totals.mvps + (bs.wonMvp ? 1 : 0),
          nbaMvps: career.totals.nbaMvps + (isNba && bs.wonMvp ? 1 : 0),
          finalsMvps:
            (career.totals.finalsMvps || 0) + (bs.wonFinalsMvp ? 1 : 0),
          dpoys: (career.totals.dpoys || 0) + (bs.wonDpoy ? 1 : 0),
          sixthManAwards:
            (career.totals.sixthManAwards || 0) + (bs.wonSixthMan ? 1 : 0),
          mips: (career.totals.mips || 0) + (bs.wonMip ? 1 : 0),
          allLeagueSelections:
            (career.totals.allLeagueSelections || 0) +
            (bs.allLeagueTeam ? 1 : 0),
          allStars: career.totals.allStars + (bs.allStarSelected ? 1 : 0),
          nbaAllStars:
            career.totals.nbaAllStars + (isNba && bs.allStarSelected ? 1 : 0),
        };

        const nextHighs = { ...career.careerHighs };
        if (bs.singleGameHighPts > nextHighs.points) {
          nextHighs.points = bs.singleGameHighPts;
          nextHighs.pointsContext = `${bs.year}시즌 ${bs.teamShortName} (${bs.leagueName})`;
        }
        nextHighs.rebounds = Math.max(
          nextHighs.rebounds,
          Math.round(bs.rpg * 1.85 + 2)
        );
        nextHighs.assists = Math.max(
          nextHighs.assists,
          Math.round(bs.apg * 1.9 + 2)
        );
        nextHighs.steals = Math.max(
          nextHighs.steals,
          Math.min(10, Math.round(bs.spg * 2.8 + 1))
        );
        nextHighs.blocks = Math.max(
          nextHighs.blocks,
          Math.min(11, Math.round(bs.bpg * 2.9 + 1))
        );

        const newMilestones = [...career.milestones];
        if (bs.wonChampionship) {
          newMilestones.push({
            id: `MS_CHAMP_${bs.year}`,
            year: bs.year,
            age: bs.age,
            title: `💍 ${bs.leagueName} 챔피언십 우승${
              bs.wonFinalsMvp ? ' & 파이널 MVP!' : '!'
            }`,
            description: `${bs.teamName} 소속으로 평균 ${bs.ppg}점을 기록하며 정상에 등극했어요!`,
            type: 'CHAMPIONSHIP',
            teamName: bs.teamName,
          });
        }
        if (bs.wonMvp) {
          newMilestones.push({
            id: `MS_MVP_${bs.year}`,
            year: bs.year,
            age: bs.age,
            title: `🏆 ${bs.leagueName} 정규시즌 MVP 수상!`,
            description: `평균 ${bs.ppg}점 · ${bs.rpg}리바운드 · ${bs.apg}도움으로 리그 최고의 별이 되었어요!`,
            type: 'AWARD',
            teamName: bs.teamName,
          });
        }
        if (bs.wonDpoy) {
          newMilestones.push({
            id: `MS_DPOY_${bs.year}`,
            year: bs.year,
            age: bs.age,
            title: `🛡️ ${bs.leagueName} 올해의 수비수(DPOY) 수상!`,
            description: `평균 ${bs.spg}스틸 · ${bs.bpg}블록의 철벽 수비로 코트를 지배했어요!`,
            type: 'AWARD',
            teamName: bs.teamName,
          });
        }
        if (bs.wonSixthMan) {
          newMilestones.push({
            id: `MS_6MOY_${bs.year}`,
            year: bs.year,
            age: bs.age,
            title: `⚡ ${bs.leagueName} 올해의 식스맨상(6MOY) 수상!`,
            description: `벤치 에이스로서 평균 ${bs.ppg}점을 퍼부으며 최고의 식스맨에 선정되었어요!`,
            type: 'AWARD',
            teamName: bs.teamName,
          });
        }
        if (bs.wonMip) {
          newMilestones.push({
            id: `MS_MIP_${bs.year}`,
            year: bs.year,
            age: bs.age,
            title: `📈 ${bs.leagueName} 기량발전상(MIP) 수상!`,
            description: `비시즌 피나는 노력 끝에 리그에서 가장 눈부신 성장을 이뤄냈어요!`,
            type: 'AWARD',
            teamName: bs.teamName,
          });
        }
        if (sim.potentialBreakthroughReason) {
          newMilestones.push({
            id: `MS_BREAKTHROUGH_${bs.year}`,
            year: bs.year,
            age: bs.age,
            title: `🚀 잠재력 한계 돌파! (POT ${career.potential} → ${sim.nextPotential})`,
            description: sim.potentialBreakthroughReason,
            type: 'SPECIAL',
            teamName: bs.teamName,
          });
        }
        if (bs.singleGameHighPts >= 40) {
          newMilestones.push({
            id: `MS_40PTS_${bs.year}`,
            year: bs.year,
            age: bs.age,
            title: `🔥 단일 경기 ${bs.singleGameHighPts}득점 폭발`,
            description: `${bs.leagueName} 코트에서 잊지 못할 득점 쇼를 펼쳤어요!`,
            type: 'RECORD',
            teamName: bs.teamName,
          });
        }

        const nextAge = career.age + 1;
        const nextSeasonYear = career.seasonYear + 1;
        const nextSeasonsPlayed = career.seasonsPlayed + 1;
        let nextContractYearsLeft = Math.max(0, career.contractYearsLeft - 1);
        const nextTwoWaySeasonsUsed =
          career.contractType === 'TWO_WAY'
            ? career.twoWaySeasonsUsed + 1
            : career.twoWaySeasonsUsed;
        const nextPedigreeSeasonsLeft = Math.max(
          0,
          (career.draftPedigreeSeasonsLeft ?? 0) - 1
        );

        const nextRatingsMap = evolveLeagueTeamRatings(
          career.teamRatingsMap || {}
        );
        let nextTeam =
          getTeamById(career.team.id, nextRatingsMap) || career.team;
        let nextLeague = career.league;
        let nextContractType = career.contractType;
        let nextAnnualSalary = career.annualSalary;
        let nextMilitaryExempt = career.militaryExempt;
        let nextMilitaryLeft = career.militaryServiceSeasonsLeft;
        let nextPrevTeam = career.previousTeamBeforeMilitary;

        if (nextMilitaryLeft > 0) {
          nextMilitaryLeft -= 1;
          if (nextMilitaryLeft === 0) {
            nextMilitaryExempt = true;
            const returnTeam =
              (nextPrevTeam && getTeamById(nextPrevTeam.id, nextRatingsMap)) ||
              selectBestFitTeamForPlayer(
                'KBL',
                career.primaryPos,
                career.secondaryPos,
                nextRatingsMap
              );
            nextTeam = returnTeam;
            nextLeague = returnTeam.league;
            nextContractType =
              returnTeam.league === 'KBL' ? 'KBL_MAX' : 'OVERSEAS_CONTRACT';
            nextContractYearsLeft = 0;
            nextAnnualSalary = getContractDefaultSalary(
              nextContractType,
              sim.nextOvr
            );
            nextPrevTeam = null;

            newMilestones.push({
              id: `MS_DISCHARGE_${nextSeasonYear}`,
              year: nextSeasonYear,
              age: nextAge,
              title: '🎖️ 국군체육부대(상무) 만기 전역!',
              description:
                '2시즌 동안의 상무 복무를 마치고 당당히 프로 코트로 복귀했어요!',
              type: 'MILITARY',
              teamName: SANGMU_TEAM.name,
            });
          }
        }

        const updatedCareerBase: CareerState = {
          ...career,
          age: nextAge,
          seasonYear: nextSeasonYear,
          seasonsPlayed: nextSeasonsPlayed,
          ovr: sim.nextOvr,
          peakOvr: Math.max(career.peakOvr, sim.nextOvr),
          ovrHistory: [...(career.ovrHistory || [career.ovr]), sim.nextOvr],
          potential: sim.nextPotential,
          potentialBreakthroughCount:
            (career.potentialBreakthroughCount || 0) +
            (sim.potentialBreakthroughReason ? 1 : 0),
          stats: sim.nextStats,
          lastSeasonDelta: sim.statDelta,
          traits: sim.nextTraits,
          league: nextLeague,
          team: nextTeam,
          contractType: nextContractType,
          contractYearsLeft: nextContractYearsLeft,
          annualSalary: nextAnnualSalary,
          careerEarnings: (career.careerEarnings || 0) + bs.salaryEarned,
          twoWaySeasonsUsed: nextTwoWaySeasonsUsed,
          draftPedigreeSeasonsLeft: nextPedigreeSeasonsLeft,
          brokenRolePromise: sim.brokenRolePromise,
          role: bs.role,
          coachTrust: sim.nextCoachTrust,
          draftStock: sim.nextDraftStock,
          militaryExempt: nextMilitaryExempt,
          militaryServiceSeasonsLeft: nextMilitaryLeft,
          previousTeamBeforeMilitary: nextPrevTeam,
          midSeasonEventTriggeredThisYear: false,
          rivals: sim.updatedRivals,
          teamRatingsMap: nextRatingsMap,
          badges: sim.nextBadges,
          seasonLogs: [...career.seasonLogs, bs],
          milestones: newMilestones,
          careerHighs: nextHighs,
          totals: nextTotals,
          offseasonLocked: true,
          offseasonOptions: [],
          pendingEvent: null,
        };

        if (
          updatedCareerBase.league === 'HIGH_SCHOOL' &&
          updatedCareerBase.age >= 20
        ) {
          const hsEval = evaluateHighSchoolProspect(updatedCareerBase);
          updatedCareerBase.prospectStars = hsEval.stars;
        }

        if (career.isFarewellTour) {
          const legacyEval = evaluateCareerLegacy(updatedCareerBase);
          set({
            career: {
              ...updatedCareerBase,
              farewellTourCompleted: true,
              retirementReason: 'LEGEND_FAREWELL_TOUR',
              legacyEvaluation: legacyEval,
            },
            view: 'RETIREMENT',
          });
          return;
        }

        if (nextAge >= 40) {
          const legacyEval = evaluateCareerLegacy(updatedCareerBase);
          set({
            career: {
              ...updatedCareerBase,
              retirementReason: 'AGE_40_MANDATORY',
              legacyEvaluation: legacyEval,
            },
            view: 'RETIREMENT',
          });
          return;
        }

        const rolledEvent = rollSeasonEvent(updatedCareerBase);
        const offseasonOptions = generateOffseasonOptions(updatedCareerBase);
        const { isOutOfLeague } = checkRetirementEligibility(updatedCareerBase);
        const hasNoActiveOffers =
          offseasonOptions.length === 1 &&
          offseasonOptions[0].actionType === 'RETIRE_OUT_OF_LEAGUE';

        set({
          career: {
            ...updatedCareerBase,
            agentAdviceShown:
              updatedCareerBase.agentAdviceShown ||
              rolledEvent?.id === 'EVT_AGENT_RETIREMENT_ADVICE',
            isOutOfLeagueWarning: isOutOfLeague || hasNoActiveOffers,
            offseasonOptions,
            pendingEvent: rolledEvent,
          },
        });
      },

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
            view: 'RETIREMENT',
          });
          return;
        }

        const nextStats: PlayerStats = { ...career.stats };
        if (choice.statChanges) {
          for (const k of Object.keys(
            choice.statChanges
          ) as (keyof PlayerStats)[]) {
            const diff = choice.statChanges[k] || 0;
            nextStats[k] = clampStat(nextStats[k] + diff);
          }
        }

        const nextPrimary = choice.switchPrimaryPos || career.primaryPos;
        const nextSecondary = choice.unlockSecondaryPos || career.secondaryPos;
        const nextOvr = calculateOvr(nextStats, nextPrimary);
        const nextPotential = Math.min(
          98,
          career.potential + (choice.potentialDelta || 0)
        );
        const nextTrust = Math.max(
          10,
          Math.min(100, career.coachTrust + (choice.trustDelta || 0))
        );
        const nextStock = Math.max(
          10,
          Math.min(100, career.draftStock + (choice.draftStockDelta || 0))
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

        if (choice.grantMilitaryExemption && !career.militaryExempt) {
          nextMilestones.push({
            id: `MS_MILITARY_${Date.now()}`,
            year: career.seasonYear,
            age: career.age,
            title: '🇰🇷 아시안게임 금메달 & 병역특례 획득!',
            description:
              '결승전 클러치 활약으로 금메달을 목에 걸며 해외 진출 걸림돌이던 병역 문제를 완전히 해결했어요!',
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
          nextAnnualSalary = 5400;
          nextMilitaryServiceLeft = 2;

          nextMilestones.push({
            id: `MS_SANGMU_ENLIST_${Date.now()}`,
            year: career.seasonYear,
            age: career.age,
            title: '🫡 국군체육부대(상무 농구단) 입대 (2시즌 복무)',
            description:
              '국방의 의무를 다하기 위해 문경 상무 농구단에 입대하여 2시즌간 KBL 무대에서 복무해요.',
            type: 'MILITARY',
            teamName: SANGMU_TEAM.name,
          });
        }

        // 시즌 중반 트레이드 데드라인 이적 실행
        if (choice.executeTradeToContender) {
          const sameLeagueTeams = getTeamsByLeague(
            career.league,
            career.teamRatingsMap
          ).filter((t) => t.id !== career.team.id);
          const contenders = sameLeagueTeams.filter(
            (t) =>
              t.direction === 'CONTENDER' || t.direction === 'PLAYOFF_HUNT'
          );
          const pickedContender =
            contenders.find((t) =>
              t.neededPositions?.includes(career.primaryPos)
            ) ||
            contenders[0] ||
            sameLeagueTeams[0];

          if (pickedContender) {
            nextTeam = pickedContender;
            nextPromisedRole =
              career.ovr >= pickedContender.rating - 1
                ? 'STARTER_GUARANTEE'
                : 'SIXTH_MAN_CORE';
            nextMilestones.push({
              id: `MS_MID_TRADE_${Date.now()}`,
              year: career.seasonYear,
              age: career.age,
              title: `✈️ 트레이드 데드라인 전격 이적: ${pickedContender.name}`,
              description: `시즌 중반 우승 반지와 새로운 기회를 찾아 ${pickedContender.name}(으)로 유니폼을 갈아입었어요!`,
              type: 'SPECIAL',
              teamName: pickedContender.name,
            });
          }
        }

        const updatedBase: CareerState = {
          ...career,
          primaryPos: nextPrimary,
          secondaryPos: nextSecondary,
          stats: nextStats,
          ovr: nextOvr,
          peakOvr: Math.max(career.peakOvr, nextOvr),
          potential: nextPotential,
          coachTrust: nextTrust,
          draftStock: nextStock,
          league: nextLeague,
          team: nextTeam,
          contractType: nextContractType,
          contractYearsLeft: nextContractYearsLeft,
          annualSalary: nextAnnualSalary,
          promisedRole: nextPromisedRole,
          brokenRolePromise: choice.executeTradeToContender
            ? false
            : career.brokenRolePromise,
          agentAdviceShown:
            career.agentAdviceShown || Boolean(choice.markAgentAdviceDismissed),
          militaryExempt: nextMilitaryExempt,
          militaryServiceSeasonsLeft: nextMilitaryServiceLeft,
          previousTeamBeforeMilitary: nextPrevTeam,
          badges: evaluatePlayerBadges(
            nextStats,
            nextSecondary,
            career.growthDna,
            career.playstyle,
            career.traits
          ),
          milestones: nextMilestones,
          pendingEvent: null,
        };

        const refreshedOptions = updatedBase.offseasonLocked
          ? generateOffseasonOptions(updatedBase)
          : [];

        set({
          career: {
            ...updatedBase,
            offseasonOptions: refreshedOptions,
          },
          toast: {
            id: `TOAST_${Date.now()}`,
            title: choice.enlistSangmu
              ? '🫡 국군체육부대(상무)에 입대했어요!'
              : choice.executeTradeToContender
              ? `✈️ ${nextTeam.name}(으)로 트레이드 이적 완료!`
              : '선택 결과가 선수에게 반영되었어요!',
            description: choice.effectSummary,
            tone: 'emerald',
          },
        });
      },

      selectOffseasonOption: (option) => {
        const { career } = get();
        if (!career || option.locked) return;

        if (option.actionType === 'RETIRE_VOLUNTARY') {
          get().triggerRetirement('VOLUNTARY_HONOR');
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
              contractYearsLeft: 1,
              offseasonLocked: false,
              offseasonOptions: [],
              milestones: [
                ...career.milestones,
                {
                  id: `MS_TOUR_${Date.now()}`,
                  year: career.seasonYear,
                  age: career.age,
                  title: '🌟 공식 레전드 은퇴 투어(Farewell Tour) 선언',
                  description: `${career.team.name}에서의 마지막 시즌을 앞두고 전 구단 고별 투어를 시작했어요!`,
                  type: 'TOUR',
                  teamName: career.team.name,
                },
              ],
            },
            toast: {
              id: `TOAST_${Date.now()}`,
              title: '🌟 공식 은퇴 투어 시즌이 시작되었어요!',
              description: '이번 시즌을 마치면 성대한 은퇴식과 영구결번 심사가 열려요.',
              tone: 'amber',
            },
          });
          return;
        }

        if (option.actionType === 'RETURN_KBL_FAREWELL' && option.targetTeam) {
          const { role } = calculateRoleAndMpg({
            ...career,
            league: 'KBL',
            team: option.targetTeam,
            contractType: 'KBL_VET',
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
              isFarewellTour: true,
              isOutOfLeagueWarning: false,
              offseasonLocked: false,
              offseasonOptions: [],
              milestones: [
                ...career.milestones,
                {
                  id: `MS_KBL_RETURN_${Date.now()}`,
                  year: career.seasonYear,
                  age: career.age,
                  title: `🇰🇷 ${option.targetTeam.name} 복귀 & 고별 투어 선언`,
                  description:
                    '국내 팬들 앞에서 현역 마지막 시즌을 불태우기로 결정했어요!',
                  type: 'TOUR',
                  teamName: option.targetTeam.name,
                },
              ],
            },
            toast: {
              id: `TOAST_${Date.now()}`,
              title: `${option.targetTeam.name}에 합류했어요!`,
              description: '고국 팬들의 뜨거운 박수 속에 마지막 시즌을 시작해요.',
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
        const isTeamChanged = nextTeam.id !== career.team.id;
        const nextTrust = isTeamChanged ? 54 : career.coachTrust;
        const nextSalary =
          option.annualSalary !== undefined
            ? option.annualSalary
            : getContractDefaultSalary(option.contractType, career.ovr);

        const nextPromisedRole =
          option.promisedRole ||
          determineTeamRolePromise(career, nextTeam, option.contractType)
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
          contractType: option.contractType,
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
            title: `${nextTeam.name} (${LEAGUE_CONFIG[nextLeague].shortName}) 계약 체결`,
            description: `약속 역할 [${ROLE_PROMISE_LABELS[nextPromisedRole]}] · '${role}' 입지로 새로운 도전을 시작했어요.`,
            type: 'SPECIAL',
            teamName: nextTeam.name,
          });
        }

        set({
          career: {
            ...career,
            league: nextLeague,
            team: nextTeam,
            contractType: option.contractType,
            contractYearsLeft: option.contractYears,
            annualSalary: nextSalary,
            twoWaySeasonsUsed:
              option.contractType === 'TWO_WAY' && isTeamChanged
                ? 0
                : career.twoWaySeasonsUsed,
            draftPedigreePick: isTeamChanged ? null : career.draftPedigreePick,
            draftPedigreeRound: isTeamChanged ? null : career.draftPedigreeRound,
            draftPedigreeSeasonsLeft: nextPedigreeSeasons,
            promisedRole: nextPromisedRole,
            brokenRolePromise: false,
            rivals: nextRivals,
            coachTrust: nextTrust,
            role,
            isOutOfLeagueWarning: false,
            offseasonLocked: false,
            offseasonOptions: [],
            milestones: nextMilestones,
          },
          toast: {
            id: `TOAST_${Date.now()}`,
            title: isTeamChanged
              ? `${nextTeam.name} 계약을 완료했어요!`
              : `${nextTeam.name}에서 새 시즌을 준비해요!`,
            description: `구단 약속 역할: ${ROLE_PROMISE_LABELS[nextPromisedRole]}`,
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
        const updatedStats: PlayerStats = {
          ...career.stats,
          [statKey]: clampStat(career.stats[statKey] + 1),
        };
        const updatedOvr = calculateOvr(updatedStats, career.primaryPos);
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
            },
          },
          toast: {
            id: `TOAST_${Date.now()}`,
            title: `${label} 측정 완료!`,
            description: `능력치 +1 상승 & 예상 지명 순위가 ${projectedPick}순위로 업데이트되었어요!`,
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

        set({
          career: {
            ...career,
            coachTrust: Math.min(100, career.coachTrust + 4),
            combineState: {
              ...career.combineState,
              interviewCompleted: true,
              combineBonusScore: newBonus,
              projectedPick,
              undraftedRisk,
            },
          },
          toast: {
            id: `TOAST_${Date.now()}`,
            title: 'NBA 구단 단장단 심층 면접 완료!',
            description: `인상적인 답변으로 예상 순위가 ${projectedPick}순위로 상승했어요!`,
            tone: 'orange',
          },
        });
      },

      withdrawFromDraft: () => {
        const { career } = get();
        if (!career) return;

        const { role } = calculateRoleAndMpg(career);
        set({
          career: {
            ...career,
            combineState: null,
            draftResult: null,
            offseasonLocked: false,
            offseasonOptions: [],
            contractYearsLeft: Math.max(1, career.contractYearsLeft),
            role,
          },
          view: 'DASHBOARD',
          toast: {
            id: `TOAST_${Date.now()}`,
            title: '↩️ NBA 드래프트 참가를 철회하고 소속팀으로 복귀했어요.',
            description:
              '한 시즌 더 주전으로 활약하며 실전 성적과 스카우트 주가를 끌어올려 봐요!',
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
          milestoneTitle = `🇰🇷 KBL 드래프트 전체 ${dr.pickNumber}순위 지명 (${nextTeam.shortName})`;
          milestoneDesc = `${nextTeam.name}의 부름을 받아 프로 무대에 공식 데뷔했어요!`;
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
          milestoneTitle = `🏀 NBA 드래프트 1라운드 ${dr.pickNumber}순위 지명 (${nextTeam.shortName})`;
          milestoneDesc = `브루클린 바클레이스 센터에서 ${nextTeam.name} 모자를 쓰고 꿈의 NBA 정식 루키 계약을 체결했어요!`;
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
            ? `🏀 NBA 드래프트 2라운드 ${dr.pickNumber}순위 지명 (${targetNbaTeam.shortName})`
            : `🔥 언드래프티 신화 도전! ${targetNbaTeam.shortName} 투웨이 계약 체결`;
          milestoneDesc = `${targetNbaTeam.name} 투웨이 로스터에 합류해 정식 계약 승격 경쟁을 시작해요!`;
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
          milestoneTitle = `🇺🇸 ${nextTeam.name} 트라이아웃 합류`;
          milestoneDesc =
            '드래프트 아쉬움을 삼키고 G리그 쇼케이스에서 실력으로 증명하기로 했어요.';
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
          milestoneTitle = `🇰🇷 ${nextTeam.name} 입단`;
          milestoneDesc =
            'KBL 무대에서 먼저 실전 경쟁력을 증명한 뒤 다시 도전하기로 했어요.';
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
            rivals: nextRivals,
            coachTrust: nextInitialTrust,
            role,
            combineState: null,
            draftResult: null,
            offseasonLocked: false,
            offseasonOptions: [],
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

      triggerRetirement: (reason) => {
        const { career } = get();
        if (!career) return;
        const legacyEval = evaluateCareerLegacy(career);
        set({
          career: {
            ...career,
            retirementReason: reason,
            legacyEvaluation: legacyEval,
          },
          view: 'RETIREMENT',
        });
      },

      completeRetirementAndReturnHome: () => {
        const { career, hofList } = get();
        if (!career) {
          set({ view: 'HOME' });
          return;
        }

        const reason = career.retirementReason || 'VOLUNTARY_HONOR';
        const evaluation =
          career.legacyEvaluation || evaluateCareerLegacy(career);
        const newEntry = buildHallOfFameEntry(career, reason, evaluation);

        const updatedHof = [newEntry, ...hofList].sort(
          (a, b) => b.legacyScore - a.legacyScore
        );

        set({
          hofList: updatedHof,
          career: null,
          view: 'HOME',
          toast: {
            id: `TOAST_${Date.now()}`,
            title: `🏛️ #${newEntry.jerseyNumber} ${newEntry.name} 선수가 명예의 전당에 헌액되었어요!`,
            description:
              '메인 화면의 올타임 베스트 5 하프코트와 명예의 전당 보드를 확인해 보세요.',
            tone: 'amber',
          },
        });
      },

      resetActiveCareer: () => {
        set({
          career: null,
          view: 'CREATE',
        });
      },
    }),
    {
      name: 'bench-to-mvp-career-storage-v1',
      partialize: (state) => ({
        career: state.career,
        hofList: state.hofList,
      }),
    }
  )
);
