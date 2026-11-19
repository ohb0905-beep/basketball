export type LeagueId =
  | 'HIGH_SCHOOL'
  | 'U_LEAGUE'
  | 'KBL'
  | 'OVERSEAS'
  | 'GLEAGUE'
  | 'NCAA'
  | 'NBA';

export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

export type ContractType =
  | 'AMATEUR'
  | 'MILITARY_SERVICE'
  | 'KBL_ROOKIE'
  | 'KBL_MAX'
  | 'KBL_VET'
  | 'OVERSEAS_CONTRACT'
  | 'GLEAGUE_EXHIBIT'
  | 'SUMMER_LEAGUE_INVITE'
  | 'TWO_WAY'
  | 'NBA_STANDARD'
  | 'NBA_MAX'
  | 'NBA_VET_MIN'
  | 'FREE_AGENT';

export type TeamDirection = 'REBUILDING' | 'PLAYOFF_HUNT' | 'CONTENDER';

export type GrowthDna =
  | 'EARLY_BLOOMER' // 조숙형 천재 (10대~20대 초반 폭발적 성장, 다소 이른 에이징)
  | 'STANDARD'      // 밸런스 표준형 (정석적인 성장과 전성기 유지)
  | 'LATE_BLOOMER'  // 대기만성형 (20대 중후반~30세까지도 꾸준히 기량 만개)
  | 'IRONMAN';      // 철강왕 내구도형 (부상 저항력 최상, 30대 중반까지 노쇠화 지연)

export type PlaystyleArchetype =
  | 'SCORER'        // 온볼 스코어러
  | 'PLAYMAKER'     // 플로어 제너럴 플레이메이커
  | 'THREE_AND_D'   // 3&D 윙 스페셜리스트
  | 'RIM_PROTECTOR' // 림 프로텍터 & 보드 장악 빅맨
  | 'ALL_ROUNDER';  // 공수겸장 올라운더

/**
 * 선수 고유 특성 (선천적 1개 + 후천적 조건 달성 시 최대 3개 보유)
 */
export type PlayerTraitId =
  | 'IRON_STAMINA'         // [선천] 강철 체력: 부상 확률 대폭 감소 및 체력 유지
  | 'SLOW_STARTER'         // [선천] 슬로우 스타터: 20대 중후반 성장 가속 및 한계 돌파 확률 상승
  | 'GLASS_BODY'           // [선천] 유리몸: 성장 잠재력 상한 보너스가 높으나 잔부상 위험 증가
  | 'CLUTCH_PERFORMER'     // [선천] 승부사: 강팀 상대 및 플레이오프/우승 경쟁 시 스탯·승률 보정
  | 'CONTRACT_YEAR_BOOST'  // [후천] FA 로이드: 계약 마지막 해 맹활약 시 획득, 계약 만료 시즌 효율 상승
  | 'FRANCHISE_HEART'      // [후천] 프랜차이즈의 심장: 단일 구단 6시즌 이상 헌신 시 획득
  | 'BENCH_ACE'            // [후천] 벤치의 에이스: 식스맨상 수상 시 획득, 벤치/식스맨 출전 시 효율 상승
  | 'SNIPER';              // [후천] 스나이퍼: 시즌 3점 성공률 40%+ 달성 시 획득

export interface PlayerTraitInfo {
  id: PlayerTraitId;
  name: string;
  badge: string;
  kind: 'INNATE' | 'ACQUIRED';
  description: string;
}

/**
 * FA / 이적 계약 시 구단이 약속하는 역할 (Role Promise)
 */
export type RolePromiseType =
  | 'ACE_FIRST_OPTION'     // 1옵션 에이스 보장
  | 'STARTER_GUARANTEE'    // 주전 스타터 보장
  | 'SIXTH_MAN_CORE'       // 핵심 식스맨 & 클러치조
  | 'PROSPECT_DEVELOPMENT' // 핵심 유망주 육성 로테이션
  | 'VETERAN_MENTOR';      // 베테랑 라커룸 리더 & 스페셜리스트

