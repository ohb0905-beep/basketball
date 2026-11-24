'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  BarChart3,
  Database,
  Loader2,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { GAME_NAME, GAME_VERSION } from '../../config/appMeta';
import {
  ANALYTICS_DATE_RANGES,
  ANALYTICS_RANGE_LABELS,
  AdminAnalyticsReport,
  AnalyticsDateRange,
  DailyTrendPoint,
  DistributionItem,
  formatAnalyticsDateKst,
} from '../../lib/adminAnalytics';
import { AdminConsoleNav } from './AdminConsoleNav';

const EVENT_TONE_MAP: Record<string, { text: string; bg: string }> = {
  session_start: {
    text: 'text-[var(--t-g700)]',
    bg: 'bg-[var(--t-g100)]',
  },
  career_created: {
    text: 'text-[var(--t-accent)]',
    bg: 'bg-[var(--t-accent-soft)]',
  },
  season_completed: {
    text: 'text-[var(--t-ok)]',
    bg: 'bg-[var(--t-ok-soft)]',
  },
  league_changed: {
    text: 'text-[var(--t-gold)]',
    bg: 'bg-[var(--t-gold-soft)]',
  },
  career_ended: {
    text: 'text-[var(--t-down)]',
    bg: 'bg-[var(--t-down-soft)]',
  },
  career_reset: {
    text: 'text-[var(--t-up)]',
    bg: 'bg-[var(--t-up-soft)]',
  },
};

function formatPercentText(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0.0%';
  return `${value.toFixed(1)}%`;
}

function clampBarWidth(percent: number): number {
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return Math.min(100, Math.max(percent, 2));
}

