'use client';

import React from 'react';
import { Award, Flame, History, Medal, Swords, Trophy } from 'lucide-react';
import { getAwardsByLeague } from '../../engine/seasonSimulator';
import { useCareerStore } from '../../store/useCareerStore';

function formatMoney(amountUsd: number): string {
  if (!amountUsd || amountUsd <= 0) return '$0';
  if (amountUsd >= 1000000) {
    return `$${(amountUsd / 1000000).toFixed(2)}M`;
  }
  if (amountUsd >= 1000) {
    return `$${Math.round(amountUsd / 1000).toLocaleString()}K`;
  }
  return `$${amountUsd.toLocaleString()}`;
}

export function HistoryTab() {
  const career = useCareerStore((s) => s.career);
  if (!career) return null;

  const gp = Math.max(1, career.totals.gp);
  const careerPpg = (career.totals.points / gp).toFixed(1);
  const careerRpg = (career.totals.rebounds / gp).toFixed(1);
  const careerApg = (career.totals.assists / gp).toFixed(1);
  const allLeagueCount = career.totals.allLeagueSelections || 0;
  const rivals = career.rivals || [];
  const leagueAwards = getAwardsByLeague(career.seasonLogs);

  return (
    <div className="space-y-6">
      {/* 1. 통산 누적 기록 & 커리어하이 요약 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-orange-600" />
              통산 누적 기록 (Career Totals)
            </h2>
            <span className="text-xs font-extrabold text-emerald-700 tabular-nums">
              통산 누적 수입: {formatMoney(career.careerEarnings || 0)}
            </span>
          </div>

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
              <span className="block text-xs text-slate-500">NBA 우승 / MVP / 올스타</span>
              <span className="text-xl font-black text-amber-600 tabular-nums">
                {career.totals.nbaChampionships} / {career.totals.nbaMvps} / {career.totals.nbaAllStars}
              </span>
              <span className="block text-[11px] text-slate-400 tabular-nums">
                전체 리그 합산 {career.totals.championships}우승 · {career.totals.mvps}MVP
              </span>
            </div>
          </div>

          {/* 확장 수상 내역 요약 바 */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 tabular-nums">
            <span>🛡️ 올해의 수비수(DPOY): <strong className="text-slate-900">{career.totals.dpoys || 0}회</strong></span>
            <span>⚡ 식스맨상(6MOY): <strong className="text-slate-900">{career.totals.sixthManAwards || 0}회</strong></span>
            <span>📈 기량발전상(MIP): <strong className="text-slate-900">{career.totals.mips || 0}회</strong></span>
            <span>
              🏅 올-리그 팀 선정: <strong className="text-slate-900">{allLeagueCount}회</strong>
            </span>
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

      {/* 1.5 리그별 트로피 캐비닛 (League-Separated Trophy Cabinet) */}
      <section
        data-testid="league-trophy-cabinet"
        className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Medal className="w-5 h-5 text-amber-500" />
              리그별 분리 트로피 캐비닛 (Trophy Cabinet by League)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              고교·대학 아마추어 무대와 KBL·해외·NBA 프로 리그의 우승 및 수상 내역을 리그 위상에 맞게 엄격히 분리해 기록해요.
            </p>
          </div>
        </div>

        {leagueAwards.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center bg-slate-50 rounded-xl border border-slate-200">
            아직 완료한 시즌이나 획득한 리그 트로피가 없어요.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {leagueAwards.map((la) => (
              <div
                key={la.league}
                className={`p-4 rounded-xl border space-y-2.5 ${
                  la.league === 'NBA'
                    ? 'bg-amber-50/40 border-amber-300'
                    : la.league === 'KBL' || la.league === 'OVERSEAS'
                    ? 'bg-indigo-50/30 border-indigo-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
                  <span className="text-sm font-black text-slate-900">
                    {la.leagueName}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                    {la.seasons}시즌 · {la.gp}G · 통산 {la.points.toLocaleString()}점
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 text-center text-xs tabular-nums">
                  <div className="p-2 rounded-lg bg-white border border-slate-200/80">
                    <span className="block text-[10px] text-slate-400">💍 우승</span>
                    <span className="font-black text-amber-600">{la.championships}회</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-200/80">
                    <span className="block text-[10px] text-slate-400">🏆 MVP</span>
                    <span className="font-black text-orange-600">{la.mvps}회</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-200/80">
                    <span className="block text-[10px] text-slate-400">👑 FMVP</span>
                    <span className="font-bold text-slate-800">{la.finalsMvps}회</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-200/80">
                    <span className="block text-[10px] text-slate-400">⭐ 올스타</span>
                    <span className="font-bold text-slate-800">{la.allStars}회</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 tabular-nums pt-0.5">
                  <span>🛡️ DPOY {la.dpoys}회</span>
                  <span>⚡ 식스맨 {la.sixthManAwards}회</span>
                  <span>📈 MIP {la.mips}회</span>
                  <span>🌱 신인왕 {la.roys}회</span>
                  <span>🏅 올-리그 {la.allLeague1st + la.allLeague2nd + la.allLeague3rd}회</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 2. 드래프트 동기 & 리그 라이벌 매치업 보드 */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Swords className="w-5 h-5 text-orange-600" />
              드래프트 동기 & 리그 라이벌 매치업 보드
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              프로 무대(KBL·NBA) 입단 동기와 포지션 경쟁자들의 실시간 시즌 성적과 수상 레이스를 비교해요.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500 tabular-nums">
            등록 라이벌 {rivals.length}명
          </span>
        </div>

        {rivals.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center bg-slate-50 rounded-xl border border-slate-200">
            프로 리그(KBL 또는 NBA)에 진입하면 드래프트 동기 라이벌 2명이 자동 생성되어 매 시즌 성적과 MVP 레이스를 경쟁해요.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rivals.map((rv) => (
              <div
                key={rv.id}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-orange-600">
                      {rv.draftYear}년 {rv.league} 입단 동기 · {rv.pos}
                    </span>
                    <h3 className="text-base font-black text-slate-900">
                      {rv.name}{' '}
                      <span className="text-xs font-semibold text-slate-500">
                        ({rv.teamName})
                      </span>
                    </h3>
                  </div>
                  <div className="text-right tabular-nums">
                    <span className="block text-lg font-black text-slate-900">
                      OVR {rv.ovr}
                    </span>
                    <span className="block text-[11px] text-slate-400">
                      잠재 {rv.potential}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-xs tabular-nums">
                  <div className="p-2 rounded-lg bg-white border border-slate-200">
                    <span className="block text-[10px] text-slate-400">평균 득점</span>
                    <span className="font-extrabold text-orange-600">{rv.ppg.toFixed(1)}점</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-200">
                    <span className="block text-[10px] text-slate-400">리바운드</span>
                    <span className="font-bold text-slate-800">{rv.rpg.toFixed(1)}개</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-200">
                    <span className="block text-[10px] text-slate-400">어시스트</span>
                    <span className="font-bold text-slate-800">{rv.apg.toFixed(1)}개</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-200">
                    <span className="block text-[10px] text-slate-400">MVP / 올스타</span>
                    <span className="font-bold text-amber-600">
                      {rv.mvps} / {rv.allStars}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  📰 {rv.lastHeadline}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. 연도별 시즌 기록 테이블 */}
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
                  <th className="py-3 px-2">팀 순위 · PO 결과</th>
                  <th className="py-3 px-2">역할</th>
                  <th className="py-3 px-2 text-right">OVR</th>
                  <th className="py-3 px-2 text-right">GP</th>
                  <th className="py-3 px-2 text-right">MPG</th>
                  <th className="py-3 px-2 text-right text-orange-600">PPG</th>
                  <th className="py-3 px-2 text-right">RPG</th>
                  <th className="py-3 px-2 text-right">APG</th>
                  <th className="py-3 px-2 text-right">FG%</th>
                  <th className="py-3 px-2 text-right">3P%</th>
                  <th className="py-3 px-2">리그별 수상/비고</th>
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
                    <td className="py-3 px-2 text-indigo-700 font-semibold whitespace-nowrap">
                      {log.teamRank
                        ? `정규 ${log.teamRank}위(${log.wins}승${log.losses}패) · ${log.playoffResult || '-'}`
                        : `${log.wins}승 ${log.losses}패`}
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
                        log.wonChampionship ? `[${log.leagueName}] 💍우승` : null,
                        log.wonFinalsMvp ? `[${log.leagueName}] 👑파이널MVP` : null,
                        log.wonMvp ? `[${log.leagueName}] 🏆MVP` : null,
                        log.wonDpoy ? `[${log.leagueName}] 🛡️DPOY` : null,
                        log.wonSixthMan ? `[${log.leagueName}] ⚡식스맨` : null,
                        log.wonMip ? `[${log.leagueName}] 📈MIP` : null,
                        log.wonRookieOfYear ? `[${log.leagueName}] 🌱신인왕` : null,
                        log.allStarSelected ? `[${log.leagueName}] ⭐올스타` : null,
                        log.allLeagueTeam ? `[${log.leagueName}] 🏅올리그(${log.allLeagueTeam})` : null,
                        log.injuredGamesMissed > 0 ? `🩹결장${log.injuredGamesMissed}G` : null,
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

      {/* 4. 하이라이트 연대기 */}
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