/**
 * 비시즌 특별 훈련 캠프 & 신체 개조 프로그램
 */
export type SpecialCampType =
  | 'LEGEND_SKILL_CAMP' // 레전드 스킬 멘토링 캠프 (핵심 능력치 집중 강화 + 잠재력 돌파 기회)
  | 'BULK_UP'           // 벌크업 신체 개조 (INS, REB, PHY 상승 / PLY, OUT 소폭 감소)
  | 'LEAN_MASS';        // 린매스업 신체 개조 (PLY, OUT, DEF 상승 / REB, INS 소폭 감소)

/**
 * 프로 입단 동기 & 리그 라이벌 선수 인터페이스
 */
export interface RivalPlayer {
  id: string;
  name: string;
  draftYear: number;
  league: LeagueId;
  teamId: string;
  teamName: string;
  teamShortName: string;
  pos: Position;
  ovr: number;
  potential: number;
  ppg: number;
  rpg: number;
  apg: number;
  championships: number;
  mvps: number;
  allStars: number;
  roys: number;
  lastHeadline: string;
}

export type ViewState =
  | 'HOME'
  | 'CREATE'
  | 'DASHBOARD'
  | 'DRAFT_COMBINE'
  | 'DRAFT_LIVE'
  | 'RETIREMENT';

export type SeasonPhase =
  | 'REGULAR_SEASON'
  | 'POSTSEASON_BRACKET'
  | 'LIVE_FINAL_BROADCAST'
  | 'OFFSEASON';

export type TrainingFocus =
  | 'INSIDE_SCORING'
  | 'OUTSIDE_SHOOTING'
  | 'PLAYMAKING'
  | 'DEFENSE_LOCKDOWN'
  | 'REBOUND_POST'
  | 'PHYSICAL_CONDITIONING'
  | 'BALANCED';

export interface PlayerStats {
  ins: number; // 인사이드 득점 (레이업/덩크/포스트업)
  out: number; // 아웃사이드 슈팅 (3점/미드레인지/자유투)
  ply: number; // 플레이메이킹 (패스/볼핸들링/BQ)
  def: number; // 수비력 (대인방어/스틸/블록)
  reb: number; // 리바운드 & 박스아웃
  phy: number; // 피지컬 (스피드/점프/체력/내구도)
}

export interface StatDelta {
  ins: number;
  out: number;
  ply: number;
  def: number;
  reb: number;
  phy: number;
}

export interface LeagueConfig {
  id: LeagueId;
  name: string;
  shortName: string;
  games: number;
  ldr: number;        // League Defensive Resistance (수비 저항치)
  growthCap: number;  // 리그 성장 상한선
  prestige: number;   // 스카우팅 가중치
  country: string;
  badgeColor: string;
}

export interface BiomechanicalProfile {
  reachLeverage: number;          // ① 타점 및 림 장악력 지수 (0.25 ~ 1.45, 신장에 비례하여 연속 증가)
  centerOfGravityAgility: number; // ② 무게중심 및 볼핸들링/방향전환 기민성 지수 (0.35 ~ 1.35, 신장이 커질수록 연속 감소)
  positionalPhysicsStrain: number;// ③ 포지션 전술 요구치 대비 신체 물리 부하 지수 (0.0 ~ 1.0+)
  rebMultiplier: number;          // 실전 리바운드 경합 배율
  blkMultiplier: number;          // 실전 블록슛/림 프로텍팅 배율
  insideFgModifier: number;       // 골밑 슛 컨테스트 극복 보정치 (%p)
  tovRatePenalty: number;         // 장신 볼핸들러 드리블 궤적 노출로 인한 턴오버율 페널티
  perimeterDefPenalty: number;    // 외곽 수비 돌파 허용(Blow-by) 페널티
  staminaDrainMultiplier: number; // 풀코트 체력 소모 및 하체 부하 배율
}

