'use client';

import React from 'react';
import { Award, Flame, History, Trophy } from 'lucide-react';
import { useCareerStore } from '../../store/useCareerStore';

export function HistoryTab() {
  const career = useCareerStore((s) => s.career);
  if (!career) return null;

  const gp = Math.max(1, career.totals.gp);
  const careerPpg = (career.totals.points / gp).toFixed(1);
  const careerRpg = (career.totals.rebounds / gp).toFixed(1);
  const careerApg = (career.totals.assists / gp).toFixed(1);

  return (
    <div className="space-y-6">
      {/* 1. 통산 누적 기록 & 커리어하이 요약 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-orange-600" />
            통산 누적 기록 (Career Totals)
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="block text-xs text-slate-500">통산 출전</span>
              <span className="text-xl font-black text-slate-900 tabular-nums">
                {career.totals.gp.toLocaleString()}G
              </span>
              <span className="block text-[11px] text-slate-400 tabular-nums">
                NBA {career.totals.nbaGp}G
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="block text-xs text-slate-500">통산 누적 득점</span>
              <span className="text-xl font-black text-orange-600 tabular-nums">
                {career.totals.points.toLocaleString()}점
              </span>
              <span className="block text-[11px] text-slate-400 tabular-nums">
                평균 {careerPpg}점
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="block text-xs text-slate-500">리바운드 / 도움</span>
              <span className="text-base font-extrabold text-slate-900 tabular-nums">
                {career.totals.rebounds.toLocaleString()} / {career.totals.assists.toLocaleString()}
              </span>
              <span className="block text-[11px] text-slate-400 tabular-nums">
                평균 {careerRpg} / {careerApg}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="block text-xs text-slate-500">우승 / MVP / 올스타</span>
              <span className="text-xl font-black text-amber-600 tabular-nums">
                {career.totals.championships} / {career.totals.mvps} / {career.totals.allStars}
              </span>
              <span className="block text-[11px] text-slate-400 tabular-nums">
                NBA 우승 {career.totals.nbaChampionships}회
              </span>
            </div>
          </div>
        </section>

        {/* 단일 경기 커리어하이 */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-600" />
              단일 경기 커리어하이
            </h2>
            <span className="text-xs text-slate-500 truncate max-w-[180px]">
              {career.careerHighs.pointsContext}
            </span>
          </div>

          <div className="grid grid-cols-5 gap-2 text-center">
            {[
              { label: '최다 득점', val: `${career.careerHighs.points}점`, hi: true },
              { label: '리바운드', val: `${career.careerHighs.rebounds}개` },
              { label: '어시스트', val: `${career.careerHighs.assists}개` },
              { label: '스틸', val: `${career.careerHighs.steals}개` },
              { label: '블록슛', val: `${career.careerHighs.blocks}개` },
            ].map((item, i) => (
              <div
                key={i}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200"
              >
                <span className="block text-[11px] text-slate-500">{item.label}</span>
                <span
                  className={`block text-base font-black mt-1 tabular-nums ${
                    item.hi ? 'text-orange-600' : 'text-slate-900'
                  }`}
                >
                  {item.val}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 2. 연도별 시즌 기록 테이블 */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
          <History className="w-5 h-5 text-orange-600" />
          연도별 시즌 박스스코어 기록표
        </h2>

        {career.seasonLogs.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">
            아직 완료된 시즌 기록이 없어요.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-bold">
                  <th className="py-3 px-2">연도(나이)</th>
                  <th className="py-3 px-2">리그 · 소속팀</th>
                  <th className="py-3 px-2">역할</th>
                  <th className="py-3 px-2 text-right">OVR</th>
                  <th className="py-3 px-2 text-right">GP</th>
                  <th className="py-3 px-2 text-right">MPG</th>
                  <th className="py-3 px-2 text-right text-orange-600">PPG</th>
                  <th className="py-3 px-2 text-right">RPG</th>
                  <th className="py-3 px-2 text-right">APG</th>
                  <th className="py-3 px-2 text-right">FG%</th>
                  <th className="py-3 px-2 text-right">3P%</th>
                  <th className="py-3 px-2">수상/비고</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {career.seasonLogs.map((log) => (
                  <tr key={log.seasonNumber} className="hover:bg-slate-50">
                    <td className="py-3 px-2 font-semibold text-slate-800 whitespace-nowrap">
                      {log.year} ({log.age}세)
                    </td>
                    <td className="py-3 px-2 font-bold text-slate-900 whitespace-nowrap">
                      {log.leagueName} · {log.teamShortName}
                    </td>
                    <td className="py-3 px-2 text-slate-600 whitespace-nowrap">
                      {log.role}
                    </td>
                    <td className="py-3 px-2 text-right font-bold text-slate-900">
                      {log.ovr}
                    </td>
                    <td className="py-3 px-2 text-right text-slate-700">{log.gp}</td>
                    <td className="py-3 px-2 text-right text-slate-700">
                      {log.mpg.toFixed(1)}
                    </td>
                    <td className="py-3 px-2 text-right font-extrabold text-orange-600">
                      {log.ppg.toFixed(1)}
                    </td>
                    <td className="py-3 px-2 text-right text-slate-700">
                      {log.rpg.toFixed(1)}
                    </td>
                    <td className="py-3 px-2 text-right text-slate-700">
                      {log.apg.toFixed(1)}
                    </td>
                    <td className="py-3 px-2 text-right text-slate-600">
                      {log.fgPct}%
                    </td>
                    <td className="py-3 px-2 text-right text-slate-600">
                      {log.tpPct}%
                    </td>
                    <td className="py-3 px-2 text-amber-600 font-semibold whitespace-nowrap">
                      {[
                        log.wonChampionship ? '💍우승' : null,
                        log.wonMvp ? '🏆MVP' : null,
                        log.allStarSelected ? '⭐올스타' : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 3. 하이라이트 연대기 */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
          <Award className="w-5 h-5 text-orange-600" />
          선수 커리어 연대기 (Chronicles)
        </h2>

        <div className="space-y-3">
          {[...career.milestones].reverse().map((ms) => (
            <div
              key={ms.id}
              className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-4"
            >
              <div className="space-y-0.5">
                <p className="text-sm font-extrabold text-slate-900">{ms.title}</p>
                <p className="text-xs text-slate-600">{ms.description}</p>
              </div>
              <span className="text-xs font-semibold text-slate-400 whitespace-nowrap tabular-nums">
                {ms.year}년 ({ms.age}세)
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
