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
  | 'KBL_ROOKIE'
  | 'KBL_MAX'
  | 'KBL_VET'
  | 'OVERSEAS_CONTRACT'
  | 'GLEAGUE_EXHIBIT'
  | 'TWO_WAY'
  | 'NBA_STANDARD'
  | 'NBA_MAX'
  | 'NBA_VET_MIN'
  | 'FREE_AGENT';

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
  rating: number; // 구단 전력 (60 ~ 90)
  primaryColor: string;
  secondaryColor: string;
  espnAbbr?: string; // NBA/NCAA 공식 로고 연동용 약어
  espnId?: string;   // NCAA/NBA ESPN Team ID
  logoUrl?: string;  // 런타임 ESPN API 캐시 URL
  prestigeDesc: string;
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
  wonChampionship: boolean;
  wonMvp: boolean;
  wonRookieOfYear: boolean;
  allStarSelected: boolean;
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
  type: 'DEBUT' | 'AWARD' | 'CHAMPIONSHIP' | 'DRAFT' | 'RECORD' | 'INJURY' | 'TOUR' | 'SPECIAL';
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
  startFarewellTour?: boolean;
}

export interface CareerEvent {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category: 'POSITION' | 'MILITARY' | 'INJURY' | 'COACH' | 'FAREWELL' | 'CLUTCH';
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
  actionType:
    | 'SIGN_TEAM'
    | 'ENTER_KBL_DRAFT'
    | 'ENTER_NBA_DRAFT'
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
  | 'OUT_OF_LEAGUE'         // ③ 방출 및 구단 오퍼 부재 은퇴
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
  potential: number;
  stats: PlayerStats;
  lastSeasonDelta: StatDelta;
  league: LeagueId;
  team: TeamInfo;
  contractType: ContractType;
  contractYearsLeft: number;
  twoWaySeasonsUsed: number;
  role: string;
  coachTrust: number; // 0 ~ 100
  draftStock: number; // 0 ~ 100
  trainingFocus: TrainingFocus;
  militaryExempt: boolean;
  isFarewellTour: boolean;
  farewellTourCompleted: boolean;
  isOutOfLeagueWarning: boolean;
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
    allStars: number;
    nbaAllStars: number;
  };
  offseasonLocked: boolean; // 시즌 종료 직후 오프시즌 진로 선택 활성화 여부
  offseasonOptions: OffseasonOption[];
  pendingEvent: CareerEvent | null;
  combineState: CombineState | null;
  draftResult: {
    draftType: 'NBA' | 'KBL';
    pickNumber: number | null; // null이면 언드래프티
    round: 1 | 2 | null;
    draftedTeam: TeamInfo | null;
    twoWayOfferTeam: TeamInfo | null;
  } | null;
  retirementReason: RetirementReason | null;
  legacyEvaluation: LegacyEvaluation | null;
}