export interface AsianGamesMatchLog {
  stage: 'GROUP' | 'QUARTERFINAL' | 'SEMIFINAL';
  stageLabel: string;
  opponentName: string;
  korScore: number;
  oppScore: number;
  playerPts: number;
  playerReb: number;
  playerAst: number;
  won: boolean;
}

export interface AsianGamesTournamentResult {
  reachedFinals: boolean;
  eliminatedStage: 'QUARTERFINAL' | 'SEMIFINAL' | null;
  finalOpponent: TeamInfo;
  matches: AsianGamesMatchLog[];
  summaryHeadline: string;
}

export interface TeamInfo {
  id: string;
  name: string;
  shortName: string;
  city: string;
  league: LeagueId;
  rating: number; // 구단 전력 (동적으로 매 오프시즌 변동)
  primaryColor: string;
  secondaryColor: string;
  espnAbbr?: string;
  espnId?: string;
  logoUrl?: string;
  conference?: 'EAST' | 'WEST';
  division?: string;
  prestigeDesc: string;
  direction?: TeamDirection;
  neededPositions?: Position[];
  preferredStyle?: 'PACE_AND_SPACE' | 'DEFENSE_GRIT' | 'HALF_COURT' | 'BALANCED';
  isMilitaryTeam?: boolean;
}

export type AllLeagueTier = 1 | 2 | 3 | null;

export interface StandingEntry {
  rank: number;
  conference?: 'EAST' | 'WEST';
  conferenceRank?: number;
  team: TeamInfo;
  wins: number;
  losses: number;
  winPct: number;
  gb: number;
  isPlayerTeam: boolean;
  qualifiedPlayoffs: boolean;
}

export interface PlayoffSeriesMatchup {
  id: string;
  roundNumber: number;
  roundLabel: string;
  conference?: 'EAST' | 'WEST' | 'FINALS';
  bestOf: number;
  winsNeeded: number;
  higherSeed: StandingEntry;
  lowerSeed: StandingEntry;
  higherSeedWins: number;
  lowerSeedWins: number;
  winnerId: string | null;
  involvesPlayer: boolean;
  summaryLog: string[];
}

export interface PlayoffBracketState {
  league: LeagueId;
  year: number;
  totalRounds: number;
  currentRound: number;
  rounds: PlayoffSeriesMatchup[][];
  playerEliminated: boolean;
  playerReachedFinals: boolean;
  championTeamId: string | null;
  playoffResultLabel: string;
}

export type LiveTacticId =
  | 'ACE_HERO'          // 에이스 모드: 공격 주도권 극대화 (득점↑, 체력 소모↑)
  | 'LOCKDOWN_DEFENSE'  // 질식 수비: 상대 에이스 봉쇄 (수비·스틸↑, 파울 위험↑)
  | 'UNSELFISH_PASS'    // 이타적 조율: 팀원 찬스 창출 (어시스트·팀 야투율↑)
  | 'PACE_CONSERVE';    // 체력 안배: 페이스 조절 (체력 회복, 4쿼터 클러치 대비)

export type ClutchChoiceId = 'ISO_WINNER' | 'KICKOUT_ASSIST';

export type PersonalCareId =
  | 'BIOMECH_SKILL_LAB'
  | 'REHAB_LOAD_MGMT'
  | 'SIGNATURE_SNEAKER_MARKETING';

export interface AwardRaceEntry {
  rank: number;
  name: string;
  teamShortName: string;
  pos: Position;
  isPlayer: boolean;
  ppg: number;
  rpg: number;
  apg: number;
  wins: number;
  losses: number;
  firstPlaceVoteShare: number; // 1위 표 득표율 (0 ~ 100%)
  awardScore: number;
}

export interface LiveQuarterLog {
  quarter: number; // 1, 2, 3, 4, 5(OT)
  label: string;
  teamPts: number;
  oppPts: number;
  playerPts: number;
  playerReb: number;
  playerAst: number;
  playByPlay: string[];
}

