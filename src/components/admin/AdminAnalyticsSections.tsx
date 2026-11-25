'use client';

import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Lightbulb } from 'lucide-react';
import type {
  AdminAnalyticsReport,
  DistributionItem,
  LeagueAwardRow,
  RateCell,
  RecentMilestoneLog,
} from '../../lib/adminAnalytics';

// ============================================================================
// 공통 표시 유틸 (NaN·빈 모수 방어)
// ============================================================================

export function formatPercentText(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) {
    return '-';
  }
  return `${value.toFixed(1)}%`;
}

function formatAvg(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '-' : value.toFixed(1);
}

function clampBarWidth(percent: number | null): number {
  if (percent === null || !Number.isFinite(percent) || percent <= 0) return 0;
  return Math.min(100, Math.max(percent, 2));
}

export const CARD_CLASS =
  'bg-[var(--t-card)] border border-[var(--t-g200)] rounded-[20px] p-5 space-y-4 min-w-0';

export function SectionHeader({
  title,
  description,
  aside,
}: {
  title: string;
  description?: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <div className="min-w-0">
        <h2 className="text-[15px] sm:text-[16px] font-bold tracking-[-0.02em] text-[var(--t-g900)]">
          {title}
        </h2>
        {description && (
          <p className="text-[12px] text-[var(--t-g500)] leading-relaxed">{description}</p>
        )}
      </div>
      {aside && (
        <div className="text-[12px] font-medium text-[var(--t-g500)] tabular-nums shrink-0">
          {aside}
        </div>
      )}
    </div>
  );
}

export function EmptyText({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-8 text-center text-[13px] text-[var(--t-g500)]">{children}</p>
  );
}

export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-7 rounded-lg bg-[var(--t-g100)]" />
      ))}
    </div>
  );
}

