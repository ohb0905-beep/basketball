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

export type ViewState =
  | 'HOME'
  | 'CREATE'
  | 'DASHBOARD'
  | 'DRAFT_COMBINE'
  | 'DRAFT_LIVE'
  | 'RETIREMENT';

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

export interface TeamInfo {
  id: string;
  name: string;
  shortName: string;
  city: string;
  league: LeagueId;
  rating: number; // 구단 전력 (동적으로 매 오프시즌 ±3 변동)
  primaryColor: string;
  secondaryColor: string;
  espnAbbr?: string;
  espnId?: string;
  logoUrl?: string;
  prestigeDesc: string;
  direction?: TeamDirection;
  neededPositions?: Position[];
  preferredStyle?: 'PACE_AND_SPACE' | 'DEFENSE_GRIT' | 'HALF_COURT' | 'BALANCED';
  isMilitaryTeam?: boolean;
}

export type AllLeagueTier = 1 | 2 | 3 | null;

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

export interface CareerEventChoice {
  label: string;
  description: string;
  effectSummary: string;
  statChanges?: Partial<PlayerStats>;
  trustDelta?: number;
  draftStockDelta?: number;
  unlockSecondaryPos?: Position;
  switchPrimaryPos?: Position;
  triggerRetirement?: RetirementReason;
  grantMilitaryExemption?: boolean;
  enlistSangmu?: boolean;
  startFarewellTour?: boolean;
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
    | 'RETIREMENT_ADVICE';
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
  actionType:
    | 'SIGN_TEAM'
    | 'ENTER_KBL_DRAFT'
    | 'ENTER_NBA_DRAFT'
    | 'SUMMER_LEAGUE_SHOWCASE'
    | 'STAY_TEAM'
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
  age: number;
  seasonYear: number;
  seasonsPlayed: number;
  ovr: number;
  peakOvr: number;
  ovrHistory: number[];
  potential: number;
  stats: PlayerStats;
  lastSeasonDelta: StatDelta;
  league: LeagueId;
  team: TeamInfo;
  contractType: ContractType;
  contractYearsLeft: number;
  annualSalary: number;     // 현재 계약 연봉 (USD 기준)
  careerEarnings: number;   // 통산 누적 수입 (USD 기준)
  twoWaySeasonsUsed: number;
  role: string;
  coachTrust: number; // 0 ~ 100
  draftStock: number; // 0 ~ 100
  prospectStars?: number; // 고교 졸업 시 산출된 유망주 등급 (1~5성)
  trainingFocus: TrainingFocus;
  militaryExempt: boolean;
  militaryServiceSeasonsLeft: number;
  previousTeamBeforeMilitary: TeamInfo | null;
  isFarewellTour: boolean;
  farewellTourCompleted: boolean;
  isOutOfLeagueWarning: boolean;
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
