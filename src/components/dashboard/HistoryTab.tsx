'use client';

import React, { useState } from 'react';
import { LEAGUE_CONFIG } from '../../data/leagues';
import { getLeagueRecordChases } from '../../engine/recordBookEngine';
import { getAwardsByLeague } from '../../engine/seasonSimulator';
import { useCareerStore } from '../../store/useCareerStore';
import {
  InternationalTournamentRecord,
  LeagueId,
  SeasonBoxScore,
} from '../../types/game';
import { formatCurrencyCompact } from '../../utils/formatters';

function getIntlResultLabel(result: InternationalTournamentRecord['result']): string {
  if (result === 'GOLD') return '금메달';
  if (result === 'SILVER') return '은메달';
  if (result === 'BRONZE') return '동메달';
  if (result === 'FOURTH') return '4위';
  if (result === 'QUARTERFINAL') return '8강';
  return '조별리그';
}

const RECORD_LEAGUES: LeagueId[] = [
  'NBA',
  'KBL',
  'EUROLEAGUE',
  'NBL',
  'B_LEAGUE',
  'NCAA',
  'U_LEAGUE',
  'GLEAGUE',
  'HIGH_SCHOOL',
  'US_HIGH_SCHOOL',
];

function formatAwardsClean(log: SeasonBoxScore): string[] {
  const badges: string[] = [];
  if (log.wonChampionship) badges.push('우승');
  if (log.wonFinalsMvp) badges.push('파이널 MVP');
  if (log.wonMvp) badges.push('MVP');
  if (log.wonDpoy) badges.push('DPOY');
  if (log.wonSixthMan) badges.push('식스맨상');
  if (log.wonMip) badges.push('MIP');
  if (log.wonRookieOfYear) badges.push('신인왕');
  if (log.allLeagueTeam === 1) badges.push('퍼스트팀');
  else if (log.allLeagueTeam === 2) badges.push('세컨드팀');
  else if (log.allLeagueTeam === 3) badges.push('서드팀');
  if (log.allStarSelected) badges.push('올스타');
  return badges;
}

