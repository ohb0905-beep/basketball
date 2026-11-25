import type { AnalyticsDeviceType, AnalyticsEventName } from './analyticsSchema';
import type { LeagueId, Position } from '../types/game';

export const ANALYTICS_DATE_RANGES = ['7d', '30d', 'all'] as const;
export type AnalyticsDateRange = (typeof ANALYTICS_DATE_RANGES)[number];

export const ANALYTICS_RANGE_LABELS: Record<AnalyticsDateRange, string> = {
  '7d': '최근 7일',
  '30d': '최근 30일',
  all: '전체',
};

export const ANALYTICS_EVENT_LABELS: Record<AnalyticsEventName, string> = {
  session_start: '세션 시작',
  career_created: '커리어 생성',
  season_completed: '시즌 완료',
  league_changed: '리그 변경',
  career_ended: '커리어 은퇴',
  career_reset: '중도 초기화',
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
const RECENT_LOGS_LIMIT = 25;

export interface AnalyticsEventRow {
  id: string;
  event_name: AnalyticsEventName | string;
  anonymous_id: string;
  session_id: string;
  career_run_id: string | null;
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

export interface RecentMilestoneLog {
  id: string;
  createdAt: string;
  formattedDateKst: string;
  eventName: AnalyticsEventName | string;
  eventLabel: string;
  deviceType: AnalyticsDeviceType | null;
  deviceLabel: string;
  gameVersion: string | null;
  summary: string;
}

export interface AdminAnalyticsReport {
  range: AnalyticsDateRange;
  version: string;
  availableVersions: string[];
  generatedAt: string;
  tableNotReady: boolean;
  scanMeta: {
    scannedRows: number;
    totalMatchingRows: number;
    scanLimit: number;
    truncated: boolean;
  };
  kpi: AnalyticsKpiSummary;
  dailyTrend: DailyTrendPoint[];
  distributions: {
    positions: DistributionItem[];
    leagueReach: DistributionItem[];
    leagueReachDenominator: number;
    maxSeasonReached: DistributionItem[];
    resetSeasons: DistributionItem[];
    devices: DistributionItem[];
    versions: DistributionItem[];
  };
  recentLogs: RecentMilestoneLog[];
}

export function isValidAnalyticsDateRange(
  value: string
): value is AnalyticsDateRange {
  return value === '7d' || value === '30d' || value === 'all';
}

export function isValidAnalyticsVersionFilter(value: string): boolean {
  if (value === 'all') return true;
  return SAFE_VERSION_FILTER_PATTERN.test(value);
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
 * - 30d: 오늘 포함 최근 30일 (KST 00:00:00 시작)
 * - all: null (기간 제한 없음)
 */
export function getAnalyticsRangeStartIso(
  range: AnalyticsDateRange,
  nowMs: number = Date.now()
): string | null {
  if (range === 'all') return null;
  const days = range === '7d' ? 7 : 30;
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
    default:
      return '플레이 이벤트 기록';
  }
}

function buildDailyDateKeys(
  range: AnalyticsDateRange,
  rows: AnalyticsEventRow[],
  nowMs: number
): string[] {
  const todayKstKey = toKstDateKey(nowMs);
  const [y, m, d] = todayKstKey.split('-').map(Number);
  const todayUtcMs = Date.UTC(y, m - 1, d);

  if (range === '7d' || range === '30d') {
    const days = range === '7d' ? 7 : 30;
    const keys: string[] = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const dt = new Date(todayUtcMs - i * DAY_MS);
      const yy = dt.getUTCFullYear();
      const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(dt.getUTCDate()).padStart(2, '0');
      keys.push(`${yy}-${mm}-${dd}`);
    }
    return keys;
  }

  // 'all' 기간: 실제 수집된 날짜 중 최신 30개 날짜 구간을 연속/정렬 표시
  if (rows.length === 0) return [];

  const uniqueDates = new Set<string>();
  for (const row of rows) {
    const key = toKstDateKey(row.created_at);
    if (key !== '0000-00-00') uniqueDates.add(key);
  }
  const sorted = Array.from(uniqueDates).sort();
  if (sorted.length === 0) return [];

  const firstKey = sorted[0];
  const lastKey = sorted[sorted.length - 1];
  const [fy, fm, fd] = firstKey.split('-').map(Number);
  const [ly, lm, ld] = lastKey.split('-').map(Number);
  const startUtc = Date.UTC(fy, fm - 1, fd);
  const endUtc = Date.UTC(ly, lm - 1, ld);
  const spanDays = Math.floor((endUtc - startUtc) / DAY_MS) + 1;

  if (spanDays <= 30) {
    const keys: string[] = [];
    for (let i = 0; i < spanDays; i += 1) {
      const dt = new Date(startUtc + i * DAY_MS);
      const yy = dt.getUTCFullYear();
      const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(dt.getUTCDate()).padStart(2, '0');
      keys.push(`${yy}-${mm}-${dd}`);
    }
    return keys;
  }

  // 30일을 초과하는 장기 데이터는 최근 30일(마지막 이벤트 날짜 기준) 연속 막대로 표시
  const keys: string[] = [];
  for (let i = 29; i >= 0; i -= 1) {
    const dt = new Date(endUtc - i * DAY_MS);
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    keys.push(`${yy}-${mm}-${dd}`);
  }
  return keys;
}

export interface AggregateAnalyticsOptions {
  range: AnalyticsDateRange;
  version: string;
  availableVersions?: string[];
  nowMs?: number;
  totalMatchingRows?: number;
  scanLimit?: number;
  tableNotReady?: boolean;
}

/**
 * Supabase에서 조회한 원시 analytics_events 행을 관리자 대시보드용 집계 리포트로 변환합니다.
 * - 행 수가 0건이거나 일부 이벤트가 비어 있어도 절대 NaN이나 예외를 발생시키지 않습니다.
 */
export function aggregateAnalyticsEvents(
  rows: AnalyticsEventRow[],
  options: AggregateAnalyticsOptions
): AdminAnalyticsReport {
  const nowMs = options.nowMs ?? Date.now();
  const safeRows = Array.isArray(rows) ? rows : [];
  const scanLimit = options.scanLimit ?? 5000;
  const totalMatchingRows =
    typeof options.totalMatchingRows === 'number' &&
    Number.isFinite(options.totalMatchingRows)
      ? Math.max(options.totalMatchingRows, safeRows.length)
      : safeRows.length;

  const uniquePlayersSet = new Set<string>();
  let totalSessions = 0;
  let careersCreated = 0;
  let seasonsCompleted = 0;
  let careersEnded = 0;
  let careersReset = 0;

  // 일별 집계 버킷
  const dailyPlayersMap = new Map<string, Set<string>>();
  const dailyCareersMap = new Map<string, number>();
  const dailySeasonsMap = new Map<string, number>();

  // 포지션 선택 집계
  const positionCounts = new Map<Position, number>();
  for (const pos of POSITION_ORDER) positionCounts.set(pos, 0);

  // 리그 도달 퍼널 (커리어 실행 ID 단위)
  const careerRunLeagues = new Map<string, Set<LeagueId>>();
  // 커리어별 최대 완료 시즌 (season_completed 기준)
  const careerRunMaxSeason = new Map<string, number>();
  // 중도 리셋 발생 시즌
  const resetSeasonValues: number[] = [];

  // 기기 및 버전 분포
  const deviceCounts: Record<AnalyticsDeviceType | 'unknown', number> = {
    mobile: 0,
    tablet: 0,
    desktop: 0,
    unknown: 0,
  };
  const versionCounts = new Map<string, number>();
  const discoveredVersions = new Set<string>(options.availableVersions ?? []);

  const leagueSet = new Set<string>(LEAGUE_FUNNEL_ORDER);
  const positionSet = new Set<string>(POSITION_ORDER);

  const recordLeagueReach = (runKey: string, leagueRaw: string | null) => {
    if (!leagueRaw || !leagueSet.has(leagueRaw)) return;
    let reached = careerRunLeagues.get(runKey);
    if (!reached) {
      reached = new Set<LeagueId>();
      careerRunLeagues.set(runKey, reached);
    }
    reached.add(leagueRaw as LeagueId);
  };

  for (const row of safeRows) {
    if (row.anonymous_id) {
      uniquePlayersSet.add(row.anonymous_id);
    }

    const dateKey = toKstDateKey(row.created_at);
    if (dateKey !== '0000-00-00') {
      let dayPlayers = dailyPlayersMap.get(dateKey);
      if (!dayPlayers) {
        dayPlayers = new Set<string>();
        dailyPlayersMap.set(dateKey, dayPlayers);
      }
      if (row.anonymous_id) dayPlayers.add(row.anonymous_id);
    }

    // 기기 집계
    if (
      row.device_type === 'mobile' ||
      row.device_type === 'tablet' ||
      row.device_type === 'desktop'
    ) {
      deviceCounts[row.device_type] += 1;
    } else {
      deviceCounts.unknown += 1;
    }

    // 게임 버전 집계
    const ver = asString(row.game_version) ?? '미상';
    versionCounts.set(ver, (versionCounts.get(ver) ?? 0) + 1);
    if (ver !== '미상') discoveredVersions.add(ver);

    const payload = asRecord(row.payload);
    const runKey =
      asString(row.career_run_id) ??
      `${row.anonymous_id || 'anon'}:${row.session_id || 'sess'}`;

    switch (row.event_name) {
      case 'session_start': {
        totalSessions += 1;
        break;
      }
      case 'career_created': {
        careersCreated += 1;
        if (dateKey !== '0000-00-00') {
          dailyCareersMap.set(dateKey, (dailyCareersMap.get(dateKey) ?? 0) + 1);
        }
        const pos = asString(payload.position);
        if (pos && positionSet.has(pos)) {
          positionCounts.set(pos as Position, (positionCounts.get(pos as Position) ?? 0) + 1);
        }
        recordLeagueReach(runKey, asString(payload.startingLeague));
        break;
      }
      case 'season_completed': {
        seasonsCompleted += 1;
        if (dateKey !== '0000-00-00') {
          dailySeasonsMap.set(dateKey, (dailySeasonsMap.get(dateKey) ?? 0) + 1);
        }
        recordLeagueReach(runKey, asString(payload.league));
        const seasonNum = asNumber(payload.seasonNumber);
        if (seasonNum !== null && seasonNum >= 1) {
          const prevMax = careerRunMaxSeason.get(runKey) ?? 0;
          if (seasonNum > prevMax) {
            careerRunMaxSeason.set(runKey, Math.floor(seasonNum));
          }
        }
        break;
      }
      case 'league_changed': {
        recordLeagueReach(runKey, asString(payload.fromLeague));
        recordLeagueReach(runKey, asString(payload.toLeague));
        break;
      }
      case 'career_ended': {
        careersEnded += 1;
        recordLeagueReach(runKey, asString(payload.finalLeague));
        const totalSeasons = asNumber(payload.totalSeasons);
        if (totalSeasons !== null && totalSeasons >= 1) {
          const prevMax = careerRunMaxSeason.get(runKey) ?? 0;
          if (totalSeasons > prevMax) {
            careerRunMaxSeason.set(runKey, Math.floor(totalSeasons));
          }
        }
        break;
      }
      case 'career_reset': {
        careersReset += 1;
        recordLeagueReach(runKey, asString(payload.abandonedLeague));
        const abandonedSeason = asNumber(payload.abandonedSeason);
        if (abandonedSeason !== null && abandonedSeason >= 0) {
          resetSeasonValues.push(Math.floor(abandonedSeason));
        }
        break;
      }
      default:
        break;
    }
  }

  // 일별 추이 배열 생성
  const dateKeys = buildDailyDateKeys(options.range, safeRows, nowMs);
  const dailyTrend: DailyTrendPoint[] = dateKeys.map((dateKey) => ({
    dateKey,
    label: formatShortDateLabel(dateKey),
    uniquePlayers: dailyPlayersMap.get(dateKey)?.size ?? 0,
    careersCreated: dailyCareersMap.get(dateKey) ?? 0,
    seasonsCompleted: dailySeasonsMap.get(dateKey) ?? 0,
  }));

  // 1. 포지션별 선택 비율
  const totalPositions = Array.from(positionCounts.values()).reduce(
    (sum, n) => sum + n,
    0
  );
  const positions: DistributionItem[] = POSITION_ORDER.map((pos) => {
    const count = positionCounts.get(pos) ?? 0;
    return {
      key: pos,
      label: POSITION_LABELS[pos],
      count,
      percent: safePercent(count, totalPositions),
    };
  });

  // 2. 리그별 도달 퍼널 (추적된 고유 커리어 대비 각 리그 도달 비율)
  const leagueReachDenominator = careerRunLeagues.size;
  const leagueReachCounts = new Map<LeagueId, number>();
  for (const lg of LEAGUE_FUNNEL_ORDER) leagueReachCounts.set(lg, 0);
  for (const reachedSet of careerRunLeagues.values()) {
    for (const lg of reachedSet) {
      leagueReachCounts.set(lg, (leagueReachCounts.get(lg) ?? 0) + 1);
    }
  }
  const leagueReach: DistributionItem[] = LEAGUE_FUNNEL_ORDER.map((lg) => {
    const count = leagueReachCounts.get(lg) ?? 0;
    return {
      key: lg,
      label: LEAGUE_SHORT_LABELS[lg],
      count,
      percent: safePercent(count, leagueReachDenominator),
    };
  });

  // 3. 시즌 완료 최대 시즌 분포
  const maxSeasonValues = Array.from(careerRunMaxSeason.values());
  const maxSeasonReached: DistributionItem[] = MAX_SEASON_BUCKETS.map((bucket) => {
    const count = maxSeasonValues.filter((v) => bucket.match(v)).length;
    return {
      key: bucket.key,
      label: bucket.label,
      count,
      percent: safePercent(count, maxSeasonValues.length),
    };
  });

  // 4. 중도 리셋 발생 시즌 분포
  const resetSeasons: DistributionItem[] = RESET_SEASON_BUCKETS.map((bucket) => {
    const count = resetSeasonValues.filter((v) => bucket.match(v)).length;
    return {
      key: bucket.key,
      label: bucket.label,
      count,
      percent: safePercent(count, resetSeasonValues.length),
    };
  });

  // 5. 기기별 접속 비율
  const totalEvents = safeRows.length;
  const deviceKeys: Array<AnalyticsDeviceType | 'unknown'> =
    deviceCounts.unknown > 0
      ? ['mobile', 'desktop', 'tablet', 'unknown']
      : ['mobile', 'desktop', 'tablet'];
  const devices: DistributionItem[] = deviceKeys.map((key) => ({
    key,
    label: ANALYTICS_DEVICE_LABELS[key],
    count: deviceCounts[key],
    percent: safePercent(deviceCounts[key], totalEvents),
  }));

  // 6. 게임 버전별 분포 (건수 내림차순)
  const versions: DistributionItem[] = Array.from(versionCounts.entries())
    .sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))
    .map(([ver, count]) => ({
      key: ver,
      label: ver === '미상' ? '버전 미상' : `v${ver}`,
      count,
      percent: safePercent(count, totalEvents),
    }));

  // 7. 최근 주요 마일스톤 로그 (최신 25건, created_at 내림차순 보장)
  const sortedRecent = [...safeRows]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, RECENT_LOGS_LIMIT);

  const recentLogs: RecentMilestoneLog[] = sortedRecent.map((row) => {
    const knownEvent = row.event_name as AnalyticsEventName;
    const eventLabel =
      knownEvent in ANALYTICS_EVENT_LABELS
        ? ANALYTICS_EVENT_LABELS[knownEvent]
        : row.event_name;
    const deviceType =
      row.device_type === 'mobile' ||
      row.device_type === 'tablet' ||
      row.device_type === 'desktop'
        ? row.device_type
        : null;
    return {
      id: row.id,
      createdAt: row.created_at,
      formattedDateKst: formatAnalyticsDateKst(row.created_at),
      eventName: row.event_name,
      eventLabel,
      deviceType,
      deviceLabel: ANALYTICS_DEVICE_LABELS[deviceType ?? 'unknown'],
      gameVersion: asString(row.game_version),
      summary: summarizeMilestonePayload(row.event_name, row.payload),
    };
  });

  const availableVersions = Array.from(discoveredVersions).sort((a, b) =>
    b.localeCompare(a, undefined, { numeric: true })
  );

  return {
    range: options.range,
    version: options.version,
    availableVersions,
    generatedAt: new Date(nowMs).toISOString(),
    tableNotReady: Boolean(options.tableNotReady),
    scanMeta: {
      scannedRows: safeRows.length,
      totalMatchingRows,
      scanLimit,
      truncated: totalMatchingRows > safeRows.length,
    },
    kpi: {
      uniquePlayers: uniquePlayersSet.size,
      totalSessions,
      careersCreated,
      seasonsCompleted,
      careersEnded,
      careersReset,
      totalEvents,
    },
    dailyTrend,
    distributions: {
      positions,
      leagueReach,
      leagueReachDenominator,
      maxSeasonReached,
      resetSeasons,
      devices,
      versions,
    },
    recentLogs,
  };
}
