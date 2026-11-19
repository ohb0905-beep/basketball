'use client';

import React, { useState } from 'react';
import { ArrowLeft, Check, Ruler, ShieldCheck, Sparkles } from 'lucide-react';
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
import { BiomechanicalProfile, Position } from '../../types/game';
import { TeamEmblem } from '../common/TeamEmblem';

const POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

export function getScoutingBalanceBadges(bio: BiomechanicalProfile): {
  overallBadge: { text: string; toneClass: string };
  reachBadge: string;
  agilityBadge: string;
} {
  let overallBadge = {
    text: '✅ 이상적인 신체 밸런스 (포지션 최적화)',
    toneClass: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  };
  if (bio.positionalPhysicsStrain >= 0.42) {
    overallBadge = {
      text: '⚠️ 포지션 대비 신체 부하 높음 - 턴오버·체력 소모 증가',
      toneClass: 'bg-rose-50 border-rose-200 text-rose-700',
    };
  } else if (bio.positionalPhysicsStrain >= 0.2) {
    overallBadge = {
      text: '⚡ 개성 있는 체격 조건 - 높이·스피드 장단점 공존',
      toneClass: 'bg-amber-50 border-amber-200 text-amber-700',
    };
  }

  const reachBadge =
    bio.reachLeverage >= 1.1
      ? '🦅 압도적 타점 & 림 장악력 우위'
      : bio.reachLeverage >= 0.85
      ? '⚖️ 안정적인 슛 타점 & 리바운드 경합'
      : '💨 낮은 타점 - 빠른 외곽 돌파·슈팅 승부 권장';

  const agilityBadge =
    bio.centerOfGravityAgility >= 1.05
      ? '⚡ 최상급 민첩성 & 볼 키핑 안정성'
      : bio.centerOfGravityAgility >= 0.85
      ? '🏃 준수한 방향 전환 & 코트 기동력'
      : '⚠️ 높은 무게중심 - 드리블 시 스틸·하체 피로 주의';

  return { overallBadge, reachBadge, agilityBadge };
}

function getElasticityBadgeText(elasticity: number): {
  text: string;
  className: string;
} {
  if (elasticity >= 0.95) {
    return {
      text: '🚀 성장 효율 최상',
      className: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    };
  }
  if (elasticity >= 0.78) {
    return {
      text: '✅ 표준 성장 효율',
      className: 'text-slate-600 bg-slate-100 border-slate-200',
    };
  }
  return {
    text: '⚠️ 체격 한계 근접',
    className: 'text-amber-700 bg-amber-50 border-amber-200',
  };
}

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
  const { overallBadge, reachBadge, agilityBadge } = getScoutingBalanceBadges(bioProfile);

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
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 text-slate-900">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setView('HOME')}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          메인 코트로 돌아가기
        </button>
        <span className="text-xs font-extrabold text-orange-600">
          만 17세 고교 신입생 등록
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 1. 기본 프로필 & 신체 조건 설정 카드 */}
        <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              새로운 유망주 프로필 등록
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              포지션과 신장, 그리고 타고난 성장 DNA가 어우러져 나만의 선수로 탄생해요.
            </p>
          </div>

          {/* 이름 및 등번호 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
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

          {/* 주포지션 선택 */}
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
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50 text-orange-700 font-black ring-1 ring-orange-500'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span className="block text-sm sm:text-base font-black">{pos}</span>
                    <span className="block text-[10px] text-slate-500 mt-0.5 truncate">
                      {POSITION_LABELS[pos].split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 신장 슬라이더 & 한국어 스카우팅 등급 뱃지 */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label
                htmlFor="height-slider"
                className="text-xs font-bold text-slate-700 flex items-center gap-1.5"
              >
                <Ruler className="w-4 h-4 text-orange-600" />
                선수 신장 설정
              </label>
              <span className="text-base sm:text-lg font-black text-orange-600 tabular-nums">
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
                {primaryPos} 권장 체격: {heightRange.optimalMin}~{heightRange.optimalMax}cm
              </span>
              <span>222cm (타워 빅맨)</span>
            </div>

            {/* 직관적인 한국어 스카우팅 리포트 등급 뱃지 */}
            <div className="pt-2 border-t border-slate-200 space-y-2">
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-extrabold ${overallBadge.toneClass}`}
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>{overallBadge.text}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="px-3 py-2 rounded-xl bg-white border border-slate-200 font-bold text-slate-700">
                  {reachBadge}
                </div>
                <div className="px-3 py-2 rounded-xl bg-white border border-slate-200 font-bold text-slate-700">
                  {agilityBadge}
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {heightMod.physicsDesc}
            </p>
          </div>
        </section>

        {/* 2. 스카우트 초기 예상 리포트 카드 */}
        <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
            <div>
              <span className="text-xs font-extrabold text-orange-600">
                스카우트 초기 예상 리포트
              </span>
              <h2 className="text-lg font-black text-slate-900 mt-0.5">
                #{jerseyNumber || '?'} {name || '신입 유망주'} ({primaryPos})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">{currentArch.title}</p>
            </div>
            <div className="text-right">
              <span className="block text-[11px] text-slate-500 font-bold">예상 초기 OVR</span>
              <span
                data-testid="expected-ovr-range"
                className="text-2xl font-black text-orange-600 tabular-nums"
              >
                {minOvr} ~ {maxOvr}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">{currentArch.description}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              const badge = getElasticityBadgeText(elasticityMap[item.key] ?? 1);
              return (
                <div
                  key={item.key}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{item.label}</span>
                    <span className="font-black text-orange-600 tabular-nums">
                      기준 {item.val}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      style={{ width: `${item.val}%` }}
                      className="h-full bg-orange-600 rounded-full transition-all"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badge.className}`}
                    >
                      {badge.text}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-orange-600" />
              포지션 핵심 가중 능력치
            </span>
            <div className="flex flex-wrap items-center gap-1.5 text-slate-700">
              {currentArch.keyStats.map((st, idx) => (
                <React.Fragment key={st}>
                  {idx > 0 && <span aria-hidden="true">·</span>}
                  <span className="font-extrabold text-orange-600 uppercase">
                    {st} 집중 가중
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>

        {/* 3. 입학 고교 선택 카드 */}
        <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-extrabold text-slate-900">
              입학할 한국 고교농구 명문교 선택 ({HIGH_SCHOOL_TEAMS.length}개교)
            </label>
            <span className="text-[11px] text-slate-500">원하는 학교를 선택해 주세요</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
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
                      {team.city} · 구단 전력 {team.rating}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="submit"
            className="w-full py-4 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-black text-base transition shadow-sm cursor-pointer"
          >
            {jerseyNumber ? `#${jerseyNumber}` : '랜덤 등번호'} {name || '신입생'} 고교 농구부 입부하기
          </button>
        </section>
      </form>
    </div>
  );
}
