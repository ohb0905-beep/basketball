'use client';

import { motion } from 'motion/react';
import { Crown, Trophy } from 'lucide-react';
import {
  PlayoffSeriesMatchup,
  StandingEntry,
} from '../../../types/game';
import { TeamEmblem } from '../../common/TeamEmblem';
import {
  BracketConnectorSvg,
  BracketLayoutProps,
  SeriesSlotCard,
  createEdgeBuilders,
} from './bracketParts';

/** 16팀 (NBA 동/서부, NCAA 좌/우) */
export function Bracket16Layout({
  bracket,
  playerTeamId,
  prefersReducedMotion,
  wingFocus,
  displayStep,
  isClimbing,
  finalsSeries,
  championEntry,
  showChampion,
  showLeft,
  showCenter,
  showRight,
  finalsLabel,
  isNba,
  left16R1,
  right16R1,
  left16R2,
  right16R2,
  left16CF,
  right16CF,
}: BracketLayoutProps & {
  isNba: boolean;
  left16R1: PlayoffSeriesMatchup[];
  right16R1: PlayoffSeriesMatchup[];
  left16R2: PlayoffSeriesMatchup[];
  right16R2: PlayoffSeriesMatchup[];
  left16CF: PlayoffSeriesMatchup | null;
  right16CF: PlayoffSeriesMatchup | null;
}) {
  const { build4to2Edges, build2to1Edges, build1to1Edge } = createEdgeBuilders(
    displayStep,
    playerTeamId
  );

  return (
    <div
      className={`flex items-stretch ${
        wingFocus === 'ALL' ? 'min-w-[840px]' : 'min-w-full justify-center'
      } min-h-[360px]`}
    >
      {showLeft && (
        <div className="flex items-stretch flex-1">
          <div className="flex-1 min-w-[112px] flex flex-col">
            <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
              {isNba ? '동부 1R' : '16강 A'}
            </div>
            <div className="flex-1 grid grid-rows-4 gap-2 items-center">
              {[0, 1, 2, 3].map((i) => (
                <SeriesSlotCard
                  key={`left16-r1-${i}`}
                  match={left16R1[i]}
                  placeholderTitle={isNba ? '동부 1R' : '16강'}
                  playerTeamId={playerTeamId}
                  isRevealed={displayStep >= 1}
                  isHighlightedNew={isClimbing && displayStep === 1}
                  compact
                />
              ))}
            </div>
          </div>

          <div className="pt-6 flex items-stretch">
            <BracketConnectorSvg
              edges={build4to2Edges(left16R1, 'L2R', 1)}
              shouldReduceMotion={prefersReducedMotion}
            />
          </div>

          <div className="flex-1 min-w-[112px] flex flex-col">
            <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
              {isNba ? '동부 4강' : '8강 A'}
            </div>
            <div className="flex-1 grid grid-rows-2 gap-2 items-center">
              {[0, 1].map((i) => (
                <SeriesSlotCard
                  key={`left16-r2-${i}`}
                  match={left16R2[i]}
                  placeholderTitle={isNba ? '동부 4강' : '8강'}
                  playerTeamId={playerTeamId}
                  isRevealed={displayStep >= 2}
                  isHighlightedNew={isClimbing && displayStep === 2}
                  compact
                />
              ))}
            </div>
          </div>

          <div className="pt-6 flex items-stretch">
            <BracketConnectorSvg
              edges={build2to1Edges(left16R2, 'L2R', 2)}
              shouldReduceMotion={prefersReducedMotion}
            />
          </div>

          <div className="flex-1 min-w-[112px] flex flex-col">
            <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
              {isNba ? '동부 결승' : '파이널 포 A'}
            </div>
            <div className="flex-1 grid grid-rows-1 items-center">
              <SeriesSlotCard
                match={left16CF}
                placeholderTitle={isNba ? '동부 결승' : '파이널 포'}
                playerTeamId={playerTeamId}
                isRevealed={displayStep >= 3}
                isHighlightedNew={isClimbing && displayStep === 3}
                compact
              />
            </div>
          </div>
        </div>
      )}

      {showLeft && showCenter && (
        <div className="pt-6 flex items-stretch">
          <BracketConnectorSvg
            edges={build1to1Edge(left16CF, 'L2R', 3)}
            shouldReduceMotion={prefersReducedMotion}
          />
        </div>
      )}

      {showCenter && (
        <div className="w-[146px] shrink-0 flex flex-col justify-center items-center px-1">
          <div className="text-[10px] font-bold text-[var(--t-gold)] text-center pb-2 flex items-center justify-center gap-1">
            <Trophy className="w-3 h-3" />
            <span>{finalsLabel}</span>
          </div>
          <div className="w-full space-y-2">
            <div
              className={`rounded-2xl p-2.5 text-center ${
                showChampion
                  ? 'bg-[var(--t-gold-soft)]'
                  : 'bg-[var(--t-card)]'
              }`}
            >
              <div className="flex justify-center">
                {showChampion && championEntry ? (
                  <motion.div
                    initial={prefersReducedMotion ? false : { scale: 0.75, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                    className="flex flex-col items-center gap-1"
                  >
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--t-gold)]">
                      <Crown className="w-3 h-3" /> CHAMPION
                    </span>
                    <TeamEmblem team={championEntry.team} size="sm" />
                    <span className="text-[12px] font-bold text-[var(--t-g900)]">
                      {championEntry.team.shortName}
                    </span>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center gap-1 py-1">
                    <Trophy className="w-5 h-5 text-[var(--t-gold)]" />
                    <span className="text-[10px] font-bold text-[var(--t-g500)]">
                      {bracket.playerReachedFinals ? '결승 진출' : '결승전'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <SeriesSlotCard
              match={finalsSeries}
              placeholderTitle={finalsLabel}
              playerTeamId={playerTeamId}
              isRevealed={displayStep >= 4}
              isHighlightedNew={isClimbing && displayStep === 4}
              compact
            />
          </div>
        </div>
      )}

      {showRight && showCenter && (
        <div className="pt-6 flex items-stretch">
          <BracketConnectorSvg
            edges={build1to1Edge(right16CF, 'R2L', 3)}
            shouldReduceMotion={prefersReducedMotion}
          />
        </div>
      )}

      {showRight && (
        <div className="flex items-stretch flex-1">
          <div className="flex-1 min-w-[112px] flex flex-col">
            <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
              {isNba ? '서부 결승' : '파이널 포 B'}
            </div>
            <div className="flex-1 grid grid-rows-1 items-center">
              <SeriesSlotCard
                match={right16CF}
                placeholderTitle={isNba ? '서부 결승' : '파이널 포'}
                playerTeamId={playerTeamId}
                isRevealed={displayStep >= 3}
                isHighlightedNew={isClimbing && displayStep === 3}
                compact
              />
            </div>
          </div>

          <div className="pt-6 flex items-stretch">
            <BracketConnectorSvg
              edges={build2to1Edges(right16R2, 'R2L', 2)}
              shouldReduceMotion={prefersReducedMotion}
            />
          </div>

          <div className="flex-1 min-w-[112px] flex flex-col">
            <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
              {isNba ? '서부 4강' : '8강 B'}
            </div>
            <div className="flex-1 grid grid-rows-2 gap-2 items-center">
              {[0, 1].map((i) => (
                <SeriesSlotCard
                  key={`right16-r2-${i}`}
                  match={right16R2[i]}
                  placeholderTitle={isNba ? '서부 4강' : '8강'}
                  playerTeamId={playerTeamId}
                  isRevealed={displayStep >= 2}
                  isHighlightedNew={isClimbing && displayStep === 2}
                  compact
                />
              ))}
            </div>
          </div>

          <div className="pt-6 flex items-stretch">
            <BracketConnectorSvg
              edges={build4to2Edges(right16R1, 'R2L', 1)}
              shouldReduceMotion={prefersReducedMotion}
            />
          </div>

          <div className="flex-1 min-w-[112px] flex flex-col">
            <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
              {isNba ? '서부 1R' : '16강 B'}
            </div>
            <div className="flex-1 grid grid-rows-4 gap-2 items-center">
              {[0, 1, 2, 3].map((i) => (
                <SeriesSlotCard
                  key={`right16-r1-${i}`}
                  match={right16R1[i]}
                  placeholderTitle={isNba ? '서부 1R' : '16강'}
                  playerTeamId={playerTeamId}
                  isRevealed={displayStep >= 1}
                  isHighlightedNew={isClimbing && displayStep === 1}
                  compact
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 12팀 (G리그 동/서부) */
export function Bracket12Layout({
  playerTeamId,
  prefersReducedMotion,
  wingFocus,
  displayStep,
  isClimbing,
  finalsSeries,
  championEntry,
  showChampion,
  showLeft,
  showCenter,
  showRight,
  finalsLabel,
  gEastStandings,
  gWestStandings,
  gEastR1,
  gWestR1,
  gEastR2,
  gWestR2,
  gEastCF,
  gWestCF,
}: BracketLayoutProps & {
  gEastStandings: StandingEntry[];
  gWestStandings: StandingEntry[];
  gEastR1: PlayoffSeriesMatchup[];
  gWestR1: PlayoffSeriesMatchup[];
  gEastR2: PlayoffSeriesMatchup[];
  gWestR2: PlayoffSeriesMatchup[];
  gEastCF: PlayoffSeriesMatchup | null;
  gWestCF: PlayoffSeriesMatchup | null;
}) {
  const { build2to1Edges, build1to1Edge, build2to2Edges } = createEdgeBuilders(
    displayStep,
    playerTeamId
  );

  return (
    <div
      className={`flex items-stretch ${
        wingFocus === 'ALL' ? 'min-w-[820px]' : 'min-w-full justify-center'
      } min-h-[260px]`}
    >
      {showLeft && (
        <div className="flex items-stretch flex-1">
          <div className="flex-1 min-w-[112px] flex flex-col">
            <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
              동부 6강
            </div>
            <div className="flex-1 grid grid-rows-2 gap-2 items-center">
              {[0, 1].map((i) => (
                <SeriesSlotCard
                  key={`g-east-r1-${i}`}
                  match={gEastR1[i]}
                  placeholderTitle="동부 6강"
                  playerTeamId={playerTeamId}
                  isRevealed={displayStep >= 1}
                  isHighlightedNew={isClimbing && displayStep === 1}
                  compact
                />
              ))}
            </div>
          </div>

          <div className="pt-6 flex items-stretch">
            <BracketConnectorSvg
              edges={build2to2Edges(gEastR1, 'L2R', 1)}
              shouldReduceMotion={prefersReducedMotion}
            />
          </div>

          <div className="flex-1 min-w-[112px] flex flex-col">
            <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
              동부 4강
            </div>
            <div className="flex-1 grid grid-rows-2 gap-2 items-center">
              {[0, 1].map((i) => (
                <SeriesSlotCard
                  key={`g-east-r2-${i}`}
                  match={gEastR2[i]}
                  placeholderTitle="동부 4강"
                  byeSeed={gEastStandings[i] || null}
                  playerTeamId={playerTeamId}
                  isRevealed={displayStep >= 2}
                  isHighlightedNew={isClimbing && displayStep === 2}
                  compact
                />
              ))}
            </div>
          </div>

          <div className="pt-6 flex items-stretch">
            <BracketConnectorSvg
              edges={build2to1Edges(gEastR2, 'L2R', 2)}
              shouldReduceMotion={prefersReducedMotion}
            />
          </div>

          <div className="flex-1 min-w-[112px] flex flex-col">
            <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
              동부 결승
            </div>
            <div className="flex-1 grid grid-rows-1 items-center">
              <SeriesSlotCard
                match={gEastCF}
                placeholderTitle="동부 결승"
                playerTeamId={playerTeamId}
                isRevealed={displayStep >= 3}
                isHighlightedNew={isClimbing && displayStep === 3}
                compact
              />
            </div>
          </div>
        </div>
      )}

      {showLeft && showCenter && (
        <div className="pt-6 flex items-stretch">
          <BracketConnectorSvg
            edges={build1to1Edge(gEastCF, 'L2R', 3)}
            shouldReduceMotion={prefersReducedMotion}
          />
        </div>
      )}

      {showCenter && (
        <div className="w-[146px] shrink-0 flex flex-col justify-center items-center px-1">
          <div className="text-[10px] font-bold text-[var(--t-gold)] text-center pb-2 flex items-center justify-center gap-1">
            <Trophy className="w-3 h-3" />
            <span>{finalsLabel}</span>
          </div>
          <div className="w-full space-y-2">
            {showChampion && championEntry && (
              <div className="rounded-xl bg-[var(--t-gold-soft)] p-2 text-center flex flex-col items-center gap-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--t-gold)]">
                  <Crown className="w-3 h-3" /> CHAMPION
                </span>
                <TeamEmblem team={championEntry.team} size="sm" />
                <span className="text-[12px] font-bold text-[var(--t-g900)]">
                  {championEntry.team.shortName}
                </span>
              </div>
            )}
            <SeriesSlotCard
              match={finalsSeries}
              placeholderTitle={finalsLabel}
              playerTeamId={playerTeamId}
              isRevealed={displayStep >= 4}
              isHighlightedNew={isClimbing && displayStep === 4}
              compact
            />
          </div>
        </div>
      )}

      {showRight && showCenter && (
        <div className="pt-6 flex items-stretch">
          <BracketConnectorSvg
            edges={build1to1Edge(gWestCF, 'R2L', 3)}
            shouldReduceMotion={prefersReducedMotion}
          />
        </div>
      )}

      {showRight && (
        <div className="flex items-stretch flex-1">
          <div className="flex-1 min-w-[112px] flex flex-col">
            <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
              서부 결승
            </div>
            <div className="flex-1 grid grid-rows-1 items-center">
              <SeriesSlotCard
                match={gWestCF}
                placeholderTitle="서부 결승"
                playerTeamId={playerTeamId}
                isRevealed={displayStep >= 3}
                isHighlightedNew={isClimbing && displayStep === 3}
                compact
              />
            </div>
          </div>

          <div className="pt-6 flex items-stretch">
            <BracketConnectorSvg
              edges={build2to1Edges(gWestR2, 'R2L', 2)}
              shouldReduceMotion={prefersReducedMotion}
            />
          </div>

          <div className="flex-1 min-w-[112px] flex flex-col">
            <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
              서부 4강
            </div>
            <div className="flex-1 grid grid-rows-2 gap-2 items-center">
              {[0, 1].map((i) => (
                <SeriesSlotCard
                  key={`g-west-r2-${i}`}
                  match={gWestR2[i]}
                  placeholderTitle="서부 4강"
                  byeSeed={gWestStandings[i] || null}
                  playerTeamId={playerTeamId}
                  isRevealed={displayStep >= 2}
                  isHighlightedNew={isClimbing && displayStep === 2}
                  compact
                />
              ))}
            </div>
          </div>

          <div className="pt-6 flex items-stretch">
            <BracketConnectorSvg
              edges={build2to2Edges(gWestR1, 'R2L', 1)}
              shouldReduceMotion={prefersReducedMotion}
            />
          </div>

          <div className="flex-1 min-w-[112px] flex flex-col">
            <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
              서부 6강
            </div>
            <div className="flex-1 grid grid-rows-2 gap-2 items-center">
              {[0, 1].map((i) => (
                <SeriesSlotCard
                  key={`g-west-r1-${i}`}
                  match={gWestR1[i]}
                  placeholderTitle="서부 6강"
                  playerTeamId={playerTeamId}
                  isRevealed={displayStep >= 1}
                  isHighlightedNew={isClimbing && displayStep === 1}
                  compact
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 8팀 (B.리그 / 유로리그 / U리그 / 고교) */
export function Bracket8Layout({
  bracket,
  playerTeamId,
  prefersReducedMotion,
  wingFocus,
  displayStep,
  isClimbing,
  finalsSeries,
  championEntry,
  showChampion,
  showLeft,
  showCenter,
  showRight,
  finalsLabel,
  eightLeftQF,
  eightRightQF,
  eightLeftSF,
  eightRightSF,
}: BracketLayoutProps & {
  eightLeftQF: PlayoffSeriesMatchup[];
  eightRightQF: PlayoffSeriesMatchup[];
  eightLeftSF: PlayoffSeriesMatchup | null;
  eightRightSF: PlayoffSeriesMatchup | null;
}) {
  const { build2to1Edges, build1to1Edge } = createEdgeBuilders(
    displayStep,
    playerTeamId
  );

  return (
    <div
      className={`flex items-stretch ${
        wingFocus === 'ALL' ? 'min-w-[660px]' : 'min-w-full justify-center'
      } min-h-[240px]`}
    >
      {showLeft && (
        <div className="flex items-stretch flex-1">
          <div className="flex-1 min-w-[116px] flex flex-col">
            <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
              8강 A
            </div>
            <div className="flex-1 grid grid-rows-2 gap-2 items-center">
              {[0, 1].map((i) => (
                <SeriesSlotCard
                  key={`eight-lqf-${i}`}
                  match={eightLeftQF[i]}
                  placeholderTitle="8강"
                  playerTeamId={playerTeamId}
                  isRevealed={displayStep >= 1}
                  isHighlightedNew={isClimbing && displayStep === 1}
                  compact
                />
              ))}
            </div>
          </div>

          <div className="pt-6 flex items-stretch">
            <BracketConnectorSvg
              edges={build2to1Edges(eightLeftQF, 'L2R', 1)}
              shouldReduceMotion={prefersReducedMotion}
            />
          </div>

          <div className="flex-1 min-w-[116px] flex flex-col">
            <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
              {bracket.league === 'EUROLEAGUE' ? '파이널 포 A' : '4강 A'}
            </div>
            <div className="flex-1 grid grid-rows-1 items-center">
              <SeriesSlotCard
                match={eightLeftSF}
                placeholderTitle={
                  bracket.league === 'EUROLEAGUE' ? '파이널 포' : '4강'
                }
                playerTeamId={playerTeamId}
                isRevealed={displayStep >= 2}
                isHighlightedNew={isClimbing && displayStep === 2}
                compact
              />
            </div>
          </div>
        </div>
      )}

      {showLeft && showCenter && (
        <div className="pt-6 flex items-stretch">
          <BracketConnectorSvg
            edges={build1to1Edge(eightLeftSF, 'L2R', 2)}
            shouldReduceMotion={prefersReducedMotion}
          />
        </div>
      )}

      {showCenter && (
        <div className="w-[146px] shrink-0 flex flex-col justify-center items-center px-1">
          <div className="text-[10px] font-bold text-[var(--t-gold)] text-center pb-2 flex items-center gap-1">
            <Trophy className="w-3 h-3" />
            <span>{finalsLabel}</span>
          </div>
          <div className="w-full space-y-2">
            {showChampion && championEntry && (
              <div className="rounded-xl bg-[var(--t-gold-soft)] p-2 text-center flex flex-col items-center gap-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--t-gold)]">
                  <Crown className="w-3 h-3" /> CHAMPION
                </span>
                <TeamEmblem team={championEntry.team} size="sm" />
                <span className="text-[12px] font-bold text-[var(--t-g900)]">
                  {championEntry.team.shortName}
                </span>
              </div>
            )}
            <SeriesSlotCard
              match={finalsSeries}
              placeholderTitle={finalsLabel}
              playerTeamId={playerTeamId}
              isRevealed={displayStep >= 3}
              isHighlightedNew={isClimbing && displayStep === 3}
              compact
            />
          </div>
        </div>
      )}

      {showRight && showCenter && (
        <div className="pt-6 flex items-stretch">
          <BracketConnectorSvg
            edges={build1to1Edge(eightRightSF, 'R2L', 2)}
            shouldReduceMotion={prefersReducedMotion}
          />
        </div>
      )}

      {showRight && (
        <div className="flex items-stretch flex-1">
          <div className="flex-1 min-w-[116px] flex flex-col">
            <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
              {bracket.league === 'EUROLEAGUE' ? '파이널 포 B' : '4강 B'}
            </div>
            <div className="flex-1 grid grid-rows-1 items-center">
              <SeriesSlotCard
                match={eightRightSF}
                placeholderTitle={
                  bracket.league === 'EUROLEAGUE' ? '파이널 포' : '4강'
                }
                playerTeamId={playerTeamId}
                isRevealed={displayStep >= 2}
                isHighlightedNew={isClimbing && displayStep === 2}
                compact
              />
            </div>
          </div>

          <div className="pt-6 flex items-stretch">
            <BracketConnectorSvg
              edges={build2to1Edges(eightRightQF, 'R2L', 1)}
              shouldReduceMotion={prefersReducedMotion}
            />
          </div>

          <div className="flex-1 min-w-[116px] flex flex-col">
            <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
              8강 B
            </div>
            <div className="flex-1 grid grid-rows-2 gap-2 items-center">
              {[0, 1].map((i) => (
                <SeriesSlotCard
                  key={`eight-rqf-${i}`}
                  match={eightRightQF[i]}
                  placeholderTitle="8강"
                  playerTeamId={playerTeamId}
                  isRevealed={displayStep >= 1}
                  isHighlightedNew={isClimbing && displayStep === 1}
                  compact
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 6팀 (KBL) */
export function Bracket6Layout({
  playerTeamId,
  prefersReducedMotion,
  wingFocus,
  displayStep,
  isClimbing,
  finalsSeries,
  championEntry,
  showChampion,
  showLeft,
  showCenter,
  showRight,
  finalsLabel,
  standings,
  sixLeftR1,
  sixRightR1,
  sixLeftR2,
  sixRightR2,
}: BracketLayoutProps & {
  standings: StandingEntry[];
  sixLeftR1: PlayoffSeriesMatchup | null;
  sixRightR1: PlayoffSeriesMatchup | null;
  sixLeftR2: PlayoffSeriesMatchup | null;
  sixRightR2: PlayoffSeriesMatchup | null;
}) {
  const { build1to1Edge } = createEdgeBuilders(
    displayStep,
    playerTeamId
  );

  return (
    <div
      className={`flex items-stretch ${
        wingFocus === 'ALL' ? 'min-w-[620px]' : 'min-w-full justify-center'
      } min-h-[195px]`}
    >
      {showLeft && (
        <div className="flex items-stretch flex-1">
          <div className="flex-1 min-w-[116px] flex flex-col">
            <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
              6강 A
            </div>
            <div className="flex-1 grid grid-rows-1 items-center">
              <SeriesSlotCard
                match={sixLeftR1}
                placeholderTitle="6강 PO"
                playerTeamId={playerTeamId}
                isRevealed={displayStep >= 1}
                isHighlightedNew={isClimbing && displayStep === 1}
              />
            </div>
          </div>

          <div className="pt-6 flex items-stretch">
            <BracketConnectorSvg
              edges={build1to1Edge(sixLeftR1, 'L2R', 1)}
              shouldReduceMotion={prefersReducedMotion}
            />
          </div>

          <div className="flex-1 min-w-[116px] flex flex-col">
            <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
              4강 (1시드)
            </div>
            <div className="flex-1 grid grid-rows-1 items-center">
              <SeriesSlotCard
                match={sixLeftR2}
                placeholderTitle="4강 A"
                byeSeed={standings[0] || null}
                playerTeamId={playerTeamId}
                isRevealed={displayStep >= 2}
                isHighlightedNew={isClimbing && displayStep === 2}
              />
            </div>
          </div>
        </div>
      )}

      {showLeft && showCenter && (
        <div className="pt-6 flex items-stretch">
          <BracketConnectorSvg
            edges={build1to1Edge(sixLeftR2, 'L2R', 2)}
            shouldReduceMotion={prefersReducedMotion}
          />
        </div>
      )}

      {showCenter && (
        <div className="w-[146px] shrink-0 flex flex-col justify-center items-center px-1">
          <div className="text-[10px] font-bold text-[var(--t-gold)] text-center pb-2 flex items-center gap-1">
            <Trophy className="w-3 h-3" />
            <span>{finalsLabel}</span>
          </div>
          <div className="w-full space-y-2">
            {showChampion && championEntry && (
              <div className="rounded-xl bg-[var(--t-gold-soft)] p-2 text-center flex flex-col items-center gap-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--t-gold)]">
                  <Crown className="w-3 h-3" /> CHAMPION
                </span>
                <TeamEmblem team={championEntry.team} size="sm" />
                <span className="text-[12px] font-bold text-[var(--t-g900)]">
                  {championEntry.team.shortName}
                </span>
              </div>
            )}
            <SeriesSlotCard
              match={finalsSeries}
              placeholderTitle={finalsLabel}
              playerTeamId={playerTeamId}
              isRevealed={displayStep >= 3}
              isHighlightedNew={isClimbing && displayStep === 3}
            />
          </div>
        </div>
      )}

      {showRight && showCenter && (
        <div className="pt-6 flex items-stretch">
          <BracketConnectorSvg
            edges={build1to1Edge(sixRightR2, 'R2L', 2)}
            shouldReduceMotion={prefersReducedMotion}
          />
        </div>
      )}

      {showRight && (
        <div className="flex items-stretch flex-1">
          <div className="flex-1 min-w-[116px] flex flex-col">
            <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
              4강 (2시드)
            </div>
            <div className="flex-1 grid grid-rows-1 items-center">
              <SeriesSlotCard
                match={sixRightR2}
                placeholderTitle="4강 B"
                byeSeed={standings[1] || null}
                playerTeamId={playerTeamId}
                isRevealed={displayStep >= 2}
                isHighlightedNew={isClimbing && displayStep === 2}
              />
            </div>
          </div>

          <div className="pt-6 flex items-stretch">
            <BracketConnectorSvg
              edges={build1to1Edge(sixRightR1, 'R2L', 1)}
              shouldReduceMotion={prefersReducedMotion}
            />
          </div>

          <div className="flex-1 min-w-[116px] flex flex-col">
            <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
              6강 B
            </div>
            <div className="flex-1 grid grid-rows-1 items-center">
              <SeriesSlotCard
                match={sixRightR1}
                placeholderTitle="6강 PO"
                playerTeamId={playerTeamId}
                isRevealed={displayStep >= 1}
                isHighlightedNew={isClimbing && displayStep === 1}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 4팀 (NBL 본선) */
export function Bracket4Layout({
  playerTeamId,
  prefersReducedMotion,
  wingFocus,
  displayStep,
  isClimbing,
  finalsSeries,
  championEntry,
  showChampion,
  showLeft,
  showCenter,
  showRight,
  finalsLabel,
  fourLeftSF,
  fourRightSF,
}: BracketLayoutProps & {
  fourLeftSF: PlayoffSeriesMatchup | null;
  fourRightSF: PlayoffSeriesMatchup | null;
}) {
  const { build1to1Edge } = createEdgeBuilders(
    displayStep,
    playerTeamId
  );

  return (
    <div
      className={`flex items-stretch ${
        wingFocus === 'ALL' ? 'min-w-[480px]' : 'min-w-full justify-center'
      } min-h-[160px]`}
    >
      {showLeft && (
        <div className="flex-1 min-w-[132px] flex flex-col">
          <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
            4강 1경기
          </div>
          <div className="flex-1 grid grid-rows-1 items-center">
            <SeriesSlotCard
              match={fourLeftSF}
              placeholderTitle="4강"
              playerTeamId={playerTeamId}
              isRevealed={displayStep >= 1}
              isHighlightedNew={isClimbing && displayStep === 1}
            />
          </div>
        </div>
      )}

      {showLeft && showCenter && (
        <div className="pt-6 flex items-stretch">
          <BracketConnectorSvg
            edges={build1to1Edge(fourLeftSF, 'L2R', 1)}
            shouldReduceMotion={prefersReducedMotion}
          />
        </div>
      )}

      {showCenter && (
        <div className="w-[152px] shrink-0 flex flex-col justify-center items-center px-1">
          <div className="text-[10px] font-bold text-[var(--t-gold)] text-center pb-2 flex items-center gap-1">
            <Trophy className="w-3 h-3" />
            <span>{finalsLabel}</span>
          </div>
          <div className="w-full space-y-2">
            {showChampion && championEntry && (
              <div className="rounded-xl bg-[var(--t-gold-soft)] p-2 text-center flex flex-col items-center gap-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--t-gold)]">
                  <Crown className="w-3 h-3" /> 우승
                </span>
                <TeamEmblem team={championEntry.team} size="sm" />
                <span className="text-[12px] font-bold text-[var(--t-g900)]">
                  {championEntry.team.shortName}
                </span>
              </div>
            )}
            <SeriesSlotCard
              match={finalsSeries}
              placeholderTitle={finalsLabel}
              playerTeamId={playerTeamId}
              isRevealed={displayStep >= 2}
              isHighlightedNew={isClimbing && displayStep === 2}
            />
          </div>
        </div>
      )}

      {showRight && showCenter && (
        <div className="pt-6 flex items-stretch">
          <BracketConnectorSvg
            edges={build1to1Edge(fourRightSF, 'R2L', 1)}
            shouldReduceMotion={prefersReducedMotion}
          />
        </div>
      )}

      {showRight && (
        <div className="flex-1 min-w-[132px] flex flex-col">
          <div className="text-[10px] font-bold text-[var(--t-g500)] text-center pb-2">
            4강 2경기
          </div>
          <div className="flex-1 grid grid-rows-1 items-center">
            <SeriesSlotCard
              match={fourRightSF}
              placeholderTitle="4강"
              playerTeamId={playerTeamId}
              isRevealed={displayStep >= 1}
              isHighlightedNew={isClimbing && displayStep === 1}
            />
          </div>
        </div>
      )}
    </div>
  );
}
