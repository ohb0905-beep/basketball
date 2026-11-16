'use client';

import React from 'react';
import { Award, Check, Dumbbell, MessageSquare, RefreshCw } from 'lucide-react';
import { POSITION_ARCHETYPES } from '../../data/archetypes';
import { LEAGUE_CONFIG } from '../../data/leagues';
import { analyzePositionFit } from '../../engine/statCalculator';
import { useCareerStore } from '../../store/useCareerStore';
import { Position, TrainingFocus } from '../../types/game';

const TRAINING_PROGRAMS: {
  id: TrainingFocus;
  title: string;
  desc: string;
  targetStats: string;
}[] = [
  {
    id: 'BALANCED',
    title: '전천후 밸런스 훈련',
    desc: '6대 능력치를 고르게 단련하며 약점을 보완해요.',
    targetStats: '전 스탯 균형 성장',
  },
  {
    id: 'OUTSIDE_SHOOTING',
    title: '외곽 슈팅 & 스텝백 3점 집중',
    desc: '캐치앤슛과 풀업 3점슛 성공률, 볼핸들링 감각을 집중적으로 끌어올려요.',
    targetStats: 'OUT +++ · PLY +',
  },
  {
    id: 'INSIDE_SCORING',
    title: '림 어택 & 인사이드 피니시',
    desc: '돌파 레이업, 컨택 마무리, 플로터와 포스트업 득점력을 강화해요.',
    targetStats: 'INS +++ · PHY +',
  },
  {
    id: 'PLAYMAKING',
    title: '픽앤롤 리딩 & 코트 비전',
    desc: '동료의 오픈 찬스를 읽는 시야와 드리블 돌파 후 킥아웃 패스를 연마해요.',
    targetStats: 'PLY +++ · OUT +',
  },
  {
    id: 'DEFENSE_LOCKDOWN',
    title: '락다운 대인 수비 & 스틸/블록',
    desc: '상대 에이스를 제어하는 사이드스텝과 손질, 림 프로텍팅을 훈련해요.',
    targetStats: 'DEF +++ · PHY +',
  },
  {
    id: 'REBOUND_POST',
    title: '박스아웃 & 보드 장악 훈련',
    desc: '공수 리바운드 위치 선정과 골밑 몸싸움 경합 능력을 극대화해요.',
    targetStats: 'REB +++ · INS +',
  },
  {
    id: 'PHYSICAL_CONDITIONING',
    title: '코어 웨이트 & 민첩성 강화',
    desc: '폭발적인 퍼스트 스텝과 점프력, 풀타임 체력을 길러요.',
    targetStats: 'PHY +++ · DEF +',
  },
];