function DistributionBarList({
  items,
  barColorClass = 'bg-[var(--t-accent)]',
  emptyText = '수집된 데이터가 아직 없습니다.',
  unitLabel = '건',
}: {
  items: DistributionItem[];
  barColorClass?: string;
  emptyText?: string;
  unitLabel?: string;
}) {
  const hasAny = items.some((item) => item.count > 0);
  if (!hasAny) {
    return (
      <p className="py-8 text-center text-[13px] text-[var(--t-g500)]">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const widthPct = clampBarWidth(item.percent);
        return (
          <div key={item.key} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2 text-[13px]">
              <span className="font-semibold text-[var(--t-g800)] truncate">
                {item.label}
              </span>
              <span className="text-[12px] font-semibold text-[var(--t-g600)] tabular-nums whitespace-nowrap shrink-0">
                {item.count.toLocaleString()}
                {unitLabel}{' '}
                <span className="text-[var(--t-g400)] font-normal">
                  ({formatPercentText(item.percent)})
                </span>
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-[var(--t-g100)] overflow-hidden">
              <div
                className={`h-full rounded-full transition-[width] duration-300 ${barColorClass}`}
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
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

  const labelStep = points.length <= 10 ? 1 : points.length <= 18 ? 2 : 5;
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
              {activePoint.dateKey} (KST)
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
            <div className="relative h-[180px] border-b border-[var(--t-g200)] flex items-end gap-1 sm:gap-1.5">
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
                    aria-label={`${point.dateKey} 고유 플레이어 ${point.uniquePlayers}명, 커리어 생성 ${point.careersCreated}건`}
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
            <div className="mt-2 flex items-center gap-1 sm:gap-1.5">
              {points.map((point, idx) => {
                const showLabel =
                  idx === 0 ||
                  idx === points.length - 1 ||
                  idx % labelStep === 0;
                return (
                  <div
                    key={point.dateKey}
                    className="flex-1 text-center text-[10px] sm:text-[11px] font-mono text-[var(--t-g500)] tabular-nums truncate"
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

export function AdminAnalyticsDashboard() {
  const router = useRouter();

  const [range, setRange] = useState<AnalyticsDateRange>('7d');
  const [versionFilter, setVersionFilter] = useState<string>('all');
  const [seasonTab, setSeasonTab] = useState<'maxSeason' | 'resetSeason'>('maxSeason');
  const [reloadTick, setReloadTick] = useState(0);

  const [report, setReport] = useState<AdminAnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const triggerReload = useCallback(() => {
    setLoading(true);
    setErrorMessage(null);
    setReloadTick((prev) => prev + 1);
  }, []);

  const handleChangeRange = (nextRange: AnalyticsDateRange) => {
    if (nextRange === range) return;
    setLoading(true);
    setErrorMessage(null);
    setRange(nextRange);
  };

  const handleChangeVersion = (nextVersion: string) => {
    if (nextVersion === versionFilter) return;
    setLoading(true);
    setErrorMessage(null);
    setVersionFilter(nextVersion);
  };

  useEffect(() => {
    let cancelled = false;

    const qs = new URLSearchParams({
      range,
      version: versionFilter,
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
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [range, versionFilter, reloadTick, router]);

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

  const kpi = report?.kpi ?? {
    uniquePlayers: 0,
    totalSessions: 0,
    careersCreated: 0,
    seasonsCompleted: 0,
    careersEnded: 0,
    careersReset: 0,
    totalEvents: 0,
  };

  const kpiCards = [
    {
      key: 'uniquePlayers',
      label: '고유 플레이어',
      value: kpi.uniquePlayers,
      unit: '명',
      subtext: '익명 ID 중복 제거',
      toneClass: 'text-[var(--t-g900)]',
    },
    {
      key: 'totalSessions',
      label: '총 세션 수',
      value: kpi.totalSessions,
      unit: '회',
      subtext: 'session_start 기준',
      toneClass: 'text-[var(--t-accent)]',
    },
    {
      key: 'careersCreated',
      label: '생성된 커리어',
      value: kpi.careersCreated,
      unit: '건',
      subtext:
        kpi.careersReset > 0
          ? `중도 리셋 ${kpi.careersReset.toLocaleString()}건`
          : 'career_created 기준',
      toneClass: 'text-[var(--t-ok)]',
    },
    {
      key: 'seasonsCompleted',
      label: '완료된 총 시즌',
      value: kpi.seasonsCompleted,
      unit: '시즌',
      subtext: 'season_completed 기준',
      toneClass: 'text-[var(--t-gold)]',
    },
    {
      key: 'careersEnded',
      label: '은퇴/엔딩 도달',
      value: kpi.careersEnded,
      unit: '건',
      subtext: 'career_ended 기준',
      toneClass: 'text-[var(--t-down)]',
    },
  ];

  const availableVersions = report?.availableVersions ?? [];

  return (
    <div className="min-h-screen bg-[var(--t-bg)] text-[var(--t-g900)]">
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
              className="min-h-[40px] px-3 rounded-xl bg-[var(--t-card)] border border-[var(--t-g200)] text-[13px] font-semibold text-[var(--t-g700)] hover:bg-[var(--t-g100)] inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer t-tap disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">새로고침</span>
            </button>
            <button
              type="button"
              data-testid="analytics-logout-btn"
              disabled={loggingOut}
              onClick={() => void handleLogout()}
              className="min-h-[40px] px-3 rounded-xl bg-[var(--t-card)] border border-[var(--t-g200)] text-[13px] font-semibold text-[var(--t-g700)] hover:text-[var(--t-up)] hover:border-[var(--t-up)]/40 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer t-tap disabled:opacity-50"
            >
              {loggingOut ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              <span>로그아웃</span>
            </button>
          </div>

          <div className="w-full sm:hidden pt-1">
            <AdminConsoleNav active="analytics" />
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-5 sm:py-6 space-y-5">
        {/* 필터 및 집계 범위 컨트롤 바 */}
        <section
          aria-label="통계 필터"
          className="bg-[var(--t-card)] border border-[var(--t-g200)] rounded-[20px] p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <div
              role="group"
              aria-label="조회 기간"
              className="inline-flex items-center p-1 rounded-xl bg-[var(--t-g100)]"
            >
              {ANALYTICS_DATE_RANGES.map((option) => {
                const active = range === option;
                return (
                  <button
                    key={option}
                    type="button"
                    data-testid={`analytics-range-${option}`}
                    onClick={() => handleChangeRange(option)}
                    className={`min-h-[34px] px-3 rounded-lg text-[13px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
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

            <div className="flex items-center gap-2">
              <label
                htmlFor="analytics-version-select"
                className="text-[12px] font-bold text-[var(--t-g500)] whitespace-nowrap"
              >
                버전
              </label>
              <select
                id="analytics-version-select"
                data-testid="analytics-version-select"
                value={versionFilter}
                disabled={loading}
                onChange={(e) => handleChangeVersion(e.target.value)}
                className="min-h-[40px] px-3 rounded-xl bg-[var(--t-g100)] text-[13px] font-semibold text-[var(--t-g900)] focus:outline-none focus:ring-2 focus:ring-[var(--t-accent)] cursor-pointer disabled:opacity-60"
              >
                <option value="all">전체 버전</option>
                {availableVersions.map((ver) => (
                  <option key={ver} value={ver}>
                    v{ver}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--t-g500)] tabular-nums">
            {report ? (
              <>
                <span>
                  분석 이벤트 {report.scanMeta.scannedRows.toLocaleString()}건
                  {report.scanMeta.truncated
                    ? ` (최근 ${report.scanMeta.scanLimit.toLocaleString()}건 상한 적용 / 전체 ${report.scanMeta.totalMatchingRows.toLocaleString()}건)`
                    : ''}
                </span>
                <span aria-hidden="true">·</span>
                <span>기준 {formatAnalyticsDateKst(report.generatedAt)} KST</span>
              </>
            ) : (
              <span>통계 집계 준비 중...</span>
            )}
          </div>
        </section>

        {/* 에러 알림 배너 */}
        {errorMessage && (
          <div
            role="alert"
            data-testid="analytics-error-banner"
            className="p-4 rounded-[20px] bg-[var(--t-up-soft)] border border-[var(--t-up)]/20 text-[var(--t-up)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p className="text-[13px] font-semibold leading-snug">
                {errorMessage}
              </p>
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

        {/* analytics_events 테이블 미생성 안내 배너 */}
        {report?.tableNotReady && (
          <div
            role="status"
            data-testid="analytics-table-not-ready"
            className="p-4 rounded-[20px] bg-[var(--t-gold-soft)] border border-[var(--t-gold)]/20 text-[var(--t-g900)] flex items-start gap-3"
          >
            <Database className="w-4 h-4 mt-0.5 text-[var(--t-gold)] shrink-0" />
            <div className="space-y-1 text-[13px]">
              <p className="font-bold text-[var(--t-g900)]">
                Supabase에 analytics_events 테이블이 아직 생성되지 않았습니다
              </p>
              <p className="text-[12px] text-[var(--t-g700)] leading-relaxed">
                저장소의{' '}
                <code className="font-mono font-semibold">
                  supabase/migrations/20261124_create_analytics_events.sql
                </code>{' '}
                SQL을 Supabase SQL Editor에서 실행하면 익명 플레이 통계가 자동 적재되고 이 대시보드에 실시간 반영됩니다.
              </p>
            </div>
          </div>
        )}

        {/* 핵심 요약 KPI 카드 5종 */}
        <section
          aria-label="핵심 플레이 지표"
          data-testid="analytics-kpi-grid"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
        >
          {kpiCards.map((card) => (
            <div
              key={card.key}
              data-testid={`kpi-card-${card.key}`}
              className="bg-[var(--t-card)] border border-[var(--t-g200)] rounded-[18px] p-4 space-y-1.5"
            >
              <p className="text-[12px] font-semibold text-[var(--t-g500)]">
                {card.label}
              </p>
              {loading && !report ? (
                <div className="h-8 w-20 rounded-md bg-[var(--t-g100)] animate-pulse" />
              ) : (
                <p
                  className={`text-[24px] sm:text-[26px] font-bold tracking-[-0.03em] tabular-nums leading-tight ${card.toneClass}`}
                >
                  {card.value.toLocaleString()}
                  <span className="ml-0.5 text-[13px] font-semibold text-[var(--t-g500)]">
                    {card.unit}
                  </span>
                </p>
              )}
              <p className="text-[11px] text-[var(--t-g500)] truncate">
                {card.subtext}
              </p>
            </div>
          ))}
        </section>

        {/* 일별 추이 차트 (KST 기준) */}
        <section
          aria-label="일별 추이"
          data-testid="analytics-daily-trend"
          className="bg-[var(--t-card)] border border-[var(--t-g200)] rounded-[20px] p-5 space-y-4"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-[16px] font-bold tracking-[-0.02em] text-[var(--t-g900)]">
                일별 플레이 추이
              </h2>
              <p className="text-[12px] text-[var(--t-g500)]">
                한국 시간(KST) 기준 날짜별 고유 플레이어 수 및 신규 커리어 생성 건수
              </p>
            </div>
            <span className="text-[12px] font-medium text-[var(--t-g500)]">
              {ANALYTICS_RANGE_LABELS[range]}
            </span>
          </div>

          {loading && !report ? (
            <div className="h-[220px] rounded-xl bg-[var(--t-g50)] animate-pulse" />
          ) : (
            <DailyTrendChart points={report?.dailyTrend ?? []} />
          )}
        </section>

        {/* 게임 밸런스 & 플레이 분포 2x2 그리드 */}
        <section
          aria-label="게임 밸런스 및 플레이 분포"
          className="grid grid-cols-1 lg:grid-cols-2 gap-5"
        >
          {/* 1. 포지션별 선택 비율 */}
          <div
            data-testid="analytics-dist-positions"
            className="bg-[var(--t-card)] border border-[var(--t-g200)] rounded-[20px] p-5 space-y-4"
          >
            <div>
              <h2 className="text-[15px] font-bold tracking-[-0.02em] text-[var(--t-g900)]">
                포지션별 선택 비율
              </h2>
              <p className="text-[12px] text-[var(--t-g500)]">
                신규 커리어 생성(career_created) 시 선택된 주 포지션 분포
              </p>
            </div>
            {loading && !report ? (
              <div className="space-y-3 animate-pulse">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-8 rounded-lg bg-[var(--t-g100)]" />
                ))}
              </div>
            ) : (
              <DistributionBarList
                items={report?.distributions.positions ?? []}
                barColorClass="bg-[var(--t-accent)]"
                emptyText="아직 생성된 커리어 데이터가 없습니다."
              />
            )}
          </div>

          {/* 2. 리그별 도달 퍼널 */}
          <div
            data-testid="analytics-dist-leagues"
            className="bg-[var(--t-card)] border border-[var(--t-g200)] rounded-[20px] p-5 space-y-4"
          >
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-bold tracking-[-0.02em] text-[var(--t-g900)]">
                  리그별 도달 퍼널
                </h2>
                <p className="text-[12px] text-[var(--t-g500)]">
                  추적된 고유 커리어 중 각 리그에 도달한 비율
                </p>
              </div>
              {report && report.distributions.leagueReachDenominator > 0 && (
                <span className="text-[12px] font-medium text-[var(--t-g500)] tabular-nums shrink-0">
                  모수 {report.distributions.leagueReachDenominator.toLocaleString()}커리어
                </span>
              )}
            </div>
            {loading && !report ? (
              <div className="space-y-3 animate-pulse">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-7 rounded-lg bg-[var(--t-g100)]" />
                ))}
              </div>
            ) : (
              <DistributionBarList
                items={report?.distributions.leagueReach ?? []}
                barColorClass="bg-[var(--t-ok)]"
                unitLabel="커리어"
                emptyText="리그 도달 이력이 아직 없습니다."
              />
            )}
          </div>

          {/* 3. 시즌 진행 및 중도 리셋 분포 */}
          <div
            data-testid="analytics-dist-seasons"
            className="bg-[var(--t-card)] border border-[var(--t-g200)] rounded-[20px] p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-bold tracking-[-0.02em] text-[var(--t-g900)]">
                  시즌 진행 · 이탈 구간 분포
                </h2>
                <p className="text-[12px] text-[var(--t-g500)]">
                  커리어별 최대 도달 시즌 및 중도 리셋 발생 시즌 구간
                </p>
              </div>
              <div className="inline-flex items-center p-1 rounded-xl bg-[var(--t-g100)]">
                <button
                  type="button"
                  onClick={() => setSeasonTab('maxSeason')}
                  className={`min-h-[30px] px-2.5 rounded-lg text-[12px] font-semibold whitespace-nowrap cursor-pointer ${
                    seasonTab === 'maxSeason'
                      ? 'bg-[var(--t-card)] text-[var(--t-g900)] shadow-xs'
                      : 'text-[var(--t-g600)] hover:text-[var(--t-g900)]'
                  }`}
                >
                  최대 도달 시즌
                </button>
                <button
                  type="button"
                  onClick={() => setSeasonTab('resetSeason')}
                  className={`min-h-[30px] px-2.5 rounded-lg text-[12px] font-semibold whitespace-nowrap cursor-pointer ${
                    seasonTab === 'resetSeason'
                      ? 'bg-[var(--t-card)] text-[var(--t-g900)] shadow-xs'
                      : 'text-[var(--t-g600)] hover:text-[var(--t-g900)]'
                  }`}
                >
                  리셋 발생 구간
                </button>
              </div>
            </div>

            {loading && !report ? (
              <div className="space-y-3 animate-pulse">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-8 rounded-lg bg-[var(--t-g100)]" />
                ))}
              </div>
            ) : seasonTab === 'maxSeason' ? (
              <DistributionBarList
                items={report?.distributions.maxSeasonReached ?? []}
                barColorClass="bg-[var(--t-gold)]"
                unitLabel="커리어"
                emptyText="완료된 시즌 기록이 아직 없습니다."
              />
            ) : (
              <DistributionBarList
                items={report?.distributions.resetSeasons ?? []}
                barColorClass="bg-[var(--t-up)]"
                unitLabel="건"
                emptyText="중도 초기화(리셋) 이벤트가 없습니다."
              />
            )}
          </div>

          {/* 4. 접속 기기 및 게임 버전 분포 */}
          <div
            data-testid="analytics-dist-env"
            className="bg-[var(--t-card)] border border-[var(--t-g200)] rounded-[20px] p-5 space-y-5"
          >
            <div className="space-y-3">
              <div>
                <h2 className="text-[15px] font-bold tracking-[-0.02em] text-[var(--t-g900)]">
                  기기별 접속 비율
                </h2>
                <p className="text-[12px] text-[var(--t-g500)]">
                  조회된 이벤트 기준 모바일 · 태블릿 · 데스크톱 비중
                </p>
              </div>
              {loading && !report ? (
                <div className="space-y-2.5 animate-pulse">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-7 rounded-lg bg-[var(--t-g100)]" />
                  ))}
                </div>
              ) : (
                <DistributionBarList
                  items={report?.distributions.devices ?? []}
                  barColorClass="bg-[var(--t-down)]"
                  emptyText="기기 접속 데이터가 아직 없습니다."
                />
              )}
            </div>

            <div className="pt-4 border-t border-[var(--t-g100)] space-y-3">
              <div>
                <h3 className="text-[14px] font-bold text-[var(--t-g900)]">
                  게임 버전별 분포
                </h3>
              </div>
              {loading && !report ? (
                <div className="h-12 rounded-lg bg-[var(--t-g100)] animate-pulse" />
              ) : (
                <DistributionBarList
                  items={report?.distributions.versions ?? []}
                  barColorClass="bg-[var(--t-g700)]"
                  emptyText="버전 분포 데이터가 아직 없습니다."
                />
              )}
            </div>
          </div>
        </section>

        {/* 최근 주요 마일스톤 로그 (최신 25건) */}
        <section
          aria-label="최근 주요 마일스톤 로그"
          data-testid="analytics-recent-logs"
          className="bg-[var(--t-card)] border border-[var(--t-g200)] rounded-[20px] overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-[var(--t-g100)] flex items-baseline justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-bold tracking-[-0.02em] text-[var(--t-g900)]">
                최근 주요 마일스톤 로그
              </h2>
              <p className="text-[12px] text-[var(--t-g500)]">
                최신 25건 기준 익명 플레이 이벤트 요약 (선수명·개인정보 미포함)
              </p>
            </div>
            <span className="text-[12px] font-medium text-[var(--t-g500)] tabular-nums shrink-0">
              {report ? `${report.recentLogs.length}건 표시` : ''}
            </span>
          </div>

          {loading && !report ? (
            <div className="divide-y divide-[var(--t-g100)]">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-5 py-3.5 animate-pulse flex gap-4">
                  <div className="h-4 w-28 rounded bg-[var(--t-g100)]" />
                  <div className="h-4 w-20 rounded bg-[var(--t-g100)]" />
                  <div className="h-4 flex-1 rounded bg-[var(--t-g100)]" />
                </div>
              ))}
            </div>
          ) : !report || report.recentLogs.length === 0 ? (
            <div
              data-testid="analytics-empty-state"
              className="py-14 px-6 text-center space-y-2"
            >
              <div className="w-11 h-11 mx-auto rounded-2xl bg-[var(--t-g100)] text-[var(--t-g400)] flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
              <p className="text-[15px] font-bold text-[var(--t-g800)]">
                조건에 맞는 플레이 통계 이벤트가 없습니다
              </p>
              <p className="text-[13px] text-[var(--t-g500)]">
                조회 기간이나 버전 필터를 변경하거나, 유저 플레이가 기록된 뒤 새로고침해 주세요.
              </p>
            </div>
          ) : (
            <>
              {/* 데스크톱 테이블 */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--t-g100)] text-[12px] font-bold text-[var(--t-g500)] bg-[var(--t-g50)]">
                      <th className="py-3 px-5 whitespace-nowrap">발생 시각 (KST)</th>
                      <th className="py-3 px-4 whitespace-nowrap">이벤트</th>
                      <th className="py-3 px-4">핵심 요약</th>
                      <th className="py-3 px-4 whitespace-nowrap">기기</th>
                      <th className="py-3 px-5 text-right whitespace-nowrap">버전</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--t-g100)] text-[13px]">
                    {report.recentLogs.map((log) => {
                      const tone =
                        EVENT_TONE_MAP[log.eventName] || EVENT_TONE_MAP.session_start;
                      return (
                        <tr
                          key={log.id}
                          className="hover:bg-[var(--t-g50)]/70 transition-colors"
                        >
                          <td className="py-3 px-5 font-mono text-[12px] text-[var(--t-g500)] tabular-nums whitespace-nowrap">
                            {log.formattedDateKst}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${tone.bg} ${tone.text}`}
                            >
                              {log.eventLabel}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[var(--t-g800)] font-medium break-words">
                            {log.summary}
                          </td>
                          <td className="py-3 px-4 text-[12px] text-[var(--t-g600)] whitespace-nowrap">
                            {log.deviceLabel}
                          </td>
                          <td className="py-3 px-5 text-right font-mono text-[12px] text-[var(--t-g500)] tabular-nums whitespace-nowrap">
                            {log.gameVersion ? `v${log.gameVersion}` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 모바일 스택 리스트 (가로 넘침 방지) */}
              <ul className="md:hidden divide-y divide-[var(--t-g100)]">
                {report.recentLogs.map((log) => {
                  const tone =
                    EVENT_TONE_MAP[log.eventName] || EVENT_TONE_MAP.session_start;
                  return (
                    <li key={log.id} className="px-4 py-3.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${tone.bg} ${tone.text}`}
                        >
                          {log.eventLabel}
                        </span>
                        <span className="font-mono text-[11px] text-[var(--t-g500)] tabular-nums">
                          {log.formattedDateKst}
                        </span>
                      </div>
                      <p className="text-[13px] font-medium text-[var(--t-g800)] leading-snug break-words">
                        {log.summary}
                      </p>
                      <div className="flex items-center gap-1.5 text-[11px] text-[var(--t-g500)] tabular-nums">
                        <span>{log.deviceLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span>{log.gameVersion ? `v${log.gameVersion}` : '버전 미상'}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
