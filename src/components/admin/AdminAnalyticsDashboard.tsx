'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Check,
  ClipboardCopy,
  Database,
  Download,
  Loader2,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { GAME_NAME, GAME_VERSION } from '../../config/appMeta';
import {
  ANALYTICS_DATE_RANGES,
  DEFAULT_VERSION_FILTER,
  VERSION_FILTER_ALL,
  VERSION_FILTER_RELEASE,
  isPreviewVersion,
  isValidAnalyticsDateRange,
  isValidAnalyticsLeagueFilter,
  isValidAnalyticsVersionFilter,
  ANALYTICS_RANGE_LABELS,
  AdminAnalyticsReport,
  AnalyticsDateRange,
  DailyTrendPoint,
  LEAGUE_FUNNEL_ORDER,
  LEAGUE_SHORT_LABELS,
  buildShareableAnalyticsSummary,
  formatAnalyticsDateKst,
} from '../../lib/adminAnalytics';
import { AdminConsoleNav } from './AdminConsoleNav';
import {
  CARD_CLASS,
  DistributionBarList,
  InsightsCard,
  LeagueAwardsTable,
  PositionBalanceMatrix,
  RecentLogsList,
  ResetBottleneck,
  SectionHeader,
  SkeletonRows,
  formatPercentText,
} from './AdminAnalyticsSections';
import {
  CreationFunnelCard,
  StorageStatusCard,
  SurveyResultsCard,
  VersionCompareTable,
} from './AdminAnalyticsExtraSections';

const SETUP_SQL_PATH = 'supabase/migrations/20261125_admin_analytics_report.sql';

/** 'YYYY-MM-DD' 또는 시간별 'YYYY-MM-DDTHH'를 읽기 쉬운 글로 바꿉니다. */
function formatTrendKey(key: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})$/.exec(key);
  return m ? `${Number(m[2])}/${Number(m[3])} ${m[4]}시` : key;
}

