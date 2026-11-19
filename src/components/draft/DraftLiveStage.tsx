'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Award, CheckCircle2, FastForward, Mic2, Radio, Sparkles } from 'lucide-react';
import { useCareerStore } from '../../store/useCareerStore';
import { TeamEmblem } from '../common/TeamEmblem';

export function DraftLiveStage() {
  const career = useCareerStore((s) => s.career);
  const finalizeDraftSigning = useCareerStore((s) => s.finalizeDraftSigning);

  // 4단계 실시간 호명 시퀀스: 0(티커 롤업) -> 1(커미셔너 단상 등단) -> 2(이름 스포트라이트 호명) -> 3(지명 구단 앰블럼 & 계약 체결)
  const [stage, setStage] = useState<0 | 1 | 2 | 3>(0);
  const [tickerPick, setTickerPick] = useState(1);

  const dr = career?.draftResult;
  const targetPick = dr?.pickNumber ?? (dr?.draftType === 'KBL' ? 20 : 60);

  // Stage 0: 1순위부터 본인 지명 순위 직전까지 빠르게 롤업
  useEffect(() => {
    if (stage !== 0) return;
    const stopAt = Math.max(1, targetPick - 1);
    if (tickerPick >= stopAt) {
      const t = setTimeout(() => setStage(1), 450);
      return () => clearTimeout(t);
    }
    const step = Math.max(1, Math.ceil((stopAt - tickerPick) / 6));
    const timer = setTimeout(() => {
      setTickerPick((prev) => Math.min(stopAt, prev + step));
    }, 110);
    return () => clearTimeout(timer);
  }, [stage, tickerPick, targetPick]);

  // Stage 1 -> Stage 2 -> Stage 3 자동 전환
  useEffect(() => {
    if (stage === 1) {
      const t = setTimeout(() => setStage(2), 950);
      return () => clearTimeout(t);
    }
    if (stage === 2) {
      const t = setTimeout(() => setStage(3), 1100);
      return () => clearTimeout(t);
    }
  }, [stage]);

  if (!career || !dr) return null;

  const isKbl = dr.draftType === 'KBL';
  const isFirstRound = dr.round === 1 && dr.pickNumber !== null && dr.pickNumber <= 30;
  const isSecondRound = dr.round === 2 && dr.pickNumber !== null && dr.pickNumber > 30;
  const isUndrafted = dr.pickNumber === null;
  const twoWayTargetTeam = dr.draftedTeam || dr.twoWayOfferTeam;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <section className="bg-white text-slate-900 border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-sm text-center space-y-6 relative overflow-hidden">
        {/* 상단 라이브 배지 및 즉시 건너뛰기 버튼 */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2 text-xs font-extrabold text-orange-600">
            <Radio className="w-4 h-4 animate-pulse text-rose-500" />
            <span>
              {isKbl
                ? '서울 잠실학생체육관 · KBL 신인선수 드래프트 LIVE'
                : '뉴욕 브루클린 바클레이스 센터 · NBA DRAFT LIVE'}
            </span>
          </div>

          {stage < 3 && (
            <button
              type="button"
              onClick={() => setStage(3)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
            >
              <FastForward className="w-3.5 h-3.5" />
              연출 건너뛰기
            </button>
          )}
        </div>

        {/* 단계별 라이브 보드 애니메이션 */}
        <AnimatePresence mode="wait">
          {stage === 0 && (
            <motion.div
              key="stage-0"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="py-12 space-y-4"
            >
              <span className="inline-block px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-extrabold tracking-widest uppercase">
                DRAFT BOARD ROLLING
              </span>
              <div className="text-5xl sm:text-6xl font-black font-mono text-amber-600 tabular-nums">
                PICK #{tickerPick}
              </div>
              <p className="text-sm text-slate-600">
                각 구단 워룸(War Room)의 지명 카드가 차례대로 발표되고 있어요...
              </p>
            </motion.div>
          )}

          {stage === 1 && (
            <motion.div
              key="stage-1"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.03 }}
              className="py-12 space-y-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto">
                <Mic2 className="w-8 h-8 text-amber-600 animate-bounce" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                커미셔너가 지명 봉투를 들고 단상으로 걸어 나와요...
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                장내에 정적이 흐르고 스포트라이트가 포디움으로 집중돼요!
              </p>
            </motion.div>
          )}

          {stage === 2 && (
            <motion.div
              key="stage-2"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="py-10 space-y-4"
            >
              <span className="inline-block px-3.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-extrabold">
                OFFICIAL COMMISSIONER CALLOUT
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-amber-700 leading-tight max-w-2xl mx-auto">
                {isUndrafted
                  ? '60순위까지 지명 호명이 모두 종료되었어요...'
                  : isKbl
                  ? `“KBL 신인드래프트 전체 ${dr.pickNumber}순위 지명... ${dr.draftedTeam?.name}, #${career.jerseyNumber} ${career.name}!”`
                  : `“With the #${dr.pickNumber} pick in the ${career.seasonYear} NBA Draft, the ${dr.draftedTeam?.name} select... ${career.name}!”`}
              </h2>
            </motion.div>
          )}

          {stage === 3 && (
            <motion.div
              key="stage-3"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <span className="inline-block px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-extrabold">
                  {isUndrafted
                    ? 'OFFICIAL DRAFT RESULT · UNDRAFTED'
                    : `${dr.draftType} DRAFT · ROUND ${dr.round} · PICK #${dr.pickNumber}`}
                </span>
                <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                  {isUndrafted
                    ? '60순위까지 이름이 불리지 않았어요 (Undrafted)'
                    : `${dr.draftType} 드래프트 ${dr.round}라운드 전체 ${dr.pickNumber}순위 지명!`}
                </h1>
              </div>

              {/* 지명 구단 엠블럼 & 커미셔너 콜아웃 카드 */}
              {dr.draftedTeam ? (
                <div
                  className="max-w-xl mx-auto p-6 rounded-2xl border-2 bg-slate-50 flex flex-col items-center space-y-4"
                  style={{
                    borderColor: dr.draftedTeam.primaryColor || '#f97316',
                  }}
                >
                  <TeamEmblem team={dr.draftedTeam} size="xl" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-500">
                      {dr.draftedTeam.city} · 구단 전력 {dr.draftedTeam.rating}
                      {dr.draftedTeam.conference
                        ? ` · ${dr.draftedTeam.conference === 'EAST' ? '동부 컨퍼런스' : '서부 컨퍼런스'}`
                        : ''}
                    </p>
                    <h2 className="text-2xl font-black text-slate-900">
                      {dr.draftedTeam.name}
                    </h2>
                    <p className="text-xs text-slate-600 max-w-md mt-1 leading-relaxed">
                      {dr.draftedTeam.prestigeDesc}
                    </p>
                  </div>

                  <div className="w-full p-3.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 font-medium">
                    {isKbl
                      ? `“KBL 신인드래프트 전체 ${dr.pickNumber}순위로 ${dr.draftedTeam.name} 구단이 #${career.jerseyNumber} ${career.name} 선수를 지명했어요!”`
                      : isFirstRound
                      ? `“With the #${dr.pickNumber} pick in the NBA Draft, the ${dr.draftedTeam.name} select ${career.name}!” (1라운드 정식 루키 스케일 보장 계약)`
                      : `2라운드 전체 ${dr.pickNumber}순위로 ${dr.draftedTeam.name}에 지명되었어요! 구단과 투웨이(Two-Way) 계약을 체결해 콜업을 노리거나 G리그·KBL 진로를 선택할 수 있어요.`}
                  </div>
                </div>
              ) : dr.twoWayOfferTeam ? (
                <div className="max-w-xl mx-auto p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <TeamEmblem team={dr.twoWayOfferTeam} size="lg" className="mx-auto" />
                  <p className="text-sm font-bold text-slate-900">
                    아쉽게도 드래프트 1·2라운드 60명 안에 호명되지 못했어요.
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    하지만 직전 시즌 실전 퍼포먼스와 잠재력을 눈여겨본{' '}
                    <strong className="text-amber-700">
                      {dr.twoWayOfferTeam.name}
                    </strong>{' '}
                    스카우팅 팀에서 라스베이거스 서머리그 초청과 함께{' '}
                    <strong className="text-orange-600">투웨이(Two-Way) 계약</strong>을 공식 제안했어요!
                  </p>
                </div>
              ) : (
                <div className="max-w-xl mx-auto p-6 rounded-2xl bg-amber-50 border border-amber-200 space-y-3">
                  <p className="text-sm font-bold text-amber-900">
                    드래프트 미지명(Undrafted) 및 NBA 구단 투웨이 오퍼 부재
                  </p>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    구단 스카우팅 AI 심사 결과(직전 시즌 실전 기록·효율·생체역학 적합도), 아쉽게도 NBA 30개
                    구단으로부터 투웨이(Two-Way) 계약을 제안받지 못했어요. NBA G리그 공개 트라이아웃에 참가해
                    밑바닥부터 실력을 증명하거나, 국내 KBL 무대로 복귀해 기량을 끌어올려 보세요!
                  </p>
                </div>
              )}

              {/* 계약 체결 선택 버튼들 */}
              <div className="max-w-xl mx-auto space-y-3 pt-2">
                {isKbl && (
                  <button
                    type="button"
                    onClick={() => finalizeDraftSigning('KBL')}
                    className="w-full py-4 px-6 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    {dr.draftedTeam?.name} 신인 루키 계약서 서명하기
                  </button>
                )}

                {!isKbl && isFirstRound && (
                  <button
                    type="button"
                    onClick={() => finalizeDraftSigning('NBA_STANDARD')}
                    className="w-full py-4 px-6 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Award className="w-5 h-5" />
                    {dr.draftedTeam?.name} 1라운드 NBA 정식 루키 보장 계약 체결하기
                  </button>
                )}

                {!isKbl && (isSecondRound || isUndrafted) && (
                  <>
                    {twoWayTargetTeam && (
                      <button
                        type="button"
                        onClick={() => finalizeDraftSigning('TWO_WAY')}
                        className="w-full py-4 px-6 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <Sparkles className="w-5 h-5" />
                        {twoWayTargetTeam.name} NBA 투웨이(Two-Way) 계약 수락하기
                      </button>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => finalizeDraftSigning('GLEAGUE')}
                        className="py-3.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
                      >
                        🇺🇸 NBA G리그 공개 트라이아웃 입단
                      </button>
                      <button
                        type="button"
                        onClick={() => finalizeDraftSigning('KBL')}
                        className="py-3.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
                      >
                        🇰🇷 국내 KBL 복귀 후 재도전
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}
