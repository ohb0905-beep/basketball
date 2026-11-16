'use client';

import React, { useState } from 'react';
import { ArrowLeft, Check, Ruler, Shield, Sparkles } from 'lucide-react';
import { getHeightModifiers, POSITION_ARCHETYPES } from '../../data/archetypes';
import { HIGH_SCHOOL_TEAMS } from '../../data/teams';
import { getPreviewStatsAndOvrRange } from '../../engine/statCalculator';
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

  const archetype = POSITION_ARCHETYPES[primaryPos];
  const heightMod = getHeightModifiers(heightCm);
  const preview = getPreviewStatsAndOvrRange(primaryPos, heightCm);

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
    const cleanNum = jerseyNumber.trim();
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
              포지션과 신장(cm) 물리 보정에 더해 개체별 재능 편차가 무작위로 부여되어 초기 능력치와 OVR이 결정돼요.
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
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 font-bold text-sm tabular-nums focus:outline-none focus:border-orange-500"
              />
            </div>
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
            {jerseyNumber ? `#${jerseyNumber}` : '랜덤 등번호'} {name || '신입생'} 고교 농구부 입부하기
          </button>
        </div>

        {/* 우측: 실시간 능력치 프리뷰 & 아키타입 리포트 */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-semibold text-orange-600">
                  스카우트 초기 예상 리포트
                </span>
                <h2 className="text-xl font-extrabold text-slate-900 mt-0.5">
                  #{jerseyNumber || '?'} {name || '신입 유망주'} ({primaryPos})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">{archetype.tagline}</p>
              </div>
              <div className="text-right">
                <span className="block text-xs text-slate-400 font-semibold">예상 초기 OVR</span>
                <span
                  data-testid="expected-ovr-range"
                  className="text-2xl font-black text-orange-600 tabular-nums"
                >
                  {preview.minOvr} ~ {preview.maxOvr}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {archetype.description} 입부 시 개체별 무작위 편차(-4 ~ +5)가 적용되어 실제 초기 능력치와 OVR이 확정돼요.
            </p>

            {/* 6대 능력치 기준치 바 */}
            <div className="space-y-3">
              {[
                { key: 'ins', label: '인사이드 득점 (INS)', val: preview.baselineStats.ins, mod: heightMod.statModifiers.ins },
                { key: 'out', label: '아웃사이드 슈팅 (OUT)', val: preview.baselineStats.out, mod: heightMod.statModifiers.out },
                { key: 'ply', label: '플레이메이킹 (PLY)', val: preview.baselineStats.ply, mod: heightMod.statModifiers.ply },
                { key: 'def', label: '대인/팀 수비 (DEF)', val: preview.baselineStats.def, mod: heightMod.statModifiers.def },
                { key: 'reb', label: '리바운드 장악 (REB)', val: preview.baselineStats.reb, mod: heightMod.statModifiers.reb },
                { key: 'phy', label: '피지컬 & 기동력 (PHY)', val: preview.baselineStats.phy, mod: heightMod.statModifiers.phy },
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
                      <span className="font-bold text-slate-900">
                        기준 {item.val} <span className="text-[11px] text-slate-400 font-normal">(±편차)</span>
                      </span>
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
              고교 유망주 별점(1~5성) & 진로 제한 안내
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              한국 고교농구의 성장 상한선은 <strong className="text-slate-800">OVR 60</strong>이에요.
              고교 3년간의 통산 성적, 우승/MVP 여부, 최종 OVR에 따라 <strong className="text-slate-800">1~5성 유망주 등급</strong>이 매겨지며,
              등급에 따라 진학 가능한 대학·KBL 얼리·NCAA D1·해외 직행 스카우트 오퍼가 차등 해금돼요!
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