function DailyTrendChart({ points }: { points: DailyTrendPoint[] }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const maxValue = useMemo(() => {
    let max = 0;
    for (const p of points) {
      if (p.uniquePlayers > max) max = p.uniquePlayers;
      if (p.careersCreated > max) max = p.careersCreated;
    }
    return max;
  }, [points]);

  const activePoint =
    selectedIndex !== null && points[selectedIndex]
      ? points[selectedIndex]
      : points[points.length - 1] ?? null;

  if (points.length === 0 || maxValue === 0) {
    return (
      <div className="py-12 text-center space-y-1.5">
        <p className="text-[14px] font-bold text-[var(--t-g700)]">
          선택한 기간에 일별 추이 데이터가 없습니다
        </p>
        <p className="text-[12px] text-[var(--t-g500)]">
          유저 플레이 이벤트가 적재되면 날짜별(KST) 고유 플레이어 수와 커리어 생성 추이가 표시됩니다.
        </p>
      </div>
    );
  }

  const labelStep =
    points.length <= 10 ? 1 : points.length <= 18 ? 2 : points.length <= 45 ? 5 : 15;
  const gapClass = points.length > 31 ? 'gap-px' : 'gap-1 sm:gap-1.5';
  const midTick = Math.ceil(maxValue / 2);

  return (
    <div className="space-y-4">
      {/* 범례 및 선택 일자 수치 요약 */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[12px]">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--t-g700)]">
            <span className="w-2.5 h-2.5 rounded-xs bg-[var(--t-accent)]" />
            고유 플레이어
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--t-g700)]">
            <span className="w-2.5 h-2.5 rounded-xs bg-[var(--t-ok)]" />
            커리어 생성
          </span>
        </div>

        {activePoint && (
          <div className="flex flex-wrap items-center gap-2 text-[var(--t-g600)] tabular-nums">
            <span className="font-bold text-[var(--t-g900)]">
              {formatTrendKey(activePoint.dateKey)} (KST)
            </span>
            <span aria-hidden="true">·</span>
            <span>플레이어 {activePoint.uniquePlayers.toLocaleString()}명</span>
            <span aria-hidden="true">·</span>
            <span>커리어 {activePoint.careersCreated.toLocaleString()}건</span>
            <span aria-hidden="true">·</span>
            <span>시즌 완료 {activePoint.seasonsCompleted.toLocaleString()}건</span>
          </div>
        )}
      </div>

      {/* 반응형 순수 CSS 막대 차트 */}
      <div className="overflow-x-auto pb-1">
        <div
          className="flex gap-2.5"
          style={{
            minWidth: points.length > 14 ? `${points.length * 26}px` : '100%',
          }}
        >
          {/* Y축 눈금 */}
          <div className="w-8 shrink-0 flex flex-col justify-between text-right text-[11px] font-mono text-[var(--t-g400)] tabular-nums pb-6 select-none">
            <span>{maxValue}</span>
            <span>{midTick}</span>
            <span>0</span>
          </div>

          {/* 막대 영역 */}
          <div className="flex-1 min-w-0">
            <div className={`relative h-[180px] border-b border-[var(--t-g200)] flex items-end ${gapClass}`}>
              {/* 가로 가이드선 */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-[var(--t-g100)]"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-[var(--t-g100)]"
              />

              {points.map((point, idx) => {
                const playerHeightPct =
                  maxValue > 0 ? (point.uniquePlayers / maxValue) * 100 : 0;
                const careerHeightPct =
                  maxValue > 0 ? (point.careersCreated / maxValue) * 100 : 0;
                const isSelected =
                  selectedIndex === idx ||
                  (selectedIndex === null && idx === points.length - 1);

                return (
                  <button
                    key={point.dateKey}
                    type="button"
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onFocus={() => setSelectedIndex(idx)}
                    onClick={() => setSelectedIndex(idx)}
                    aria-label={`${formatTrendKey(point.dateKey)} 고유 플레이어 ${point.uniquePlayers}명, 커리어 생성 ${point.careersCreated}건`}
                    className={`group relative flex-1 h-full flex items-end justify-center gap-[2px] px-0.5 rounded-t-md cursor-pointer transition-colors ${
                      isSelected ? 'bg-[var(--t-g100)]/60' : 'hover:bg-[var(--t-g50)]'
                    }`}
                  >
                    <span
                      className="w-full max-w-[14px] rounded-t-xs bg-[var(--t-accent)] transition-[height] duration-200"
                      style={{
                        height:
                          point.uniquePlayers > 0
                            ? `${Math.max(playerHeightPct, 4)}%`
                            : '0%',
                      }}
                    />
                    <span
                      className="w-full max-w-[14px] rounded-t-xs bg-[var(--t-ok)] transition-[height] duration-200"
                      style={{
                        height:
                          point.careersCreated > 0
                            ? `${Math.max(careerHeightPct, 4)}%`
                            : '0%',
                      }}
                    />
                  </button>
                );
              })}
            </div>

            {/* X축 날짜 레이블 */}
            <div className={`mt-2 flex items-center ${gapClass}`}>
              {points.map((point, idx) => {
                const showLabel =
                  idx === 0 ||
                  idx === points.length - 1 ||
                  idx % labelStep === 0;
                return (
                  <div
                    key={point.dateKey}
                    className="flex-1 min-w-0 text-center text-[10px] sm:text-[11px] font-mono text-[var(--t-g500)] tabular-nums whitespace-nowrap overflow-visible"
                  >
                    {showLabel ? point.label : ''}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


type CopyState = 'idle' | 'copied' | 'failed';

export interface AdminAnalyticsInitialFilters {
  range?: string;
  version?: string;
  league?: string;
}

/** 주소(?range=&version=&league=)의 필터 값을 검증해 초기값으로 씁니다. */
export function resolveInitialAnalyticsFilters(raw: AdminAnalyticsInitialFilters) {
  return {
    range: raw.range && isValidAnalyticsDateRange(raw.range) ? raw.range : ('7d' as AnalyticsDateRange),
    version: raw.version && isValidAnalyticsVersionFilter(raw.version) ? raw.version : DEFAULT_VERSION_FILTER,
    league: raw.league && isValidAnalyticsLeagueFilter(raw.league) ? raw.league : 'all',
  };
}

export function AdminAnalyticsDashboard({
  initialFilters = {},
}: {
  initialFilters?: AdminAnalyticsInitialFilters;
}) {
  const router = useRouter();
  const [initial] = useState(() => resolveInitialAnalyticsFilters(initialFilters));

  const [range, setRange] = useState<AnalyticsDateRange>(initial.range);
  const [versionFilter, setVersionFilter] = useState<string>(initial.version);
  const [leagueFilter, setLeagueFilter] = useState<string>(initial.league);
  const [funnelTab, setFunnelTab] = useState<'reach' | 'maxSeason'>('reach');
  const [reloadTick, setReloadTick] = useState(0);

  const [report, setReport] = useState<AdminAnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>('idle');

  const beginLoad = () => {
    setLoading(true);
    setErrorMessage(null);
  };

  const triggerReload = useCallback(() => {
    setLoading(true);
    setErrorMessage(null);
    setReloadTick((prev) => prev + 1);
  }, []);

  // 필터를 주소에 남겨 새로고침하거나 링크를 보내도 같은 화면이 열리게 합니다.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const setOrDelete = (key: string, value: string, fallback: string) => {
      if (value === fallback) params.delete(key);
      else params.set(key, value);
    };
    setOrDelete('range', range, '7d');
    setOrDelete('version', versionFilter, DEFAULT_VERSION_FILTER);
    setOrDelete('league', leagueFilter, 'all');
    const qs = params.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, '', next);
    }
  }, [range, versionFilter, leagueFilter]);

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({
      range,
      version: versionFilter,
      league: leagueFilter,
    });

    fetch(`/api/admin/analytics?${qs.toString()}`, {
      method: 'GET',
      cache: 'no-store',
    })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          router.refresh();
          return;
        }
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          report?: AdminAnalyticsReport;
        };
        if (cancelled) return;
        if (!res.ok || !data?.ok || !data.report) {
          setErrorMessage(
            data?.error ||
              '플레이 통계 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
          );
          return;
        }
        setReport(data.report);
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMessage('네트워크 오류로 통계 데이터를 불러오지 못했습니다.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [range, versionFilter, leagueFilter, reloadTick, router]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' });
    } finally {
      router.refresh();
      setLoggingOut(false);
    }
  };

  const shareableJson = useMemo(
    () => (report ? JSON.stringify(buildShareableAnalyticsSummary(report), null, 2) : ''),
    [report]
  );

  const handleCopyReport = async () => {
    if (!shareableJson) return;
    try {
      await navigator.clipboard.writeText(shareableJson);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    window.setTimeout(() => setCopyState('idle'), 2000);
  };

  const handleDownloadReport = () => {
    if (!shareableJson || !report) return;
    const blob = new Blob([shareableJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const stamp = formatAnalyticsDateKst(report.generatedAt).replace(/[^0-9]/g, '').slice(0, 12);
    anchor.href = url;
    anchor.download = `road-to-mvp-balance-${report.range}-${report.league}-${stamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const kpi = report?.kpi;
  const showSkeleton = loading && !report;
  const aggregateMissing = Boolean(report?.setupRequired || report?.tableNotReady);
  const leagueLabel =
    leagueFilter === 'all'
      ? null
      : LEAGUE_SHORT_LABELS[leagueFilter as keyof typeof LEAGUE_SHORT_LABELS] ?? leagueFilter;
  const leagueScopeNote = leagueLabel ? `리그 필터: ${leagueLabel}` : '전체 리그';
  const versionScopeNote =
    versionFilter === VERSION_FILTER_RELEASE
      ? '정식 버전 전체'
      : versionFilter === VERSION_FILTER_ALL
        ? '미리보기 포함 전체'
        : `v${versionFilter}`;
  // 리그 필터를 걸었을 때, 필터가 적용되지 않는 섹션에 "전체 리그 기준"을 붙입니다.
  const allLeagues = (aside?: string) =>
    leagueLabel ? [`전체 리그 기준`, aside].filter(Boolean).join(' · ') : aside;
  // 원본은 최근 14일만 남기므로, 기간이 그보다 길면 원본에서만 계산하는 섹션에 범위를 알려 줍니다.
  const prunedBefore = report?.storage.rawLimited ? report.storage.prunedBefore : null;
  const rawOnly = (description: string) =>
    prunedBefore
      ? `${description} · 원본이 남아 있는 ${formatAnalyticsDateKst(prunedBefore)} 이후만 집계`
      : description;

  const kpiCards = [
    { key: 'uniquePlayers', label: '고유 플레이어', value: kpi?.uniquePlayers, unit: '명', subtext: '익명 ID 중복 제거', tone: 'text-[var(--t-g900)]' },
    { key: 'totalSessions', label: '총 세션 수', value: kpi?.totalSessions, unit: '회', subtext: 'session_start 기준', tone: 'text-[var(--t-accent)]' },
    { key: 'careersCreated', label: '생성된 커리어', value: kpi?.careersCreated, unit: '건', subtext: kpi && kpi.careersReset > 0 ? `중도 리셋 ${kpi.careersReset.toLocaleString()}건` : 'career_created 기준', tone: 'text-[var(--t-ok)]' },
    { key: 'seasonsCompleted', label: '완료된 총 시즌', value: kpi?.seasonsCompleted, unit: '시즌', subtext: 'season_completed 기준', tone: 'text-[var(--t-gold)]' },
    { key: 'careersEnded', label: '은퇴/엔딩 도달', value: kpi?.careersEnded, unit: '건', subtext: 'career_ended 기준', tone: 'text-[var(--t-down)]' },
    { key: 'championships', label: '시즌 우승', value: kpi?.championships, unit: '회', subtext: '전체 리그 합계', tone: 'text-[var(--t-gold)]' },
    { key: 'mvps', label: '정규시즌 MVP', value: kpi?.mvps, unit: '회', subtext: '전체 리그 합계', tone: 'text-[var(--t-accent)]' },
    { key: 'fmvps', label: '파이널 MVP', value: kpi?.fmvps, unit: '회', subtext: '구버전 wonFinalsMvp 포함', tone: 'text-[var(--t-up)]' },
  ];

  const availableVersions = report?.availableVersions ?? [];
  // availableVersions는 최신순으로 정렬되어 옵니다.
  const latestReleaseVersion = availableVersions.find((v) => !isPreviewVersion(v)) ?? null;
  const selectClass =
    'min-h-[40px] px-3 rounded-xl bg-[var(--t-g100)] text-[13px] font-semibold text-[var(--t-g900)] focus:outline-none focus:ring-2 focus:ring-[var(--t-accent)] cursor-pointer disabled:opacity-60';
  const toolButtonClass =
    'min-h-[40px] px-3 rounded-xl bg-[var(--t-card)] border border-[var(--t-g200)] text-[13px] font-semibold text-[var(--t-g700)] hover:bg-[var(--t-g100)] inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer t-tap disabled:opacity-50';

  return (
    <div className="min-h-screen bg-[var(--t-bg)] text-[var(--t-g900)] overflow-x-hidden">
      {/* 상단 관리자 헤더 (피드백 관리와 동일한 내비게이션 구조) */}
      <header className="sticky top-0 z-30 bg-[var(--t-bg)]/92 backdrop-blur-md border-b border-[var(--t-g200)]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-baseline gap-2 min-w-0">
              <h1 className="text-[17px] sm:text-[18px] font-bold tracking-[-0.03em] text-[var(--t-g900)] whitespace-nowrap truncate">
                {GAME_NAME} 관리자
              </h1>
              <span className="hidden md:inline text-[12px] font-medium text-[var(--t-g500)] whitespace-nowrap tabular-nums">
                v{GAME_VERSION}
              </span>
            </div>
            <div className="hidden sm:block">
              <AdminConsoleNav active="analytics" />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              data-testid="analytics-refresh-btn"
              disabled={loading}
              onClick={triggerReload}
              className={toolButtonClass}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">새로고침</span>
            </button>
            <button
              type="button"
              data-testid="analytics-logout-btn"
              disabled={loggingOut}
              onClick={() => void handleLogout()}
              className={`${toolButtonClass} hover:text-[var(--t-up)] hover:border-[var(--t-up)]/40`}
            >
              {loggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              <span>로그아웃</span>
            </button>
          </div>

          <div className="w-full sm:hidden pt-1">
            <AdminConsoleNav active="analytics" />
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-5 sm:py-6 space-y-5">
        {/* 필터 · 리포트 내보내기 */}
        <section
          aria-label="통계 필터"
          className="bg-[var(--t-card)] border border-[var(--t-g200)] rounded-[20px] p-4 space-y-3"
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <div
                role="group"
                aria-label="조회 기간"
                className="inline-flex flex-wrap items-center p-1 rounded-xl bg-[var(--t-g100)]"
              >
                {ANALYTICS_DATE_RANGES.map((option) => {
                  const active = range === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      data-testid={`analytics-range-${option}`}
                      onClick={() => {
                        if (option === range) return;
                        beginLoad();
                        setRange(option);
                      }}
                      className={`min-h-[34px] px-2.5 sm:px-3 rounded-lg text-[13px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                        active
                          ? 'bg-[var(--t-card)] text-[var(--t-g900)] shadow-xs'
                          : 'text-[var(--t-g600)] hover:text-[var(--t-g900)]'
                      }`}
                    >
                      {ANALYTICS_RANGE_LABELS[option]}
                    </button>
                  );
                })}
              </div>

              <label className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-[var(--t-g500)] whitespace-nowrap">버전</span>
                <select
                  data-testid="analytics-version-select"
                  value={versionFilter}
                  disabled={loading}
                  onChange={(e) => {
                    beginLoad();
                    setVersionFilter(e.target.value);
                  }}
                  className={selectClass}
                >
                  <option value={VERSION_FILTER_RELEASE}>정식 버전 전체</option>
                  <option value={VERSION_FILTER_ALL}>미리보기 포함 전체</option>
                  {availableVersions.map((ver) => (
                    <option key={ver} value={ver}>
                      v{ver}
                      {isPreviewVersion(ver) ? ' (미리보기)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              {latestReleaseVersion && versionFilter !== latestReleaseVersion && (
                <button
                  type="button"
                  data-testid="analytics-latest-version"
                  disabled={loading}
                  onClick={() => {
                    beginLoad();
                    setVersionFilter(latestReleaseVersion);
                  }}
                  className="min-h-[34px] px-2.5 rounded-lg text-[12px] font-semibold text-[var(--t-accent-ink)] bg-[var(--t-accent-soft)] whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  최신 v{latestReleaseVersion}만
                </button>
              )}

              <label className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-[var(--t-g500)] whitespace-nowrap">리그</span>
                <select
                  data-testid="analytics-league-select"
                  value={leagueFilter}
                  disabled={loading}
                  onChange={(e) => {
                    beginLoad();
                    setLeagueFilter(e.target.value);
                  }}
                  className={selectClass}
                >
                  <option value="all">전체 리그</option>
                  {LEAGUE_FUNNEL_ORDER.map((lg) => (
                    <option key={lg} value={lg}>
                      {LEAGUE_SHORT_LABELS[lg]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="analytics-copy-report"
                disabled={!report || aggregateMissing}
                onClick={() => void handleCopyReport()}
                className={toolButtonClass}
              >
                {copyState === 'copied' ? (
                  <Check className="w-4 h-4 text-[var(--t-ok)]" />
                ) : (
                  <ClipboardCopy className="w-4 h-4" />
                )}
                {copyState === 'copied'
                  ? '복사됨'
                  : copyState === 'failed'
                    ? '복사 실패'
                    : '밸런스 리포트 복사'}
              </button>
              <button
                type="button"
                data-testid="analytics-download-report"
                disabled={!report || aggregateMissing}
                onClick={handleDownloadReport}
                className={toolButtonClass}
              >
                <Download className="w-4 h-4" />
                JSON 다운로드
              </button>
            </div>
          </div>

          <p className="text-[12px] text-[var(--t-g500)] tabular-nums">
            {report ? (
              <>
                전체 이벤트 {report.kpi.totalEvents.toLocaleString()}건을 서버에서 집계했습니다 (행 수 상한 없음)
                <span aria-hidden="true"> · </span>
                기준 {formatAnalyticsDateKst(report.generatedAt)} KST
                {leagueLabel && (
                  <>
                    <span aria-hidden="true"> · </span>
                    리그 필터는 포지션·리셋·역할·플레이오프·수상 섹션과 최근 로그에 적용되고, 나머지는 &quot;전체 리그 기준&quot;으로 표시됩니다
                  </>
                )}
              </>
            ) : (
              '통계 집계 준비 중...'
            )}
          </p>
        </section>

        {errorMessage && (
          <div
            role="alert"
            data-testid="analytics-error-banner"
            className="p-4 rounded-[20px] bg-[var(--t-up-soft)] border border-[var(--t-up)]/20 text-[var(--t-up)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p className="text-[13px] font-semibold leading-snug">{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={triggerReload}
              className="text-[12px] font-bold underline whitespace-nowrap self-start sm:self-center cursor-pointer"
            >
              다시 불러오기
            </button>
          </div>
        )}

        {report?.tableNotReady && (
          <div
            role="status"
            data-testid="analytics-table-not-ready"
            className="p-4 rounded-[20px] bg-[var(--t-gold-soft)] border border-[var(--t-gold)]/20 flex items-start gap-3"
          >
            <Database className="w-4 h-4 mt-0.5 text-[var(--t-gold)] shrink-0" />
            <div className="space-y-1 text-[13px]">
              <p className="font-bold text-[var(--t-g900)]">
                Supabase에 analytics_events 테이블이 아직 생성되지 않았습니다
              </p>
              <p className="text-[12px] text-[var(--t-g700)] leading-relaxed">
                <code className="font-mono font-semibold">supabase/migrations/20261124_create_analytics_events.sql</code>
                과 <code className="font-mono font-semibold">{SETUP_SQL_PATH}</code>를 Supabase SQL Editor에서 차례로 실행해 주세요.
              </p>
            </div>
          </div>
        )}

        {report?.setupRequired && !report.tableNotReady && (
          <div
            role="status"
            data-testid="analytics-setup-required"
            className="p-4 rounded-[20px] bg-[var(--t-gold-soft)] border border-[var(--t-gold)]/20 flex items-start gap-3"
          >
            <Database className="w-4 h-4 mt-0.5 text-[var(--t-gold)] shrink-0" />
            <div className="space-y-1 text-[13px]">
              <p className="font-bold text-[var(--t-g900)]">
                서버 집계 함수가 아직 설치되지 않았습니다
              </p>
              <p className="text-[12px] text-[var(--t-g700)] leading-relaxed">
                저장소의 <code className="font-mono font-semibold">{SETUP_SQL_PATH}</code> 내용을 Supabase SQL Editor에서 한 번 실행하면 집계 지표가 표시됩니다. 기존 테이블과 데이터는 변경되지 않습니다. 아래 최근 로그는 지금도 확인할 수 있습니다.
              </p>
            </div>
          </div>
        )}

        {/* 핵심 요약 KPI 카드 */}
        <section
          aria-label="핵심 플레이 지표"
          data-testid="analytics-kpi-grid"
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        >
          {kpiCards.map((card) => (
            <div
              key={card.key}
              data-testid={`kpi-card-${card.key}`}
              className="bg-[var(--t-card)] border border-[var(--t-g200)] rounded-[18px] p-4 space-y-1.5 min-w-0"
            >
              <p className="text-[12px] font-semibold text-[var(--t-g500)] truncate">{card.label}</p>
              {showSkeleton ? (
                <div className="h-8 w-20 rounded-md bg-[var(--t-g100)] animate-pulse" />
              ) : (
                <p className={`text-[22px] sm:text-[26px] font-bold tracking-[-0.03em] tabular-nums leading-tight ${card.tone}`}>
                  {(card.value ?? 0).toLocaleString()}
                  <span className="ml-0.5 text-[13px] font-semibold text-[var(--t-g500)]">{card.unit}</span>
                </p>
              )}
              <p className="text-[11px] text-[var(--t-g500)] truncate">{card.subtext}</p>
            </div>
          ))}
        </section>

        {report && !aggregateMissing && report.extrasAvailable && (
          <StorageStatusCard storage={report.storage} />
        )}

        {report && !aggregateMissing && <InsightsCard insights={report.insights} />}

        {report && !aggregateMissing && !report.extrasAvailable && (
          <section
            data-testid="analytics-extras-setup"
            className="rounded-[20px] border border-[var(--t-gold)] bg-[var(--t-gold-soft)] p-4 text-[13px] text-[var(--t-g800)] leading-relaxed"
          >
            버전별 비교, 난이도 설문, 생성→드래프트 퍼널을 보려면 Supabase SQL 편집기에서
            <code className="mx-1 px-1 rounded bg-[var(--t-card)]">supabase/migrations/20261125_admin_analytics_report.sql</code>
            을 다시 실행해 주세요 (기존 데이터는 바뀌지 않습니다).
          </section>
        )}

        {report && report.extrasAvailable && (
          <>
            {/* 🆚 버전별 비교 */}
            <section aria-label="버전별 비교" data-testid="analytics-version-compare" className={CARD_CLASS}>
              <SectionHeader
                title="🆚 버전별 비교"
                description="기간 필터만 적용 (버전·리그 필터 무시). 커리어 지표는 커리어를 만든 버전, 시즌·은퇴 지표는 그 이벤트가 기록된 버전 기준입니다. 업데이트 전에 연 탭은 예전 버전으로 계속 기록됩니다."
                aside={allLeagues('옆으로 밀어서 보기')}
              />
              <VersionCompareTable rows={report.versionCompare} />
            </section>

            <section aria-label="설문과 생성 퍼널" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div data-testid="analytics-survey" className={CARD_CLASS}>
                <SectionHeader
                  title="🗳️ 난이도 설문 결과"
                  description="은퇴 화면 1인 1회 설문 (1 쉬움 ~ 5 어려움). 버전·기간 필터 적용"
                  aside={allLeagues(versionScopeNote)}
                />
                <SurveyResultsCard survey={report.survey} />
              </div>
              <div data-testid="analytics-creation-funnel" className={CARD_CLASS}>
                <SectionHeader
                  title="🧭 생성 → 드래프트 퍼널"
                  description="1.0.1부터 수집된 생성 화면 진입 기준. 버전·기간 필터 적용"
                  aside={allLeagues(versionScopeNote)}
                />
                <CreationFunnelCard funnel={report.creationFunnel} />
              </div>
            </section>
          </>
        )}

        {/* 🏆 리그별 수상 테이블 */}
        <section aria-label="리그별 MVP FMVP 우승" data-testid="analytics-league-awards" className={CARD_CLASS}>
          <SectionHeader
            title="🏆 리그별 MVP · FMVP · 우승"
            description="season_completed 기준. 비율 아래 숫자는 발생/모수이며, 모수는 해당 필드가 실제로 수집된 시즌만 셉니다 (구버전 FMVP는 wonFinalsMvp 사용)."
            aside={allLeagues('열 제목을 눌러 정렬')}
          />
          {showSkeleton ? (
            <SkeletonRows count={6} />
          ) : (
            <LeagueAwardsTable rows={report?.leagueAwards ?? []} activeLeague={leagueFilter} />
          )}
        </section>

        {/* 🏀 포지션 밸런스 */}
        <section aria-label="포지션별 밸런스" data-testid="analytics-position-balance" className={CARD_CLASS}>
          <SectionHeader
            title="🏀 포지션별 밸런스 매트릭스"
            description="커리어 선택은 career_created 기준, 시즌 지표는 season_completed 기준 (구버전 시즌은 같은 커리어의 생성 포지션으로 보완)."
            aside={leagueScopeNote}
          />
          {showSkeleton ? (
            <SkeletonRows count={5} />
          ) : report ? (
            <PositionBalanceMatrix data={report.positionBalance} />
          ) : null}
        </section>

        {/* 📈 퍼널 · 리셋 */}
        <section aria-label="커리어 퍼널과 이탈" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div data-testid="analytics-funnel" className={CARD_CLASS}>
            <SectionHeader
              title="📈 커리어 성장 퍼널"
              description={rawOnly("고유 커리어(career_run_id) 단위 리그 도달률과 최대 도달 시즌")}
              aside={allLeagues(
                report && report.funnel.leagueReachDenominator > 0
                  ? `모수 ${report.funnel.leagueReachDenominator.toLocaleString()}커리어`
                  : undefined
              )}
            />
            <div className="inline-flex items-center p-1 rounded-xl bg-[var(--t-g100)]">
              {(
                [
                  ['reach', '리그 도달'],
                  ['maxSeason', '최대 도달 시즌'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFunnelTab(key)}
                  className={`min-h-[30px] px-2.5 rounded-lg text-[12px] font-semibold whitespace-nowrap cursor-pointer ${
                    funnelTab === key
                      ? 'bg-[var(--t-card)] text-[var(--t-g900)] shadow-xs'
                      : 'text-[var(--t-g600)] hover:text-[var(--t-g900)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {showSkeleton ? (
              <SkeletonRows count={6} />
            ) : (
              <DistributionBarList
                items={
                  funnelTab === 'reach'
                    ? report?.funnel.leagueReach ?? []
                    : report?.funnel.maxSeasonReached ?? []
                }
                barColorClass={funnelTab === 'reach' ? 'bg-[var(--t-ok)]' : 'bg-[var(--t-gold)]'}
                unitLabel="커리어"
                emptyText="커리어 진행 기록이 아직 없습니다."
              />
            )}
          </div>

          <div data-testid="analytics-resets" className={CARD_CLASS}>
            <SectionHeader
              title="🚪 이탈(리셋) 병목"
              description={rawOnly("career_reset 발생 구간. 초반 벽 포기와 목표 달성 후 재도전을 구분합니다.")}
              aside={
                report
                  ? `${leagueScopeNote} · ${report.resets.total.toLocaleString()}건`
                  : undefined
              }
            />
            {showSkeleton ? (
              <SkeletonRows count={5} />
            ) : report ? (
              <ResetBottleneck resets={report.resets} />
            ) : null}
          </div>
        </section>

        {/* 역할 · 플레이오프 단계 */}
        <section aria-label="시즌 역할과 플레이오프" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div data-testid="analytics-roles" className={CARD_CLASS}>
            <SectionHeader
              title="🪑 벤치 → 주전 역할 분포"
              description={rawOnly("시즌 종료 시점 역할 (1차 고도화 이후 수집분)")}
              aside={report ? `${leagueScopeNote} · 표본 ${report.seasonMeta.roleSample.toLocaleString()}시즌` : undefined}
            />
            {showSkeleton ? (
              <SkeletonRows count={6} />
            ) : (
              <DistributionBarList
                items={report?.seasonMeta.roles ?? []}
                barColorClass="bg-[var(--t-accent)]"
                unitLabel="시즌"
                emptyText="역할 데이터가 아직 없습니다."
              />
            )}
          </div>
          <div data-testid="analytics-playoffs" className={CARD_CLASS}>
            <SectionHeader
              title="🏟️ 플레이오프 최종 단계"
              description={rawOnly("시즌별 최종 성적 (1차 고도화 이후 수집분)")}
              aside={report ? `${leagueScopeNote} · 표본 ${report.seasonMeta.playoffSample.toLocaleString()}시즌` : undefined}
            />
            {showSkeleton ? (
              <SkeletonRows count={6} />
            ) : (
              <DistributionBarList
                items={report?.seasonMeta.playoffResults ?? []}
                barColorClass="bg-[var(--t-ok)]"
                unitLabel="시즌"
                emptyText="플레이오프 데이터가 아직 없습니다."
              />
            )}
          </div>
        </section>

        {/* 🎖️ 수상 · 엔딩 · 육성 메타 */}
        <section aria-label="수상 엔딩 육성 메타" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div data-testid="analytics-awards" className={CARD_CLASS}>
            <SectionHeader
              title="🎖️ 기타 수상 TOP"
              description={rawOnly("awards 배열 기준. 비율은 수상 데이터가 있는 시즌 대비 수상 시즌 비율")}
              aside={
                report
                  ? `${leagueScopeNote} · 모수 ${report.awards.seasonsWithAwardData.toLocaleString()}시즌`
                  : undefined
              }
            />
            {showSkeleton ? (
              <SkeletonRows count={6} />
            ) : (
              <DistributionBarList
                items={report?.awards.items ?? []}
                barColorClass="bg-[var(--t-gold)]"
                unitLabel="회"
                limit={10}
                emptyText="수상 데이터가 아직 없습니다."
              />
            )}
          </div>

          <div data-testid="analytics-endings" className={CARD_CLASS}>
            <SectionHeader
              title="🏁 커리어 엔딩 · 명예의 전당"
              description="career_ended 기준"
              aside={allLeagues(
                report
                  ? `명예의 전당 ${formatPercentText(report.endings.hallOfFame.percent)} (${report.endings.hallOfFame.count}/${report.endings.hallOfFame.n})`
                  : undefined
              )}
            />
            {showSkeleton ? (
              <SkeletonRows count={5} />
            ) : (
              <DistributionBarList
                items={report?.endings.byType ?? []}
                barColorClass="bg-[var(--t-down)]"
                emptyText="엔딩 유형이 기록된 은퇴가 아직 없습니다."
              />
            )}
          </div>

          <div data-testid="analytics-build-meta" className={`${CARD_CLASS} lg:col-span-2`}>
            <SectionHeader
              title="🧬 초기 빌드 · 육성 · 이동 메타"
              aside={allLeagues()}
              description={prunedBefore ? `career_created의 플레이스타일·성장 DNA·훈련 방향 (전체 기간), league_changed의 이동 사유와 드래프트 라운드 (원본이 남아 있는 ${formatAnalyticsDateKst(prunedBefore)} 이후)` : "career_created의 플레이스타일·성장 DNA·훈련 방향, league_changed의 이동 사유와 드래프트 라운드"}
            />
            {showSkeleton ? (
              <SkeletonRows count={4} />
            ) : report ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {(
                  [
                    ['플레이스타일', report.buildMeta.playstyle, 'bg-[var(--t-accent)]'],
                    ['성장 DNA', report.buildMeta.growthDna, 'bg-[var(--t-ok)]'],
                    ['훈련 방향', report.buildMeta.trainingFocus, 'bg-[var(--t-gold)]'],
                    ['리그 이동 사유', report.buildMeta.leagueChangeReasons, 'bg-[var(--t-down)]'],
                    ['드래프트 라운드', report.buildMeta.draftRounds, 'bg-[var(--t-g700)]'],
                  ] as const
                ).map(([title, items, color]) => (
                  <div key={title} className="space-y-3 min-w-0">
                    <h3 className="text-[13px] font-bold text-[var(--t-g800)]">{title}</h3>
                    <DistributionBarList items={items} barColorClass={color} emptyText="수집 전" />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        {/* 일별 추이 · 환경 분포 */}
        <section aria-label="일별 추이" data-testid="analytics-daily-trend" className={CARD_CLASS}>
          <SectionHeader
            title={report?.trendGranularity === 'hour' ? '시간별 플레이 추이' : '일별 플레이 추이'}
            description={
              report?.trendGranularity === 'hour'
                ? '한국 시간(KST) 기준 시간별 고유 플레이어 수 및 신규 커리어 생성 건수'
                : '한국 시간(KST) 기준 날짜별 고유 플레이어 수 및 신규 커리어 생성 건수'
            }
            aside={allLeagues(ANALYTICS_RANGE_LABELS[range])}
          />
          {showSkeleton ? (
            <div className="h-[220px] rounded-xl bg-[var(--t-g50)] animate-pulse" />
          ) : (
            <DailyTrendChart points={report?.dailyTrend ?? []} />
          )}
        </section>

        <section aria-label="유입 경로" data-testid="analytics-sources" className={CARD_CLASS}>
          <SectionHeader
            title="유입 경로별 신규 유저"
            description="이 기간에 처음 들어온 유저가 어디서 왔는지 (?src= 링크 표시 또는 이전 사이트). 1.3.2 이전 유저는 빠지고, 버전·리그 필터와 무관합니다."
            aside={allLeagues(ANALYTICS_RANGE_LABELS[range])}
          />
          {showSkeleton ? (
            <SkeletonRows count={3} />
          ) : report?.environment.sources === null ? (
            <p className="text-[13px] text-[var(--t-g500)]">
              Supabase에서 supabase/migrations/20261129_analytics_acquisition_source.sql을 실행하면 표시됩니다.
            </p>
          ) : (
            <DistributionBarList
              items={report?.environment.sources ?? []}
              barColorClass="bg-[var(--t-ok)]"
              unitLabel="명"
              emptyText="아직 1.3.2 이후 새로 들어온 유저가 없습니다."
            />
          )}
        </section>

        <section aria-label="접속 환경" data-testid="analytics-dist-env" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className={CARD_CLASS}>
            <SectionHeader title="기기별 플레이어" description="기기 유형별 고유 플레이어 수" aside={allLeagues()} />
            {showSkeleton ? (
              <SkeletonRows count={3} />
            ) : (
              <DistributionBarList
                items={report?.environment.devices ?? []}
                barColorClass="bg-[var(--t-down)]"
                unitLabel="명"
                emptyText="기기 데이터가 아직 없습니다."
              />
            )}
          </div>
          <div className={CARD_CLASS}>
            <SectionHeader title="게임 버전별 이벤트" description="game_version별 이벤트 수" aside={allLeagues()} />
            {showSkeleton ? (
              <SkeletonRows count={2} />
            ) : (
              <DistributionBarList
                items={report?.environment.versions ?? []}
                barColorClass="bg-[var(--t-g700)]"
                emptyText="버전 데이터가 아직 없습니다."
              />
            )}
          </div>
        </section>

        {/* 최근 마일스톤 로그 */}
        <section
          aria-label="최근 주요 마일스톤 로그"
          data-testid="analytics-recent-logs"
          className="bg-[var(--t-card)] border border-[var(--t-g200)] rounded-[20px] overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-[var(--t-g100)]">
            <SectionHeader
              title="최근 주요 마일스톤 로그"
              description="세션 시작을 제외한 최신 30건 (선수명·개인정보 미포함). 항목을 누르면 원본 payload JSON이 펼쳐집니다."
              aside={report ? `${leagueLabel ? `${leagueScopeNote} · ` : ''}${report.recentLogs.length}건 표시` : undefined}
            />
          </div>
          {showSkeleton ? (
            <div className="p-5">
              <SkeletonRows count={5} />
            </div>
          ) : (
            <RecentLogsList logs={report?.recentLogs ?? []} />
          )}
        </section>
      </main>
    </div>
  );
}
