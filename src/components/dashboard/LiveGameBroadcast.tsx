'use client';

import React from 'react';
import {
  CheckCircle2,
  FastForward,
  Flame,
  Play,
  Shield,
  Target,
  Trophy,
  Users,
} from 'lucide-react';
import { useCareerStore } from '../../store/useCareerStore';
import { LiveTacticId } from '../../types/game';
import { TeamEmblem } from '../common/TeamEmblem';

const TACTIC_OPTIONS: {
  id: LiveTacticId;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'ACE_HERO',
    label: '🔥 에이스 클러치 모드',
    desc: '공격 주도권을 극대화해 직접 득점을 노려요 (득점↑, 체력 소모↑).',
    icon: Flame,
  },
  {
    id: 'UNSELFISH_PASS',
    label: '🪄 이타적 패스 & 찬스 메이킹',
    desc: '수비를 끌어당긴 뒤 동료 찬스를 살려줘요 (어시스트·팀 야투율↑).',
    icon: Users,
  },
  {
    id: 'LOCKDOWN_DEFENSE',
    label: '🛡️ 질식 수비 & 에이스 봉쇄',
    desc: '상대 주포를 전담 마크해 실점을 억제해요 (수비·스틸↑, 파울 주의).',
    icon: Shield,
  },
  {
    id: 'PACE_CONSERVE',
    label: '⚖️ 페이스 조절 & 체력 안배',
    desc: '무리한 공격을 줄이고 4쿼터 승부처 체력을 비축해요.',
    icon: Target,
  },
];

