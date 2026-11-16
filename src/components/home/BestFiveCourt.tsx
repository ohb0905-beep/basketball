'use client';

import React, { useState } from 'react';
import { Award, Crown, UserCheck } from 'lucide-react';
import { getTraitInfo } from '../../engine/statCalculator';
import { useCareerStore } from '../../store/useCareerStore';
import { HallOfFameEntry, Position } from '../../types/game';
import { TeamEmblem } from '../common/TeamEmblem';
import { Modal } from '../common/Modal';

const COURT_POSITIONS: {
  pos: Position;
  korName: string;
  coordClass: string;
}[] = [
  {
    pos: 'PG',
    korName: '포인트 가드',
    coordClass: 'top-[10%] left-1/2 -translate-x-1/2',
  },
  {
    pos: 'SG',
    korName: '슈팅 가드',
    coordClass: 'top-[32%] left-[18%] -translate-x-1/2',
  },
  {
    pos: 'SF',
    korName: '스몰 포워드',
    coordClass: 'top-[32%] left-[82%] -translate-x-1/2',
  },
  {
    pos: 'PF',
    korName: '파워 포워드',
    coordClass: 'top-[64%] left-[26%] -translate-x-1/2',
  },
  {
    pos: 'C',
    korName: '센터',
    coordClass: 'top-[64%] left-[74%] -translate-x-1/2',
  },
];

