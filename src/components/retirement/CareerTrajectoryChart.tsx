'use client';

import React, { useMemo, useState } from 'react';
import { RetrospectiveSeasonPoint } from '../../types/game';

interface CareerTrajectoryChartProps {
  seasons: RetrospectiveSeasonPoint[];
  peakSeasonNumber?: number | null;
}

type MetricKey = 'ovr' | 'ppg';

export function CareerTrajectoryChart({
  seasons,
  peakSeasonNumber,
}: CareerTrajectoryChartProps) {
  const [metric, setMetric] = useState<MetricKey>('ovr');
  const defaultSelectedIdx = useMemo(() => {
    if (seasons.length === 0) return 0;
    if (peakSeasonNumber != null) {
      const idx = seasons.findIndex((s) => s.seasonNumber === peakSeasonNumber);
      if (idx >= 0) return idx;
    }
    let bestIdx = 0;
    for (let i = 1; i < seasons.length; i++) {
      if (seasons[i].ovr > seasons[bestIdx].ovr) bestIdx = i;
    }
    return bestIdx;
  }, [seasons, peakSeasonNumber]);

  const [selectedIdx, setSelectedIdx] = useState<number>(defaultSelectedIdx);

  if (seasons.length === 0) {
    return (
      <div className="py-8 text-center rounded-2xl bg-[var(--t-g50)] border border-[var(--t-g100)]">
        <p className="text-[14px] font-semibold text-[var(--t-g600)]">
          시즌별 상세 궤적 데이터가 기록되지 않은 이전 명예의 전당 선수입니다
        </p>
        <p className="text-[12px] text-[var(--t-g400)] mt-1">
          통산 요약과 대표 구단 기록은 그대로 열람할 수 있습니다
        </p>
      </div>
    );
  }

  const safeIdx = Math.min(Math.max(0, selectedIdx), seasons.length - 1);
  const selected = seasons[safeIdx];

  const width = 520;
  const height = 210;
  const padLeft = 36;
  const padRight = 18;
  const padTop = 20;
  const padBottom = 32;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const values = seasons.map((s) => (metric === 'ovr' ? s.ovr : s.ppg));
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);

  const minVal =
    metric === 'ovr'
      ? Math.max(40, Math.floor((rawMin - 4) / 5) * 5)
      : Math.max(0, Math.floor((rawMin - 2) / 5) * 5);
  const maxVal =
    metric === 'ovr'
      ? Math.min(99, Math.ceil((rawMax + 4) / 5) * 5)
      : Math.max(10, Math.ceil((rawMax + 3) / 5) * 5);
  const span = Math.max(1, maxVal - minVal);

  const points = seasons.map((s, idx) => {
    const val = metric === 'ovr' ? s.ovr : s.ppg;
    const x =
      seasons.length === 1
        ? padLeft + innerW / 2
        : padLeft + (idx / (seasons.length - 1)) * innerW;
    const y = padTop + innerH - ((val - minVal) / span) * innerH;
    return { x, y, val, season: s, idx };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const areaPath =
    points.length > 1
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padTop + innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padTop + innerH).toFixed(1)} Z`
      : '';

  const yTicks = [minVal, Math.round((minVal + maxVal) / 2), maxVal];
  const strokeColor = metric === 'ovr' ? 'var(--t-accent)' : 'var(--t-gold)';

  const awards: string[] = [];
  if (selected.wonChampionship) awards.push('우승');
  if (selected.wonFinalsMvp) awards.push('파이널 MVP');
  if (selected.wonMvp) awards.push('정규시즌 MVP');
  if (selected.wonDpoy) awards.push('수비왕');
  if (selected.wonSixthMan) awards.push('식스맨상');
  if (selected.wonMip) awards.push('기량발전상');
  if (selected.wonRookieOfYear) awards.push('신인왕');
  if (selected.allLeagueTeam) awards.push(`올-리그 ${selected.allLeagueTeam}팀`);
  if (selected.allStarSelected) awards.push('올스타');

  return (
    <div className="space-y-4">
      {/* 지표 토글 헤더 */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-[var(--t-g800)]">
            커리어 시즌별 추이
          </p>
          <p className="text-[12px] text-[var(--t-g500)]">
            각 시즌 지점을 선택하면 상세 성적을 확인할 수 있습니다
          </p>
        </div>
        <div
          role="tablist"
          aria-label="성장 그래프 지표 선택"
          className="inline-flex p-1 rounded-xl bg-[var(--t-g100)] shrink-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={metric === 'ovr'}
            data-testid="trajectory-metric-ovr"
            onClick={() => setMetric('ovr')}
            className={`min-h-[36px] px-3 rounded-lg text-[12px] font-bold whitespace-nowrap cursor-pointer transition-colors ${
              metric === 'ovr'
                ? 'bg-[var(--t-card)] text-[var(--t-g900)] shadow-xs'
                : 'text-[var(--t-g500)] hover:text-[var(--t-g800)]'
            }`}
          >
            OVR
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={metric === 'ppg'}
            data-testid="trajectory-metric-ppg"
            onClick={() => setMetric('ppg')}
            className={`min-h-[36px] px-3 rounded-lg text-[12px] font-bold whitespace-nowrap cursor-pointer transition-colors ${
              metric === 'ppg'
                ? 'bg-[var(--t-card)] text-[var(--t-g900)] shadow-xs'
                : 'text-[var(--t-g500)] hover:text-[var(--t-g800)]'
            }`}
          >
            평균 득점
          </button>
        </div>
      </div>

      {/* SVG 반응형 라인 차트 */}
      <div className="w-full rounded-2xl bg-[var(--t-g50)] border border-[var(--t-g100)] p-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto block select-none"
          role="img"
          aria-label={`시즌별 ${metric === 'ovr' ? 'OVR' : '평균 득점'} 추이 그래프`}
        >
          <defs>
            <linearGradient id={`traj-grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.22" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* 수평 가이드선 */}
          {yTicks.map((tick) => {
            const y = padTop + innerH - ((tick - minVal) / span) * innerH;
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="var(--t-g200)"
                  strokeWidth="1"
                  strokeDasharray={tick === minVal ? undefined : '3 4'}
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="var(--t-g500)"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* 면적 및 곡선 */}
          {areaPath && (
            <path d={areaPath} fill={`url(#traj-grad-${metric})`} />
          )}
          <path
            d={linePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 선택 시즌 수직 보조선 */}
          {points[safeIdx] && (
            <line
              x1={points[safeIdx].x}
              y1={padTop}
              x2={points[safeIdx].x}
              y2={padTop + innerH}
              stroke={strokeColor}
              strokeOpacity="0.35"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          )}

          {/* 시즌 포인트 노드 */}
          {points.map((p) => {
            const isSelected = p.idx === safeIdx;
            const isPeak = p.season.seasonNumber === peakSeasonNumber;
            const showXLabel =
              p.idx === 0 ||
              p.idx === points.length - 1 ||
              isSelected ||
              (points.length <= 8) ||
              p.idx % Math.ceil(points.length / 5) === 0;

            return (
              <g
                key={p.season.seasonNumber}
                className="cursor-pointer"
                onClick={() => setSelectedIdx(p.idx)}
              >
                {/* 터치 영역 확장 투명 원 */}
                <circle cx={p.x} cy={p.y} r="14" fill="transparent" />
                {isPeak && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="8"
                    fill="none"
                    stroke="var(--t-gold)"
                    strokeWidth="1.5"
                    strokeOpacity="0.8"
                  />
                )}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isSelected ? 5.5 : isPeak ? 4.2 : 3.2}
                  fill={isSelected ? strokeColor : 'var(--t-card)'}
                  stroke={isPeak && !isSelected ? 'var(--t-gold)' : strokeColor}
                  strokeWidth={isSelected ? 2.5 : 2}
                />
                {showXLabel && (
                  <text
                    x={p.x}
                    y={height - 10}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight={isSelected ? '700' : '500'}
                    fill={isSelected ? 'var(--t-g900)' : 'var(--t-g500)'}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {p.season.year}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* 선택 시즌 인스펙터 */}
      <div
        data-testid="trajectory-season-inspector"
        className="pt-3 border-t border-[var(--t-g100)] space-y-2"
      >
        <div className="flex items-baseline justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[14px] font-bold text-[var(--t-g900)] tabular-nums">
              {selected.year} 시즌 · {selected.teamName}
            </span>
            <p className="text-[12px] text-[var(--t-g500)] tabular-nums">
              {selected.leagueShortName} · 만 {selected.age}세 · OVR {selected.ovr} ·{' '}
              {selected.wins}승 {selected.losses}패 ({selected.playoffResult})
            </p>
          </div>
          <span className="text-[13px] font-bold text-[var(--t-accent-ink)] tabular-nums shrink-0">
            {metric === 'ovr'
              ? `OVR ${selected.ovr}`
              : `${selected.ppg.toFixed(1)} PPG`}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2 pt-1 text-center tabular-nums">
          <div>
            <span className="block text-[15px] font-bold text-[var(--t-g900)]">
              {selected.ppg.toFixed(1)}
            </span>
            <span className="text-[11px] text-[var(--t-g500)]">PPG</span>
          </div>
          <div>
            <span className="block text-[15px] font-bold text-[var(--t-g900)]">
              {selected.rpg.toFixed(1)}
            </span>
            <span className="text-[11px] text-[var(--t-g500)]">RPG</span>
          </div>
          <div>
            <span className="block text-[15px] font-bold text-[var(--t-g900)]">
              {selected.apg.toFixed(1)}
            </span>
            <span className="text-[11px] text-[var(--t-g500)]">APG</span>
          </div>
          <div>
            <span className="block text-[15px] font-bold text-[var(--t-g900)]">
              {selected.fgPct.toFixed(1)}%
            </span>
            <span className="text-[11px] text-[var(--t-g500)]">FG%</span>
          </div>
        </div>

        {awards.length > 0 && (
          <p className="text-[12px] font-semibold text-[var(--t-gold)] pt-1">
            주요 수상 · {awards.join(' · ')}
          </p>
        )}
      </div>
    </div>
  );
}
