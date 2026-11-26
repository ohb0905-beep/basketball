'use client';

import {
  PlayoffBracketState,
  PlayoffSeriesMatchup,
} from '../../../types/game';
import { SeriesSlotCard } from './bracketParts';

/** 플레이인 토너먼트 전용 대진표 (NBA 7-10, EuroLeague 7-10, NBL 3-6) */
export function PlayInBracket({
  bracket,
  playerTeamId,
}: {
  bracket: PlayoffBracketState;
  playerTeamId: string;
}) {
  const playInR1 = bracket.rounds[0] || [];
  const playInDecider = bracket.rounds[1] || [];
  const isNbaPlayIn = bracket.league === 'NBA';
  const isNblPlayIn = bracket.league === 'NBL';

  const renderPlayInGroup = (
    label: string,
    r1List: PlayoffSeriesMatchup[],
    deciderList: PlayoffSeriesMatchup[]
  ) => (
    <div className="space-y-2">
      <div className="text-[11px] font-bold text-[var(--t-g600)]">
        {label}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-[var(--t-g400)]">
            {isNblPlayIn ? '시딩전 / 엘리미네이터' : '플레이인 1라운드'}
          </div>
          {r1List.map((m) => (
            <div key={m.id} className="space-y-1">
              <div className="text-[10px] font-semibold text-[var(--t-g500)]">
                {m.roundLabel}
              </div>
              <SeriesSlotCard
                match={m}
                placeholderTitle={m.roundLabel}
                playerTeamId={playerTeamId}
                isRevealed
                isHighlightedNew={false}
                compact
              />
            </div>
          ))}
        </div>

        <div className="space-y-2 flex flex-col justify-center">
          <div className="text-[10px] font-bold text-[var(--t-gold)]">
            {isNblPlayIn ? '4시드 최종 결정전' : '8시드 최종 결정전'}
          </div>
          {deciderList.length > 0 ? (
            deciderList.map((m) => (
              <div key={m.id} className="space-y-1">
                <div className="text-[10px] font-semibold text-[var(--t-g500)]">
                  {m.roundLabel}
                </div>
                <SeriesSlotCard
                  match={m}
                  placeholderTitle={m.roundLabel}
                  playerTeamId={playerTeamId}
                  isRevealed
                  isHighlightedNew
                  compact
                />
              </div>
            ))
          ) : (
            <SeriesSlotCard
              match={null}
              placeholderTitle={
                isNblPlayIn
                  ? '3·4위전 패자 vs 5·6위전 승자'
                  : '7·8위전 패자 vs 9·10위전 승자'
              }
              playerTeamId={playerTeamId}
              isRevealed={false}
              isHighlightedNew={false}
              compact
            />
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div
      data-testid="playoff-bracket-ladder"
      className="rounded-2xl bg-[var(--t-g100)] p-3 sm:p-4 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-bold text-[var(--t-g800)]">
          플레이인 토너먼트 대진표
        </span>
        <span className="text-[11px] font-bold text-[var(--t-gold)]">
          {bracket.stageType === 'PLAY_IN_DECIDER'
            ? '최종 결정전'
            : '단판 승부'}
        </span>
      </div>

      <div className="space-y-4">
        {isNbaPlayIn ? (
          <>
            {renderPlayInGroup(
              '동부 컨퍼런스 플레이인',
              playInR1.filter((m) => m.conference === 'EAST'),
              playInDecider.filter((m) => m.conference === 'EAST')
            )}
            {renderPlayInGroup(
              '서부 컨퍼런스 플레이인',
              playInR1.filter((m) => m.conference !== 'EAST'),
              playInDecider.filter((m) => m.conference !== 'EAST')
            )}
          </>
        ) : (
          renderPlayInGroup(
            isNblPlayIn
              ? 'NBL 플레이인 (3위~6위)'
              : '유로리그 플레이인 (7위~10위)',
            playInR1,
            playInDecider
          )
        )}
      </div>
    </div>
  );
}
