'use client';

import React from 'react';
import { ArrowRight, PlayCircle, RotateCcw } from 'lucide-react';
import { useCareerStore } from '../../store/useCareerStore';
import { TeamEmblem } from '../common/TeamEmblem';

interface HeroSectionProps {
  onRequestResetModal: () => void;
}

export function HeroSection({ onRequestResetModal }: HeroSectionProps) {
  const career = useCareerStore((s) => s.career);
  const setView = useCareerStore((s) => s.setView);
  const espnApiConnected = useCareerStore((s) => s.espnApiConnected);

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 shadow-xs">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* 좌측 타이틀 & CTA */}
        <div className="lg:col-span-7 space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
            <span className="text-orange-600 font-bold">농구 선수 육성 시뮬레이션</span>
            <span aria-hidden="true">·</span>
            <span>고교 벤치에서 NBA 영구결번까지</span>
            <span aria-hidden="true">·</span>
            <span>
              {espnApiConnected ? 'ESPN 공식 구단 로고 연동됨' : '7대 리그 오픈월드 커리어'}
            </span>
          </div>

          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight break-keep"
            style={{ textWrap: 'balance' }}
          >
            차가운 벤치 끝자리에서 시작해, 코트 위의 전설이 되어 봐요
          </h1>

          <p className="text-base text-slate-600 leading-relaxed max-w-2xl break-keep">
            한국 고교농구 후보 선수로 출발해 대학 U-리그, KBL, 해외 리그, NCAA D1, G리그를 거쳐
            꿈의 무대 NBA에 도전해요. 상대 리그 수비 저항치(LDR)와 투웨이 생존 경쟁, 30대 에이징
            커브를 이겨내고 영구결번의 주인공이 되어 보세요.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            {career ? (
              <>
                <button
                  type="button"
                  data-start="true"
                  onClick={() => setView('DASHBOARD')}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm transition-colors shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <PlayCircle className="w-4 h-4" />
                  #{career.jerseyNumber} {career.name} 커리어 이어하기
                </button>
                <button
                  type="button"
                  onClick={onRequestResetModal}
                  className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  새 선수로 처음부터 시작하기
                </button>
              </>
            ) : (
              <button
                type="button"
                data-start="true"
                onClick={() => setView('CREATE')}
                className="inline-flex items-center gap-2 px-7 py-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-base transition-colors shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
              >
                새 선수 생성하고 데뷔하기
                <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </div>

          <p className="text-xs text-slate-400 pt-1">
            단축키 안내: 홈 화면에서 Enter 또는 Space 키를 누르면 바로 시작해요 · 모든 기록은 브라우저에 자동 저장돼요
          </p>
        </div>

        {/* 우측 커스텀 인라인 SVG 엠블럼 & 진행 중 선수 요약 카드 */}
        <div className="lg:col-span-5">
          {career ? (
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-orange-600">현재 진행 중인 선수</span>
                <span className="tabular-nums">{career.seasonYear}시즌 · 만 {career.age}세</span>
              </div>

              <div className="flex items-center gap-4">
                <TeamEmblem team={career.team} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500 truncate">{career.team.name}</p>
                  <h2 className="text-xl font-extrabold text-slate-900 truncate">
                    #{career.jerseyNumber} {career.name}
                  </h2>
                  <p className="text-xs font-medium text-slate-600 mt-0.5">
                    {career.heightCm}cm · {career.primaryPos}
                    {career.secondaryPos ? `/${career.secondaryPos}` : ''} · {career.role}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="block text-xs text-slate-400 font-medium">OVR</span>
                  <span className="text-3xl font-black text-orange-600 tabular-nums">
                    {career.ovr}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-200 text-center">
                <div>
                  <span className="block text-xs text-slate-500">통산 경기</span>
                  <span className="text-base font-bold text-slate-900 tabular-nums">
                    {career.totals.gp}G
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500">통산 득점</span>
                  <span className="text-base font-bold text-slate-900 tabular-nums">
                    {career.totals.points.toLocaleString()}점
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500">우승 / MVP</span>
                  <span className="text-base font-bold text-amber-600 tabular-nums">
                    {career.totals.championships}회 / {career.totals.mvps}회
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6 flex flex-col items-center text-center">
              {/* 커스텀 인라인 SVG 타이틀 엠블럼 */}
              <svg
                viewBox="0 0 220 140"
                className="w-52 h-32 mb-3"
                role="img"
                aria-label="벤치에서 MVP까지 코트 엠블럼"
              >
                <rect
                  x="10"
                  y="10"
                  width="200"
                  height="120"
                  rx="16"
                  fill="#FFFFFF"
                  stroke="#E2E8F0"
                  strokeWidth="2"
                />
                {/* 하프코트 라인 */}
                <path
                  d="M40 130 V55 A70 70 0 0 1 180 55 V130"
                  fill="none"
                  stroke="#CBD5E1"
                  strokeWidth="2"
                />
                <rect
                  x="82"
                  y="70"
                  width="56"
                  height="60"
                  fill="#FFF7ED"
                  stroke="#EA580C"
                  strokeWidth="2"
                />
                <circle
                  cx="110"
                  cy="70"
                  r="20"
                  fill="none"
                  stroke="#EA580C"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
                {/* 농구공 + 크라운 심볼 */}
                <circle
                  cx="110"
                  cy="45"
                  r="18"
                  fill="#EA580C"
                />
                <path
                  d="M95 40 Q110 48 125 40 M95 50 Q110 42 125 50 M110 27 V63"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="1.8"
                />
              </svg>

              <p className="text-sm font-bold text-slate-900">
                하드코어 농구 커리어 시뮬레이터
              </p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                7개 리그 단계별 수비 저항치(LDR) · 시카고 드래프트 컴바인 · 투웨이 생존 심사 ·
                30대 에이징 커브와 구단 영구결번 시스템이 준비되어 있어요.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
