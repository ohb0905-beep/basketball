'use client';

import React from 'react';
import type {
  CreationFunnelReport,
  FunnelStep,
  SurveyQuestionResult,
  StorageReport,
  SurveyReport,
  VersionCompareRow,
} from '../../lib/adminAnalytics';
import { EmptyText, RateText, formatPercentText } from './AdminAnalyticsSections';

/** 이 표본보다 적으면 "참고용" 표시 */
const SMALL_SAMPLE = 20;

function formatNum(value: number | null, digits = 1): string {
  return value === null || !Number.isFinite(value) ? '-' : value.toFixed(digits);
}

function SmallSampleTag({ n }: { n: number }) {
  if (n >= SMALL_SAMPLE) return null;
  return (
    <span className="ml-1.5 px-1.5 py-0.5 rounded-md bg-[var(--t-g100)] text-[10.5px] font-medium text-[var(--t-g500)] whitespace-nowrap">
      표본 적음
    </span>
  );
}

// ============================================================================
// 🧭 생성 → 드래프트 퍼널
// ============================================================================

function FunnelStepList({ steps, unit, barClass }: { steps: FunnelStep[]; unit: string; barClass: string }) {
  return (
    <ol className="space-y-2.5">
      {steps.map((step, i) => (
        <li key={step.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-[13px]">
            <span className="font-semibold text-[var(--t-g800)] truncate">
              <span className="text-[var(--t-g400)] tabular-nums mr-1.5">{i + 1}</span>
              {step.label}
            </span>
            <span className="text-[12px] font-semibold text-[var(--t-g700)] tabular-nums whitespace-nowrap shrink-0">
              {step.count.toLocaleString()}
              {unit}
              {i > 0 && (
                <span className="ml-1 font-normal text-[var(--t-g500)]">
                  (앞 단계의 {formatPercentText(step.percentOfPrev)})
                </span>
              )}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-[var(--t-g100)] overflow-hidden">
            <div
              className={`h-full rounded-full ${barClass}`}
              style={{ width: `${Math.min(100, Math.max(step.percentOfStart ?? 0, step.count > 0 ? 2 : 0))}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

export function CreationFunnelCard({ funnel }: { funnel: CreationFunnelReport }) {
  const runs = funnel.runSteps[0]?.count ?? 0;
  const started = funnel.sessionSteps[0]?.count ?? 0;
  if (runs === 0 && started === 0) {
    return <EmptyText>1.0.1 이후 생성 화면 진입 기록이 아직 없습니다.</EmptyText>;
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h3 className="text-[13px] font-bold text-[var(--t-g800)]">세션 기준</h3>
        <FunnelStepList steps={funnel.sessionSteps} unit="세션" barClass="bg-[var(--t-accent)]" />
      </div>

      <div className="space-y-2">
        <h3 className="text-[13px] font-bold text-[var(--t-g800)]">
          커리어 기준
          <span className="ml-1.5 text-[11px] font-normal text-[var(--t-g500)]">
            진행 중인 커리어도 모수에 들어가서 뒤 단계일수록 낮게 나옵니다
          </span>
        </h3>
        <FunnelStepList steps={funnel.runSteps} unit="커리어" barClass="bg-[var(--t-ok)]" />
        <p className="text-[12px] text-[var(--t-g500)] tabular-nums">
          중도 초기화: {formatPercentText(funnel.resetRuns.percent)} ({funnel.resetRuns.count}/
          {funnel.resetRuns.n})
        </p>
      </div>

      {funnel.draftOutcomes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[13px] font-bold text-[var(--t-g800)]">드래프트 결과</h3>
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-y border-[var(--t-g100)] bg-[var(--t-g50)] text-[12px] font-bold text-[var(--t-g500)]">
                  <th className="py-2 pl-5 pr-3">결과</th>
                  <th className="py-2 px-3 text-right">건수</th>
                  <th className="py-2 px-3 text-right">평균 OVR</th>
                  <th className="py-2 px-3 text-right">평균 순번</th>
                  <th className="py-2 pl-3 pr-5 text-right">투웨이 제안</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--t-g100)]">
                {funnel.draftOutcomes.map((row) => (
                  <tr key={row.key}>
                    <td className="py-2 pl-5 pr-3 font-semibold text-[var(--t-g900)] whitespace-nowrap">{row.label}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{row.count.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{formatNum(row.ovrAvg)}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{formatNum(row.pickAvg)}</td>
                    <td className="py-2 pl-3 pr-5 text-right tabular-nums">{row.twoWay.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 🗳️ 난이도 설문 결과
// ============================================================================

/** 1점(쉬움·지루함) 파랑 → 3점 회색 → 5점(어려움·빠름) 빨강 */
const SCORE_COLORS = [
  'bg-[var(--t-down)]',
  'bg-[var(--t-down)] opacity-50',
  'bg-[var(--t-g400)]',
  'bg-[var(--t-up)] opacity-50',
  'bg-[var(--t-up)]',
];

function ScoreBar({ dist }: { dist: number[] }) {
  const total = dist.reduce((a, b) => a + b, 0);
  if (total === 0) return <div className="h-3 w-full rounded-full bg-[var(--t-g100)]" />;
  return (
    <div className="flex h-3 w-full rounded-full overflow-hidden bg-[var(--t-g100)]">
      {dist.map((count, i) =>
        count > 0 ? (
          <div
            key={i}
            className={SCORE_COLORS[i]}
            style={{ width: `${(count / total) * 100}%` }}
            title={`${i + 1}점: ${count}명`}
          />
        ) : null
      )}
    </div>
  );
}

function SurveyQuestionRow({ q }: { q: SurveyQuestionResult }) {
  return (
    <li className="space-y-1.5 py-3 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13px] font-bold text-[var(--t-g900)]">
          {q.title}
          <SmallSampleTag n={q.n} />
        </span>
        <span className="text-[12px] text-[var(--t-g600)] tabular-nums whitespace-nowrap">
          평균 <b className="text-[14px] text-[var(--t-g900)]">{formatNum(q.avg, 2)}</b> / 5 · {q.n}명
        </span>
      </div>
      <ScoreBar dist={q.dist} />
      <div className="flex justify-between text-[11px] text-[var(--t-g500)]">
        <span>1 {q.lowLabel}</span>
        <span>{q.highLabel} 5</span>
      </div>
      <p className="text-[11px] text-[var(--t-g500)] tabular-nums">
        {q.dist.map((c, i) => `${i + 1}점 ${c}명`).join(' · ')}
      </p>
      {q.experiencedLabel && q.n > 0 && (
        <p className="text-[12px] text-[var(--t-g600)] tabular-nums">
          {q.experiencedLabel} {formatNum(q.expAvg, 2)} ({q.expN}명) · 못 겪은 사람 {formatNum(q.noExpAvg, 2)} (
          {q.noExpN}명)
        </p>
      )}
    </li>
  );
}

export function SurveyResultsCard({ survey }: { survey: SurveyReport }) {
  if (survey.total === 0) {
    return <EmptyText>아직 설문 응답이 없습니다. (1.1.2부터 은퇴 화면에서 1인 1회)</EmptyText>;
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { label: '설문 노출', value: `${survey.total.toLocaleString()}명` },
          { label: '응답', value: `${survey.submitted.toLocaleString()}명` },
          { label: '응답률', value: formatPercentText(survey.responseRate) },
          { label: '의견 글', value: `${survey.withComment.toLocaleString()}건` },
        ].map((item) => (
          <div key={item.label} className="rounded-xl bg-[var(--t-g50)] px-3 py-2.5">
            <p className="text-[11px] text-[var(--t-g500)]">{item.label}</p>
            <p className="text-[16px] font-bold text-[var(--t-g900)] tabular-nums">{item.value}</p>
          </div>
        ))}
      </div>
      {survey.submitted === 0 ? (
        <EmptyText>응답을 제출한 사람이 아직 없습니다 (모두 건너뜀).</EmptyText>
      ) : (
        <ul className="divide-y divide-[var(--t-g100)]">
          {survey.questions.map((q) => (
            <SurveyQuestionRow key={q.key} q={q} />
          ))}
        </ul>
      )}
      <p className="text-[11.5px] text-[var(--t-g500)] leading-relaxed">
        3점이 &quot;적당함&quot;입니다. 의견 글은 피드백함에서 &quot;[설문]&quot; 제목으로 볼 수 있습니다.
      </p>
    </div>
  );
}

// ============================================================================
// 🆚 버전별 비교
// ============================================================================

export function VersionCompareTable({ rows }: { rows: VersionCompareRow[] }) {
  if (rows.length === 0) {
    return <EmptyText>비교할 버전 데이터가 아직 없습니다.</EmptyText>;
  }
  const cols = [
    '플레이어',
    '커리어',
    'NBA 도달',
    '완주',
    '초기화',
    '평균 커리어',
    'NBA 시즌',
    'NBA 우승',
    'NBA MVP',
    'NBA PO',
    '명예의 전당',
  ];
  return (
    <div className="-mx-5 overflow-x-auto" data-testid="version-compare-table">
      <table className="w-full min-w-[960px] text-left border-collapse text-[13px]">
        <thead>
          <tr className="border-y border-[var(--t-g100)] bg-[var(--t-g50)] text-[12px] font-bold text-[var(--t-g500)]">
            <th className="py-2.5 pl-5 pr-3 whitespace-nowrap sticky left-0 bg-[var(--t-g50)]">버전</th>
            {cols.map((c, i) => (
              <th key={c} className={`py-2.5 text-right whitespace-nowrap ${i === cols.length - 1 ? 'pl-3 pr-5' : 'px-3'}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--t-g100)]">
          {rows.map((row) => (
            <tr key={row.version} className={row.isPreview ? 'text-[var(--t-g500)]' : ''}>
              <td className="py-2.5 pl-5 pr-3 font-semibold text-[var(--t-g900)] whitespace-nowrap sticky left-0 bg-[var(--t-card)]">
                {row.label}
                <SmallSampleTag n={row.runs} />
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums">{row.players.toLocaleString()}</td>
              <td className="py-2.5 px-3 text-right tabular-nums">{row.runs.toLocaleString()}</td>
              <td className="py-2.5 px-3 text-right"><RateText cell={row.nbaReach} emphasize /></td>
              <td className="py-2.5 px-3 text-right"><RateText cell={row.completion} /></td>
              <td className="py-2.5 px-3 text-right"><RateText cell={row.resetRate} /></td>
              <td className="py-2.5 px-3 text-right tabular-nums">
                {row.careerSeasonsAvg === null ? '-' : `${formatNum(row.careerSeasonsAvg)}시즌`}
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums">{row.nbaSeasons.toLocaleString()}</td>
              <td className="py-2.5 px-3 text-right"><RateText cell={row.nbaChampionship} emphasize /></td>
              <td className="py-2.5 px-3 text-right"><RateText cell={row.nbaMvp} /></td>
              <td className="py-2.5 px-3 text-right"><RateText cell={row.nbaPlayoffs} /></td>
              <td className="py-2.5 pl-3 pr-5 text-right"><RateText cell={row.hallOfFame} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// 💾 DB 용량 · 매일 정리 상태
// ============================================================================

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0MB';
  const mb = bytes / (1024 * 1024);
  return mb >= 100 ? `${Math.round(mb)}MB` : `${mb.toFixed(1)}MB`;
}

function formatKstDateTime(iso: string): string {
  const d = new Date(Date.parse(iso) + 9 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

const LEVEL_STYLE: Record<StorageReport['level'], { box: string; bar: string; label: string }> = {
  ok: { box: 'border-[var(--t-g200)] bg-[var(--t-card)]', bar: 'bg-[var(--t-ok)]', label: '여유 있음' },
  warn: { box: 'border-[var(--t-gold)] bg-[var(--t-gold-soft)]', bar: 'bg-[var(--t-gold)]', label: '300MB 넘음' },
  danger: { box: 'border-[var(--t-up)] bg-[var(--t-up-soft)]', bar: 'bg-[var(--t-up)]', label: '400MB 넘음, 한도 임박' },
};

export function StorageStatusCard({ storage }: { storage: StorageReport }) {
  if (!storage.available) {
    return (
      <section
        data-testid="analytics-storage-setup"
        className="rounded-[20px] border border-[var(--t-gold)] bg-[var(--t-gold-soft)] p-4 text-[13px] text-[var(--t-g800)] leading-relaxed"
      >
        DB 용량 경보와 원본 14일 보관을 켜려면 Supabase SQL 편집기에서
        <code className="mx-1 px-1 rounded bg-[var(--t-card)]">supabase/migrations/20261126_analytics_capacity.sql</code>
        과
        <code className="mx-1 px-1 rounded bg-[var(--t-card)]">20261126_analytics_capacity_cron.sql</code>
        을 차례로 실행해 주세요.
      </section>
    );
  }

  const style = LEVEL_STYLE[storage.level];
  const m = storage.maintenance;
  const width = Math.min(100, Math.max(storage.usedPercent ?? 0, storage.dbBytes > 0 ? 1 : 0));

  return (
    <section
      aria-label="DB 용량"
      data-testid="analytics-storage"
      data-level={storage.level}
      className={`rounded-[20px] border p-4 space-y-3 ${style.box}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[14px] font-bold text-[var(--t-g900)]">💾 DB 용량</h2>
        <p className="text-[12px] font-semibold text-[var(--t-g700)] tabular-nums">
          {formatBytes(storage.dbBytes)} / {formatBytes(storage.limitBytes)} ({formatPercentText(storage.usedPercent)}) · {style.label}
        </p>
      </div>
      <div className="h-2 w-full rounded-full bg-[var(--t-g100)] overflow-hidden">
        <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${width}%` }} />
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[12px] text-[var(--t-g700)]">
        <div className="min-w-0">
          <dt className="text-[var(--t-g500)]">원본 통계</dt>
          <dd className="font-semibold tabular-nums">
            {formatBytes(storage.eventsBytes)} · {storage.eventsRetained.toLocaleString()}행
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[var(--t-g500)]">최근 24시간 증가</dt>
          <dd className="font-semibold tabular-nums">
            {storage.eventsLast24h.toLocaleString()}행
            {storage.dailyGrowthBytes !== null && ` (약 ${formatBytes(storage.dailyGrowthBytes)})`}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[var(--t-g500)]">매일 정리 (04:00 KST)</dt>
          <dd className={`font-semibold tabular-nums ${m.stale ? 'text-[var(--t-up)]' : ''}`}>
            {m.ranAt
              ? `${formatKstDateTime(m.ranAt)} · ${(m.eventsDeleted ?? 0).toLocaleString()}행 정리`
              : '아직 한 번도 안 돌았어요'}
          </dd>
        </div>
      </dl>
      {m.stale && (
        <p data-testid="analytics-storage-stale" className="text-[12px] font-semibold text-[var(--t-up)] leading-relaxed">
          {m.ranAt
            ? `마지막 정리가 ${m.hoursAgo}시간 전이에요. Supabase의 Integrations → Cron에서 analytics-daily-maintenance 작업을 확인해 주세요.`
            : '정리 예약(20261126_analytics_capacity_cron.sql)을 실행했는지 확인해 주세요. 실행했다면 다음 04:00 KST 이후에 기록이 생겨요.'}
          {storage.daysUntilLimitIfNoCleanup !== null &&
            ` 정리 없이 지금 속도면 약 ${storage.daysUntilLimitIfNoCleanup.toLocaleString()}일 뒤 한도에 닿아요.`}
        </p>
      )}
    </section>
  );
}
