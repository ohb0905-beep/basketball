import type { AnalyticsDeviceType, AnalyticsEventName } from './analyticsSchema';
import type { LeagueId, Position } from '../types/game';

export const ANALYTICS_DATE_RANGES = ['7d', '30d', '90d', 'all'] as const;
export type AnalyticsDateRange = (typeof ANALYTICS_DATE_RANGES)[number];

export const ANALYTICS_RANGE_LABELS: Record<AnalyticsDateRange, string> = {
  '7d': '최근 7일',
  '30d': '최근 30일',
  '90d': '최근 90일',
  all: '전체',
};

const RANGE_DAYS: Record<Exclude<AnalyticsDateRange, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

export const ANALYTICS_EVENT_LABELS: Record<AnalyticsEventName, string> = {
  session_start: '세션 시작',
  career_created: '커리어 생성',
  season_completed: '시즌 완료',
  league_changed: '리그 변경',
  career_ended: '커리어 은퇴',
  career_reset: '중도 초기화',
  creation_started: '생성 화면 진입',
  draft_completed: '드래프트',
};

export const ANALYTICS_DEVICE_LABELS: Record<AnalyticsDeviceType | 'unknown', string> = {
  mobile: '모바일',
  tablet: '태블릿',
  desktop: '데스크톱',
  unknown: '미분류',
};

export const POSITION_ORDER: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

export const POSITION_LABELS: Record<Position, string> = {
  PG: 'PG · 포인트가드',
  SG: 'SG · 슈팅가드',
  SF: 'SF · 스몰포워드',
  PF: 'PF · 파워포워드',
  C: 'C · 센터',
};

export const LEAGUE_FUNNEL_ORDER: LeagueId[] = [
  'HIGH_SCHOOL',
  'U_LEAGUE',
  'NCAA',
  'KBL',
  'B_LEAGUE',
  'NBL',
  'EUROLEAGUE',
  'GLEAGUE',
  'NBA',
];

export const LEAGUE_SHORT_LABELS: Record<LeagueId, string> = {
  HIGH_SCHOOL: '한국 고교',
  U_LEAGUE: '대학 U-리그',
  NCAA: 'NCAA',
  KBL: 'KBL',
  B_LEAGUE: '일본 B.리그',
  NBL: '호주 NBL',
  EUROLEAGUE: '유로리그',
  GLEAGUE: 'NBA G리그',
  NBA: 'NBA',
};


const SAFE_VERSION_FILTER_PATTERN = /^[0-9A-Za-z._+-]{1,32}$/;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
export const RECENT_LOGS_LIMIT = 30;
const MAX_DAILY_TREND_DAYS = 90;
/** 규칙 기반 인사이트를 만들기 위한 최소 표본 수 */
export const INSIGHT_MIN_SAMPLE = 30;

export function isValidAnalyticsDateRange(
  value: string
): value is AnalyticsDateRange {
  return (ANALYTICS_DATE_RANGES as readonly string[]).includes(value);
}

export function isValidAnalyticsVersionFilter(value: string): boolean {
  if (value === 'all') return true;
  return SAFE_VERSION_FILTER_PATTERN.test(value);
}

export function isValidAnalyticsLeagueFilter(value: string): boolean {
  if (value === 'all') return true;
  return (LEAGUE_FUNNEL_ORDER as readonly string[]).includes(value);
}

/**
 * 0건 나눗셈으로 인한 NaN/Infinity를 원천 차단하는 퍼센트 계산 유틸
 */
export function safePercent(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0 || part <= 0) {
    return 0;
  }
  const pct = (part / total) * 100;
  if (!Number.isFinite(pct)) return 0;
  return Math.round(pct * 10) / 10;
}

/**
 * UTC 타임스탬프를 KST(Asia/Seoul) 기준 YYYY-MM-DD 날짜 키로 변환합니다.
 */