export interface LiveGameState {
  gameType: 'LEAGUE_FINALS' | 'CONF_FINALS_GAME7' | 'ASIAN_GAMES_FINAL';
  title: string;
  subtitle: string;
  playerTeam: TeamInfo;
  opponentTeam: TeamInfo;
  quarter: number; // 현재 진행 완료된 쿼터 (0 = 시작 전, 1~4, 5=OT)
  isFinished: boolean;
  teamScore: number;
  oppScore: number;
  currentTactic: LiveTacticId;
  momentum: 'HOT' | 'NEUTRAL' | 'COLD';
  pendingClutchPossession?: boolean;
  clutchPossessionResolved?: boolean;
  clutchSituationText?: string;
  playerStats: {
    pts: number;
    reb: number;
    ast: number;
    stl: number;
    blk: number;
    fgm: number;
    fga: number;
    tpm: number;
    tpa: number;
    fouls: number;
    stamina: number;
  };
  quarterLogs: LiveQuarterLog[];
  finalOutcome?: {
    won: boolean;
    wonFinalsMvp: boolean;
    grantedMilitaryExemption: boolean;
    headline: string;
  };
}

export interface LeagueAwardSummary {
  league: LeagueId;
  leagueName: string;
  leagueShortName: string;
  seasons: number;
  gp: number;
  points: number;
  championships: number;
  mvps: number;
  finalsMvps: number;
  dpoys: number;
  sixthManAwards: number;
  mips: number;
  roys: number;
  allStars: number;
  allLeague1st: number;
  allLeague2nd: number;
  allLeague3rd: number;
}

export interface SeasonBoxScore {
  seasonNumber: number;
  year: number;
  age: number;
  league: LeagueId;
  leagueName: string;
  teamId: string;
  teamName: string;
  teamShortName: string;
  contractType: ContractType;
  role: string;
  ovr: number;
  gp: number;
  injuredGamesMissed: number;
  mpg: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  fgPct: number;
  tpPct: number;
  wins: number;
  losses: number;
  teamRank?: number;
  totalLeagueTeams?: number;
  playoffResult?: string;
  salaryEarned: number; // 해당 시즌 수령 연봉 (단위: USD)
  wonChampionship: boolean;
  wonMvp: boolean;
  wonFinalsMvp: boolean;
  wonDpoy: boolean;
  wonSixthMan: boolean;
  wonMip: boolean;
  wonRookieOfYear: boolean;
  allStarSelected: boolean;
  allLeagueTeam: AllLeagueTier;
  singleGameHighPts: number;
  headline: string;
  narrativeLog: string[];
  isFarewellTour?: boolean;
  mvpRace?: AwardRaceEntry[];
  mvpRaceNarrative?: string;
  royRace?: AwardRaceEntry[];
  royRaceNarrative?: string;
}

export interface CareerHighs {
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  pointsContext: string;
}

export interface CareerMilestone {
  id: string;
  year: number;
  age: number;
  title: string;
  description: string;
  type:
    | 'DEBUT'
    | 'AWARD'
    | 'CHAMPIONSHIP'
    | 'DRAFT'
    | 'RECORD'
    | 'INJURY'
    | 'TOUR'
    | 'MILITARY'
    | 'SPECIAL';
  teamName: string;
}

export type EncounterArchetypeCategory =
  | 'TACTICAL_CLASH'
  | 'LOCKER_ROOM'
  | 'MEDIA_SPOTLIGHT'
  | 'RIVAL_SHOWDOWN'
  | 'SLUMP_MECHANICS'
  | 'LOAD_MANAGEMENT'
  | 'OFF_COURT_BRAND'
  | 'FRONT_OFFICE'
  | 'ROLE_ADAPTATION'
  | 'SCOUTING_SHOWCASE'
  | 'NATIONAL_PRIDE'
  | 'VETERAN_LEGACY';

