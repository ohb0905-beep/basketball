'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCareerStore } from '../../store/useCareerStore';
import { TeamEmblem } from '../common/TeamEmblem';

export function DraftLiveStage() {
  const career = useCareerStore((s) => s.career);
  const finalizeDraftSigning = useCareerStore((s) => s.finalizeDraftSigning);
  const prefersReducedMotion = useReducedMotion() ?? false;

  const [stage, setStage] = useState<0 | 1 | 2 | 3>(prefersReducedMotion ? 3 : 0);
  const [tickerPick, setTickerPick] = useState(1);

  const dr = career?.draftResult;
  const targetPick = dr?.pickNumber ?? (dr?.draftType === 'KBL' ? 20 : 60);

  useEffect(() => {
    if (stage !== 0) return;
    const stopAt = Math.max(1, targetPick - 1);
    if (tickerPick >= stopAt) {
      const t = setTimeout(() => setStage(1), 400);
      return () => clearTimeout(t);
    }
    const step = Math.max(1, Math.ceil((stopAt - tickerPick) / 6));
    const timer = setTimeout(() => {
      setTickerPick((prev) => Math.min(stopAt, prev + step));
    }, 100);
    return () => clearTimeout(timer);
  }, [stage, tickerPick, targetPick]);

  useEffect(() => {
    if (stage === 1) {
      const t = setTimeout(() => setStage(2), 850);
      return () => clearTimeout(t);
    }
    if (stage === 2) {
      const t = setTimeout(() => setStage(3), 1000);
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
    <div className="max-w-[560px] mx-auto space-y-3">
      <section className="t-card text-center space-y-6">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--t-g100)]">
          <span className="text-[12px] font-bold text-[var(--t-accent-ink)]">
            {isKbl ? 'KBL 신인드래프트 LIVE' : 'NBA DRAFT LIVE'}
          </span>

          {stage < 3 && (
            <button
              type="button"
              onClick={() => setStage(3)}
              className="text-[12px] font-semibold text-[var(--t-g500)] hover:text-[var(--t-g900)] cursor-pointer"
            >
              건너뛰기
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {stage === 0 && (
            <motion.div
              key="stage-0"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="py-12 space-y-3"
            >
              <span className="text-[12px] font-bold text-[var(--t-g500)] tracking-wider">
                DRAFT BOARD
              </span>
              <div className="text-[52px] font-bold text-[var(--t-accent)] tabular-nums leading-none">
                #{tickerPick}
              </div>
              <p className="text-[14px] text-[var(--t-g600)]">
                지명 순위가 차례로 발표되고 있습니다
              </p>
            </motion.div>
          )}

          {stage === 1 && (
            <motion.div
              key="stage-1"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="py-14 space-y-2"
            >
              <h2 className="text-[22px] font-bold tracking-[-0.03em] text-[var(--t-g900)]">
                커미셔너가 단상에 올랐습니다
              </h2>
              <p className="text-[14px] text-[var(--t-g500)]">
                지명 봉투를 개봉합니다
              </p>
            </motion.div>
          )}

          {stage === 2 && (
            <motion.div
              key="stage-2"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="py-12 space-y-3"
            >
              <span className="text-[12px] font-bold text-[var(--t-ok)]">
                OFFICIAL CALLOUT
              </span>
              <h2 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.03em] text-[var(--t-g900)] leading-snug">
                {isUndrafted
                  ? '60순위까지 지명이 모두 종료되었습니다'
                  : isKbl
                  ? `“전체 ${dr.pickNumber}순위 ${dr.draftedTeam?.name}, ${career.name}!”`
                  : `“With the #${dr.pickNumber} pick, the ${dr.draftedTeam?.name} select ${career.name}!”`}
              </h2>
            </motion.div>
          )}

          {stage === 3 && (
            <motion.div
              key="stage-3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <span className="text-[12px] font-bold text-[var(--t-accent-ink)] tabular-nums">
                  {isUndrafted
                    ? 'UNDRAFTED'
                    : `${dr.draftType} · ${dr.round}라운드 · 전체 ${dr.pickNumber}순위`}
                </span>
                <h1 className="text-[26px] font-bold tracking-[-0.03em] text-[var(--t-g900)]">
                  {isUndrafted
                    ? '드래프트 미지명'
                    : `${dr.draftedTeam?.name} 지명`}
                </h1>
              </div>

              {dr.draftedTeam ? (
                <div className="p-5 rounded-2xl bg-[var(--t-g100)] flex flex-col items-center space-y-3">
                  <TeamEmblem team={dr.draftedTeam} size="xl" />
                  <div className="space-y-1">
                    <p className="text-[13px] font-semibold text-[var(--t-g600)] tabular-nums">
                      {dr.draftedTeam.city} · 전력 {dr.draftedTeam.rating}
                      {dr.draftedTeam.conference
                        ? ` · ${dr.draftedTeam.conference === 'EAST' ? '동부' : '서부'}`
                        : ''}
                    </p>
                    <p className="text-[13px] text-[var(--t-g600)] leading-relaxed">
                      {dr.draftedTeam.prestigeDesc}
                    </p>
                  </div>
                </div>
              ) : dr.twoWayOfferTeam ? (
                <div className="p-5 rounded-2xl bg-[var(--t-g100)] flex flex-col items-center space-y-2.5">
                  <TeamEmblem team={dr.twoWayOfferTeam} size="lg" />
                  <p className="text-[15px] font-bold text-[var(--t-g900)]">
                    {dr.twoWayOfferTeam.name} 투웨이 오퍼 도착
                  </p>
                  <p className="text-[13px] text-[var(--t-g600)] leading-relaxed">
                    지명에는 실패했지만 서머리그 및 투웨이 계약을 제안받았습니다.
                  </p>
                </div>
              ) : (
                <div className="p-5 rounded-2xl bg-[var(--t-g100)] space-y-1.5">
                  <p className="text-[15px] font-bold text-[var(--t-g900)]">
                    투웨이 오퍼 부재
                  </p>
                  <p className="text-[13px] text-[var(--t-g600)] leading-relaxed">
                    G리그 트라이아웃 또는 KBL 복귀로 다시 도전할 수 있습니다.
                  </p>
                </div>
              )}

              <div className="space-y-2.5 pt-1">
                {isKbl && (
                  <button
                    type="button"
                    onClick={() => finalizeDraftSigning('KBL')}
                    className="t-cta"
                  >
                    {dr.draftedTeam?.shortName} 신인 계약 서명
                  </button>
                )}

                {!isKbl && isFirstRound && (
                  <button
                    type="button"
                    onClick={() => finalizeDraftSigning('NBA_STANDARD')}
                    className="t-cta"
                  >
                    1라운드 루키 보장 계약 체결
                  </button>
                )}

                {!isKbl && (isSecondRound || isUndrafted) && (
                  <>
                    {twoWayTargetTeam && (
                      <button
                        type="button"
                        onClick={() => finalizeDraftSigning('TWO_WAY')}
                        className="t-cta"
                      >
                        {twoWayTargetTeam.shortName} 투웨이 계약 수락
                      </button>
                    )}

                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => finalizeDraftSigning('GLEAGUE')}
                        className="t-cta-sub"
                      >
                        G리그 트라이아웃
                      </button>
                      <button
                        type="button"
                        onClick={() => finalizeDraftSigning('KBL')}
                        className="t-cta-sub"
                      >
                        KBL 복귀
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