export function HistoryTab() {
  const career = useCareerStore((s) => s.career);
  const recordBook = useCareerStore((s) => s.recordBook);
  const [timelineTab, setTimelineTab] = useState<
    'SEASONS' | 'MILESTONES' | 'RECORDS'
  >('SEASONS');
  const [selectedRecordLeague, setSelectedRecordLeague] =
    useState<LeagueId | null>(null);

  if (!career) return null;

  const { seasonLogs, milestones, totals, careerHighs, rivals } = career;
  const leagueSummaries = getAwardsByLeague(seasonLogs);
  const activeRecordLeague = selectedRecordLeague || career.league;
  const recordChases = getLeagueRecordChases(
    recordBook,
    career,
    activeRecordLeague
  );

  const avgPpg = totals.gp > 0 ? (totals.points / totals.gp).toFixed(1) : '0.0';
  const avgRpg = totals.gp > 0 ? (totals.rebounds / totals.gp).toFixed(1) : '0.0';
  const avgApg = totals.gp > 0 ? (totals.assists / totals.gp).toFixed(1) : '0.0';

  return (
    <div className="space-y-3">
      {/* 1. 통산 누적 요약 */}
      <section className="t-card space-y-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[17px] font-bold tracking-[-0.02em] text-[var(--t-g900)]">
            통산 기록
          </h2>
          <span className="text-[12px] text-[var(--t-g500)] tabular-nums">
            최다 득점 {careerHighs.points}점
          </span>
        </div>

        {/* 오픈 4열 핵심 누적 스트립 */}
        <div className="grid grid-cols-4 pt-3 border-t border-[var(--t-g100)] text-center gap-1 tabular-nums">
          <div>
            <span className="block text-[18px] font-bold text-[var(--t-g900)]">
              {totals.points.toLocaleString()}
            </span>
            <span className="text-[11px] text-[var(--t-g500)]">통산 득점</span>
          </div>
          <div>
            <span className="block text-[18px] font-bold text-[var(--t-gold)]">
              {totals.championships}
            </span>
            <span className="text-[11px] text-[var(--t-g500)]">우승</span>
          </div>
          <div>
            <span className="block text-[18px] font-bold text-[var(--t-accent)]">
              {totals.mvps}
            </span>
            <span className="text-[11px] text-[var(--t-g500)]">MVP</span>
          </div>
          <div>
            <span className="block text-[18px] font-bold text-[var(--t-g900)]">
              {formatCurrencyCompact(career.careerEarnings || 0)}
            </span>
            <span className="text-[11px] text-[var(--t-g500)]">통산 연봉</span>
          </div>
        </div>

        {/* 평균 키-밸류 */}
        <div className="divide-y divide-[var(--t-g100)] border-t border-[var(--t-g100)] text-[14px]">
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-[var(--t-g600)]">통산 평균</span>
            <span className="font-bold text-[var(--t-g900)] tabular-nums">
              {avgPpg}득점 · {avgRpg}리바 · {avgApg}도움 ({totals.gp}G)
            </span>
          </div>
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-[var(--t-g600)]">주요 수상</span>
            <span className="font-semibold text-[var(--t-g800)] tabular-nums">
              파이널 MVP {totals.finalsMvps || 0} · 올스타 {totals.allStars}
            </span>
          </div>
          {leagueSummaries.map((ls) => (
            <div
              key={ls.league}
              className="py-2.5 flex items-center justify-between gap-2 text-[13px]"
            >
              <span className="font-semibold text-[var(--t-g700)]">
                {ls.leagueName} ({ls.seasons}시즌)
              </span>
              <span className="text-[var(--t-g600)] tabular-nums text-right">
                {ls.points.toLocaleString()}득점
                {ls.championships > 0 ? ` · 우승 ${ls.championships}` : ''}
                {ls.mvps > 0 ? ` · MVP ${ls.mvps}` : ''}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 1.5 국가대표 국제대회 이력 */}
      {((career.internationalHistory && career.internationalHistory.length > 0) ||
        career.nationalTeamRetired) && (
        <section
          data-testid="international-history-section"
          className="t-card space-y-3"
        >
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-[17px] font-bold tracking-[-0.02em] text-[var(--t-g900)]">
              국가대표 국제대회 기록
            </h2>
            <span className="text-[12px] font-semibold text-[var(--t-g500)] tabular-nums">
              {career.nationalTeamRetired
                ? `${career.nationalTeamRetiredYear ?? career.seasonYear}년 은퇴 · `
                : ''}
              A매치 {totals.internationalCaps || 0}G · 금 {totals.internationalMedals?.gold || 0} · 은{' '}
              {totals.internationalMedals?.silver || 0} · 동{' '}
              {totals.internationalMedals?.bronze || 0}
            </span>
          </div>

          {career.internationalHistory && career.internationalHistory.length > 0 ? (
            <div className="divide-y divide-[var(--t-g100)]">
              {career.internationalHistory.map((rec) => {
                const isGold = rec.result === 'GOLD';
                const isMedal =
                  rec.result === 'GOLD' ||
                  rec.result === 'SILVER' ||
                  rec.result === 'BRONZE';
                return (
                  <div key={rec.id} className="py-2.5 first:pt-0 last:pb-0 space-y-0.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[14px] font-bold text-[var(--t-g900)] truncate">
                        {rec.year} {rec.tournamentName}
                      </span>
                      <span
                        className={`text-[13px] font-bold shrink-0 ${
                          isGold
                            ? 'text-[var(--t-gold)]'
                            : isMedal
                            ? 'text-[var(--t-accent-ink)]'
                            : 'text-[var(--t-g500)]'
                        }`}
                      >
                        {getIntlResultLabel(rec.result)}
                        {rec.wonMvp ? ' · MVP' : ''}
                      </span>
                    </div>
                    <p className="text-[12px] text-[var(--t-g500)] tabular-nums">
                      평균 {rec.avgPts.toFixed(1)}점 · {rec.avgReb.toFixed(1)}리바 ·{' '}
                      {rec.avgAst.toFixed(1)}도움 ({rec.matches.length}경기)
                      {rec.grantedMilitaryExemption ? ' · 병역 특례' : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[13px] text-[var(--t-g500)] leading-relaxed">
              {career.nationalTeamRetirementNote ||
                `만 ${career.nationalTeamRetiredAge ?? career.age}세에 국가대표 은퇴를 선언했습니다.`}
            </p>
          )}
        </section>
      )}

      {/* 2. 드래프트 동기 라이벌 */}
      {rivals && rivals.length > 0 && (
        <section className="t-card space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[17px] font-bold tracking-[-0.02em] text-[var(--t-g900)]">
              동기 라이벌
            </h2>
            <span className="text-[12px] text-[var(--t-g500)] tabular-nums">
              {rivals.length}명
            </span>
          </div>

          <div className="divide-y divide-[var(--t-g100)]">
            {rivals.map((rv) => (
              <div key={rv.id} className="py-3 first:pt-1 last:pb-1 space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[15px] font-bold text-[var(--t-g900)]">
                    {rv.name}{' '}
                    <span className="text-[12px] font-medium text-[var(--t-g500)]">
                      {rv.pos} · {rv.teamName}
                    </span>
                  </span>
                  <span className="text-[13px] font-bold text-[var(--t-accent)] tabular-nums shrink-0">
                    OVR {rv.ovr}
                  </span>
                </div>
                <p className="text-[12px] text-[var(--t-g600)] tabular-nums">
                  {rv.ppg}득점 {rv.rpg}리바 {rv.apg}도움 · 우승 {rv.championships} · MVP {rv.mvps}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. 시즌별 기록 · 연대기 · 역대 기록실 */}
      <section className="t-card space-y-4">
        <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-[var(--t-g100)] text-[13px] font-semibold">
          <button
            type="button"
            onClick={() => setTimelineTab('SEASONS')}
            className={`min-h-[40px] rounded-xl transition cursor-pointer ${
              timelineTab === 'SEASONS'
                ? 'bg-[var(--t-card)] text-[var(--t-g900)]'
                : 'text-[var(--t-g500)]'
            }`}
          >
            시즌 ({seasonLogs.length})
          </button>
          <button
            type="button"
            onClick={() => setTimelineTab('MILESTONES')}
            className={`min-h-[40px] rounded-xl transition cursor-pointer ${
              timelineTab === 'MILESTONES'
                ? 'bg-[var(--t-card)] text-[var(--t-g900)]'
                : 'text-[var(--t-g500)]'
            }`}
          >
            연대기 ({milestones.length})
          </button>
          <button
            type="button"
            data-testid="history-records-tab"
            onClick={() => setTimelineTab('RECORDS')}
            className={`min-h-[40px] rounded-xl transition cursor-pointer ${
              timelineTab === 'RECORDS'
                ? 'bg-[var(--t-card)] text-[var(--t-g900)]'
                : 'text-[var(--t-g500)]'
            }`}
          >
            역대 기록실
          </button>
        </div>

        {timelineTab === 'SEASONS' ? (
          seasonLogs.length === 0 ? (
            <p className="text-[14px] text-[var(--t-g500)] py-8 text-center">
              완료된 시즌 기록이 없습니다.
            </p>
          ) : (
            <div className="relative pl-5 space-y-5 before:content-[''] before:absolute before:left-[5px] before:top-2 before:bottom-2 before:w-[2px] before:bg-[var(--t-g100)]">
              {seasonLogs
                .slice()
                .reverse()
                .map((log: SeasonBoxScore) => {
                  const awards = formatAwardsClean(log);
                  const isHighlight = log.wonChampionship || log.wonMvp;
                  return (
                    <div key={log.seasonNumber} className="relative space-y-1.5">
                      <span
                        className={`absolute -left-5 top-1.5 w-[12px] h-[12px] rounded-full border-2 border-[var(--t-card)] ${
                          isHighlight
                            ? 'bg-[var(--t-gold)]'
                            : 'bg-[var(--t-accent)]'
                        }`}
                      />

                      <div className="flex items-baseline justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[12px] font-bold text-[var(--t-g500)] tabular-nums">
                            {log.year} · 만 {log.age}세 ·{' '}
                            {LEAGUE_CONFIG[log.league]?.shortName || log.league}
                          </span>
                          <div className="text-[15px] font-bold text-[var(--t-g900)] truncate">
                            {log.teamName}
                          </div>
                        </div>
                        <span className="text-[13px] font-bold text-[var(--t-accent)] tabular-nums shrink-0">
                          OVR {log.ovr}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] font-semibold text-[var(--t-g800)] tabular-nums">
                        <span>{log.ppg.toFixed(1)} PPG</span>
                        <span>{log.rpg.toFixed(1)} RPG</span>
                        <span>{log.apg.toFixed(1)} APG</span>
                        <span className="text-[var(--t-g500)] font-medium">
                          FG {log.fgPct.toFixed(1)}%
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-[var(--t-g500)] tabular-nums">
                        <span>
                          {log.wins}승 {log.losses}패 · {log.playoffResult || '-'}
                        </span>
                        {awards.length > 0 && (
                          <span className="font-bold text-[var(--t-gold)]">
                            · {awards.join(' · ')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )
        ) : timelineTab === 'MILESTONES' ? (
          <div className="relative pl-5 space-y-4 before:content-[''] before:absolute before:left-[5px] before:top-2 before:bottom-2 before:w-[2px] before:bg-[var(--t-g100)]">
            {milestones
              .slice()
              .reverse()
              .map((m) => (
                <div key={m.id} className="relative space-y-0.5">
                  <span className="absolute -left-5 top-1.5 w-[10px] h-[10px] rounded-full bg-[var(--t-g400)] border-2 border-[var(--t-card)]" />
                  <div className="text-[12px] font-semibold text-[var(--t-g500)] tabular-nums">
                    {m.year} · 만 {m.age}세 · {m.teamName}
                  </div>
                  <div className="text-[14px] font-bold text-[var(--t-g900)]">
                    {m.title}
                  </div>
                  <p className="text-[13px] text-[var(--t-g600)] leading-snug">
                    {m.description}
                  </p>
                </div>
              ))}
          </div>
        ) : (
          <div className="space-y-4">
            {/* 리그 필터 바 */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {RECORD_LEAGUES.map((lg) => {
                const selected = activeRecordLeague === lg;
                return (
                  <button
                    key={lg}
                    type="button"
                    onClick={() => setSelectedRecordLeague(lg)}
                    className={`min-h-[36px] px-3 rounded-xl text-[12px] font-bold whitespace-nowrap shrink-0 cursor-pointer t-tap ${
                      selected
                        ? 'bg-[var(--t-g900)] text-[var(--t-card)]'
                        : 'bg-[var(--t-g100)] text-[var(--t-g600)]'
                    }`}
                  >
                    {LEAGUE_CONFIG[lg].shortName}
                  </button>
                );
              })}
            </div>

            <div className="divide-y divide-[var(--t-g100)]">
              {recordChases.map(({ entry, currentValue, progressPct, isAlreadyHolder }) => {
                const isInt = entry.unit === '점' || entry.unit === '회';
                const formattedTarget = isInt
                  ? `${entry.value.toLocaleString()}${entry.unit}`
                  : `${entry.value.toFixed(1)} ${entry.unit}`;
                const formattedCurr = isInt
                  ? `${currentValue.toLocaleString()}${entry.unit}`
                  : `${currentValue.toFixed(1)} ${entry.unit}`;

                return (
                  <div key={entry.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[14px] font-bold text-[var(--t-g900)]">
                        {entry.label}
                      </span>
                      <span
                        className={`text-[15px] font-bold tabular-nums shrink-0 ${
                          entry.isUserRecord
                            ? 'text-[var(--t-accent)]'
                            : 'text-[var(--t-g900)]'
                        }`}
                      >
                        {formattedTarget}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[12px] text-[var(--t-g500)]">
                      <span className="truncate">
                        {entry.isUserRecord && (
                          <span className="font-bold text-[var(--t-accent-ink)] mr-1">
                            신기록
                          </span>
                        )}
                        {entry.holderName} · {entry.teamName} ({entry.year})
                      </span>
                      {currentValue > 0 && !isAlreadyHolder && (
                        <span className="tabular-nums shrink-0 font-semibold text-[var(--t-g700)]">
                          내 기록 {formattedCurr}
                        </span>
                      )}
                    </div>

                    {currentValue > 0 && (
                      <div className="w-full h-1.5 rounded-full bg-[var(--t-g100)] overflow-hidden">
                        <div
                          style={{ width: `${progressPct}%` }}
                          className={`h-full rounded-full ${
                            isAlreadyHolder
                              ? 'bg-[var(--t-gold)]'
                              : 'bg-[var(--t-accent)]'
                          }`}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
