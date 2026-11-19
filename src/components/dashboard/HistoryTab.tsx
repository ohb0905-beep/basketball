'use client';

import React from 'react';
import { Award, History, Trophy, Users } from 'lucide-react';
import { LEAGUE_CONFIG } from '../../data/leagues';
import { getAwardsByLeague } from '../../engine/seasonSimulator';
import { useCareerStore } from '../../store/useCareerStore';
import { SeasonBoxScore } from '../../types/game';

function formatAwardsForSeason(log: SeasonBoxScore): string[] {
  const badges: string[] = [];
  if (log.wonChampionship) badges.push('💍 우승');
  if (log.wonFinalsMvp) badges.push('👑 파이널 MVP');
  if (log.wonMvp) badges.push('🏆 정규 MVP');
  if (log.wonDpoy) badges.push('🛡️ DPOY');
  if (log.wonSixthMan) badges.push('⚡ 식스맨상');
  if (log.wonMip) badges.push('📈 MIP');
  if (log.wonRookieOfYear) badges.push('🌱 신인왕');
  if (log.allLeagueTeam === 1) badges.push('🥇 퍼스트팀');
  else if (log.allLeagueTeam === 2) badges.push('🥈 세컨드팀');
  else if (log.allLeagueTeam === 3) badges.push('🥉 서드팀');
  if (log.allStarSelected) badges.push('⭐ 올스타');
  return badges;
}

