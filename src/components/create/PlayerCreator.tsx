'use client';

import React, { useState } from 'react';
import { ArrowLeft, Check, Ruler, Shield, Sparkles } from 'lucide-react';
import { getHeightModifiers, POSITION_ARCHETYPES } from '../../data/archetypes';
import { HIGH_SCHOOL_TEAMS } from '../../data/teams';
import { calculateOvr, createInitialStats } from '../../engine/statCalculator';
import { useCareerStore } from '../../store/useCareerStore';
import { Position } from '../../types/game';
import { TeamEmblem } from '../common/TeamEmblem';

const POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];
const POPULAR_NUMBERS = ['0', '1', '3', '7', '10', '11', '15', '23', '30', '34', '77'];

export function PlayerCreator() {
  const startNewCareer = useCareerStore((s) => s.startNewCareer);
  const setView = useCareerStore((s) => s.setView);

  const [name, setName] = useState('강백호');
  const [jerseyNumber, setJerseyNumber] = useState('7');
  const [primaryPos, setPrimaryPos] = useState<Position>('PG');
  const [heightCm, setHeightCm] = useState<number>(186);
  const [highSchoolTeamId, setHighSchoolTeamId] = useState<string>(HIGH_SCHOOL_TEAMS[0].id);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const archetype = POSITION_ARCHETYPES[primaryPos];
  const heightMod = getHeightModifiers(heightCm);
  const previewStats = createInitialStats(primaryPos, heightCm);
  const previewOvr = calculateOvr(previewStats, primaryPos);

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
    const cleanNum = jerseyNumber.trim() || '0';
    startNewCareer({
      name: trimmed,
      jerseyNumber: cleanNum,
      heightCm,
      primaryPos,
      highSchoolTeamId,
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setView('HOME')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          메인 코트로 돌아가기
        </button>
        <span className="text-xs font-medium text-slate-500">
          만 17세 고교 신입생 프로필 작성
        </span>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 좌측 입력 영역 */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">
              새로운 유망주 프로필 등록
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              포지션과 신장(cm)에 따라 물리 보정이 적용된 초기 능력치가 결정돼요.
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
                placeholder="예: 이현중, 여준석, 정성우"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 font-semibold text-sm focus:outline-none focus:border-orange-500"
              />
              {errorMsg && (
                <p className="text-xs font-semibold text-red-600 mt-1">{errorMsg}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="jersey-number-input"
                className="block text-xs font-bold text-slate-700 mb-1.5"
              >
                등번호 (#00 ~ #99)
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
                placeholder="7"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 font-bold text-sm tabular-nums focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* 등번호 빠른 선택 */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-400 mr-1">인기 등번호:</span>
            {POPULAR_NUMBERS.map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setJerseyNumber(num)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums transition-colors cursor-pointer ${
                  jerseyNumber === num
                    ? 'bg-orange-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                #{num}
              </button>
            ))}
          </div>

          {/* 2. 포지션 선택 (PG ~ C) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              주포지션 선택 (5대 포지션)
            </label>
            <div className="grid grid-cols-5 gap-2">
              {POSITIONS.map((pos) => {
                const info = POSITION_ARCHETYPES[pos];
                const isSelected = primaryPos === pos;
                return (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => handlePosChange(pos)}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'border-orange-600 bg-orange-50/70 text-orange-700 font-extrabold shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span className="block text-base font-black">{pos}</span>
                    <span className="block text-[11px] text-slate-500 mt-0.5 truncate">
                      {info.koreanName}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. 신장 슬라이더 (168cm ~ 220cm) */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label
                htmlFor="height-slider"
                className="text-xs font-bold text-slate-700 flex items-center gap-1.5"
              >
                <Ruler className="w-4 h-4 text-orange-600" />
                선수 신장 (168cm ~ 220cm 물리 보정)
              </label>
              <span className="text-lg font-black text-orange-600 tabular-nums">
                {heightCm}cm ({heightMod.heightLabel})
              </span>
            </div>

            <input
              id="height-slider"
              type="range"
              min={168}
              max={220}
              value={heightCm}
              onChange={(e) => setHeightCm(Number(e.target.value))}
              className="w-full accent-orange-600 cursor-pointer"
            />

            <div className="flex justify-between text-[11px] text-slate-400 tabular-nums">
              <span>168cm (초단신 가드)</span>
              <span>
                권장: {archetype.recommendedHeightRange[0]}~
                {archetype.recommendedHeightRange[1]}cm
              </span>
              <span>220cm (타워 빅맨)</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {heightMod.physicsComment}
            </p>
          </div>

          {/* 4. 입학 고교 선택 */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              입학할 한국 고교농구 명문교 선택
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {HIGH_SCHOOL_TEAMS.map((team) => {
                const selected = highSchoolTeamId === team.id;
                return (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => setHighSchoolTeamId(team.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                      selected
                        ? 'border-orange-600 bg-orange-50/40 ring-1 ring-orange-600'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <TeamEmblem team={team} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-sm font-bold text-slate-900">
                          {team.name}
                        </span>
                        {selected && <Check className="w-4 h-4 text-orange-600 shrink-0" />}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                        {team.prestigeDesc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-base transition-colors shadow-xs cursor-pointer"
          >
            #{jerseyNumber || '0'} {name || '신입생'} 고교 농구부 입부하기
          </button>
        </div>

        {/* 우측: 실시간 능력치 프리뷰 & 아키타입 리포트 */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-semibold text-orange-600">
                  스카우트 초기 리포트
                </span>
                <h2 className="text-xl font-extrabold text-slate-900 mt-0.5">
                  #{jerseyNumber || '0'} {name || '유망주'} ({primaryPos})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">{archetype.tagline}</p>
              </div>
              <div className="text-right">
                <span className="block text-xs text-slate-400 font-semibold">초기 OVR</span>
                <span className="text-3xl font-black text-orange-600 tabular-nums">
                  {previewOvr}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {archetype.description}
            </p>

            {/* 6대 능력치 바 */}
            <div className="space-y-3">
              {[
                { key: 'ins', label: '인사이드 득점 (INS)', val: previewStats.ins, mod: heightMod.statModifiers.ins },
                { key: 'out', label: '아웃사이드 슈팅 (OUT)', val: previewStats.out, mod: heightMod.statModifiers.out },
                { key: 'ply', label: '플레이메이킹 (PLY)', val: previewStats.ply, mod: heightMod.statModifiers.ply },
                { key: 'def', label: '대인/팀 수비 (DEF)', val: previewStats.def, mod: heightMod.statModifiers.def },
                { key: 'reb', label: '리바운드 장악 (REB)', val: previewStats.reb, mod: heightMod.statModifiers.reb },
                { key: 'phy', label: '피지컬 & 기동력 (PHY)', val: previewStats.phy, mod: heightMod.statModifiers.phy },
              ].map((item) => (
                <div key={item.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{item.label}</span>
                    <div className="flex items-center gap-1.5 tabular-nums">
                      {item.mod !== 0 && (
                        <span
                          className={`text-[11px] font-semibold ${
                            item.mod > 0 ? 'text-emerald-600' : 'text-rose-500'
                          }`}
                        >
                          (신장 {item.mod > 0 ? `+${item.mod}` : item.mod})
                        </span>
                      )}
                      <span className="font-bold text-slate-900">{item.val}</span>
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      style={{ width: `${item.val}%` }}
                      className="h-full bg-orange-600 rounded-full transition-all"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                포지션 핵심 강점
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                {archetype.keyStrengths.map((str, i) => (
                  <span key={i}>
                    {i > 0 && <span className="mr-2 text-slate-300">·</span>}
                    {str}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-2">
            <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-orange-600" />
              리그 수비 저항치(LDR) & 성장 캡 안내
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              한국 고교농구의 성장 상한선은 <strong className="text-slate-800">OVR 60</strong>이에요.
              고교 졸업(만 20세) 후 대학 U-리그, KBL, 해외 리그, NCAA D1 등 더 높은 무대로
              나아가야만 성장이 멈추지 않고 NBA MVP까지 도달할 수 있어요!
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