export function toKstDateKey(isoOrMs: string | number): string {
  const ms = typeof isoOrMs === 'number' ? isoOrMs : Date.parse(isoOrMs);
  if (!Number.isFinite(ms)) return '0000-00-00';
  const kst = new Date(ms + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatShortDateLabel(dateKey: string): string {
  const parts = dateKey.split('-');
  if (parts.length !== 3) return dateKey;
  return `${parts[1]}/${parts[2]}`;
}

/**
 * KST 기준 기간 시작 시각(ISO 문자열)을 반환합니다.
 * - 7d: 오늘 포함 최근 7일 (KST 00:00:00 시작)
 * - 30d / 90d: 오늘 포함 최근 30일 / 90일 (KST 00:00:00 시작)
 * - all: null (기간 제한 없음)
 */
export function getAnalyticsRangeStartIso(
  range: AnalyticsDateRange,
  nowMs: number = Date.now()
): string | null {
  if (range === 'all') return null;
  const days = RANGE_DAYS[range];
  const todayKstKey = toKstDateKey(nowMs);
  const [y, m, d] = todayKstKey.split('-').map(Number);
  const todayMidnightKstUtcMs = Date.UTC(y, m - 1, d) - KST_OFFSET_MS;
  const startUtcMs = todayMidnightKstUtcMs - (days - 1) * DAY_MS;
  return new Date(startUtcMs).toISOString();
}

export function formatAnalyticsDateKst(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '-';
  const kst = new Date(ms + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  const hh = String(kst.getUTCHours()).padStart(2, '0');
  const mm = String(kst.getUTCMinutes()).padStart(2, '0');
  return `${y}.${m}.${d} ${hh}:${mm}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return null;
}

function leagueLabel(raw: string | null): string {
  if (!raw) return '-';
  if (raw in LEAGUE_SHORT_LABELS) {
    return LEAGUE_SHORT_LABELS[raw as LeagueId];
  }
  return raw;
}

const MAX_SEASON_BUCKETS = [
  { key: '1', label: '1시즌', match: (s: number) => s <= 1 },
  { key: '2-3', label: '2~3시즌', match: (s: number) => s >= 2 && s <= 3 },
  { key: '4-6', label: '4~6시즌', match: (s: number) => s >= 4 && s <= 6 },
  { key: '7-10', label: '7~10시즌', match: (s: number) => s >= 7 && s <= 10 },
  { key: '11-15', label: '11~15시즌', match: (s: number) => s >= 11 && s <= 15 },
  { key: '16+', label: '16시즌+', match: (s: number) => s >= 16 },
] as const;

const RESET_SEASON_BUCKETS = [
  { key: '0', label: '0시즌 (생성 직후)', match: (s: number) => s <= 0 },
  { key: '1', label: '1시즌', match: (s: number) => s === 1 },
  { key: '2-3', label: '2~3시즌', match: (s: number) => s >= 2 && s <= 3 },
  { key: '4-6', label: '4~6시즌', match: (s: number) => s >= 4 && s <= 6 },
  { key: '7-10', label: '7~10시즌', match: (s: number) => s >= 7 && s <= 10 },
  { key: '11+', label: '11시즌+', match: (s: number) => s >= 11 },
] as const;

/**
 * 최근 주요 마일스톤 로그용 간결한 한국어 요약 문구를 생성합니다.
 */
export function summarizeMilestonePayload(
  eventName: string,
  rawPayload: Record<string, unknown> | null
): string {
  const p = asRecord(rawPayload);

  switch (eventName) {
    case 'session_start': {
      const hasSave = Boolean(p.hasExistingSave);
      if (!hasSave) return '신규 방문 (진행 중인 세이브 없음)';
      const lg = leagueLabel(asString(p.currentLeague));
      const season = asNumber(p.currentSeason);
      const hof = asNumber(p.hofCount) ?? 0;
      return `기존 세이브 이어하기 · ${lg}${season !== null ? ` ${season}시즌` : ''}${hof > 0 ? ` · HOF ${hof}` : ''}`;
    }
    case 'career_created': {
      const pos = asString(p.position) ?? '-';
      const height = asNumber(p.heightCm);
      const lg = leagueLabel(asString(p.startingLeague));
      const ovr = asNumber(p.initialOvr);
      return `${pos}${height ? ` (${height}cm)` : ''} · ${lg} 시작${ovr !== null ? ` · OVR ${ovr}` : ''}`;
    }
    case 'season_completed': {
      const season = asNumber(p.seasonNumber);
      const lg = leagueLabel(asString(p.league));
      const ovr = asNumber(p.overall);
      const ppg = asNumber(p.ppg);
      const badges: string[] = [];
      if (p.wonChampionship) badges.push('우승');
      if (p.wonMvp) badges.push('MVP');
      if (p.wonFmvp || p.wonFinalsMvp) badges.push('FMVP');
      if (p.allStarSelected) badges.push('올스타');
      const badgeSuffix = badges.length > 0 ? ` · ${badges.join('/')}` : '';
      return `${season !== null ? `${season}시즌` : '시즌'} · ${lg}${ovr !== null ? ` · OVR ${ovr}` : ''}${ppg !== null ? ` · ${ppg} PPG` : ''}${badgeSuffix}`;
    }
    case 'league_changed': {
      const fromLg = leagueLabel(asString(p.fromLeague));
      const toLg = leagueLabel(asString(p.toLeague));
      const season = asNumber(p.seasonNumber);
      const ovr = asNumber(p.overall);
      const pick = asNumber(p.draftPick);
      const pickSuffix = pick !== null ? ` · #${pick} 지명` : '';
      return `${fromLg} → ${toLg}${season !== null ? ` (${season}시즌)` : ''}${pickSuffix}${ovr !== null ? ` · OVR ${ovr}` : ''}`;
    }
    case 'career_ended': {
      const totalSeasons = asNumber(p.totalSeasons);
      const finalLg = leagueLabel(asString(p.finalLeague));
      const peakOvr = asNumber(p.peakOverall);
      const champs = asNumber(p.totalChampionships) ?? asNumber(p.championshipCount) ?? 0;
      const mvps = asNumber(p.totalMvp) ?? asNumber(p.mvpCount) ?? 0;
      const fmvps = asNumber(p.totalFmvp) ?? asNumber(p.finalsMvpCount) ?? 0;
      const tier = asString(p.legacyTier);
      return `${totalSeasons !== null ? `총 ${totalSeasons}시즌` : '은퇴'} · ${finalLg}${peakOvr !== null ? ` · 최고 OVR ${peakOvr}` : ''} · 우승 ${champs} · MVP ${mvps}${fmvps > 0 ? ` · FMVP ${fmvps}` : ''}${tier ? ` · ${tier}` : ''}`;
    }
    case 'career_reset': {
      const lg = leagueLabel(asString(p.abandonedLeague));
      const season = asNumber(p.abandonedSeason);
      const ovr = asNumber(p.abandonedOverall);
      return `${lg} ${season !== null ? `${season}시즌` : ''} 중도 리셋${ovr !== null ? ` · OVR ${ovr}` : ''}`;
    }
    case 'creation_started':
      return p.hasExistingSave ? '생성 화면 진입 (기존 세이브 있음)' : '생성 화면 진입';
    case 'draft_completed': {
      const type = asString(p.draftType) ?? '';
      const pick = asNumber(p.pickNumber);
      const ovr = asNumber(p.overall);
      return `${type} 드래프트 · ${pick !== null ? `#${pick} 지명` : '미지명'}${ovr !== null ? ` · OVR ${ovr}` : ''}`;
    }
    default:
      return '플레이 이벤트 기록';
  }
}


// ============================================================================
// 표시용 레이블 (실제 수집되는 정규화 코드 기준, 미등록 코드는 원문 그대로 표시)
// ============================================================================

export const ROLE_LABELS: Record<string, string> = {
  garbage_time: '가비지 타임',
  two_way: '투웨이',
  bench: '벤치',
  sixth_man: '식스맨',
  starter: '주전',
  franchise_ace: '프랜차이즈 에이스',
};

export const PLAYOFF_RESULT_LABELS: Record<string, string> = {
  missed: '플레이오프 탈락',
  play_in: '플레이인',
  round1: '1라운드',
  quarterfinals: '8강',
  semifinals: '4강',
  finals_loss: '준우승',
  champion: '우승',
};

const PLAYOFF_RESULT_ORDER = [
  'champion',
  'finals_loss',
  'semifinals',
  'quarterfinals',
  'round1',
  'play_in',
  'missed',
];

export const AWARD_LABELS: Record<string, string> = {
  ROY: '신인왕',
  DPOY: '올해의 수비수',
  '6MOY': '식스맨상',
  MIP: '기량발전상',
  ALL_STAR: '올스타',
  ALL_LEAGUE_1ST: '올리그 퍼스트팀',
  ALL_LEAGUE_2ND: '올리그 세컨드팀',
  ALL_LEAGUE_3RD: '올리그 서드팀',
};

export const ENDING_LABELS: Record<string, string> = {
  GOAT: '역대 최고 선수 (GOAT)',
  FIRST_BALLOT_HOF: '명예의 전당 퍼스트 발롯',
  NBA_ALL_STAR: 'NBA 올스타 · 챔피언',
  NBA_VETERAN: 'NBA 정식 리거',
  ASIA_KBL_LEGEND: 'KBL · 아시아 레전드',
  PRO_VETERAN: '프로 베테랑',
  COURT_CHALLENGER: '코트의 도전자',
  VOLUNTARY_HONOR: '자율 명예 은퇴',
  LEGEND_FAREWELL_TOUR: '레전드 은퇴 투어',
  OUT_OF_LEAGUE: '방출 · 오퍼 없음',
  CRITICAL_INJURY: '부상 은퇴',
  AGE_40_MANDATORY: '40세 정년 은퇴',
};

export const PLAYSTYLE_LABELS: Record<string, string> = {
  SCORER: '온볼 스코어러',
  PLAYMAKER: '플레이메이커',
  THREE_AND_D: '3&D 윙',
  RIM_PROTECTOR: '림 프로텍터',
  STRETCH_BIG: '스트레치 빅',
  POST_SCORER: '포스트 스코어러',
  ALL_ROUNDER: '올라운더',
};

export const GROWTH_DNA_LABELS: Record<string, string> = {
  EARLY_BLOOMER: '조숙형',
  STANDARD: '표준형',
  LATE_BLOOMER: '대기만성형',
  IRONMAN: '철강왕',
};

export const TRAINING_FOCUS_LABELS: Record<string, string> = {
  INSIDE_SCORING: '인사이드 득점',
  OUTSIDE_SHOOTING: '외곽 슈팅',
  PLAYMAKING: '플레이메이킹',
  DEFENSE_LOCKDOWN: '수비',
  REBOUND_POST: '리바운드 · 포스트',
  PHYSICAL_CONDITIONING: '피지컬 · 체력',
  BALANCED: '밸런스',
};

export const LEAGUE_CHANGE_REASON_LABELS: Record<string, string> = {
  draft: '드래프트',
  military_enlist: '군 입대',
  military_discharge: '전역',
  summer_league: '서머리그',
  two_way: '투웨이 계약',
  promotion: '승격 · 이적',
  relegation: '강등',
  free_agency: 'FA 이적',
};

// ============================================================================
// 리포트 타입
// ============================================================================

export interface AnalyticsEventRow {
  id: string;
  event_name: AnalyticsEventName | string;
  anonymous_id?: string;
  session_id?: string;
  career_run_id?: string | null;
  game_version: string | null;
  device_type: AnalyticsDeviceType | string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface AnalyticsKpiSummary {
  uniquePlayers: number;
  totalSessions: number;
  careersCreated: number;
  seasonsCompleted: number;
  careersEnded: number;
  careersReset: number;
  totalEvents: number;
  championships: number;
  mvps: number;
  fmvps: number;
}

export interface DailyTrendPoint {
  dateKey: string; // YYYY-MM-DD (KST)
  label: string; // MM/DD
  uniquePlayers: number;
  careersCreated: number;
  seasonsCompleted: number;
}

export interface DistributionItem {
  key: string;
  label: string;
  count: number;
  percent: number;
}

/**
 * 비율 셀: 모수(n)가 0이면 percent는 null (화면에는 '-'로 표시)
 */
export interface RateCell {
  count: number;
  n: number;
  percent: number | null;
}

export interface LeagueAwardRow {
  league: string;
  label: string;
  seasons: number;
  v2Seasons: number;
  championship: RateCell;
  mvp: RateCell;
  fmvp: RateCell;
  playoffs: RateCell;
  ovrAvg: number | null;
  ppgAvg: number | null;
  rpgAvg: number | null;
  apgAvg: number | null;
}

export interface PositionBalanceRow {
  position: string;
  label: string;
  careers: number;
  careerShare: number;
  seasons: number;
  championship: RateCell;
  mvp: RateCell;
  fmvp: RateCell;
  ovrAvg: number | null;
  ppgAvg: number | null;
  rpgAvg: number | null;
  apgAvg: number | null;
}

export interface RecentMilestoneLog {
  id: string;
  createdAt: string;
  formattedDateKst: string;
  eventName: AnalyticsEventName | string;
  eventLabel: string;
  deviceType: AnalyticsDeviceType | null;
  deviceLabel: string;
  gameVersion: string | null;
  league: string | null;
  position: string | null;
  badges: string[];
  summary: string;
  payload: Record<string, unknown>;
}

export interface AdminAnalyticsReport {
  schemaVersion: 2;
  range: AnalyticsDateRange;
  version: string;
  league: string;
  availableVersions: string[];
  generatedAt: string;
  /** Supabase에 admin_analytics_report 함수가 아직 설치되지 않은 경우 */
  setupRequired: boolean;
  tableNotReady: boolean;
  kpi: AnalyticsKpiSummary;
  dailyTrend: DailyTrendPoint[];
  leagueAwards: LeagueAwardRow[];
  positionBalance: {
    rows: PositionBalanceRow[];
    careersTotal: number;
    unknownPositionSeasons: number;
  };
  funnel: {
    leagueReach: DistributionItem[];
    leagueReachDenominator: number;
    maxSeasonReached: DistributionItem[];
  };
  resets: {
    total: number;
    bySeason: DistributionItem[];
    byLeague: DistributionItem[];
    byOvr: DistributionItem[];
    byRole: DistributionItem[];
    /** 1시즌 이하에서 리셋 (초반 벽 포기) */
    earlyQuit: RateCell;
    /** 우승 경험 후 리셋 (목표 달성 후 재도전) */
    afterChampionship: RateCell;
    afterMvp: RateCell;
  };
  seasonMeta: {
    roles: DistributionItem[];
    roleSample: number;
    playoffResults: DistributionItem[];
    playoffSample: number;
  };
  awards: {
    seasonsWithAwardData: number;
    items: DistributionItem[];
  };
  endings: {
    total: number;
    hallOfFame: RateCell;
    byType: DistributionItem[];
  };
  buildMeta: {
    playstyle: DistributionItem[];
    growthDna: DistributionItem[];
    trainingFocus: DistributionItem[];
    leagueChangeReasons: DistributionItem[];
    draftRounds: DistributionItem[];
  };
  environment: {
    devices: DistributionItem[];
    versions: DistributionItem[];
  };
  insights: string[];
  recentLogs: RecentMilestoneLog[];
}

// ============================================================================
// Postgres 집계 결과(admin_analytics_report) 방어적 파싱
// - 함수 버전이 달라 일부 키가 빠져 있어도 0/빈 배열로 안전하게 처리합니다.
// ============================================================================

interface KeyCount {
  key: string;
  count: number;
}

function toCount(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function toAvg(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function keyCounts(value: unknown): KeyCount[] {
  const items: KeyCount[] = [];
  for (const raw of asArray(value)) {
    const rec = asRecord(raw);
    const key =
      typeof rec.key === 'number' && Number.isFinite(rec.key)
        ? String(rec.key)
        : asString(rec.key);
    if (key === null) continue;
    items.push({ key, count: toCount(rec.count) });
  }
  return items;
}

export function rateCell(count: number, n: number): RateCell {
  const safeN = toCount(n);
  const safeCount = Math.min(toCount(count), safeN);
  return {
    count: safeCount,
    n: safeN,
    percent: safeN > 0 ? safePercent(safeCount, safeN) : null,
  };
}

function toDistribution(
  items: KeyCount[],
  labelOf: (key: string) => string,
  denominator?: number
): DistributionItem[] {
  const total =
    denominator ?? items.reduce((sum, item) => sum + item.count, 0);
  return items.map((item) => ({
    key: item.key,
    label: labelOf(item.key),
    count: item.count,
    percent: safePercent(item.count, total),
  }));
}

function labelFrom(map: Record<string, string>) {
  return (key: string) => (key === 'unknown' ? '미분류' : map[key] ?? key);
}

function leagueLabelOf(key: string): string {
  if (key === 'unknown') return '미분류';
  return leagueLabel(key);
}

function leagueOrderIndex(key: string): number {
  const idx = (LEAGUE_FUNNEL_ORDER as readonly string[]).indexOf(key);
  return idx === -1 ? LEAGUE_FUNNEL_ORDER.length : idx;
}

function bucketize(
  items: KeyCount[],
  buckets: ReadonlyArray<{ key: string; label: string; match: (s: number) => boolean }>
): DistributionItem[] {
  const counts = buckets.map(() => 0);
  for (const item of items) {
    const value = Number(item.key);
    if (!Number.isFinite(value)) continue;
    const idx = buckets.findIndex((b) => b.match(value));
    if (idx >= 0) counts[idx] += item.count;
  }
  const total = counts.reduce((a, b) => a + b, 0);
  return buckets.map((bucket, i) => ({
    key: bucket.key,
    label: bucket.label,
    count: counts[i],
    percent: safePercent(counts[i], total),
  }));
}

function buildDailyTrend(
  rawDaily: unknown,
  range: AnalyticsDateRange,
  nowMs: number
): DailyTrendPoint[] {
  const byDate = new Map<string, { players: number; careers: number; seasons: number }>();
  for (const raw of asArray(rawDaily)) {
    const rec = asRecord(raw);
    const date = asString(rec.date);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    byDate.set(date, {
      players: toCount(rec.players),
      careers: toCount(rec.careers),
      seasons: toCount(rec.seasons),
    });
  }

  const todayKey = toKstDateKey(nowMs);
  const [ty, tm, td] = todayKey.split('-').map(Number);
  const todayUtc = Date.UTC(ty, tm - 1, td);

  let days: number;
  if (range === 'all') {
    const sorted = Array.from(byDate.keys()).sort();
    if (sorted.length === 0) return [];
    const [fy, fm, fd] = sorted[0].split('-').map(Number);
    days = Math.floor((todayUtc - Date.UTC(fy, fm - 1, fd)) / DAY_MS) + 1;
  } else {
    days = RANGE_DAYS[range];
  }
  days = Math.max(1, Math.min(days, MAX_DAILY_TREND_DAYS));

  const points: DailyTrendPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const dt = new Date(todayUtc - i * DAY_MS);
    const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
    const v = byDate.get(key);
    points.push({
      dateKey: key,
      label: formatShortDateLabel(key),
      uniquePlayers: v?.players ?? 0,
      careersCreated: v?.careers ?? 0,
      seasonsCompleted: v?.seasons ?? 0,
    });
  }
  return points;
}

const RESET_OVR_LABEL = (key: string) => {
  const base = Number(key);
  if (!Number.isFinite(base)) return key;
  return `OVR ${base}~${base + 9}`;
};

function buildLeagueAwards(rawLeagues: unknown): LeagueAwardRow[] {
  const rows: LeagueAwardRow[] = [];
  for (const raw of asArray(rawLeagues)) {
    const r = asRecord(raw);
    const league = asString(r.league) ?? 'unknown';
    rows.push({
      league,
      label: leagueLabelOf(league),
      seasons: toCount(r.seasons),
      v2Seasons: toCount(r.v2Seasons),
      championship: rateCell(toCount(r.champs), toCount(r.champN)),
      mvp: rateCell(toCount(r.mvps), toCount(r.mvpN)),
      fmvp: rateCell(toCount(r.fmvps), toCount(r.fmvpN)),
      playoffs: rateCell(toCount(r.playoffs), toCount(r.playoffN)),
      ovrAvg: toAvg(r.ovrAvg),
      ppgAvg: toAvg(r.ppgAvg),
      rpgAvg: toAvg(r.rpgAvg),
      apgAvg: toAvg(r.apgAvg),
    });
  }
  return rows.sort((a, b) => leagueOrderIndex(a.league) - leagueOrderIndex(b.league));
}

function buildPositionBalance(
  rawCreated: unknown,
  rawSeasons: unknown
): AdminAnalyticsReport['positionBalance'] {
  const created = keyCounts(rawCreated);
  const careersTotal = created.reduce((sum, c) => sum + c.count, 0);
  const createdMap = new Map(created.map((c) => [c.key, c.count]));

  const seasonMap = new Map<string, Record<string, unknown>>();
  for (const raw of asArray(rawSeasons)) {
    const r = asRecord(raw);
    const pos = asString(r.position) ?? 'unknown';
    seasonMap.set(pos, r);
  }

  const rows: PositionBalanceRow[] = POSITION_ORDER.map((pos) => {
    const s = seasonMap.get(pos) ?? {};
    const careers = createdMap.get(pos) ?? 0;
    return {
      position: pos,
      label: POSITION_LABELS[pos],
      careers,
      careerShare: safePercent(careers, careersTotal),
      seasons: toCount(s.seasons),
      championship: rateCell(toCount(s.champs), toCount(s.champN)),
      mvp: rateCell(toCount(s.mvps), toCount(s.mvpN)),
      fmvp: rateCell(toCount(s.fmvps), toCount(s.fmvpN)),
      ovrAvg: toAvg(s.ovrAvg),
      ppgAvg: toAvg(s.ppgAvg),
      rpgAvg: toAvg(s.rpgAvg),
      apgAvg: toAvg(s.apgAvg),
    };
  });

  return {
    rows,
    careersTotal,
    unknownPositionSeasons: toCount(seasonMap.get('unknown')?.seasons),
  };
}

function formatPct(value: number | null): string {
  return value === null ? '-' : `${value.toFixed(1)}%`;
}

/**
 * 규칙 기반 자동 밸런스 인사이트 (표본이 INSIGHT_MIN_SAMPLE 이상인 항목만)
 */
export function buildBalanceInsights(
  report: Pick<
    AdminAnalyticsReport,
    'positionBalance' | 'leagueAwards' | 'resets' | 'kpi'
  >
): string[] {
  const insights: string[] = [];
  const min = INSIGHT_MIN_SAMPLE;

  const { rows, careersTotal } = report.positionBalance;
  if (careersTotal >= min) {
    const top = [...rows].sort((a, b) => b.careers - a.careers)[0];
    const bottom = [...rows].sort((a, b) => a.careers - b.careers)[0];
    if (top && top.careers > 0) {
      insights.push(
        `가장 많이 선택된 포지션은 ${top.position} (${top.careerShare.toFixed(1)}%)이고, 가장 적은 포지션은 ${bottom.position} (${bottom.careerShare.toFixed(1)}%)입니다.`
      );
    }
  }

  const mvpRows = rows.filter((r) => r.mvp.n >= min && r.mvp.percent !== null);
  if (mvpRows.length >= 2) {
    const sorted = [...mvpRows].sort((a, b) => (b.mvp.percent ?? 0) - (a.mvp.percent ?? 0));
    const hi = sorted[0];
    const lo = sorted[sorted.length - 1];
    insights.push(
      `시즌 MVP 수상률은 ${hi.position}가 ${formatPct(hi.mvp.percent)}로 가장 높고 ${lo.position}가 ${formatPct(lo.mvp.percent)}로 가장 낮습니다.`
    );
  }

  const nba = report.leagueAwards.find((r) => r.league === 'NBA');
  if (nba && nba.championship.n >= min) {
    insights.push(
      `최상위 리그 NBA의 시즌 우승률은 ${formatPct(nba.championship.percent)} (${nba.championship.count}/${nba.championship.n}), MVP 수상률은 ${formatPct(nba.mvp.percent)}입니다.`
    );
  }

  const mvpLeagues = report.leagueAwards.filter(
    (r) => r.mvp.n >= min && r.mvp.percent !== null && r.league !== 'unknown'
  );
  if (mvpLeagues.length >= 2) {
    const hi = [...mvpLeagues].sort((a, b) => (b.mvp.percent ?? 0) - (a.mvp.percent ?? 0))[0];
    insights.push(
      `MVP가 가장 자주 나오는 리그는 ${hi.label} (${formatPct(hi.mvp.percent)})입니다.`
    );
  }

  const resets = report.resets;
  if (resets.total >= min) {
    const topLeague = [...resets.byLeague].sort((a, b) => b.count - a.count)[0];
    const topSeason = [...resets.bySeason].sort((a, b) => b.count - a.count)[0];
    if (topLeague && topSeason && topLeague.count > 0) {
      insights.push(
        `리셋은 ${topLeague.label}에서 가장 많고 (${topLeague.percent.toFixed(1)}%), 시즌 구간으로는 ${topSeason.label}에 몰려 있습니다 (${topSeason.percent.toFixed(1)}%).`
      );
    }
    if (resets.earlyQuit.n >= min) {
      insights.push(
        `리셋 중 ${formatPct(resets.earlyQuit.percent)}가 1시즌 이하에서 발생했고, 우승 경험 후 리셋은 ${formatPct(resets.afterChampionship.percent)}입니다.`
      );
    }
  }

  return insights.slice(0, 5);
}

function extractBadges(eventName: string, p: Record<string, unknown>): string[] {
  const badges: string[] = [];
  if (eventName === 'season_completed') {
    if (p.wonChampionship === true) badges.push('우승');
    if (p.wonMvp === true) badges.push('MVP');
    if (p.wonFmvp === true || p.wonFinalsMvp === true) badges.push('FMVP');
  } else if (eventName === 'career_ended') {
    if (p.hallOfFame === true) badges.push('명예의 전당');
    const champs = asNumber(p.totalChampionships) ?? asNumber(p.championshipCount) ?? 0;
    const mvps = asNumber(p.totalMvp) ?? asNumber(p.mvpCount) ?? 0;
    if (champs > 0) badges.push(`우승 ${champs}`);
    if (mvps > 0) badges.push(`MVP ${mvps}`);
  } else if (eventName === 'career_reset') {
    if (p.hadWonChampionship === true) badges.push('우승 후 리셋');
  }
  return badges;
}

function extractLogLeague(eventName: string, p: Record<string, unknown>): string | null {
  const key =
    eventName === 'career_created'
      ? 'startingLeague'
      : eventName === 'league_changed'
        ? 'toLeague'
        : eventName === 'career_ended'
          ? 'finalLeague'
          : eventName === 'career_reset'
            ? 'abandonedLeague'
            : eventName === 'session_start'
              ? 'currentLeague'
              : 'league';
  return asString(p[key]);
}

export function buildRecentLogs(rows: AnalyticsEventRow[]): RecentMilestoneLog[] {
  const safeRows = Array.isArray(rows) ? rows : [];
  return safeRows.slice(0, RECENT_LOGS_LIMIT).map((row) => {
    const payload = asRecord(row.payload);
    const deviceType =
      row.device_type === 'mobile' ||
      row.device_type === 'tablet' ||
      row.device_type === 'desktop'
        ? row.device_type
        : null;
    const eventLabel =
      ANALYTICS_EVENT_LABELS[row.event_name as AnalyticsEventName] ?? row.event_name;
    return {
      id: row.id,
      createdAt: row.created_at,
      formattedDateKst: formatAnalyticsDateKst(row.created_at),
      eventName: row.event_name,
      eventLabel,
      deviceType,
      deviceLabel: ANALYTICS_DEVICE_LABELS[deviceType ?? 'unknown'],
      gameVersion: row.game_version ?? null,
      league: extractLogLeague(row.event_name, payload),
      position: asString(payload.position),
      badges: extractBadges(row.event_name, payload),
      summary: summarizeMilestonePayload(row.event_name, payload),
      payload,
    };
  });
}

export interface BuildAdminAnalyticsReportOptions {
  range: AnalyticsDateRange;
  version: string;
  league: string;
  nowMs?: number;
  setupRequired?: boolean;
  tableNotReady?: boolean;
}

/**
 * Postgres 집계 결과(admin_analytics_report)와 최근 로그 행을 대시보드 리포트로 변환합니다.
 * - 입력이 비어 있거나 일부 키가 없어도 NaN/Infinity 없이 0 또는 null(화면 '-')로 처리합니다.
 */
export function buildAdminAnalyticsReport(
  rawAggregate: unknown,
  recentRows: AnalyticsEventRow[],
  options: BuildAdminAnalyticsReportOptions
): AdminAnalyticsReport {
  const nowMs = options.nowMs ?? Date.now();
  const raw = asRecord(rawAggregate);
  const kpiRaw = asRecord(raw.kpi);

  const kpi: AnalyticsKpiSummary = {
    uniquePlayers: toCount(kpiRaw.uniquePlayers),
    totalSessions: toCount(kpiRaw.totalSessions),
    careersCreated: toCount(kpiRaw.careersCreated),
    seasonsCompleted: toCount(kpiRaw.seasonsCompleted),
    careersEnded: toCount(kpiRaw.careersEnded),
    careersReset: toCount(kpiRaw.careersReset),
    totalEvents: toCount(kpiRaw.totalEvents),
    championships: toCount(kpiRaw.championships),
    mvps: toCount(kpiRaw.mvps),
    fmvps: toCount(kpiRaw.fmvps),
  };

  // 리그 도달 퍼널 (고유 커리어 기준)
  const reachRaw = asRecord(raw.leagueReach);
  const reachDenominator = toCount(reachRaw.runs);
  const reachMap = new Map(keyCounts(reachRaw.items).map((i) => [i.key, i.count]));
  const leagueReach: DistributionItem[] = LEAGUE_FUNNEL_ORDER.map((lg) => ({
    key: lg,
    label: LEAGUE_SHORT_LABELS[lg],
    count: reachMap.get(lg) ?? 0,
    percent: safePercent(reachMap.get(lg) ?? 0, reachDenominator),
  }));

  // 리셋 병목
  const resetsRaw = asRecord(raw.resets);
  const resetTotal = toCount(resetsRaw.total);
  const resetSeasonItems = keyCounts(resetsRaw.bySeason);
  const resetSeasonKnown = resetSeasonItems.reduce((s, i) => s + i.count, 0);
  const earlyQuitCount = resetSeasonItems
    .filter((i) => Number(i.key) <= 1)
    .reduce((s, i) => s + i.count, 0);
  const resetByLeague = keyCounts(resetsRaw.byLeague).sort(
    (a, b) => leagueOrderIndex(a.key) - leagueOrderIndex(b.key)
  );
  const resetByOvr = keyCounts(resetsRaw.byOvr).sort((a, b) => Number(a.key) - Number(b.key));

  // 시즌 역할 · 플레이오프 단계
  const roleItems = keyCounts(raw.roles);
  const playoffItems = keyCounts(raw.playoffResults).sort(
    (a, b) => PLAYOFF_RESULT_ORDER.indexOf(a.key) - PLAYOFF_RESULT_ORDER.indexOf(b.key)
  );

  // 기타 수상: 수상 데이터가 있는 시즌 대비 수상 비율
  const awardSeasons = toCount(raw.awardSeasons);
  const awardItems = keyCounts(raw.awards).sort((a, b) => b.count - a.count);

  // 엔딩
  const endingsRaw = asRecord(raw.endings);

  const createdRaw = asRecord(raw.created);
  const changesRaw = asRecord(raw.leagueChanges);

  const availableVersions = asArray(raw.availableVersions)
    .map((v) => asString(v))
    .filter((v): v is string => v !== null);

  const partial = {
    kpi,
    leagueAwards: buildLeagueAwards(raw.leagues),
    positionBalance: buildPositionBalance(raw.positionsCreated, raw.positionSeasons),
    resets: {
      total: resetTotal,
      bySeason: bucketize(resetSeasonItems, RESET_SEASON_BUCKETS),
      byLeague: toDistribution(resetByLeague, leagueLabelOf, resetTotal),
      byOvr: toDistribution(resetByOvr, RESET_OVR_LABEL),
      byRole: toDistribution(keyCounts(resetsRaw.byRole), labelFrom(ROLE_LABELS)),
      earlyQuit: rateCell(earlyQuitCount, resetSeasonKnown),
      afterChampionship: rateCell(toCount(resetsRaw.hadChamp), toCount(resetsRaw.champN)),
      afterMvp: rateCell(toCount(resetsRaw.hadMvp), toCount(resetsRaw.mvpN)),
    },
  };

  return {
    schemaVersion: 2,
    range: options.range,
    version: options.version,
    league: options.league,
    availableVersions,
    generatedAt: new Date(nowMs).toISOString(),
    setupRequired: Boolean(options.setupRequired),
    tableNotReady: Boolean(options.tableNotReady),
    dailyTrend: buildDailyTrend(raw.daily, options.range, nowMs),
    funnel: {
      leagueReach,
      leagueReachDenominator: reachDenominator,
      maxSeasonReached: bucketize(keyCounts(raw.maxSeason), MAX_SEASON_BUCKETS),
    },
    seasonMeta: {
      roles: toDistribution(roleItems, labelFrom(ROLE_LABELS)),
      roleSample: roleItems.reduce((s, i) => s + i.count, 0),
      playoffResults: toDistribution(playoffItems, labelFrom(PLAYOFF_RESULT_LABELS)),
      playoffSample: playoffItems.reduce((s, i) => s + i.count, 0),
    },
    awards: {
      seasonsWithAwardData: awardSeasons,
      items: toDistribution(awardItems, labelFrom(AWARD_LABELS), awardSeasons),
    },
    endings: {
      total: toCount(endingsRaw.total),
      hallOfFame: rateCell(toCount(endingsRaw.hof), toCount(endingsRaw.hofN)),
      byType: toDistribution(keyCounts(endingsRaw.byType), labelFrom(ENDING_LABELS)),
    },
    buildMeta: {
      playstyle: toDistribution(keyCounts(createdRaw.playstyle), labelFrom(PLAYSTYLE_LABELS)),
      growthDna: toDistribution(keyCounts(createdRaw.growthDna), labelFrom(GROWTH_DNA_LABELS)),
      trainingFocus: toDistribution(
        keyCounts(createdRaw.trainingFocus),
        labelFrom(TRAINING_FOCUS_LABELS)
      ),
      leagueChangeReasons: toDistribution(
        keyCounts(changesRaw.byReason),
        labelFrom(LEAGUE_CHANGE_REASON_LABELS)
      ),
      draftRounds: toDistribution(keyCounts(changesRaw.byDraftRound), (k) => `${k}라운드`),
    },
    environment: {
      devices: toDistribution(
        keyCounts(raw.devices),
        (k) => ANALYTICS_DEVICE_LABELS[k as AnalyticsDeviceType] ?? '미분류'
      ),
      versions: toDistribution(keyCounts(raw.versions), (k) =>
        k === 'unknown' ? '버전 미상' : `v${k}`
      ),
    },
    insights: buildBalanceInsights(partial),
    recentLogs: buildRecentLogs(recentRows),
    ...partial,
  };
}

/**
 * AI(제미나이·Claude 등)에 붙여넣기 위한 요약 JSON (개인정보·익명 ID·원본 로그 제외)
 */
export function buildShareableAnalyticsSummary(report: AdminAnalyticsReport) {
  // 최근 로그(원본 payload)는 제외하고 집계 수치만 남깁니다.
  const { recentLogs: _recentLogs, ...rest } = report;
  void _recentLogs;
  return {
    game: '로드 투 MVP (Bench to MVP)',
    note:
      '익명 플레이 통계 집계 요약입니다. RateCell은 {count: 발생 수, n: 해당 필드가 수집된 모수, percent: 비율(모수 0이면 null)} 입니다.',
    ...rest,
  };
}