export function DistributionBarList({
  items,
  barColorClass = 'bg-[var(--t-accent)]',
  emptyText = '수집된 데이터가 아직 없습니다.',
  unitLabel = '건',
  limit,
}: {
  items: DistributionItem[];
  barColorClass?: string;
  emptyText?: string;
  unitLabel?: string;
  limit?: number;
}) {
  const visible = limit ? items.slice(0, limit) : items;
  if (!visible.some((item) => item.count > 0)) {
    return <EmptyText>{emptyText}</EmptyText>;
  }

  return (
    <div className="space-y-3">
      {visible.map((item) => (
        <div key={item.key} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2 text-[13px]">
            <span className="font-semibold text-[var(--t-g800)] truncate">{item.label}</span>
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
              style={{ width: `${clampBarWidth(item.percent)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** 비율 + 발생/모수 (모수 0이면 '-') */
export function RateText({ cell, emphasize = false }: { cell: RateCell; emphasize?: boolean }) {
  if (cell.n === 0 || cell.percent === null) {
    return <span className="text-[var(--t-g400)]">-</span>;
  }
  return (
    <span className="inline-flex flex-col items-end leading-tight">
      <span
        className={`font-bold tabular-nums ${emphasize ? 'text-[var(--t-g900)]' : 'text-[var(--t-g800)]'}`}
      >
        {formatPercentText(cell.percent)}
      </span>
      <span className="text-[10.5px] text-[var(--t-g500)] tabular-nums whitespace-nowrap">
        {cell.count.toLocaleString()}/{cell.n.toLocaleString()}
      </span>
    </span>
  );
}

// ============================================================================
// ⚡ 자동 밸런스 인사이트
// ============================================================================

export function InsightsCard({ insights }: { insights: string[] }) {
  return (
    <section
      aria-label="자동 밸런스 인사이트"
      data-testid="analytics-insights"
      className="bg-[var(--t-accent-soft)] border border-[var(--t-accent)]/20 rounded-[20px] p-5 space-y-3"
    >
      <div className="flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-[var(--t-accent)]" />
        <h2 className="text-[15px] font-bold tracking-[-0.02em] text-[var(--t-g900)]">
          자동 밸런스 인사이트
        </h2>
      </div>
      {insights.length === 0 ? (
        <p className="text-[13px] text-[var(--t-g600)]">
          표본이 아직 적어 요약을 만들지 않았습니다. 항목별 표본이 30건 이상 쌓이면 자동으로 표시됩니다.
        </p>
      ) : (
        <ul className="space-y-1.5 text-[13px] text-[var(--t-g800)] leading-relaxed list-disc pl-5">
          {insights.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ============================================================================
// 🏆 리그별 MVP · FMVP · 우승 집계 테이블 (정렬 가능)
// ============================================================================

type LeagueSortKey =
  | 'order'
  | 'seasons'
  | 'championship'
  | 'mvp'
  | 'fmvp'
  | 'playoffs'
  | 'ovrAvg'
  | 'ppgAvg';

const LEAGUE_COLUMNS: Array<{ key: LeagueSortKey; label: string }> = [
  { key: 'seasons', label: '완료 시즌' },
  { key: 'championship', label: '우승률' },
  { key: 'mvp', label: 'MVP' },
  { key: 'fmvp', label: 'FMVP' },
  { key: 'playoffs', label: 'PO 진출' },
  { key: 'ovrAvg', label: '평균 OVR' },
  { key: 'ppgAvg', label: 'PPG / RPG / APG' },
];

function leagueSortValue(row: LeagueAwardRow, key: LeagueSortKey, index: number): number {
  switch (key) {
    case 'order':
      return -index;
    case 'seasons':
      return row.seasons;
    case 'championship':
    case 'mvp':
    case 'fmvp':
    case 'playoffs':
      return row[key].percent ?? -1;
    case 'ovrAvg':
    case 'ppgAvg':
      return row[key] ?? -1;
  }
}

export function LeagueAwardsTable({
  rows,
  activeLeague,
}: {
  rows: LeagueAwardRow[];
  activeLeague: string;
}) {
  const [sortKey, setSortKey] = useState<LeagueSortKey>('order');
  const [desc, setDesc] = useState(true);

  const sorted = useMemo(() => {
    const indexed = rows.map((row, index) => ({ row, index }));
    indexed.sort((a, b) => {
      const diff =
        leagueSortValue(a.row, sortKey, a.index) - leagueSortValue(b.row, sortKey, b.index);
      return desc ? -diff : diff;
    });
    return indexed.map((i) => i.row);
  }, [rows, sortKey, desc]);

  const handleSort = (key: LeagueSortKey) => {
    if (key === sortKey) {
      setDesc((prev) => !prev);
    } else {
      setSortKey(key);
      setDesc(true);
    }
  };

  if (rows.length === 0) {
    return <EmptyText>완료된 시즌 기록이 아직 없습니다.</EmptyText>;
  }

  return (
    <div className="-mx-5 overflow-x-auto" data-testid="league-awards-table">
      <table className="w-full min-w-[720px] text-left border-collapse text-[13px]">
        <thead>
          <tr className="border-y border-[var(--t-g100)] bg-[var(--t-g50)] text-[12px] font-bold text-[var(--t-g500)]">
            <th className="py-2.5 pl-5 pr-3 whitespace-nowrap">
              <button
                type="button"
                onClick={() => handleSort('order')}
                className="inline-flex items-center gap-1 cursor-pointer hover:text-[var(--t-g900)]"
              >
                리그
              </button>
            </th>
            {LEAGUE_COLUMNS.map((col) => {
              const active = sortKey === col.key;
              return (
                <th key={col.key} className="py-2.5 px-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort(col.key)}
                    aria-label={`${col.label} 기준 정렬`}
                    className={`inline-flex items-center gap-1 cursor-pointer hover:text-[var(--t-g900)] ${active ? 'text-[var(--t-g900)]' : ''}`}
                  >
                    {col.label}
                    {active &&
                      (desc ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />)}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--t-g100)]">
          {sorted.map((row) => {
            const highlighted = activeLeague !== 'all' && row.league === activeLeague;
            return (
              <tr
                key={row.league}
                className={highlighted ? 'bg-[var(--t-gold-soft)]' : 'hover:bg-[var(--t-g50)]/70'}
              >
                <td className="py-2.5 pl-5 pr-3 font-semibold text-[var(--t-g900)] whitespace-nowrap">
                  {row.label}
                  {row.v2Seasons < row.seasons && (
                    <span
                      className="ml-1.5 text-[10.5px] font-medium text-[var(--t-g500)]"
                      title="PO 진출률은 1차 고도화 이후 수집된 시즌만 모수로 계산합니다."
                    >
                      신규 {row.v2Seasons.toLocaleString()}
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums font-semibold">
                  {row.seasons.toLocaleString()}
                </td>
                <td className="py-2.5 px-3 text-right">
                  <RateText cell={row.championship} emphasize />
                </td>
                <td className="py-2.5 px-3 text-right">
                  <RateText cell={row.mvp} />
                </td>
                <td className="py-2.5 px-3 text-right">
                  <RateText cell={row.fmvp} />
                </td>
                <td className="py-2.5 px-3 text-right">
                  <RateText cell={row.playoffs} />
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums">{formatAvg(row.ovrAvg)}</td>
                <td className="py-2.5 pl-3 pr-5 text-right tabular-nums whitespace-nowrap text-[var(--t-g700)]">
                  {formatAvg(row.ppgAvg)} / {formatAvg(row.rpgAvg)} / {formatAvg(row.apgAvg)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// 🏀 포지션별 밸런스 매트릭스
// ============================================================================

export function PositionBalanceMatrix({
  data,
}: {
  data: AdminAnalyticsReport['positionBalance'];
}) {
  const hasAny = data.rows.some((r) => r.careers > 0 || r.seasons > 0);
  if (!hasAny) {
    return <EmptyText>포지션 데이터가 아직 없습니다.</EmptyText>;
  }

  const maxMvp = Math.max(...data.rows.map((r) => r.mvp.percent ?? 0), 1);

  return (
    <div className="space-y-3">
      <div className="-mx-5 overflow-x-auto" data-testid="position-balance-table">
        <table className="w-full min-w-[680px] text-left border-collapse text-[13px]">
          <thead>
            <tr className="border-y border-[var(--t-g100)] bg-[var(--t-g50)] text-[12px] font-bold text-[var(--t-g500)]">
              <th className="py-2.5 pl-5 pr-3 whitespace-nowrap">포지션</th>
              <th className="py-2.5 px-3 whitespace-nowrap">커리어 선택</th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap">완료 시즌</th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap">우승률</th>
              <th className="py-2.5 px-3 whitespace-nowrap">MVP 수상률</th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap">FMVP</th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap">평균 OVR</th>
              <th className="py-2.5 pl-3 pr-5 text-right whitespace-nowrap">PPG / RPG / APG</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--t-g100)]">
            {data.rows.map((row) => (
              <tr key={row.position} className="hover:bg-[var(--t-g50)]/70">
                <td className="py-2.5 pl-5 pr-3 font-semibold text-[var(--t-g900)] whitespace-nowrap">
                  {row.label}
                </td>
                <td className="py-2.5 px-3 min-w-[140px]">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-[var(--t-g100)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--t-accent)]"
                        style={{ width: `${clampBarWidth(row.careerShare)}%` }}
                      />
                    </div>
                    <span className="text-[12px] tabular-nums text-[var(--t-g700)] whitespace-nowrap">
                      {row.careers.toLocaleString()} ({formatPercentText(row.careerShare)})
                    </span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums">
                  {row.seasons.toLocaleString()}
                </td>
                <td className="py-2.5 px-3 text-right">
                  <RateText cell={row.championship} />
                </td>
                <td className="py-2.5 px-3 min-w-[150px]">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-[var(--t-g100)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--t-gold)]"
                        style={{
                          width: `${clampBarWidth(((row.mvp.percent ?? 0) / maxMvp) * 100)}%`,
                        }}
                      />
                    </div>
                    <RateText cell={row.mvp} emphasize />
                  </div>
                </td>
                <td className="py-2.5 px-3 text-right">
                  <RateText cell={row.fmvp} />
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums">{formatAvg(row.ovrAvg)}</td>
                <td className="py-2.5 pl-3 pr-5 text-right tabular-nums whitespace-nowrap text-[var(--t-g700)]">
                  {formatAvg(row.ppgAvg)} / {formatAvg(row.rpgAvg)} / {formatAvg(row.apgAvg)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.unknownPositionSeasons > 0 && (
        <p className="text-[11.5px] text-[var(--t-g500)]">
          포지션을 확인할 수 없는 구버전 시즌 {data.unknownPositionSeasons.toLocaleString()}건은 시즌 지표에서 제외했습니다.
        </p>
      )}
    </div>
  );
}

// ============================================================================
// 📈 리셋 병목 분석
// ============================================================================

type ResetTab = 'bySeason' | 'byLeague' | 'byOvr' | 'byRole';

const RESET_TABS: Array<{ key: ResetTab; label: string }> = [
  { key: 'bySeason', label: '시즌 연차' },
  { key: 'byLeague', label: '리그' },
  { key: 'byOvr', label: 'OVR 구간' },
  { key: 'byRole', label: '역할' },
];

function StatChip({ label, cell }: { label: string; cell: RateCell }) {
  return (
    <div className="flex-1 min-w-[140px] rounded-xl bg-[var(--t-g50)] border border-[var(--t-g100)] px-3 py-2.5">
      <p className="text-[11.5px] font-semibold text-[var(--t-g500)]">{label}</p>
      <p className="text-[18px] font-bold tabular-nums text-[var(--t-g900)]">
        {formatPercentText(cell.percent)}
      </p>
      <p className="text-[11px] text-[var(--t-g500)] tabular-nums">
        {cell.n > 0 ? `${cell.count.toLocaleString()}/${cell.n.toLocaleString()}건` : '수집 전'}
      </p>
    </div>
  );
}

export function ResetBottleneck({ resets }: { resets: AdminAnalyticsReport['resets'] }) {
  const [tab, setTab] = useState<ResetTab>('bySeason');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <StatChip label="초반 벽 포기 (1시즌 이하)" cell={resets.earlyQuit} />
        <StatChip label="우승 경험 후 재도전" cell={resets.afterChampionship} />
        <StatChip label="MVP 경험 후 재도전" cell={resets.afterMvp} />
      </div>
      <div
        role="tablist"
        aria-label="리셋 분포 기준"
        className="inline-flex flex-wrap items-center p-1 rounded-xl bg-[var(--t-g100)]"
      >
        {RESET_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`min-h-[30px] px-2.5 rounded-lg text-[12px] font-semibold whitespace-nowrap cursor-pointer ${
              tab === t.key
                ? 'bg-[var(--t-card)] text-[var(--t-g900)] shadow-xs'
                : 'text-[var(--t-g600)] hover:text-[var(--t-g900)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <DistributionBarList
        items={resets[tab]}
        barColorClass="bg-[var(--t-up)]"
        emptyText={
          tab === 'byRole' || tab === 'byOvr'
            ? '이 항목은 1차 고도화 이후 리셋부터 수집됩니다.'
            : '중도 초기화(리셋) 이벤트가 없습니다.'
        }
      />
    </div>
  );
}

// ============================================================================
// 🎖️ 최근 마일스톤 로그 (뱃지 + 원본 JSON 펼치기)
// ============================================================================

const EVENT_TONE_MAP: Record<string, { text: string; bg: string }> = {
  career_created: { text: 'text-[var(--t-accent)]', bg: 'bg-[var(--t-accent-soft)]' },
  season_completed: { text: 'text-[var(--t-ok)]', bg: 'bg-[var(--t-ok-soft)]' },
  league_changed: { text: 'text-[var(--t-gold)]', bg: 'bg-[var(--t-gold-soft)]' },
  career_ended: { text: 'text-[var(--t-down)]', bg: 'bg-[var(--t-down-soft)]' },
  career_reset: { text: 'text-[var(--t-up)]', bg: 'bg-[var(--t-up-soft)]' },
};

const DEFAULT_TONE = { text: 'text-[var(--t-g700)]', bg: 'bg-[var(--t-g100)]' };

function RecentLogItem({ log }: { log: RecentMilestoneLog }) {
  const tone = EVENT_TONE_MAP[log.eventName] ?? DEFAULT_TONE;
  return (
    <li className="px-4 sm:px-5 py-3.5">
      <details className="group">
        <summary className="list-none cursor-pointer space-y-1.5 [&::-webkit-details-marker]:hidden">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${tone.bg} ${tone.text}`}
            >
              {log.eventLabel}
            </span>
            {log.position && (
              <span className="px-1.5 py-0.5 rounded-md text-[11px] font-semibold bg-[var(--t-g100)] text-[var(--t-g700)]">
                {log.position}
              </span>
            )}
            {log.badges.map((badge) => (
              <span
                key={badge}
                className="px-1.5 py-0.5 rounded-md text-[11px] font-bold bg-[var(--t-gold-soft)] text-[var(--t-gold)]"
              >
                {badge}
              </span>
            ))}
            <span className="ml-auto inline-flex items-center gap-1 font-mono text-[11px] text-[var(--t-g500)] tabular-nums">
              {log.formattedDateKst}
              <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
            </span>
          </div>
          <p className="text-[13px] font-medium text-[var(--t-g800)] leading-snug break-words">
            {log.summary}
          </p>
          <p className="text-[11px] text-[var(--t-g500)] tabular-nums">
            {log.deviceLabel} · {log.gameVersion ? `v${log.gameVersion}` : '버전 미상'}
          </p>
        </summary>
        <pre className="mt-2 p-3 rounded-xl bg-[var(--t-g50)] border border-[var(--t-g100)] text-[11px] leading-relaxed text-[var(--t-g700)] overflow-x-auto max-h-72">
          {JSON.stringify(log.payload, null, 2)}
        </pre>
      </details>
    </li>
  );
}

export function RecentLogsList({ logs }: { logs: RecentMilestoneLog[] }) {
  if (logs.length === 0) {
    return (
      <div data-testid="analytics-empty-state" className="py-14 px-6 text-center space-y-2">
        <p className="text-[15px] font-bold text-[var(--t-g800)]">
          조건에 맞는 마일스톤 이벤트가 없습니다
        </p>
        <p className="text-[13px] text-[var(--t-g500)]">
          조회 기간이나 버전 필터를 바꾸거나, 플레이가 기록된 뒤 새로고침해 주세요.
        </p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-[var(--t-g100)]">
      {logs.map((log) => (
        <RecentLogItem key={log.id} log={log} />
      ))}
    </ul>
  );
}