export function LiveGameBroadcast() {
  const career = useCareerStore((s) => s.career);
  const setLiveGameTactic = useCareerStore((s) => s.setLiveGameTactic);
  const playNextLiveQuarter = useCareerStore((s) => s.playNextLiveQuarter);
  const skipLiveGame = useCareerStore((s) => s.skipLiveGame);
  const closeLiveGameAndReturn = useCareerStore((s) => s.closeLiveGameAndReturn);

  const liveGame = career?.liveGame;
  if (!career || !liveGame) return null;

  const userWon = liveGame.teamScore > liveGame.oppScore;
  const ps = liveGame.playerStats;
  const fgPct = ps.fga > 0 ? ((ps.fgm / ps.fga) * 100).toFixed(1) : '0.0';

  return (
    <div
      data-testid="live-game-broadcast"
      className="bg-white text-slate-900 border-2 border-orange-500 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6"
    >
      {/* 상단 중계 배너 */}
      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-200 pb-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            ● LIVE BROADCAST ·{' '}
            {liveGame.isFinished
              ? '경기 종료'
              : liveGame.quarter === 0
              ? 'TIP-OFF 대기'
              : `${liveGame.quarter}쿼터 종료`}
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1.5">
            {liveGame.title}
          </h2>
          <p className="text-xs text-slate-500">{liveGame.subtitle}</p>
        </div>

        {!liveGame.isFinished && (
          <button
            type="button"
            onClick={skipLiveGame}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-bold text-slate-700 transition cursor-pointer"
          >
            <FastForward className="w-3.5 h-3.5" />
            경기 끝까지 빠르게 진행
          </button>
        )}
      </div>

      {/* 전광판 스코어보드 */}
      <div className="grid grid-cols-3 items-center bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center">
        <div className="flex flex-col items-center gap-2">
          <TeamEmblem team={liveGame.playerTeam} size="md" />
          <div className="text-xs font-bold text-slate-700">{liveGame.playerTeam.name}</div>
          <div className="text-4xl sm:text-5xl font-black text-orange-600 tabular-nums">
            {liveGame.teamScore}
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
            {liveGame.isFinished
              ? 'FINAL'
              : liveGame.quarter === 0
              ? '1Q 시작 전'
              : `${liveGame.quarter}Q 완료`}
          </span>
          <div className="text-xs text-slate-400 font-bold">VS</div>
          <span className="inline-block text-[11px] font-bold text-emerald-600">
            체력 {ps.stamina}% · 반칙 {ps.fouls}개
          </span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <TeamEmblem team={liveGame.opponentTeam} size="md" />
          <div className="text-xs font-bold text-slate-700">{liveGame.opponentTeam.name}</div>
          <div className="text-4xl sm:text-5xl font-black text-slate-900 tabular-nums">
            {liveGame.oppScore}
          </div>
        </div>
      </div>

      {/* 내 선수 실시간 스탯 라인 */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-center">
        {[
          { label: 'PTS', val: ps.pts },
          { label: 'REB', val: ps.reb },
          { label: 'AST', val: ps.ast },
          { label: 'STL', val: ps.stl },
          { label: 'BLK', val: ps.blk },
          {
            label: 'FG',
            val: `${ps.fgm}/${ps.fga} (${fgPct}%)`,
          },
        ].map((st) => (
          <div key={st.label}>
            <div className="text-[10px] font-bold text-slate-500">{st.label}</div>
            <div className="text-sm font-black text-slate-900 mt-0.5 tabular-nums">
              {st.val}
            </div>
          </div>
        ))}
      </div>

      {/* 작전 지시 선택 */}
      {!liveGame.isFinished && (
        <div className="space-y-2.5">
          <div className="text-xs font-bold text-slate-700">
            다음 쿼터 전술 지시 선택 ({liveGame.quarter >= 4 ? '연장전(OT)' : `${liveGame.quarter + 1}쿼터`})
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {TACTIC_OPTIONS.map((t) => {
              const Icon = t.icon;
              const active = liveGame.currentTactic === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setLiveGameTactic(t.id)}
                  className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex items-start gap-3 ${
                    active
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-black text-slate-900">{t.label}</div>
                    <div className="text-[11px] text-slate-600 mt-0.5">{t.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 쿼터별 중계 로그 */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 max-h-56 overflow-y-auto space-y-3">
        {liveGame.quarterLogs.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">
            전술을 선택한 뒤 아래 버튼을 눌러 결승전 1쿼터를 시작해 보세요!
          </p>
        ) : (
          liveGame.quarterLogs
            .slice()
            .reverse()
            .map((qLog) => (
              <div
                key={qLog.quarter}
                className="p-3 rounded-xl bg-white border border-slate-200 space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs font-extrabold text-orange-600">
                  <span>{qLog.label} 요약</span>
                  <span>
                    쿼터 득점 {qLog.teamPts} : {qLog.oppPts} (본인 +{qLog.playerPts}점 +{qLog.playerReb}리바 +{qLog.playerAst}도움)
                  </span>
                </div>
                <ul className="space-y-1 text-xs text-slate-700">
                  {qLog.playByPlay.map((line, idx) => (
                    <li key={idx}>• {line}</li>
                  ))}
                </ul>
              </div>
            ))
        )}
      </div>

      {liveGame.finalOutcome && (
        <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 text-xs sm:text-sm font-bold text-orange-800">
          {liveGame.finalOutcome.headline}
        </div>
      )}

      {/* 하단 액션 버튼 */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {!liveGame.isFinished ? (
          <button
            type="button"
            onClick={playNextLiveQuarter}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-black text-sm flex items-center justify-center gap-2 transition shadow-sm cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            {liveGame.quarter >= 4 ? '연장전(OT)' : `${liveGame.quarter + 1}쿼터`} 실시간 중계 진행하기
          </button>
        ) : (
          <button
            type="button"
            onClick={closeLiveGameAndReturn}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-sm flex items-center justify-center gap-2 transition shadow-sm cursor-pointer"
          >
            {userWon ? (
              <>
                <Trophy className="w-4 h-4" />
                우승 확정 및 오프시즌 에이전트 데스크로 복귀
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                경기 결과 확인 및 오프시즌 복귀하기
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