export interface CareerEventChoice {
  label: string;
  description: string;
  effectSummary: string;
  requiredTrait?: PlayerTraitId;
  statChanges?: Partial<PlayerStats>;
  trustDelta?: number;
  draftStockDelta?: number;
  potentialDelta?: number;
  unlockSecondaryPos?: Position;
  switchPrimaryPos?: Position;
  triggerRetirement?: RetirementReason;
  grantMilitaryExemption?: boolean;
  startAsianGamesFinal?: boolean;
  enterAsianGamesTournament?: boolean;
  enlistSangmu?: boolean;
  startFarewellTour?: boolean;
  executeTradeToContender?: boolean;
  markAgentAdviceDismissed?: boolean;
  triggerVeteranReinvention?: boolean;
  nextChainEvent?: CareerEvent;
}

export interface CareerEvent {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category:
    | 'POSITION'
    | 'MILITARY'
    | 'INJURY'
    | 'COACH'
    | 'FAREWELL'
    | 'CLUTCH'
    | 'RETIREMENT_ADVICE'
    | 'MID_SEASON_CROSSROADS'
    | EncounterArchetypeCategory;
  choices: CareerEventChoice[];
}

export interface OffseasonOption {
  id: string;
  title: string;
  subtitle: string;
  badgeText: string;
  targetLeague: LeagueId;
  targetTeam?: TeamInfo;
  contractType: ContractType;
  contractYears: number;
  annualSalary?: number;
  scoutingScore?: number;
  promisedRole?: RolePromiseType;
  promisedRoleLabel?: string;
  actionType:
    | 'SIGN_TEAM'
    | 'ENTER_KBL_DRAFT'
    | 'ENTER_NBA_DRAFT'
    | 'SUMMER_LEAGUE_SHOWCASE'
    | 'STAY_TEAM'
    | 'REQUEST_TRADE'
    | 'RETIRE_VOLUNTARY'
    | 'START_FAREWELL_TOUR'
    | 'RETIRE_OUT_OF_LEAGUE'
    | 'RETURN_KBL_FAREWELL';
  locked?: boolean;
  lockReason?: string;
}

export type RetirementReason =
  | 'VOLUNTARY_HONOR'       // ① 자율 명예 은퇴
  | 'LEGEND_FAREWELL_TOUR'  // ② 레전드 은퇴 투어 완주
  | 'OUT_OF_LEAGUE'         // ③ 방출 및 구단 오퍼 부재 강제 은퇴
  | 'CRITICAL_INJURY'       // ④ 노장 치명적 부상 은퇴
  | 'AGE_40_MANDATORY';     // ⑤ 만 40세 정년 은퇴

export type LegacyTierId =
  | 'GOAT'
  | 'FIRST_BALLOT_HOF'
  | 'NBA_ALL_STAR'
  | 'NBA_VETERAN'
  | 'ASIA_KBL_LEGEND'
  | 'PRO_VETERAN'
  | 'COURT_CHALLENGER';

export interface LegacyEvaluation {
  tierId: LegacyTierId;
  tierTitle: string;
  tierEmoji: string;
  legacyScore: number;
  summaryComment: string;
  jerseyRetired: boolean;
  honoredTeam: TeamInfo;
  honoredTeamSeasons: number;
  honoredTeamPoints: number;
  honoredTeamMvps: number;
  honoredTeamChamps: number;
  honoredTeamAllStars: number;
}

export interface HallOfFameEntry {
  id: string;
  inductedAt: string;
  name: string;
  jerseyNumber: string;
  heightCm: number;
  primaryPos: Position;
  secondaryPos: Position | null;
  peakOvr: number;
  finalAge: number;
  seasonsPlayed: number;
  retirementReason: RetirementReason;
  legacyTierId: LegacyTierId;
  legacyTitle: string;
  legacyEmoji: string;
  legacyScore: number;
  jerseyRetired: boolean;
  iconicTeam: TeamInfo;
  careerEarnings: number;
  traits?: PlayerTraitId[];
  totals: {
    gp: number;
    points: number;
    rebounds: number;
    assists: number;
    nbaGp: number;
    nbaPoints: number;
    championships: number;
    nbaChampionships: number;
    mvps: number;
    nbaMvps: number;
    finalsMvps: number;
    dpoys: number;
    sixthManAwards: number;
    mips: number;
    allLeagueSelections: number;
    allStars: number;
    nbaAllStars: number;
  };
  careerAverages: {
    ppg: number;
    rpg: number;
    apg: number;
  };
  careerHighPts: number;
  epitaph: string;
}