export function TrainingTab() {
  const career = useCareerStore((s) => s.career);
  const setTrainingFocus = useCareerStore((s) => s.setTrainingFocus);
  const switchPrimaryPosition = useCareerStore((s) => s.switchPrimaryPosition);
  const unlockSecondaryPosition = useCareerStore((s) => s.unlockSecondaryPosition);

  if (!career) return null;

  const leagueInfo = LEAGUE_CONFIG[career.league];
  const fit = analyzePositionFit(
    career.stats,
    career.heightCm,
    career.primaryPos,
    career.secondaryPos,
    career.coachTrust
  );

  const statItems = [
    { key: 'ins', label: '인사이드 득점 (INS)', val: career.stats.ins, delta: career.lastSeasonDelta.ins },
    { key: 'out', label: '아웃사이드 슈팅 (OUT)', val: career.stats.out, delta: career.lastSeasonDelta.out },
    { key: 'ply', label: '플레이메이킹 (PLY)', val: career.stats.ply, delta: career.lastSeasonDelta.ply },
    { key: 'def', label: '대인/팀 수비 (DEF)', val: career.stats.def, delta: career.lastSeasonDelta.def },
    { key: 'reb', label: '리바운드 장악 (REB)', val: career.stats.reb, delta: career.lastSeasonDelta.reb },
    { key: 'phy', label: '피지컬 & 기동력 (PHY)', val: career.stats.phy, delta: career.lastSeasonDelta.phy },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* 좌측: 6대 세부 능력치 증감 바 & 보유 배지 */}
      <div className="lg:col-span-6 space-y-6">
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">
                6대 세부 능력치 & 시즌 증감
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {career.age <= 28
                  ? `현재 리그 성장 상한선: OVR ${leagueInfo.growthCap} (초과 시 성장 효율 둔화)`
                  : `만 ${career.age}세 베테랑 에이징 커브 구간 (노련미 유지 및 체력 관리 중요)`}
              </p>
            </div>
            <span className="text-2xl font-black text-orange-600 tabular-nums">
              OVR {career.ovr}
            </span>
          </div>

          <div className="space-y-4">
            {statItems.map((item) => (
              <div key={item.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">{item.label}</span>
                  <div className="flex items-center gap-2 tabular-nums">
                    {item.delta !== 0 && (
                      <span
                        className={`font-extrabold ${
                          item.delta > 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {item.delta > 0 ? `+${item.delta}` : item.delta}
                      </span>
                    )}
                    <span className="text-sm font-black text-slate-900">{item.val}</span>
                  </div>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    style={{ width: `${item.val}%` }}
                    className={`h-full rounded-full transition-all ${
                      item.val >= 85
                        ? 'bg-amber-500'
                        : item.val >= 75
                        ? 'bg-orange-600'
                        : 'bg-slate-700'
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* 획득한 특성 배지 */}
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-orange-600" />
              보유 시그니처 배지 ({career.badges.length}개)
            </h3>
            {career.badges.length === 0 ? (
              <p className="text-xs text-slate-400">
                세부 능력치가 75 이상에 도달하면 포지션별 시그니처 배지가 자동으로 해금돼요.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
                {career.badges.map((badge, i) => (
                  <span key={i}>
                    {i > 0 && <span className="mr-2 text-slate-300">·</span>}
                    {badge}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 감독 포지션 면담 & 듀얼 포지션 해금 */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-orange-600" />
              감독 전술 면담 (포지션 전향 & 부포지션 해금)
            </h2>
            <span className="text-xs text-slate-500 tabular-nums">
              신뢰도 {career.coachTrust}%
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed">
            “{fit.coachAdvice}”
          </div>

          {/* 부포지션 해금 또는 변경 */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-700">
              부포지션(Dual Position) 장착 (출전 시간 roleIndex +2.5 보너스)
            </p>
            <div className="flex flex-wrap gap-2">
              {(['PG', 'SG', 'SF', 'PF', 'C'] as Position[])
                .filter((p) => p !== career.primaryPos)
                .map((pos) => {
                  const isCurrentSec = career.secondaryPos === pos;
                  const canUnlock = career.coachTrust >= 50 || career.ovr >= 56;
                  return (
                    <button
                      key={pos}
                      type="button"
                      disabled={!canUnlock && !isCurrentSec}
                      onClick={() => unlockSecondaryPosition(pos)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        isCurrentSec
                          ? 'border-orange-600 bg-orange-600 text-white'
                          : canUnlock
                          ? 'border-slate-200 bg-white text-slate-700 hover:border-orange-500'
                          : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {isCurrentSec ? `부포지션: ${pos} (장착됨)` : `부포지션 ${pos} 장착`}
                    </button>
                  );
                })}
            </div>
          </div>

          {/* 주포지션 전향 */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-700">
              주포지션 전향 (신장 {career.heightCm}cm 및 현재 능력치 기준)
            </p>
            <div className="grid grid-cols-5 gap-2">
              {(['PG', 'SG', 'SF', 'PF', 'C'] as Position[]).map((pos) => {
                const isPrimary = career.primaryPos === pos;
                return (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => switchPrimaryPosition(pos)}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      isPrimary
                        ? 'border-slate-900 bg-slate-900 text-white font-extrabold'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-orange-500'
                    }`}
                  >
                    <span className="block text-xs font-bold">{pos}</span>
                    <span className="block text-[10px] opacity-80">
                      {POSITION_ARCHETYPES[pos].koreanName}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* 우측: 중점 훈련 선택 */}
      <div className="lg:col-span-6">
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-orange-600" />
              시즌 중점 훈련 프로그램 설정
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              선택한 중점 훈련에 따라 시즌 결산 시 상승하는 세부 능력치 가중치가 달라져요.
            </p>
          </div>

          <div className="space-y-2.5">
            {TRAINING_PROGRAMS.map((prog) => {
              const active = career.trainingFocus === prog.id;
              return (
                <button
                  key={prog.id}
                  type="button"
                  onClick={() => setTrainingFocus(prog.id)}
                  className={`w-full p-4 rounded-xl border text-left transition-all flex items-start justify-between gap-3 cursor-pointer ${
                    active
                      ? 'border-orange-600 bg-orange-50/50 ring-1 ring-orange-600'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-slate-900">
                        {prog.title}
                      </span>
                      <span className="text-xs font-bold text-orange-600">
                        {prog.targetStats}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{prog.desc}</p>
                  </div>
                  {active ? (
                    <Check className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                  ) : (
                    <RefreshCw className="w-4 h-4 text-slate-300 shrink-0 mt-1" />
                  )}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
