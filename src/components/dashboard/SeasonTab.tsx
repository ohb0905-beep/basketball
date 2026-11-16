'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Briefcase,
  Lock,
  Newspaper,
  Play,
  Sparkles,
  Star,
  Trophy,
} from 'lucide-react';
import { LEAGUE_CONFIG } from '../../data/leagues';
import { useCareerStore } from '../../store/useCareerStore';
import { OffseasonOption } from '../../types/game';
import { TeamEmblem } from '../common/TeamEmblem';

function formatSalaryOffer(amountUsd?: number): string | null {
  if (!amountUsd || amountUsd <= 0) return null;
  if (amountUsd >= 1000000) {
    return `연봉 $${(amountUsd / 1000000).toFixed(2)}M`;
  }
  if (amountUsd >= 1000) {
    return `연봉 $${Math.round(amountUsd / 1000).toLocaleString()}K`;
  }
  return `연봉 $${amountUsd.toLocaleString()}`;
}

export function SeasonTab() {
  const career = useCareerStore((s) => s.career);
  const playSeason = useCareerStore((s) => s.playSeason);
  const selectOffseasonOption = useCareerStore((s) => s.selectOffseasonOption);
  const triggerMidSeasonCrossroads = useCareerStore((s) => s.triggerMidSeasonCrossroads);
  const requestTrade = useCareerStore((s) => s.requestTrade);

  const [isSimulating, setIsSimulating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState(
    '시즌 개막 준비가 완료되었어요. 버튼을 눌러 이번 시즌을 진행해 보세요!'
  );

  const midSeasonDone = career?.midSeasonEventTriggeredThisYear ?? false;
  const hasPendingEvent = career?.pendingEvent !== null;
  const offseasonLocked = career?.offseasonLocked ?? false;

  // 전반기 50% 반환점 모달 선택 완료 후 자동으로 후반기(50% -> 100%) 재개
  useEffect(() => {
    if (
      !isSimulating &&
      progress === 50 &&
      midSeasonDone &&
      !hasPendingEvent &&
      !offseasonLocked
    ) {
      const timer = setTimeout(() => {
        setIsSimulating(true);
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isSimulating, progress, midSeasonDone, hasPendingEvent, offseasonLocked]);

  useEffect(() => {
    if (!isSimulating) return;

    const messages = [
      '프리시즌 트레이닝 캠프에서 전술 호흡을 맞추고 있어요...',
      '정규시즌 초반 로테이션 경쟁이 치열하게 펼쳐지고 있어요!',
      '올스타 브레이크 반환점을 돌며 체력과 슛 감각을 끌어올려요!',
      '후반기 순위 싸움과 플레이오프 진출 경쟁이 절정에 달했어요!',
    ];

    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 25;
        const msgIdx = Math.min(messages.length - 1, Math.floor(next / 30));
        setStatusMessage(messages[msgIdx]);

        // 시즌 반환점(50%) 도달 시: 아직 이번 시즌 중반 분기점이 발생하지 않았다면 일시 정지 후 발동
        if (next === 50 && !midSeasonDone) {
          clearInterval(interval);
          setTimeout(() => {
            setIsSimulating(false);
            triggerMidSeasonCrossroads();
          }, 80);
          return 50;
        }

        if (next >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsSimulating(false);
            setProgress(100);
            playSeason();
          }, 120);
          return 100;
        }
        return next;
      });
    }, 90);

    return () => clearInterval(interval);
  }, [isSimulating, midSeasonDone, playSeason, triggerMidSeasonCrossroads]);

  if (!career) return null;

  const leagueInfo = LEAGUE_CONFIG[career.league];
  const lastSeason =
    career.seasonLogs.length > 0
      ? career.seasonLogs[career.seasonLogs.length - 1]
      : null;

  const handleStartSeason = () => {
    if (isSimulating || career.offseasonLocked) return;
    setProgress(25);
    setIsSimulating(true);
  };

  return (
    <div className="space-y-6">
      {/* 1. 실시간 시즌 진행 게이지 카드 */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span className="font-bold text-orange-600">
                {career.seasonYear}시즌 ({leagueInfo.name})
              </span>
              <span aria-hidden="true">·</span>
              <span>정규 {leagueInfo.games}경기 체제</span>
              <span aria-hidden="true">·</span>
              <span>수비 저항치 LDR {leagueInfo.ldr}</span>
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">
              {career.offseasonLocked
                ? '시즌 결산이 완료되었어요! 아래 에이전트 데스크에서 다음 진로를 결정해 주세요.'
                : statusMessage}
            </h2>
          </div>

          {!career.offseasonLocked && (
            <button
              type="button"
              disabled={isSimulating}
              onClick={handleStartSeason}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-extrabold text-sm transition-colors shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              {isSimulating
                ? `시즌 진행 중 (${progress}%)`
                : `${career.seasonYear}시즌 전체 시뮬레이션 진행`}
            </button>
          )}
        </div>

        {/* 게이지 바 (0% ~ 100%) */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-500 tabular-nums">
            <span>시즌 진행도 (50% 반환점 이벤트 포함)</span>
            <span className="font-bold text-slate-800">
              {career.offseasonLocked ? '100% (오프시즌)' : `${progress}%`}
            </span>
          </div>
          <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
            <div
              style={{
                width: `${career.offseasonLocked ? 100 : progress}%`,
              }}
              className="h-full bg-orange-600 rounded-full transition-all duration-150"
            />
          </div>
        </div>

        {/* 구단 역할 약속 위반 시 공식 트레이드 요청 배너 */}
        {career.brokenRolePromise && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-xs font-extrabold text-rose-700">
                🚨 구단 역할 보장 약속 위반 감지
              </p>
              <p className="text-xs text-rose-900">
                계약 당시 약속받은 주전/에이스 출전 시간이 지켜지지 않았어요. 프런트에 공식 트레이드를 요청해 주전 자리가 비어 있는 새 구단으로 이적할 수 있어요.
              </p>
            </div>
            <button
              type="button"
              onClick={requestTrade}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shrink-0 cursor-pointer transition-colors"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              공식 트레이드 요청하기
            </button>
          </div>
        )}
      </section>

      {/* 2. 오프시즌 에이전트 데스크 (시즌 종료 직후에만 활성화) */}
      {career.offseasonLocked && (
        <section
          data-testid="offseason-agent-desk"
          className="bg-white border-2 border-orange-500 rounded-2xl p-6 shadow-xs space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-extrabold text-orange-600 flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4" />
                  오프시즌 에이전트 데스크 (Offseason Agent Desk)
                </span>
                {career.league === 'HIGH_SCHOOL' && career.prospectStars && (
                  <span className="inline-flex items-center gap-1 text-xs font-extrabold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-lg">
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    고교 유망주 최종 등급: {career.prospectStars}성 (
                    {'★'.repeat(career.prospectStars)}
                    {'☆'.repeat(5 - career.prospectStars)})
                  </span>
                )}
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 mt-1">
                {career.isOutOfLeagueWarning
                  ? '⚠️ 소속팀 부재: 구단 스카우팅 AI 기준을 통과한 계약 오퍼가 없어요'
                  : '스카우팅 심사를 거쳐 도착한 구단 오퍼 및 진로를 확인해 주세요'}
              </h3>
            </div>
            <span className="text-xs text-slate-500 tabular-nums">
              현재 만 {career.age}세 · OVR {career.ovr} · 스카우트 주가 {career.draftStock}
            </span>
          </div>

          {career.isOutOfLeagueWarning && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900 leading-relaxed">
                직전 시즌 실전 퍼포먼스(득점·효율·출전시간)와 현재 나이(만 {career.age}세)·능력치(OVR{' '}
                {career.ovr})를 종합한 구단 스카우팅 AI 심사 결과, 국내외 프로 리그에서 영입 오퍼를 제시한
                구단이 없어요. 정든 코트를 떠나 공식 은퇴식을 진행해야 해요.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {career.offseasonOptions.map((option: OffseasonOption) => {
              const salaryText = formatSalaryOffer(option.annualSalary);
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={option.locked}
                  onClick={() => selectOffseasonOption(option)}
                  className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 ${
                    option.locked
                      ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                      : 'border-slate-200 bg-white hover:border-orange-500 hover:bg-orange-50/30 cursor-pointer'
                  }`}
                >
                  {option.targetTeam ? (
                    <TeamEmblem team={option.targetTeam} size="md" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center shrink-0">
                      <Sparkles className="w-6 h-6 text-orange-600" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-orange-600">
                        {option.badgeText}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {typeof option.scoutingScore === 'number' && (
                          <span className="text-[11px] font-bold text-slate-500 tabular-nums">
                            스카우트 {option.scoutingScore}점
                          </span>
                        )}
                        {option.locked && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                            <Lock className="w-3 h-3" />
                            잠김
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm font-extrabold text-slate-900">
                      {option.title}
                    </p>
                    {(option.promisedRoleLabel || salaryText) && (
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                        {option.promisedRoleLabel && (
                          <span className="text-indigo-700">
                            약속 역할: {option.promisedRoleLabel}
                          </span>
                        )}
                        {salaryText && (
                          <span className="text-emerald-700 tabular-nums">
                            {salaryText}
                            {option.contractYears ? ` (${option.contractYears}년)` : ''}
                          </span>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {option.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. 직전 시즌 스포츠 뉴스 헤드라인 & 박스스코어 리포트 */}
      {lastSeason ? (
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          {/* 스포츠 뉴스 헤드라인 배너 */}
          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-bold text-orange-600 flex items-center gap-1.5">
                <Newspaper className="w-4 h-4" />
                스포츠 뉴스 톱 헤드라인
              </span>
              <span className="tabular-nums">
                {lastSeason.year}시즌 결산 · 팀 성적 {lastSeason.wins}승 {lastSeason.losses}패
                {lastSeason.injuredGamesMissed > 0
                  ? ` · 🩹 부상 결장 ${lastSeason.injuredGamesMissed}G`
                  : ''}
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-snug">
              {lastSeason.headline}
            </h3>
          </div>

          {/* 주요 박스스코어 타일 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-center">
            {[
              {
                label:
                  lastSeason.injuredGamesMissed > 0
                    ? `출전 (결장 ${lastSeason.injuredGamesMissed}G)`
                    : '출전 경기',
                val: `${lastSeason.gp}G`,
              },
              { label: '출전 시간', val: `${lastSeason.mpg.toFixed(1)}분` },
              { label: '평균 득점', val: `${lastSeason.ppg.toFixed(1)}점`, highlight: true },
              { label: '평균 리바운드', val: `${lastSeason.rpg.toFixed(1)}개` },
              { label: '평균 어시스트', val: `${lastSeason.apg.toFixed(1)}개` },
              { label: '스틸 / 블록', val: `${lastSeason.spg.toFixed(1)} / ${lastSeason.bpg.toFixed(1)}` },
              { label: '야투 / 3점%', val: `${lastSeason.fgPct}% / ${lastSeason.tpPct}%` },
              { label: '시즌 최다득점', val: `${lastSeason.singleGameHighPts}점`, highlight: true },
            ].map((stat, i) => (
              <div
                key={i}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200"
              >
                <span className="block text-[11px] font-medium text-slate-500">
                  {stat.label}
                </span>
                <span
                  className={`block text-base font-extrabold mt-0.5 tabular-nums ${
                    stat.highlight ? 'text-orange-600' : 'text-slate-900'
                  }`}
                >
                  {stat.val}
                </span>
              </div>
            ))}
          </div>

          {/* 시즌 하이라이트 로그 (~해요체) */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-500" />
              시즌 코트 노트 & 하이라이트
            </h4>
            <ul className="space-y-2">
              {lastSeason.narrativeLog.map((line, idx) => (
                <li
                  key={idx}
                  className="text-sm text-slate-700 bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2.5"
                >
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : (
        <section className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-2">
          <p className="text-base font-bold text-slate-800">
            아직 치른 정규시즌 경기가 없어요
          </p>
          <p className="text-xs text-slate-500">
            상단의 [시즌 전체 시뮬레이션 진행] 버튼을 눌러 데뷔 첫 시즌 박스스코어와 뉴스 기사를 확인해 보세요!
          </p>
        </section>
      )}
    </div>
  );
}