export interface CombineState {
  completedDrills: string[];
  interviewCompleted: boolean;
  combineBonusScore: number;
  projectedPick: number;
  scoutingReport: string;
  undraftedRisk: boolean;
}

export interface CareerState {
  id: string;
  name: string;
  jerseyNumber: string;
  heightCm: number;
  primaryPos: Position;
  secondaryPos: Position | null;
  growthDna?: GrowthDna;
  playstyle?: PlaystyleArchetype;
  traits?: PlayerTraitId[];
  age: number;
  seasonYear: number;
  seasonsPlayed: number;
  ovr: number;
  peakOvr: number;
  ovrHistory: number[];
  potential: number;
  potentialBreakthroughCount?: number;
  stats: PlayerStats;
  lastSeasonDelta: StatDelta;
  league: LeagueId;
  team: TeamInfo;
  contractType: ContractType;
  contractYearsLeft: number;
  annualSalary: number;     // 현재 계약 연봉 (USD 기준)
  careerEarnings: number;   // 통산 누적 수입 (USD 기준)
  twoWaySeasonsUsed: number;
  draftPedigreePick?: number | null;
  draftPedigreeRound?: 1 | 2 | null;
  draftPedigreeSeasonsLeft?: number;
  promisedRole?: RolePromiseType;
  brokenRolePromise?: boolean;
  role: string;
  coachTrust: number; // 0 ~ 100
  draftStock: number; // 0 ~ 100
  prospectStars?: number; // 고교 졸업 시 산출된 유망주 등급 (1~5성)
  trainingFocus: TrainingFocus;
  lastCampYear?: number;
  activePersonalCare?: PersonalCareId[];
  purchasedPersonalCareCount?: number;
  fanPopularity?: number;
  veteranReinvented?: boolean;
  veteranReinventionOffered?: boolean;
  militaryExempt: boolean;
  militaryServiceSeasonsLeft: number;
  previousTeamBeforeMilitary: TeamInfo | null;
  isFarewellTour: boolean;
  farewellTourCompleted: boolean;
  isOutOfLeagueWarning: boolean;
  agentAdviceShown?: boolean;
  midSeasonEventTriggeredThisYear?: boolean;
  seenEventIds?: string[];
  recentEventCategories?: string[];
  pendingChainEvent?: CareerEvent | null;
  seasonPhase?: SeasonPhase;
  currentStandings?: StandingEntry[];
  playoffBracket?: PlayoffBracketState | null;
  liveGame?: LiveGameState | null;
  rivals?: RivalPlayer[];
  teamRatingsMap: Record<string, number>; // 동적 구단 전력 저장소
  badges: string[];
  seasonLogs: SeasonBoxScore[];
  milestones: CareerMilestone[];
  careerHighs: CareerHighs;
  totals: {
    gp: number;
    points: number;
    rebounds: number;
    assists: number;
    steals: number;
    blocks: number;
    nbaGp: number;
    nbaPoints: number;
    championships: number;
    nbaChampionships: number;
    mvps: number;
    nbaMvps: number;
    finalsMvps: number;
    dpoys: number;
    sixthManAwards: number;
    mips: number;
    allLeagueSelections: number;
    allStars: number;
    nbaAllStars: number;
  };
  offseasonLocked: boolean;
  offseasonOptions: OffseasonOption[];
  pendingEvent: CareerEvent | null;
  combineState: CombineState | null;
  draftResult: {
    draftType: 'NBA' | 'KBL';
    pickNumber: number | null;
    round: 1 | 2 | null;
    draftedTeam: TeamInfo | null;
    twoWayOfferTeam: TeamInfo | null;
    scoutingGrade?: number;
  } | null;
  retirementReason: RetirementReason | null;
  legacyEvaluation: LegacyEvaluation | null;
}
