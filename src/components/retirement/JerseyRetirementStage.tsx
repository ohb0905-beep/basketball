'use client';

import React, { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowUp, RotateCcw } from 'lucide-react';
import { JerseyCeremonySummary } from '../../types/game';
import { TeamEmblem } from '../common/TeamEmblem';

interface JerseyRetirementStageProps {
  playerName: string;
  jerseyNumber: string;
  startYear: number;
  endYear: number;
  ceremony: JerseyCeremonySummary;
  initialRaised?: boolean;
}

export function JerseyRetirementStage({
  playerName,
  jerseyNumber,
  startYear,
  endYear,
  ceremony,
  initialRaised = false,
}: JerseyRetirementStageProps) {
  const prefersReducedMotion = useReducedMotion();
  const [isRaised, setIsRaised] = useState(initialRaised);

  const team = ceremony.honoredTeam;
  const primaryBg = team.primaryColor || '#1e293b';

  return (
    <div className="space-y-4">
      {/* 아레나 천장 게양 스테이지 */}
      <div
        data-testid="jersey-retirement-stage"
        className="relative rounded-[20px] overflow-hidden bg-[#111318] text-white border border-white/10"
      >
        {/* 천장 철골 서까래 라인 */}
        <svg
          viewBox="0 0 600 120"
          className="w-full h-[76px] block opacity-30 pointer-events-none"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <line x1="0" y1="24" x2="600" y2="24" stroke="#94a3b8" strokeWidth="2" />
          <line x1="0" y1="52" x2="600" y2="52" stroke="#64748b" strokeWidth="1.5" />
          <path
            d="M0 24 L60 52 L120 24 L180 52 L240 24 L300 52 L360 24 L420 52 L480 24 L540 52 L600 24"
            fill="none"
            stroke="#64748b"
            strokeWidth="1.2"
          />
        </svg>

        {/* 게양 시 점등되는 스포트라이트 */}
        <motion.div
          aria-hidden="true"
          initial={false}
          animate={{ opacity: isRaised ? 1 : 0.15 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.7 }}
          className="pointer-events-none absolute inset-x-0 top-0 h-[320px]"
          style={{
            background:
              'radial-gradient(ellipse 55% 65% at 50% 12%, rgba(251, 191, 36, 0.24), rgba(255, 255, 255, 0.04) 55%, transparent 80%)',
          }}
        />

        {/* 무대 본문 */}
        <div className="relative px-5 pb-7 pt-1 flex flex-col items-center">
          <div className="relative w-full h-[265px] flex items-center justify-center">
            {/* 천장 케이블 가이드 */}
            <div
              aria-hidden="true"
              className="absolute top-0 bottom-[60%] left-1/2 -translate-x-1/2 w-[88px] flex justify-between pointer-events-none"
            >
              <div className="w-[1px] h-full bg-white/25" />
              <div className="w-[1px] h-full bg-white/25" />
            </div>

            {/* 영구결번 배너 */}
            <motion.div
              data-testid="jersey-banner"
              data-raised={isRaised ? 'true' : 'false'}
              initial={false}
              animate={{
                y: isRaised ? -28 : 28,
                scale: isRaised ? 1 : 0.96,
              }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 1.05, ease: [0.16, 1, 0.3, 1] }
              }
              className="relative w-[178px] rounded-t-xl rounded-b-[28px] px-4 py-5 text-center shadow-2xl border border-white/25"
              style={{
                backgroundColor: primaryBg,
              }}
            >
              {/* 상단 걸이봉 */}
              <div
                aria-hidden="true"
                className="w-full h-[3px] rounded-full bg-white/50 mb-3"
              />
              <div className="flex justify-center mb-2">
                <div className="w-9 h-9 rounded-full bg-white/95 p-1 flex items-center justify-center">
                  <TeamEmblem team={team} size="xs" />
                </div>
              </div>
              <p className="text-[11px] font-bold tracking-[0.08em] text-white/80 truncate">
                {team.shortName}
              </p>
              <p className="text-[48px] font-bold leading-none tracking-[-0.04em] text-white tabular-nums my-2">
                {jerseyNumber}
              </p>
              <p className="text-[15px] font-bold text-white truncate">
                {playerName}
              </p>
              <p className="text-[11px] font-medium text-white/75 tabular-nums mt-1">
                {startYear} – {endYear}
              </p>
            </motion.div>
          </div>

          {/* 상태 안내 및 게양 인터랙션 버튼 */}
          <div className="w-full max-w-[360px] text-center space-y-3 pt-2">
            <p className="text-[13px] font-semibold text-[#fbbf24]">
              {isRaised
                ? `${team.name} 아레나 천장에 #${jerseyNumber} 영구결번 헌액 완료`
                : `${team.name} 영구결번 공식 게양식 대기 중`}
            </p>

            {!isRaised ? (
              <button
                type="button"
                data-testid="raise-jersey-btn"
                onClick={() => setIsRaised(true)}
                className="w-full min-h-[48px] px-5 rounded-xl bg-[#fbbf24] hover:bg-[#f59e0b] text-[#111318] text-[15px] font-bold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors t-tap"
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                <span>영구결번 배너 천장 게양하기</span>
              </button>
            ) : (
              <button
                type="button"
                data-testid="replay-jersey-btn"
                onClick={() => setIsRaised(false)}
                className="min-h-[40px] px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white/85 text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors t-tap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>다시 게양 보기</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 대표 구단 헌신 기록 & 구단 헌정사 */}
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-1 py-3 border-y border-[var(--t-g100)] text-center tabular-nums">
          <div>
            <span className="block text-[17px] font-bold text-[var(--t-g900)]">
              {ceremony.honoredTeamSeasons}시즌
            </span>
            <span className="text-[11px] text-[var(--t-g500)]">구단 재적</span>
          </div>
          <div>
            <span className="block text-[17px] font-bold text-[var(--t-g900)]">
              {ceremony.honoredTeamPoints.toLocaleString()}
            </span>
            <span className="text-[11px] text-[var(--t-g500)]">구단 득점</span>
          </div>
          <div>
            <span className="block text-[17px] font-bold text-[var(--t-gold)]">
              {ceremony.honoredTeamChamps}회
            </span>
            <span className="text-[11px] text-[var(--t-g500)]">우승</span>
          </div>
          <div>
            <span className="block text-[17px] font-bold text-[var(--t-accent)]">
              {ceremony.honoredTeamMvps}/{ceremony.honoredTeamAllStars}
            </span>
            <span className="text-[11px] text-[var(--t-g500)]">MVP/올스타</span>
          </div>
        </div>

        <p className="text-[14px] text-[var(--t-g700)] leading-[1.7]">
          {ceremony.tributeMessage}
        </p>
      </div>
    </div>
  );
}
