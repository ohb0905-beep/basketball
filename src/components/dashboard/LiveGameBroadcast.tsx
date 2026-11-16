'use client';

import React from 'react';
import { useCareerStore } from '../../store/useCareerStore';
import { LiveTacticId } from '../../types/game';
import {
  Radio,
  Flame,
  Snowflake,
  Activity,
  Shield,
  Zap,
  Users,
  BatteryCharging,
  FastForward,
  Play,
  Trophy,
  Award,
  CheckCircle2,
} from 'lucide-react';

const TACTIC_OPTIONS: {
  id: LiveTacticId;
  label: string;
  sub: string;
  desc: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'ACE_HERO',
    label: '에이스 볼 (공격 집중)',
    sub: 'Usage ▲ · 체력 소모 ▲',
    desc: '본인이 공격을 주도하여 득점 볼륨을 극대화하지만 체력이 빠르게 소모됩니다.',
    icon: <Zap className="w-4 h-4 text-amber-400" />,
  },
  {
    id: 'LOCKDOWN_DEFENSE',
    label: '락다운 수비 (수비 올인)',
    sub: '상대 득점 ▼ · 스틸/블록 ▲',
    desc: '상대 주득점원을 봉쇄하고 수비 지표를 끌어올립니다. 파울과 체력 소모에 유의하세요.',
    icon: <Shield className="w-4 h-4 text-sky-400" />,
  },
  {
    id: 'UNSELFISH_PASS',
    label: '이타적 패스 게임',
    sub: '어시스트 ▲ · 팀 야투율 ▲',
    desc: '오픈 찬스의 동료를 살려주며 팀 전체 득점 효율을 높이고 체력을 아낍니다.',
    icon: <Users className="w-4 h-4 text-emerald-400" />,
  },
  {
    id: 'PACE_CONSERVE',
    label: '페이스 조절 (체력 세이브)',
    sub: '체력 회복 ▲ · 파울 억제',
    desc: '무리한 돌파를 자제하고 코트 밸런스를 유지하며 클러치 쿼터를 대비합니다.',
    icon: <BatteryCharging className="w-4 h-4 text-indigo-400" />,
  },
];