export function HistoryTab() {
  const career = useCareerStore((s) => s.career);
  if (!career) return null;

  const { seasonLogs, milestones, totals, careerHighs, rivals } = career;
  const leagueSummaries = getAwardsByLeague(seasonLogs);

  const avgPpg =
    totals.gp > 0 ? (totals.points / totals.gp).toFixed(1) : '0.0';
  const avgRpg =
    totals.gp > 0 ? (totals.rebounds / totals.gp).toFixed(1) : '0.0';
  const avgApg =
    totals.gp > 0 ? (totals.assists / totals.gp).toFixed(1) : '0.0';

  return (
    <div className="space-y-6">
      {/* 1. 통산 누적 기록 & 커리어 하이 요약 */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-extrabold text-slate-900">
              커리어 통산 누적 기록 &amp; 트로피 진열장
            </h3>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            단일 경기 최다득점: {careerHighs.points}점 ({careerHighs.pointsContext})
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { label: '통산 출전', val: `${totals.gp}경기` },
            { label: '통산 득점', val: `${totals.points.toLocaleString()}점 (${avgPpg})` },
            { label: '통산 리바운드', val: `${totals.rebounds.toLocaleString()}개 (${avgRpg})` },
            { label: '통산 어시스트', val: `${totals.assists.toLocaleString()}개 (${avgApg})` },
            { label: '우승 반지', val: `${totals.championships}회 (NBA ${totals.nbaChampionships})` },
            { label: '정규시즌 MVP', val: `${totals.mvps}회 (NBA ${totals.nbaMvps})` },
            { label: '파이널 MVP', val: `${totals.finalsMvps || 0}회` },
            {
              label: '통산 수입',
              val:
                (career.careerEarnings || 0) >= 1_000_000
                  ? `$${((career.careerEarnings || 0) / 1_000_000).toFixed(2)}M`
                  : `$${Math.round((career.careerEarnings || 0) / 1000).toLocaleString()}K`,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center"
            >
              <div className="text-[11px] font-bold text-slate-500">{item.label}</div>
              <div className="text-sm font-black text-slate-900 mt-1 tabular-nums">
                {item.val}
              </div>
            </div>
          ))}
        </div>

        {/* 리그별 분리 수상 내역 */}
        {leagueSummaries.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            {leagueSummaries.map((ls) => (
              <div
                key={ls.league}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-orange-600">
                    {ls.leagueName} ({ls.seasons}시즌 · {ls.gp}G)
                  </span>
                  <span className="text-xs font-bold text-slate-700 tabular-nums">
                    {ls.points.toLocaleString()}점
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  우승 {ls.championships} · MVP {ls.mvps} · FMVP {ls.finalsMvps} · 올스타 {ls.allStars} · 올리그{' '}
                  {ls.allLeague1st + ls.allLeague2nd + ls.allLeague3rd}회
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 2. 동기 라이벌 트래커 */}
      {rivals && rivals.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-extrabold text-slate-900">
              드래프트 동기 라이벌 현황 ({rivals.length}명)
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {rivals.map((rv) => (
              <div
                key={rv.id}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold text-slate-900">
                    {rv.name} ({rv.pos} · OVR {rv.ovr})
                  </span>
                  <span className="text-xs font-bold text-indigo-600">
                    {rv.teamName}
                  </span>
                </div>
                <p className="text-xs text-slate-600 tabular-nums">
                  시즌 평균 {rv.ppg}점 · {rv.rpg}리바운드 · {rv.apg}어시스트 | 우승 {rv.championships}회 · MVP {rv.mvps}회
                </p>
                <p className="text-[11px] text-slate-500">{rv.lastHeadline}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. 연도별 시즌 박스스코어 테이블 */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-orange-600" />
          <h3 className="text-lg font-extrabold text-slate-900">
            시즌별 정규리그 &amp; 포스트시즌 기록 ({seasonLogs.length}시즌)
          </h3>
        </div>

        {seasonLogs.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">
            아직 완료한 시즌 기록이 없어요. [이번 시즌] 탭에서 첫 시즌을 진행해 보세요!
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-bold">
                  <th className="py-2.5 px-2">시즌</th>
                  <th className="py-2.5 px-2">나이</th>
                  <th className="py-2.5 px-2">리그 / 소속팀</th>
                  <th className="py-2.5 px-2 text-right">OVR</th>
                  <th className="py-2.5 px-2 text-right">GP</th>
                  <th className="py-2.5 px-2 text-right">MPG</th>
                  <th className="py-2.5 px-2 text-right">PPG</th>
                  <th className="py-2.5 px-2 text-right">RPG</th>
                  <th className="py-2.5 px-2 text-right">APG</th>
                  <th className="py-2.5 px-2 text-right">FG%</th>
                  <th className="py-2.5 px-2 text-right">3P%</th>
                  <th className="py-2.5 px-2 text-right">팀 성적</th>
                  <th className="py-2.5 px-2">주요 수상</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {seasonLogs.map((log: SeasonBoxScore) => {
                  const awards = formatAwardsForSeason(log);
                  return (
                    <tr key={log.seasonNumber} className="hover:bg-slate-50 text-slate-700">
                      <td className="py-2.5 px-2 font-bold text-slate-900 tabular-nums">
                        {log.year}
                      </td>
                      <td className="py-2.5 px-2 text-slate-500 tabular-nums">
                        만 {log.age}세
                      </td>
                      <td className="py-2.5 px-2">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 mr-1.5">
                          {LEAGUE_CONFIG[log.league]?.shortName || log.league}
                        </span>
                        <span className="font-bold text-slate-900">{log.teamName}</span>
                      </td>
                      <td className="py-2.5 px-2 text-right font-black text-orange-600 tabular-nums">
                        {log.ovr}
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums">{log.gp}</td>
                      <td className="py-2.5 px-2 text-right tabular-nums">
                        {log.mpg.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-black text-slate-900 tabular-nums">
                        {log.ppg.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums">
                        {log.rpg.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums">
                        {log.apg.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums">
                        {log.fgPct.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums">
                        {log.tpPct.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums">
                        {log.wins}승 {log.losses}패 ({log.playoffResult || '-'})
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="flex flex-wrap gap-1">
                          {awards.length > 0 ? (
                            awards.map((aw) => (
                              <span
                                key={aw}
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"
                              >
                                {aw}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 4. 커리어 마일스톤 타임라인 */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-emerald-600" />
          <h3 className="text-lg font-extrabold text-slate-900">
            커리어 연대기 마일스톤 ({milestones.length}건)
          </h3>
        </div>

        <div className="space-y-3">
          {milestones
            .slice()
            .reverse()
            .map((m) => (
              <div
                key={m.id}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-orange-600 tabular-nums">
                      {m.year}시즌 (만 {m.age}세)
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                      {m.teamName}
                    </span>
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-900 mt-1">{m.title}</h4>
                  <p className="text-xs text-slate-600 mt-0.5">{m.description}</p>
                </div>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