export function BestFiveCourt() {
  const hofList = useCareerStore((s) => s.hofList);
  const [selectedEntry, setSelectedEntry] = useState<HallOfFameEntry | null>(null);

  // 각 포지션별 최고 레거시 점수를 기록한 은퇴 선수 자동 매핑 (주포지션 엄격 매칭 + 동일 선수 중복 배치 방지)
  const bestFiveByPos: Record<Position, HallOfFameEntry | null> = {
    PG: null,
    SG: null,
    SF: null,
    PF: null,
    C: null,
  };

  const placedPlayerIds = new Set<string>();
  for (const pos of ['PG', 'SG', 'SF', 'PF', 'C'] as Position[]) {
    const primaryMatch = hofList
      .filter((entry) => entry.primaryPos === pos && !placedPlayerIds.has(entry.id))
      .sort((a, b) => b.legacyScore - a.legacyScore)[0];

    if (primaryMatch) {
      bestFiveByPos[pos] = primaryMatch;
      placedPlayerIds.add(primaryMatch.id);
    } else {
      bestFiveByPos[pos] = null;
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* 좌측: 올타임 베스트 5 하프코트 보드 */}
      <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />
              올타임 베스트 5 하프코트
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              직접 육성하고 은퇴시킨 선수 중 각 주포지션 최고 레거시 선수가 1명씩 배치돼요
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500 tabular-nums">
            등재 포지션 {Object.values(bestFiveByPos).filter(Boolean).length} / 5
          </span>
        </div>

        {/* 하프코트 그래픽 컨테이너 */}
        <div
          data-testid="best-five-halfcourt"
          className="relative w-full h-[430px] sm:h-[460px] rounded-2xl bg-slate-50 border border-slate-200 overflow-hidden select-none"
        >
          {/* SVG 하프코트 라인 */}
          <svg
            viewBox="0 0 500 420"
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="none"
          >
            {/* 하프코트 센터 서클 */}
            <circle
              cx="250"
              cy="0"
              r="55"
              fill="none"
              stroke="#E2E8F0"
              strokeWidth="2.5"
            />
            {/* 3점 라인 */}
            <path
              d="M 45 420 L 45 290 A 210 205 0 0 1 455 290 L 455 420"
              fill="none"
              stroke="#CBD5E1"
              strokeWidth="2.5"
            />
            {/* 페인트존 */}
            <rect
              x="170"
              y="230"
              width="160"
              height="190"
              fill="#FFF7ED"
              fillOpacity="0.65"
              stroke="#FDBA74"
              strokeWidth="2"
            />
            {/* 자유투 서클 */}
            <circle
              cx="250"
              cy="230"
              r="55"
              fill="none"
              stroke="#FDBA74"
              strokeWidth="2"
              strokeDasharray="6 6"
            />
            {/* 골대 & 백보드 */}
            <line
              x1="215"
              y1="392"
              x2="285"
              y2="392"
              stroke="#EA580C"
              strokeWidth="4"
            />
            <circle
              cx="250"
              cy="376"
              r="12"
              fill="none"
              stroke="#EA580C"
              strokeWidth="3"
            />
          </svg>

          {/* 5개 포지션 슬롯 */}
          {COURT_POSITIONS.map(({ pos, korName, coordClass }) => {
            const player = bestFiveByPos[pos];
            return (
              <div
                key={pos}
                className={`absolute ${coordClass} w-40 sm:w-44 transition-transform`}
              >
                {player ? (
                  <button
                    type="button"
                    onClick={() => setSelectedEntry(player)}
                    className="w-full rounded-xl bg-white border-2 border-orange-500 p-2.5 shadow-sm hover:shadow-md transition-all text-left cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-extrabold text-orange-600">
                        {pos} · #{player.jerseyNumber}
                      </span>
                      <span className="text-xs font-bold text-slate-900 tabular-nums">
                        OVR {player.peakOvr}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TeamEmblem team={player.iconicTeam} size="xs" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {player.name}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate tabular-nums">
                          {player.careerAverages.ppg}점 · {player.legacyEmoji}
                        </p>
                      </div>
                    </div>
                  </button>
                ) : (
                  <div className="w-full rounded-xl bg-white/90 border border-dashed border-slate-300 p-3 text-center">
                    <span className="block text-xs font-extrabold text-slate-700">
                      {pos} ({korName})
                    </span>
                    <span className="block text-[11px] text-slate-400 mt-1">
                      [공석 - 첫 은퇴 선수 대기]
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 우측: 명예의 전당 헌액 랭킹 보드 */}
      <section className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-orange-600" />
              명예의 전당 (Hall of Fame)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              은퇴식을 마친 역대 선수들의 레거시 랭킹이에요
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500 tabular-nums">
            총 {hofList.length}명
          </span>
        </div>

        {hofList.length === 0 ? (
          <div className="flex-1 rounded-xl bg-slate-50 border border-dashed border-slate-200 p-8 flex flex-col items-center justify-center text-center">
            <UserCheck className="w-9 h-9 text-slate-300 mb-3" />
            <p className="text-sm font-bold text-slate-700">
              아직 은퇴하여 명예의 전당에 오른 선수가 없어요
            </p>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-xs">
              가상 더미 선수 없이 오직 직접 키우고 은퇴시킨 나만의 레전드 선수만 이곳에 영구 기록돼요.
            </p>
          </div>
        ) : (
          <div className="space-y-3 overflow-y-auto max-h-[420px] pr-1">
            {hofList.map((entry, idx) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSelectedEntry(entry)}
                className="w-full text-left p-3.5 rounded-xl bg-slate-50 hover:bg-orange-50/50 border border-slate-200 hover:border-orange-300 transition-colors flex items-center gap-3 cursor-pointer"
              >
                <span className="w-6 text-center text-sm font-black text-slate-400 tabular-nums">
                  {idx + 1}
                </span>
                <TeamEmblem team={entry.iconicTeam} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-900 truncate">
                      #{entry.jerseyNumber} {entry.name}
                    </span>
                    <span className="text-xs text-slate-500">
                      ({entry.primaryPos} · 전성기 OVR {entry.peakOvr})
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {entry.legacyTitle} · 통산 {entry.totals.points.toLocaleString()}득점
                    {entry.jerseyRetired ? ' · 🎽 영구결번' : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="block text-xs font-extrabold text-orange-600 tabular-nums">
                    {entry.legacyScore.toLocaleString()}점
                  </span>
                  <span className="text-[11px] text-slate-400 tabular-nums">
                    {entry.seasonsPlayed}시즌
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 헌액 선수 상세 모달 */}
      <Modal
        open={Boolean(selectedEntry)}
        title={
          selectedEntry
            ? `#${selectedEntry.jerseyNumber} ${selectedEntry.name} (${selectedEntry.primaryPos})`
            : ''
        }
        subtitle={selectedEntry?.legacyTitle}
        onClose={() => setSelectedEntry(null)}
      >
        {selectedEntry && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <TeamEmblem team={selectedEntry.iconicTeam} size="lg" />
              <div>
                <p className="text-xs text-slate-500">대표 소속 구단</p>
                <p className="text-base font-bold text-slate-900">
                  {selectedEntry.iconicTeam.name}
                </p>
                <p className="text-xs text-orange-600 font-semibold mt-0.5">
                  {selectedEntry.jerseyRetired
                    ? `🎽 구단 영구결번 (#${selectedEntry.jerseyNumber}) 헌액 완료`
                    : `${selectedEntry.seasonsPlayed}시즌 활약 · 만 ${selectedEntry.finalAge}세 은퇴`}
                </p>
              </div>
            </div>

            {selectedEntry.traits && selectedEntry.traits.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-400 font-semibold">생애 보유 특성:</span>
                {selectedEntry.traits.map((tId) => (
                  <span key={tId} className="font-bold text-slate-700">
                    [{getTraitInfo(tId).badge}]
                  </span>
                ))}
              </div>
            )}

            <p className="text-sm text-slate-600 leading-relaxed">
              {selectedEntry.epitaph}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="block text-xs text-slate-500">통산 평균</span>
                <span className="text-xs font-bold text-slate-900 tabular-nums">
                  {selectedEntry.careerAverages.ppg}점 {selectedEntry.careerAverages.rpg}리바{' '}
                  {selectedEntry.careerAverages.apg}도움
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="block text-xs text-slate-500">통산 누적 득점</span>
                <span className="text-xs font-bold text-slate-900 tabular-nums">
                  {selectedEntry.totals.points.toLocaleString()}점 ({selectedEntry.totals.gp}G)
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="block text-xs text-slate-500">우승 / MVP / 올스타</span>
                <span className="text-xs font-bold text-amber-600 tabular-nums">
                  {selectedEntry.totals.championships} / {selectedEntry.totals.mvps} /{' '}
                  {selectedEntry.totals.allStars}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="block text-xs text-slate-500">통산 누적 연봉</span>
                <span className="text-xs font-bold text-emerald-700 tabular-nums">
                  {(selectedEntry.careerEarnings || 0) >= 1000000
                    ? `$${((selectedEntry.careerEarnings || 0) / 1000000).toFixed(2)}M`
                    : `$${Math.round((selectedEntry.careerEarnings || 0) / 1000).toLocaleString()}K`}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