export const LiveGameBroadcast: React.FC = () => {
  const career = useCareerStore((s) => s.career);
  const setLiveGameTactic = useCareerStore((s) => s.setLiveGameTactic);
  const playNextLiveQuarter = useCareerStore((s) => s.playNextLiveQuarter);
  const skipLiveGame = useCareerStore((s) => s.skipLiveGame);
  const closeLiveGameAndReturn = useCareerStore((s) => s.closeLiveGameAndReturn);

  if (!career || !career.liveGame) return null;
  const live = career.liveGame;

  const isAsianGames = live.gameType === 'ASIAN_GAMES_FINAL';
  const fga = live.playerStats.fga;
  const fgm = live.playerStats.fgm;
  const tpa = live.playerStats.tpa;
  const tpm = live.playerStats.tpm;
  const fgPct = fga > 0 ? ((fgm / fga) * 100).toFixed(1) : '0.0';
  const tpPct = tpa > 0 ? ((tpm / tpa) * 100).toFixed(1) : '0.0';

  const nextQNum = live.quarter + 1;
  const nextQuarterLabel =
    nextQNum < 4
      ? `${nextQNum}쿼터 진행`
      : nextQNum === 4
      ? '4쿼터(정규 마지막 쿼터) 진행'
      : `연장전(OT${nextQNum - 4}) 진행`;

  return (
    <div data-testid="live-game-broadcast" className="space-y-5">
      {/* 상단 라이브 브로드캐스트 전광판 */}
      <div className="bg-slate-900 border border-rose-500/40 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-black tracking-wider uppercase animate-pulse">
              <Radio className="w-3.5 h-3.5" />
              LIVE BROADCAST
            </span>
            <h3 className="text-base sm:text-lg font-black text-white">
              {live.title}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {live.momentum === 'HOT' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-orange-500/20 border border-orange-500/40 text-orange-300 text-xs font-bold">
                <Flame className="w-3.5 h-3.5" />
                HOT STREAK (야투 보너스)
              </span>
            )}
            {live.momentum === 'COLD' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-500/20 border border-sky-500/40 text-sky-300 text-xs font-bold">
                <Snowflake className="w-3.5 h-3.5" />
                COLD (야투 난조)
              </span>
            )}
            {live.momentum === 'NEUTRAL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold">
                <Activity className="w-3.5 h-3.5" />
                평정심 유지
              </span>
            )}
          </div>
        </div>

        {/* 스코어보드 */}
        <div className="grid grid-cols-3 items-center gap-4 py-4 px-3 bg-slate-950/90 rounded-xl border border-slate-800">
          <div className="text-center">
            <div className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-1">
              OUR TEAM
            </div>
            <div className="text-sm sm:text-base font-black text-white truncate">
              {live.playerTeam.name}
            </div>
            <div className="text-3xl sm:text-5xl font-black text-white font-mono mt-1">
              {live.teamScore}
            </div>
          </div>

          <div className="text-center flex flex-col items-center justify-center">
            <span className="px-3 py-1 rounded-md bg-slate-800 border border-slate-700 text-xs font-black text-amber-400 uppercase tracking-widest">
              {live.isFinished
                ? 'FINAL'
                : live.quarter === 0
                ? 'TIP-OFF 대기'
                : `${live.quarter <= 4 ? `${live.quarter}Q` : `OT${live.quarter - 4}`} 종료`}
            </span>
            <div className="text-xs text-slate-400 mt-2 font-mono">
              상대 전력 {live.opponentTeam.rating}
            </div>
          </div>

          <div className="text-center">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              OPPONENT
            </div>
            <div className="text-sm sm:text-base font-black text-slate-200 truncate">
              {live.opponentTeam.name}
            </div>
            <div className="text-3xl sm:text-5xl font-black text-slate-300 font-mono mt-1">
              {live.oppScore}
            </div>
          </div>
        </div>

        {/* 실시간 선수 박스스코어 & 체력/파울 게이지 */}
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-8 grid grid-cols-4 sm:grid-cols-7 gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-center">
            <div>
              <div className="text-[10px] text-slate-500 font-bold">PTS</div>
              <div className="text-lg font-black text-amber-400 font-mono">
                {live.playerStats.pts}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 font-bold">REB</div>
              <div className="text-lg font-black text-white font-mono">
                {live.playerStats.reb}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 font-bold">AST</div>
              <div className="text-lg font-black text-emerald-400 font-mono">
                {live.playerStats.ast}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 font-bold">STL</div>
              <div className="text-lg font-black text-sky-400 font-mono">
                {live.playerStats.stl}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 font-bold">BLK</div>
              <div className="text-lg font-black text-indigo-400 font-mono">
                {live.playerStats.blk}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 font-bold">FG%</div>
              <div className="text-sm font-bold text-slate-200 font-mono mt-1">
                {fgm}/{fga} ({fgPct}%)
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 font-bold">3P%</div>
              <div className="text-sm font-bold text-slate-200 font-mono mt-1">
                {tpm}/{tpa} ({tpPct}%)
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400 font-bold">실시간 체력 (Stamina)</span>
                <span className="font-mono font-bold text-emerald-400">
                  {live.playerStats.stamina}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    live.playerStats.stamina >= 60
                      ? 'bg-emerald-500'
                      : live.playerStats.stamina >= 35
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${live.playerStats.stamina}%` }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-400 font-bold">개인 파울 (Fouls)</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5, 6].map((idx) => (
                  <span
                    key={idx}
                    className={`w-2.5 h-2.5 rounded-sm ${
                      idx <= live.playerStats.fouls
                        ? idx >= 5
                          ? 'bg-rose-500'
                          : 'bg-amber-400'
                        : 'bg-slate-800'
                    }`}
                  />
                ))}
                <span className="ml-1 font-mono font-bold text-slate-300">
                  {live.playerStats.fouls} PF
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 작전 타임 전술 선택 (경기 진행 중일 때만) */}
        {!live.isFinished && (
          <div className="mt-5 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-black text-slate-300 uppercase tracking-wider">
                📋 쿼터 작전 타임 전술 지시 (Tactical Adjustment)
              </span>
              <span className="text-[11px] text-slate-400">
                선택한 전술이 다음 쿼터 공수 마진과 체력 소모에 즉시 반영됩니다
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {TACTIC_OPTIONS.map((tactic) => {
                const active = live.currentTactic === tactic.id;
                return (
                  <button
                    key={tactic.id}
                    type="button"
                    onClick={() => setLiveGameTactic(tactic.id)}
                    className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                      active
                        ? 'bg-orange-500/15 border-orange-500 text-white shadow-md'
                        : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black flex items-center gap-1.5">
                        {tactic.icon}
                        {tactic.label}
                      </span>
                      {active && (
                        <span className="text-[10px] font-black text-orange-400">
                          선택됨
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-bold text-amber-300/90 mb-1">
                      {tactic.sub}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      {tactic.desc}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* 쿼터 진행 및 스킵 액션 버튼 */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={playNextLiveQuarter}
                className="flex-1 min-w-[200px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black text-sm shadow-lg transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                🏀 {nextQuarterLabel}
              </button>
              <button
                type="button"
                onClick={skipLiveGame}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-sm transition-all cursor-pointer"
              >
                <FastForward className="w-4 h-4" />
                ⏩ 경기 결과 바로 보기 (스킵)
              </button>
            </div>
          </div>
        )}

        {/* 경기 종료 시 최종 결과 배너 */}
        {live.isFinished && live.finalOutcome && (
          <div
            className={`mt-5 p-4 rounded-xl border ${
              live.finalOutcome.won
                ? 'bg-amber-500/15 border-amber-500/40'
                : 'bg-slate-950/90 border-slate-700'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {live.finalOutcome.won ? (
                    <Trophy className="w-5 h-5 text-amber-400" />
                  ) : (
                    <Award className="w-5 h-5 text-slate-400" />
                  )}
                  <span className="text-base font-black text-white">
                    {live.finalOutcome.headline}
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  {isAsianGames
                    ? live.finalOutcome.grantedMilitaryExemption
                      ? '🎖️ 아시안게임 금메달 획득으로 예술·체육요원 병역특례가 즉시 적용되었으며 전 구단 스카우트 평가가 상승했습니다!'
                      : '아쉽게 은메달에 머물렀지만 국제 대회 결승 무대 경험으로 스탯 성장을 얻었습니다.'
                    : live.finalOutcome.wonFinalsMvp
                    ? '🏆 파이널 MVP와 챔피언십 반지가 시즌 기록 및 영구 트로피 캐비닛에 등재되었습니다!'
                    : live.finalOutcome.won
                    ? '💍 챔피언십 우승 반지가 시즌 기록 및 리그별 트로피 캐비닛에 등재되었습니다!'
                    : '파이널 준우승으로 시즌을 마감했습니다. 다음 시즌 재도전을 준비하세요.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeLiveGameAndReturn}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-lg transition-all cursor-pointer shrink-0"
              >
                <CheckCircle2 className="w-4 h-4" />
                결과 확정 및 대시보드 복귀
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 쿼터별 생중계 텍스트 로그 */}
      {live.quarterLogs.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
            🎙️ 쿼터별 중계 하이라이트 로그 (Play-by-Play)
          </h4>
          <div className="space-y-3">
            {live.quarterLogs.map((qLog) => (
              <div
                key={qLog.quarter}
                className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-800/80">
                  <span className="text-xs font-black text-orange-400">
                    {qLog.label}
                  </span>
                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span className="text-slate-300">
                      쿼터 득점: {qLog.teamPts} - {qLog.oppPts}
                    </span>
                    <span className="text-amber-400 font-bold">
                      본인 기록: {qLog.playerPts}점 {qLog.playerReb}리바 {qLog.playerAst}어시
                    </span>
                  </div>
                </div>
                <ul className="space-y-1 text-xs text-slate-300 leading-relaxed">
                  {qLog.playByPlay.map((line, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-slate-600 select-none">•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
