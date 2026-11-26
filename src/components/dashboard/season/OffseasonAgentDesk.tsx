'use client';

import React, { useState } from 'react';
import { ChevronRight, Lock, RotateCcw } from 'lucide-react';
import {
  LEAGUE_BALANCE_META,
  isPersonalCareAllowedInLeague,
} from '../../../config/balanceConfig';
import { isHighSchoolLeague, LEAGUE_CONFIG } from '../../../data/leagues';
import {
  getEffectiveCashBalance,
  useCareerStore,
} from '../../../store/useCareerStore';
import {
  OffseasonOption,
  TeamDirection,
  CareerState,
} from '../../../types/game';
import {
  formatCurrencyDetailed,
  formatSalaryOffer,
} from '../../../utils/formatters';
import { TeamEmblem } from '../../common/TeamEmblem';

function getTeamDirectionLabel(
  direction?: TeamDirection,
  rating?: number
): string {
  if (direction === 'CONTENDER' || (rating && rating >= 84)) return '우승 도전';
  if (direction === 'PLAYOFF_HUNT' || (rating && rating >= 74)) return 'PO 경쟁';
  return '리빌딩';
}

export function OffseasonAgentDesk({
  career,
  setShowPersonalCareSheet,
}: {
  career: CareerState;
  setShowPersonalCareSheet: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const lastPersonalCareIds = useCareerStore((s) => s.lastPersonalCareIds);
  const selectOffseasonOption = useCareerStore((s) => s.selectOffseasonOption);
  const reapplyLastPersonalCare = useCareerStore((s) => s.reapplyLastPersonalCare);
  const [offseasonTab, setOffseasonTab] = useState<'STAY' | 'TRADE'>('STAY');

  const effectiveCash = getEffectiveCashBalance(career);
  const activeCareCount = (career.activePersonalCare || []).length;
  const pendingReapplyCareIds = lastPersonalCareIds.filter(
    (id) =>
      !(career.activePersonalCare || []).includes(id) &&
      isPersonalCareAllowedInLeague(id, career.league)
  );

  // 다년 프로 계약 잔여 중 여부 판정 ('소속팀 잔류' vs '트레이드 요청' 2탭 분리)
  const isProLeague = LEAGUE_BALANCE_META[career.league].isPro;
  const stayOption = career.offseasonOptions.find(
    (o) => o.id === 'OPT_STAY_CURRENT_CONTRACT' && o.actionType === 'STAY_TEAM'
  );
  const contenderPathOptions = career.offseasonOptions.filter(
    (o) => o.contenderPath
  );
  const tradeOptions = career.offseasonOptions.filter(
    (o) => o.actionType === 'REQUEST_TRADE' && !o.contenderPath
  );
  const auxiliaryContractOptions = career.offseasonOptions.filter(
    (o) =>
      o.id !== 'OPT_STAY_CURRENT_CONTRACT' &&
      o.actionType !== 'REQUEST_TRADE'
  );
  const listedOffseasonOptions = career.offseasonOptions.filter(
    (o) => !o.contenderPath
  );
  const isUnderActiveProContract =
    isProLeague &&
    career.contractYearsLeft > 0 &&
    career.militaryServiceSeasonsLeft === 0 &&
    career.contractType !== 'TWO_WAY' &&
    Boolean(stayOption);
  const activeContractTab: 'STAY' | 'TRADE' =
    tradeOptions.length === 0 ? 'STAY' : offseasonTab;

  return (
    <>
      {career.offseasonLocked && (
        <section
          data-testid="offseason-agent-desk"
          className="t-card space-y-4"
        >
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <span className="text-[12px] font-bold text-[var(--t-accent-ink)]">
                {isUnderActiveProContract
                  ? `오프시즌 · 기존 계약 잔여 ${career.contractYearsLeft}년`
                  : isProLeague &&
                    career.contractYearsLeft === 0 &&
                    career.militaryServiceSeasonsLeft === 0
                  ? '오프시즌 · FA 계약 만료'
                  : '오프시즌'}
                {isHighSchoolLeague(career.league) && career.prospectStars
                  ? ` · 유망주 ${career.prospectStars}성`
                  : ''}
              </span>
              <h2 className="text-[19px] font-bold tracking-[-0.03em] text-[var(--t-g900)] mt-0.5">
                {career.isOutOfLeagueWarning
                  ? '도착한 계약 오퍼가 없습니다'
                  : isUnderActiveProContract
                  ? activeContractTab === 'STAY'
                    ? '현 소속팀 잔류 · 시즌 준비'
                    : '계약 중 트레이드 요청'
                  : isProLeague &&
                    career.contractYearsLeft === 0 &&
                    career.militaryServiceSeasonsLeft === 0
                  ? 'FA 시장 · 계약 협상'
                  : '다음 시즌 진로 선택'}
              </h2>
            </div>
            <span className="text-[13px] font-bold text-[var(--t-ok)] tabular-nums shrink-0">
              {formatCurrencyDetailed(effectiveCash)}
            </span>
          </div>

          {/* 퍼스널 케어 바텀시트 트리거 + 원탭 재적용 */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowPersonalCareSheet(true)}
              className="w-full min-h-[54px] px-4 rounded-2xl bg-[var(--t-g100)] hover:bg-[var(--t-g200)]/70 flex items-center justify-between gap-3 text-left cursor-pointer t-tap"
            >
              <div className="min-w-0">
                <span className="block text-[14px] font-bold text-[var(--t-g900)]">
                  퍼스널 케어 · 에이전시 투자
                </span>
                <span className="block text-[12px] text-[var(--t-g500)]">
                  {activeCareCount > 0
                    ? `${activeCareCount}개 적용 중`
                    : '성장 효율 · 부상 방지 · 브랜드 투자'}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--t-g400)] shrink-0" />
            </button>

            {pendingReapplyCareIds.length > 0 && (
              <button
                type="button"
                data-testid="reapply-personal-care-btn"
                onClick={reapplyLastPersonalCare}
                className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[var(--t-accent-soft)] text-[var(--t-accent-ink)] text-[13px] font-bold flex items-center justify-center gap-1.5 cursor-pointer t-tap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>
                  이전 시즌 퍼스널 케어 {pendingReapplyCareIds.length}건 원탭 재적용
                </span>
              </button>
            )}
          </div>

          {/* 우승 도전팀 이적 요청 (PO 연속 실패 NBA 에이스 전용) */}
          {contenderPathOptions.length > 0 && (
            <div
              data-testid="contender-path-card"
              className="p-4 rounded-2xl bg-[var(--t-accent-soft)] space-y-3"
            >
              <div className="space-y-1">
                <span className="block text-[12px] font-bold text-[var(--t-accent-ink)]">
                  우승 도전팀 이적 요청
                </span>
                <p className="text-[13px] text-[var(--t-g700)] leading-relaxed">
                  {career.team.shortName}에서 플레이오프에 연속으로 실패했습니다. 우승 도전팀으로 옮기면
                  2옵션 주전으로 뛰게 되어 출전 시간과 MVP 기회는 줄지만 반지에 가까워집니다.
                  요청은 오프시즌에 한 번만 할 수 있습니다.
                </p>
              </div>
              <div className="divide-y divide-[var(--t-g200)]/60 -mx-1.5">
                {contenderPathOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    data-testid="contender-path-option"
                    disabled={option.locked}
                    onClick={() => selectOffseasonOption(option)}
                    className={`w-full min-h-[64px] px-1.5 py-2.5 text-left flex items-center gap-3 t-tap ${
                      option.locked ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    {option.targetTeam && <TeamEmblem team={option.targetTeam} size="sm" />}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <span className="block text-[15px] font-bold text-[var(--t-g900)] truncate">
                        {option.targetTeam?.name ?? option.title}
                      </span>
                      <span className="block text-[12px] text-[var(--t-g600)] truncate tabular-nums">
                        {option.locked
                          ? option.lockReason
                          : option.isExistingContract
                          ? `수락 예상 ${option.tradeAcceptChancePct ?? 0}% · 2옵션 주전 · 잔여 계약 승계`
                          : `수락 예상 ${option.tradeAcceptChancePct ?? 0}% · 2옵션 주전 · ${formatSalaryOffer(
                              option.annualSalary,
                              option.contractYears
                            )}`}
                      </span>
                    </div>
                    {option.locked ? (
                      <Lock className="w-3.5 h-3.5 text-[var(--t-g400)] shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[var(--t-g400)] shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 다년 계약 잔여 중: '소속팀 잔류' | '트레이드 요청' 전용 2탭 */}
          {isUnderActiveProContract && stayOption ? (
            <div className="space-y-3">
              {tradeOptions.length > 0 && (
                <div
                  data-testid="offseason-contract-tabs"
                  className="grid grid-cols-2 rounded-2xl bg-[var(--t-g100)] p-1 text-[13px] font-bold"
                >
                  <button
                    type="button"
                    data-testid="offseason-tab-stay"
                    onClick={() => setOffseasonTab('STAY')}
                    className={`min-h-[40px] rounded-xl transition cursor-pointer ${
                      activeContractTab === 'STAY'
                        ? 'bg-[var(--t-card)] text-[var(--t-g900)] shadow-xs'
                        : 'text-[var(--t-g500)] hover:text-[var(--t-g800)]'
                    }`}
                  >
                    현 소속팀 잔류
                  </button>
                  <button
                    type="button"
                    data-testid="offseason-tab-trade"
                    onClick={() => setOffseasonTab('TRADE')}
                    className={`min-h-[40px] rounded-xl transition cursor-pointer ${
                      activeContractTab === 'TRADE'
                        ? 'bg-[var(--t-card)] text-[var(--t-g900)] shadow-xs'
                        : 'text-[var(--t-g500)] hover:text-[var(--t-g800)]'
                    }`}
                  >
                    트레이드 요청
                    {career.tradeRequestedThisYear
                      ? ' (반려)'
                      : ` (${tradeOptions.length})`}
                  </button>
                </div>
              )}

              {activeContractTab === 'STAY' ? (
                <div
                  data-testid="offseason-stay-panel"
                  className="space-y-3"
                >
                  <div className="p-4 rounded-2xl bg-[var(--t-g100)] space-y-3">
                    <div className="flex items-center gap-3">
                      <TeamEmblem team={career.team} size="md" />
                      <div className="min-w-0 flex-1">
                        <span className="block text-[11px] font-bold text-[var(--t-accent-ink)]">
                          {LEAGUE_CONFIG[career.league].shortName} · 기존 계약 유지 · 재계약 없음
                        </span>
                        <span className="block text-[16px] font-bold text-[var(--t-g900)] truncate">
                          {career.team.name}
                        </span>
                        <span className="block text-[12px] text-[var(--t-g600)] tabular-nums mt-0.5">
                          연 {formatCurrencyDetailed(career.annualSalary)} · 잔여{' '}
                          {career.contractYearsLeft}년 ·{' '}
                          {stayOption.promisedRoleLabel || '로테이션'}
                        </span>
                      </div>
                    </div>

                    <p className="text-[12px] text-[var(--t-g600)] leading-relaxed">
                      남은 계약 기간 동안 타 구단 FA 협상 없이 기존 조건으로 다음
                      시즌을 이어갑니다.
                    </p>

                    <button
                      type="button"
                      data-testid="confirm-stay-contract-btn"
                      onClick={() => {
                        setOffseasonTab('STAY');
                        selectOffseasonOption(stayOption);
                      }}
                      className="t-cta w-full"
                    >
                      잔여 계약으로 다음 시즌 시작 (잔여 {career.contractYearsLeft}년)
                    </button>
                  </div>

                  {auxiliaryContractOptions.length > 0 && (
                    <div className="divide-y divide-[var(--t-g100)] border-t border-[var(--t-g100)] pt-1 -mx-2">
                      {auxiliaryContractOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => selectOffseasonOption(option)}
                          className="w-full min-h-[64px] px-2.5 py-2.5 rounded-2xl text-left flex items-center justify-between gap-3 hover:bg-[var(--t-g50)] cursor-pointer t-tap"
                        >
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <span className="block text-[14px] font-bold text-[var(--t-g900)] truncate">
                              {option.title}
                            </span>
                            <span className="block text-[12px] text-[var(--t-g500)] truncate">
                              {option.subtitle}
                            </span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-[var(--t-g400)] shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  data-testid="offseason-trade-panel"
                  className="space-y-3"
                >
                  <p className="text-[12px] text-[var(--t-g600)] bg-[var(--t-g100)] rounded-2xl px-3.5 py-2.5 leading-relaxed">
                    {career.tradeRequestedThisYear
                      ? '이번 오프시즌 트레이드 요청이 구단에 의해 반려되었습니다. 현 소속팀 잔류 탭에서 기존 계약으로 시즌을 시작해 주세요.'
                      : '원하는 행선지 구단을 선택해 프런트에 트레이드를 요청합니다. 구단 심사 결과에 따라 성사되거나 반려될 수 있습니다 (오프시즌 1회).'}
                  </p>

                  <div className="divide-y divide-[var(--t-g100)] -mx-2">
                    {tradeOptions.map((option: OffseasonOption) => {
                      const dirLabel = option.targetTeam
                        ? getTeamDirectionLabel(
                            option.targetTeam.direction,
                            option.targetTeam.rating
                          )
                        : option.badgeText;
                      const roleText = option.promisedRoleLabel || '로테이션';
                      const chanceText =
                        option.tradeAcceptChancePct !== undefined
                          ? `승인 예상 ${option.tradeAcceptChancePct}%`
                          : '구단 심사';

                      return (
                        <button
                          key={option.id}
                          type="button"
                          disabled={option.locked}
                          onClick={() => selectOffseasonOption(option)}
                          className={`w-full min-h-[72px] px-2.5 py-3 rounded-2xl text-left flex items-center gap-3 t-tap ${
                            option.locked
                              ? 'opacity-45 cursor-not-allowed'
                              : 'hover:bg-[var(--t-g50)] cursor-pointer'
                          }`}
                        >
                          {option.targetTeam ? (
                            <TeamEmblem team={option.targetTeam} size="sm" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-[var(--t-accent-soft)] text-[var(--t-accent-ink)] font-bold text-[12px] flex items-center justify-center shrink-0">
                              TR
                            </div>
                          )}

                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[15px] font-bold text-[var(--t-g900)] truncate">
                                {option.title}
                              </span>
                              {option.locked && (
                                <Lock className="w-3.5 h-3.5 text-[var(--t-g400)] shrink-0" />
                              )}
                            </div>
                            <p className="text-[12px] text-[var(--t-g500)] line-clamp-2 tabular-nums leading-snug">
                              <OptionLeagueLabel option={option} />
                              {dirLabel} · {roleText} · {chanceText}
                            </p>
                          </div>

                          <ChevronRight className="w-4 h-4 text-[var(--t-g400)] shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* 계약 만료(FA) / 아마추어 / 투웨이 / 상무: 오퍼 리스트 행 */
            <div className="divide-y divide-[var(--t-g100)] -mx-2">
              {listedOffseasonOptions.map((option: OffseasonOption) => {
                const dirLabel = option.targetTeam
                  ? getTeamDirectionLabel(
                      option.targetTeam.direction,
                      option.targetTeam.rating
                    )
                  : option.badgeText;
                const roleText = option.promisedRoleLabel || '로테이션';
                const salaryText = formatSalaryOffer(
                  option.annualSalary,
                  option.contractYears,
                  { isExistingContract: option.isExistingContract }
                );

                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={option.locked}
                    onClick={() => selectOffseasonOption(option)}
                    className={`w-full min-h-[72px] px-2.5 py-3 rounded-2xl text-left flex items-center gap-3 t-tap ${
                      option.locked
                        ? 'opacity-45 cursor-not-allowed'
                        : 'hover:bg-[var(--t-g50)] cursor-pointer'
                    }`}
                  >
                    {option.targetTeam ? (
                      <TeamEmblem team={option.targetTeam} size="sm" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-[var(--t-accent-soft)] text-[var(--t-accent-ink)] font-bold text-[12px] flex items-center justify-center shrink-0">
                        GO
                      </div>
                    )}

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[15px] font-bold text-[var(--t-g900)] truncate">
                          {option.title}
                        </span>
                        {option.locked && (
                          <Lock className="w-3.5 h-3.5 text-[var(--t-g400)] shrink-0" />
                        )}
                      </div>
                      <p className="text-[12px] text-[var(--t-g500)] line-clamp-2 tabular-nums leading-snug">
                        <OptionLeagueLabel option={option} />
                        {dirLabel} · {roleText} · {salaryText}
                      </p>
                    </div>

                    <ChevronRight className="w-4 h-4 text-[var(--t-g400)] shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}
    </>
  );
}

/**
 * 1.2.0: 오프시즌 제안 카드에 구단이 속한 리그를 표시합니다 (예: "NCAA · 리빌딩 · 코어 유망주 육성 · 아마추어 4년").
 * 줄이 잘려도 보이도록 맨 앞에 둡니다.
 */
function OptionLeagueLabel({ option }: { option: OffseasonOption }) {
  // 은퇴·은퇴 투어 카드는 계약이 아니므로 리그를 붙이지 않습니다.
  if (option.actionType.startsWith('RETIRE') || option.actionType === 'START_FAREWELL_TOUR') {
    return null;
  }
  const league = option.targetTeam?.league ?? option.targetLeague;
  const leagueInfo = league ? LEAGUE_CONFIG[league] : undefined;
  if (!leagueInfo) return null;
  return (
    <>
      <span
        data-testid="offseason-option-league"
        className="font-bold text-[var(--t-accent-ink)]"
      >
        {leagueInfo.shortName}
      </span>
      {' · '}
    </>
  );
}
