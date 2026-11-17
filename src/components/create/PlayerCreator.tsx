'use client';

import React, { useState } from 'react';
import { Activity, ArrowLeft, Check, Ruler, Sparkles } from 'lucide-react';
import {
  getHeightModifiers,
  POSITION_ARCHETYPES,
  POSITION_HEIGHT_RANGES,
  POSITION_LABELS,
} from '../../data/archetypes';
import { HIGH_SCHOOL_TEAMS } from '../../data/teams';
import {
  calculateBiomechanicalProfile,
  getBiomechanicalGrowthElasticity,
  getPreviewStatsAndOvrRange,
} from '../../engine/statCalculator';
import { useCareerStore } from '../../store/useCareerStore';
import { Position } from '../../types/game';
import { TeamEmblem } from '../common/TeamEmblem';

const POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

export function PlayerCreator() {
  const startNewCareer = useCareerStore((s) => s.startNewCareer);
  const setView = useCareerStore((s) => s.setView);

  const [name, setName] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [primaryPos, setPrimaryPos] = useState<Position>('PG');
  const [heightCm, setHeightCm] = useState<number>(186);
  const [highSchoolTeamId, setHighSchoolTeamId] = useState<string>(HIGH_SCHOOL_TEAMS[0].id);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentArch = POSITION_ARCHETYPES[primaryPos];
  const heightRange = POSITION_HEIGHT_RANGES[primaryPos];
  const { baselineStats, minOvr, maxOvr } = getPreviewStatsAndOvrRange(primaryPos, heightCm);
  const heightMod = getHeightModifiers(heightCm);
  const bioProfile = calculateBiomechanicalProfile(heightCm, primaryPos);
  const elasticityMap = getBiomechanicalGrowthElasticity(heightCm, primaryPos, baselineStats);

  const handlePosChange = (pos: Position) => {
    setPrimaryPos(pos);
    setHeightCm(POSITION_ARCHETYPES[pos].defaultHeightCm);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMsg('선수 이름을 입력해 주세요!');
      return;
    }
    startNewCareer({
      name: trimmed,
      jerseyNumber: jerseyNumber.trim(),
      heightCm,
      primaryPos,
      highSchoolTeamId,
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 text-slate-900">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setView('HOME')}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          메인 코트로 돌아가기
        </button>
        <span className="text-xs font-extrabold text-orange-600">
          만 17세 고교 신입생 프로필 등록
        </span>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 좌측 입력 폼 */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div>
            <h1 className="text-2xl font-black text-slate-900">새로운 유망주 프로필 등록</h1>
            <p className="text-sm text-slate-500 mt-1">
              포지션·신장(cm)의 양방향 연속 생체역학 물리 엔진과 개체별 고유 DNA·선천 특성이 결합되어 초기 능력치가 결정됩니다.
            </p>
          </div>

          {/* 1. 이름 및 등번호 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label
                htmlFor="player-name-input"
                className="block text-xs font-bold text-slate-700 mb-1.5"
              >
                선수 이름
              </label>
              <input
                id="player-name-input"
                type="text"
                maxLength={16}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="선수 이름 입력"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold text-sm focus:outline-none focus:bg-white focus:border-orange-500"
              />
              {errorMsg && (
                <p className="text-xs font-bold text-rose-600 mt-1">{errorMsg}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="jersey-number-input"
                className="block text-xs font-bold text-slate-700 mb-1.5"
              >
                등번호 (미입력 시 랜덤)
              </label>
              <input
                id="jersey-number-input"
                type="text"
                maxLength={2}
                value={jerseyNumber}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^0-9]/g, '');
                  setJerseyNumber(digits);
                }}
                placeholder="00 ~ 99"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold text-sm tabular-nums focus:outline-none focus:bg-white focus:border-orange-500"
              />
            </div>
          </div>

          {/* 2. 주포지션 선택 */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              주포지션 선택 (5대 포지션)
            </label>
            <div className="grid grid-cols-5 gap-2">
              {POSITIONS.map((pos) => {
                const isSelected = primaryPos === pos;
                return (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => handlePosChange(pos)}
                    className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50 text-orange-700 font-black ring-1 ring-orange-500'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span className="block text-base font-black">{pos}</span>
                    <span className="block text-[11px] text-slate-500 mt-0.5 truncate">
                      {POSITION_LABELS[pos].split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. 신장 슬라이더 & 양방향 생체역학 지표 */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label
                htmlFor="height-slider"
                className="text-xs font-bold text-slate-700 flex items-center gap-1.5"
              >
                <Ruler className="w-4 h-4 text-orange-600" />
                선수 신장 (168cm ~ 222cm 연속 생체역학 물리 엔진)
              </label>
              <span className="text-lg font-black text-orange-600 tabular-nums">
                {heightCm}cm · {heightMod.label}
              </span>
            </div>

            <input
              id="height-slider"
              type="range"
              min={168}
              max={222}
              value={heightCm}
              onChange={(e) => setHeightCm(Number(e.target.value))}
              className="w-full accent-orange-600 cursor-pointer"
            />

            <div className="flex justify-between text-[11px] text-slate-500 tabular-nums">
              <span>168cm (초단신 가드)</span>
              <span>
                {primaryPos} 최적 권장: {heightRange.optimalMin}~{heightRange.optimalMax}cm
              </span>
              <span>222cm (타워 빅맨)</span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-center">
              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <span className="block text-[10px] font-bold text-slate-500">
                  타점/림장악 (Reach)
                </span>
                <span className="text-xs font-black text-sky-600 tabular-nums">
                  {bioProfile.reachLeverage.toFixed(2)}x
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <span className="block text-[10px] font-bold text-slate-500">
                  무게중심 민첩성 (CoG)
                </span>
                <span className="text-xs font-black text-emerald-600 tabular-nums">
                  {bioProfile.centerOfGravityAgility.toFixed(2)}x
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <span className="block text-[10px] font-bold text-slate-500">
                  포지션 물리 부하
                </span>
                <span
                  className={`text-xs font-black tabular-nums ${
                    bioProfile.positionalPhysicsStrain >= 0.45
                      ? 'text-rose-600'
                      : bioProfile.positionalPhysicsStrain >= 0.22
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {bioProfile.positionalPhysicsStrain.toFixed(2)}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {heightMod.physicsDesc}
            </p>
          </div>

          {/* 4. 입학 고교 선택 (전국 24개 명문 고교) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700">
                입학할 한국 고교농구 명문교 선택 ({HIGH_SCHOOL_TEAMS.length}개교)
              </label>
              <span className="text-[11px] text-slate-500">스크롤하여 전체 고교 선택</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
              {HIGH_SCHOOL_TEAMS.map((team) => {
                const selected = highSchoolTeamId === team.id;
                return (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => setHighSchoolTeamId(team.id)}
                    className={`p-3 rounded-xl border text-left transition flex items-center gap-3 cursor-pointer ${
                      selected
                        ? 'border-orange-500 bg-orange-50/70 ring-1 ring-orange-500'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <TeamEmblem team={team} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-sm font-bold text-slate-900 truncate">
                          {team.name}
                        </span>
                        {selected && <Check className="w-4 h-4 text-orange-600 shrink-0" />}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {team.city} · 전력 {team.rating}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-black text-base transition shadow-sm cursor-pointer"
          >
            {jerseyNumber ? `#${jerseyNumber}` : '랜덤 등번호'} {name || '신입생'} 고교 농구부 입부하기
          </button>
        </div>

        {/* 우측 스카우트 프리뷰 리포트 */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-extrabold text-orange-600">
                  스카우트 초기 예상 리포트
                </span>
                <h2 className="text-xl font-black text-slate-900 mt-0.5">
                  #{jerseyNumber || '?'} {name || '신입 유망주'} ({primaryPos})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">{currentArch.title}</p>
              </div>
              <div className="text-right">
                <span className="block text-xs text-slate-500 font-bold">예상 초기 OVR</span>
                <span
                  data-testid="expected-ovr-range"
                  className="text-2xl font-black text-orange-600 tabular-nums"
                >
                  {minOvr} ~ {maxOvr}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">{currentArch.description}</p>

            {/* 6대 능력치 기준치 & 훈련 성장 탄력성 */}
            <div className="space-y-3">
              {(
                [
                  { key: 'ins', label: '인사이드 득점 (INS)', val: baselineStats.ins },
                  { key: 'out', label: '아웃사이드 슈팅 (OUT)', val: baselineStats.out },
                  { key: 'ply', label: '플레이메이킹 (PLY)', val: baselineStats.ply },
                  { key: 'def', label: '수비력 (DEF)', val: baselineStats.def },
                  { key: 'reb', label: '리바운드 & 보드 (REB)', val: baselineStats.reb },
                  { key: 'phy', label: '피지컬 & 내구도 (PHY)', val: baselineStats.phy },
                ] as const
              ).map((item) => {
                const elasticity = Math.round((elasticityMap[item.key] ?? 1) * 100);
                return (
                  <div key={item.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700">{item.label}</span>
                      <div className="flex items-center gap-2 tabular-nums">
                        <span className="text-[11px] text-slate-500">
                          탄력성 {elasticity}%
                        </span>
                        <span className="font-black text-slate-900">기준 {item.val}</span>
                      </div>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        style={{ width: `${item.val}%` }}
                        className="h-full bg-orange-600 rounded-full transition-all"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-orange-600" />
                포지션 핵심 가중 능력치
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                {currentArch.keyStats.map((st, idx) => (
                  <React.Fragment key={st}>
                    {idx > 0 && <span aria-hidden="true">·</span>}
                    <span className="font-bold text-slate-800 uppercase">
                      {st} 집중 가중
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-2">
            <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-orange-600" />
              양방향 연속 생체역학 물리 엔진
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              타점(Reach Leverage)과 무게중심(Center of Gravity Agility)이 실제 경기 야투율, 리바운드, 블록, 턴오버(TOV) 및 훈련 탄력성에 연속 함수로 반영됩니다.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
