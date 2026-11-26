'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Play,
  SkipForward,
} from 'lucide-react';
import {
  buildCareerRetrospective,
  buildFallbackRetrospectiveFromHof,
} from '../../engine/retrospectiveEngine';
import { evaluateCareerLegacy } from '../../engine/retirementEngine';
import {
  getGrowthDnaInfo,
  getPlaystyleInfo,
  getTraitInfo,
} from '../../engine/statCalculator';
import { useCareerStore } from '../../store/useCareerStore';
import {
  CareerRetrospective,
  HallOfFameEntry,
  LeagueId,
  TeamStintSummary,
} from '../../types/game';
import { formatCurrencyDetailed } from '../../utils/formatters';
import { TeamEmblem } from '../common/TeamEmblem';
import { hasSeenSurvey, markSurveySeen } from '../../lib/survey';
import { RetirementSurveyModal } from './RetirementSurveyModal';
import { CareerShareModal } from './CareerShareModal';
import { CareerTrajectoryChart } from './CareerTrajectoryChart';
import { JerseyRetirementStage } from './JerseyRetirementStage';
import { TrophyCabinetSection } from './TrophyCabinetSection';

type ChapterKey =
  | 'PROLOGUE'
  | 'JOURNEY'
  | 'TRAJECTORY'
  | 'TROPHIES'
  | 'JERSEY'
  | 'VERDICT';

type ArchiveTabKey = 'SUMMARY' | 'JOURNEY' | 'TROPHIES' | 'SEASONS';

type SeasonLeagueFilter = 'ALL' | 'NBA' | 'KBL' | 'OVERSEAS' | 'AMATEUR';

interface RetirementCeremonyProps {
  replayEntry?: HallOfFameEntry | null;
  onCloseReplay?: () => void;
}

const OVERSEAS_LEAGUES: LeagueId[] = ['EUROLEAGUE', 'NBL', 'B_LEAGUE', 'GLEAGUE'];
const AMATEUR_LEAGUES: LeagueId[] = ['HIGH_SCHOOL', 'US_HIGH_SCHOOL', 'U_LEAGUE', 'NCAA'];

function TeamStintsTimeline({ stints }: { stints: TeamStintSummary[] }) {
  if (stints.length === 0) {
    return (
      <div className="py-6 text-center rounded-2xl bg-[var(--t-g50)] border border-[var(--t-g100)]">
        <p className="text-[13px] text-[var(--t-g600)]">
          소속 구단 이력이 기록되지 않았습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      {stints.map((stint, idx) => {
        const isLast = idx === stints.length - 1;
        const yearSpan =
          stint.startYear === stint.endYear
            ? `${stint.startYear}`
            : `${stint.startYear} – ${stint.endYear}`;
        const honors: string[] = [];
        if (stint.championships > 0) honors.push(`우승 ${stint.championships}`);
        if (stint.finalsMvps > 0) honors.push(`파이널 MVP ${stint.finalsMvps}`);
        if (stint.mvps > 0) honors.push(`MVP ${stint.mvps}`);
        if (stint.allStars > 0) honors.push(`올스타 ${stint.allStars}`);

        return (
          <div key={stint.id} className="relative flex gap-3.5 pb-5 last:pb-0">
            {/* 수직 타임라인 레일 */}
            <div className="flex flex-col items-center shrink-0 pt-1">
              <div
                className="w-2.5 h-2.5 rounded-full border-2 border-[var(--t-card)] shrink-0"
                style={{ backgroundColor: stint.primaryColor || 'var(--t-accent)' }}
              />
              {!isLast && (
                <div className="w-[1.5px] flex-1 bg-[var(--t-g200)] mt-1.5" />
              )}
            </div>

            {/* 구단 구간 정보 */}
            <div className="min-w-0 flex-1 pb-4 border-b border-[var(--t-g100)] last:border-b-0">
              <div className="flex items-start gap-3">
                <TeamEmblem
                  team={{
                    id: stint.teamId,
                    name: stint.teamName,
                    shortName: stint.teamShortName,
                    city: '',
                    league: stint.league,
                    rating: 80,
                    primaryColor: stint.primaryColor,
                    secondaryColor: stint.secondaryColor,
                    logoUrl: stint.logoUrl,
                    prestigeDesc: '',
                    isMilitaryTeam: stint.isMilitaryTeam,
                  }}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className="text-[15px] font-bold text-[var(--t-g900)] truncate">
                      {stint.teamName}
                    </h4>
                    <span className="text-[12px] font-semibold text-[var(--t-g500)] tabular-nums shrink-0">
                      {yearSpan}
                    </span>
                  </div>
                  <p className="text-[12px] text-[var(--t-g500)] tabular-nums mt-0.5">
                    {stint.leagueShortName} · {stint.seasons}시즌 ({stint.gp}경기) · 최고 OVR{' '}
                    {stint.peakOvr}
                  </p>
                  <p className="text-[13px] font-semibold text-[var(--t-g800)] tabular-nums mt-1.5">
                    {stint.avgPpg.toFixed(1)} PPG · {stint.avgRpg.toFixed(1)} RPG ·{' '}
                    {stint.avgApg.toFixed(1)} APG
                  </p>
                  {honors.length > 0 && (
                    <p className="text-[12px] font-bold text-[var(--t-gold)] mt-1">
                      {honors.join(' · ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SeasonStatsTable({ retro }: { retro: CareerRetrospective }) {
  const [filter, setFilter] = useState<SeasonLeagueFilter>('ALL');

  const availableFilters = useMemo(() => {
    const list: { id: SeasonLeagueFilter; label: string }[] = [
      { id: 'ALL', label: '전체' },
    ];
    if (retro.seasons.some((s) => s.league === 'NBA')) {
      list.push({ id: 'NBA', label: 'NBA' });
    }
    if (retro.seasons.some((s) => s.league === 'KBL')) {
      list.push({ id: 'KBL', label: 'KBL' });
    }
    if (retro.seasons.some((s) => OVERSEAS_LEAGUES.includes(s.league))) {
      list.push({ id: 'OVERSEAS', label: '해외 · G리그' });
    }
    if (retro.seasons.some((s) => AMATEUR_LEAGUES.includes(s.league))) {
      list.push({ id: 'AMATEUR', label: '고교 · 대학' });
    }
    return list;
  }, [retro.seasons]);

  const filteredSeasons = useMemo(() => {
    if (filter === 'ALL') return retro.seasons;
    if (filter === 'NBA') return retro.seasons.filter((s) => s.league === 'NBA');
    if (filter === 'KBL') return retro.seasons.filter((s) => s.league === 'KBL');
    if (filter === 'OVERSEAS') {
      return retro.seasons.filter((s) => OVERSEAS_LEAGUES.includes(s.league));
    }
    return retro.seasons.filter((s) => AMATEUR_LEAGUES.includes(s.league));
  }, [retro.seasons, filter]);

  const filteredSummary = useMemo(() => {
    const totalGp = filteredSeasons.reduce((acc, s) => acc + s.gp, 0);
    const denom = Math.max(1, totalGp);
    const totalPts = filteredSeasons.reduce((acc, s) => acc + s.ppg * s.gp, 0);
    const totalReb = filteredSeasons.reduce((acc, s) => acc + s.rpg * s.gp, 0);
    const totalAst = filteredSeasons.reduce((acc, s) => acc + s.apg * s.gp, 0);
    return {
      seasons: filteredSeasons.length,
      gp: totalGp,
      ppg: (totalPts / denom).toFixed(1),
      rpg: (totalReb / denom).toFixed(1),
      apg: (totalAst / denom).toFixed(1),
    };
  }, [filteredSeasons]);

  if (retro.seasons.length === 0) {
    return (
      <div className="py-8 text-center rounded-2xl bg-[var(--t-g50)] border border-[var(--t-g100)]">
        <p className="text-[14px] font-semibold text-[var(--t-g600)]">
          시즌별 상세 박스스코어가 보관되지 않은 이전 기록입니다
        </p>
        <p className="text-[12px] text-[var(--t-g400)] mt-1">
          종합 요약 탭에서 통산 평균과 주요 업적을 확인할 수 있습니다
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 리그 필터 */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {availableFilters.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`min-h-[38px] px-3.5 rounded-xl text-[12px] font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors t-tap ${
                active
                  ? 'bg-[var(--t-g900)] text-[var(--t-card)]'
                  : 'bg-[var(--t-g100)] text-[var(--t-g600)] hover:text-[var(--t-g900)]'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* 필터 기준 요약 바 */}
      <div className="grid grid-cols-4 gap-2 py-3 px-3 rounded-2xl bg-[var(--t-g50)] border border-[var(--t-g100)] text-center tabular-nums">
        <div>
          <span className="block text-[15px] font-bold text-[var(--t-g900)]">
            {filteredSummary.seasons}시즌 · {filteredSummary.gp}G
          </span>
          <span className="text-[11px] text-[var(--t-g500)]">출전</span>
        </div>
        <div>
          <span className="block text-[15px] font-bold text-[var(--t-accent)]">
            {filteredSummary.ppg}
          </span>
          <span className="text-[11px] text-[var(--t-g500)]">평균 득점</span>
        </div>
        <div>
          <span className="block text-[15px] font-bold text-[var(--t-g900)]">
            {filteredSummary.rpg}
          </span>
          <span className="text-[11px] text-[var(--t-g500)]">리바운드</span>
        </div>
        <div>
          <span className="block text-[15px] font-bold text-[var(--t-g900)]">
            {filteredSummary.apg}
          </span>
          <span className="text-[11px] text-[var(--t-g500)]">어시스트</span>
        </div>
      </div>

      {/* 시즌별 테이블 */}
      <div className="overflow-x-auto -mx-2 px-2">
        <table className="w-full min-w-[540px] text-left border-collapse tabular-nums">
          <thead>
            <tr className="border-b border-[var(--t-g200)] text-[11px] font-semibold text-[var(--t-g500)]">
              <th className="py-2 pr-2">연도</th>
              <th className="py-2 px-2">소속</th>
              <th className="py-2 px-1.5 text-right">나이</th>
              <th className="py-2 px-1.5 text-right">OVR</th>
              <th className="py-2 px-1.5 text-right">G</th>
              <th className="py-2 px-1.5 text-right">PPG</th>
              <th className="py-2 px-1.5 text-right">RPG</th>
              <th className="py-2 px-1.5 text-right">APG</th>
              <th className="py-2 px-1.5 text-right">FG%</th>
              <th className="py-2 pl-2">결과 · 수상</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--t-g100)] text-[12px]">
            {filteredSeasons.map((s) => {
              const tags: string[] = [];
              if (s.wonChampionship) tags.push('우승');
              if (s.wonFinalsMvp) tags.push('FMVP');
              if (s.wonMvp) tags.push('MVP');
              if (s.wonDpoy) tags.push('DPOY');
              if (s.wonRookieOfYear) tags.push('ROY');
              if (s.allStarSelected) tags.push('AS');

              return (
                <tr
                  key={`${s.seasonNumber}_${s.year}`}
                  className={s.wonChampionship ? 'bg-[var(--t-gold-soft)]/35' : ''}
                >
                  <td className="py-2.5 pr-2 font-bold text-[var(--t-g900)] whitespace-nowrap">
                    {s.year}
                  </td>
                  <td className="py-2.5 px-2 whitespace-nowrap">
                    <span className="font-semibold text-[var(--t-g800)]">
                      {s.teamShortName}
                    </span>
                    <span className="text-[11px] text-[var(--t-g500)] ml-1">
                      {s.leagueShortName}
                    </span>
                  </td>
                  <td className="py-2.5 px-1.5 text-right text-[var(--t-g600)]">
                    {s.age}
                  </td>
                  <td className="py-2.5 px-1.5 text-right font-bold text-[var(--t-g900)]">
                    {s.ovr}
                  </td>
                  <td className="py-2.5 px-1.5 text-right text-[var(--t-g600)]">
                    {s.gp}
                  </td>
                  <td className="py-2.5 px-1.5 text-right font-bold text-[var(--t-accent-ink)]">
                    {s.ppg.toFixed(1)}
                  </td>
                  <td className="py-2.5 px-1.5 text-right text-[var(--t-g700)]">
                    {s.rpg.toFixed(1)}
                  </td>
                  <td className="py-2.5 px-1.5 text-right text-[var(--t-g700)]">
                    {s.apg.toFixed(1)}
                  </td>
                  <td className="py-2.5 px-1.5 text-right text-[var(--t-g600)]">
                    {s.fgPct.toFixed(1)}
                  </td>
                  <td className="py-2.5 pl-2 whitespace-nowrap">
                    <span className="text-[var(--t-g600)]">{s.playoffResult}</span>
                    {tags.length > 0 && (
                      <span className="ml-1.5 font-bold text-[var(--t-gold)]">
                        {tags.join('·')}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RetirementCeremony({
  replayEntry = null,
  onCloseReplay,
}: RetirementCeremonyProps) {
  const career = useCareerStore((s) => s.career);
  const recordBook = useCareerStore((s) => s.recordBook);
  const completeRetirementAndReturnHome = useCareerStore(
    (s) => s.completeRetirementAndReturnHome
  );
  const resetActiveCareer = useCareerStore((s) => s.resetActiveCareer);
  const setView = useCareerStore((s) => s.setView);
  const prefersReducedMotion = useReducedMotion();

  const isReplayMode = Boolean(replayEntry);
  const [shareCardOpen, setShareCardOpen] = useState(false);

  const retro: CareerRetrospective | null = useMemo(() => {
    if (replayEntry) {
      return buildFallbackRetrospectiveFromHof(replayEntry);
    }
    if (!career) return null;
    const reason = career.retirementReason || 'VOLUNTARY_HONOR';
    const evaluation = career.legacyEvaluation || evaluateCareerLegacy(career);
    return buildCareerRetrospective(career, reason, evaluation, recordBook);
  }, [replayEntry, career, recordBook]);

  const shareLegacyEmoji = useMemo(() => {
    if (replayEntry) return replayEntry.legacyEmoji;
    if (!career) return '🏀';
    return (career.legacyEvaluation || evaluateCareerLegacy(career)).tierEmoji;
  }, [replayEntry, career]);

  const chapters = useMemo(() => {
    if (!retro) return [] as { key: ChapterKey; title: string }[];
    const base: { key: ChapterKey; title: string }[] = [
      { key: 'PROLOGUE', title: '커리어의 서막' },
      { key: 'JOURNEY', title: '코트 위의 여정' },
      { key: 'TRAJECTORY', title: '성장 궤적과 전성기' },
      { key: 'TROPHIES', title: '우승 연대기와 트로피 진열장' },
    ];
    if (retro.jerseyCeremony.jerseyRetired) {
      base.push({ key: 'JERSEY', title: '영구결번 게양식' });
    }
    base.push({ key: 'VERDICT', title: '레거시 판정과 마침표' });
    return base;
  }, [retro]);

  const [viewMode, setViewMode] = useState<'SLIDES' | 'ARCHIVE'>('SLIDES');
  const [chapterIdx, setChapterIdx] = useState(0);
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);
  const [archiveTab, setArchiveTab] = useState<ArchiveTabKey>('SUMMARY');

  const [surveyOpen, setSurveyOpen] = useState(false);

  const safeChapterIdx = Math.min(chapterIdx, Math.max(0, chapters.length - 1));
  const currentChapter = chapters[safeChapterIdx];

  // 1.1.2 난이도 설문: 업데이트 후 처음 완주한 커리어의 전체 리포트 진입 시 한 번만 띄웁니다.
  const enterArchive = useCallback(() => {
    setViewMode('ARCHIVE');
    if (!isReplayMode && career && !hasSeenSurvey()) {
      markSurveySeen();
      setSurveyOpen(true);
    }
  }, [isReplayMode, career]);

  const handleNextChapter = useCallback(() => {
    if (safeChapterIdx >= chapters.length - 1) {
      enterArchive();
      return;
    }
    setSlideDirection(1);
    setChapterIdx((prev) => Math.min(chapters.length - 1, prev + 1));
  }, [safeChapterIdx, chapters.length, enterArchive]);

  const handlePrevChapter = useCallback(() => {
    if (safeChapterIdx <= 0) return;
    setSlideDirection(-1);
    setChapterIdx((prev) => Math.max(0, prev - 1));
  }, [safeChapterIdx]);

  useEffect(() => {
    if (viewMode !== 'SLIDES') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        handleNextChapter();
      } else if (e.key === 'ArrowLeft') {
        handlePrevChapter();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewMode, handleNextChapter, handlePrevChapter]);

  if (!retro) {
    return (
      <div className="max-w-[560px] mx-auto px-4 py-12 text-center space-y-4">
        <p className="text-[18px] font-bold text-[var(--t-g900)]">
          은퇴 리포트를 불러올 수 없습니다.
        </p>
        <button
          type="button"
          onClick={() => (onCloseReplay ? onCloseReplay() : setView('HOME'))}
          className="t-cta max-w-[260px] mx-auto"
        >
          홈으로 이동
        </button>
      </div>
    );
  }

  const positionLine = [
    retro.secondaryPos
      ? `${retro.primaryPos}/${retro.secondaryPos}`
      : retro.primaryPos,
    `${retro.heightCm}cm`,
    retro.playstyle ? getPlaystyleInfo(retro.playstyle).label : null,
    retro.growthDna ? getGrowthDnaInfo(retro.growthDna).label : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const careerSpanText =
    retro.startYear === retro.endYear
      ? `${retro.startYear} · ${retro.seasonsPlayed}시즌`
      : `${retro.startYear} – ${retro.endYear} · ${retro.seasonsPlayed}시즌`;

  const chapterIndexLabel = `${String(safeChapterIdx + 1).padStart(2, '0')} / ${String(
    chapters.length
  ).padStart(2, '0')}`;

  return (
    <div
      data-testid="retirement-retrospective-shell"
      className={`mx-auto px-4 pt-2 pb-14 space-y-4 transition-[max-width] duration-200 ${
        viewMode === 'ARCHIVE' && archiveTab === 'SEASONS'
          ? 'max-w-[760px]'
          : 'max-w-[660px]'
      }`}
    >
      {retro && shareCardOpen && (
        <CareerShareModal
          open={shareCardOpen}
          retro={retro}
          legacyEmoji={shareLegacyEmoji}
          isReplay={isReplayMode}
          onClose={() => setShareCardOpen(false)}
        />
      )}

      {career && !isReplayMode && (
        <RetirementSurveyModal
          open={surveyOpen}
          career={career}
          onClose={() => setSurveyOpen(false)}
        />
      )}

      {/* 재감상 모드 상단 복귀 링크 */}
      {isReplayMode && onCloseReplay && (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            data-testid="close-hof-replay-btn"
            onClick={onCloseReplay}
            className="min-h-[40px] px-2 -ml-2 rounded-xl text-[13px] font-semibold text-[var(--t-g600)] hover:text-[var(--t-g900)] inline-flex items-center gap-1 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>명예의 전당으로 돌아가기</span>
          </button>
          <span className="text-[12px] font-semibold text-[var(--t-g500)]">
            명예의 전당 영구 아카이브
          </span>
        </div>
      )}

      {viewMode === 'SLIDES' && currentChapter ? (
        <div className="space-y-3">
          {/* 다큐멘터리 챕터 진행 헤더 */}
          <div className="t-card !py-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-baseline gap-2 min-w-0">
                <span
                  data-testid="retro-chapter-counter"
                  className="text-[12px] font-bold text-[var(--t-accent-ink)] tabular-nums shrink-0"
                >
                  {chapterIndexLabel}
                </span>
                <span className="text-[13px] font-bold text-[var(--t-g800)] truncate">
                  {currentChapter.title}
                </span>
              </div>
              <button
                type="button"
                data-testid="skip-to-archive-btn"
                onClick={enterArchive}
                className="min-h-[36px] px-2.5 rounded-xl text-[12px] font-semibold text-[var(--t-g500)] hover:text-[var(--t-g900)] hover:bg-[var(--t-g100)] inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                <span>전체 리포트</span>
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 클릭 가능한 챕터 프로그레스 바 */}
            <div
              className="grid gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${chapters.length}, minmax(0, 1fr))`,
              }}
            >
              {chapters.map((ch, idx) => {
                const isDone = idx <= safeChapterIdx;
                return (
                  <button
                    key={ch.key}
                    type="button"
                    aria-label={`${idx + 1}장 ${ch.title}`}
                    onClick={() => {
                      setSlideDirection(idx >= safeChapterIdx ? 1 : -1);
                      setChapterIdx(idx);
                    }}
                    className="py-2 cursor-pointer group"
                  >
                    <span
                      className={`block h-[4px] rounded-full transition-colors ${
                        idx === safeChapterIdx
                          ? 'bg-[var(--t-accent)]'
                          : isDone
                          ? 'bg-[var(--t-g700)]'
                          : 'bg-[var(--t-g200)] group-hover:bg-[var(--t-g400)]'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* 챕터 슬라이드 본문 */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.section
              key={currentChapter.key}
              data-testid={`retro-chapter-${currentChapter.key}`}
              initial={
                prefersReducedMotion
                  ? false
                  : { opacity: 0, x: slideDirection * 18 }
              }
              animate={{ opacity: 1, x: 0 }}
              exit={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, x: slideDirection * -18 }
              }
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="t-card space-y-6"
            >
              {/* Chapter 01: 커리어의 서막 */}
              {currentChapter.key === 'PROLOGUE' && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <p className="text-[12px] font-bold text-[var(--t-gold)] tabular-nums">
                      01 · 커리어 다큐멘터리 · {retro.retirementReasonLabel}
                    </p>
                    <h1 className="text-[28px] sm:text-[34px] font-bold tracking-[-0.03em] text-[var(--t-g900)] leading-[1.2] text-balance">
                      #{retro.jerseyNumber} {retro.playerName}
                    </h1>
                    <p className="text-[13px] font-medium text-[var(--t-g500)] tabular-nums">
                      {careerSpanText} · 만 {retro.finalAge}세 은퇴
                    </p>
                    <p className="text-[13px] text-[var(--t-g600)]">
                      {positionLine}
                    </p>
                  </div>

                  <div className="py-5 border-y border-[var(--t-g100)]">
                    <p className="text-[16px] sm:text-[17px] font-medium text-[var(--t-g900)] leading-[1.7] text-balance">
                      {retro.openingStatement}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 tabular-nums">
                    <div>
                      <span className="block text-[22px] font-bold text-[var(--t-g900)]">
                        {retro.totals.gp.toLocaleString()}
                      </span>
                      <span className="text-[12px] text-[var(--t-g500)]">
                        통산 출전 경기
                      </span>
                    </div>
                    <div>
                      <span className="block text-[22px] font-bold text-[var(--t-accent)]">
                        {retro.totals.points.toLocaleString()}
                      </span>
                      <span className="text-[12px] text-[var(--t-g500)]">
                        통산 누적 득점
                      </span>
                    </div>
                    <div>
                      <span className="block text-[22px] font-bold text-[var(--t-g900)]">
                        {retro.peakOvr}
                      </span>
                      <span className="text-[12px] text-[var(--t-g500)]">
                        커리어 최고 OVR
                      </span>
                    </div>
                    <div>
                      <span className="block text-[22px] font-bold text-[var(--t-gold)]">
                        {retro.careerHighs.points}점
                      </span>
                      <span className="text-[12px] text-[var(--t-g500)]">
                        단일 경기 최고
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Chapter 02: 팀 이적 여정 */}
              {currentChapter.key === 'JOURNEY' && (
                <div className="space-y-5">
                  <div className="space-y-1">
                    <p className="text-[12px] font-bold text-[var(--t-accent-ink)]">
                      02 · 코트 위의 여정
                    </p>
                    <h2 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.03em] text-[var(--t-g900)] text-balance">
                      {retro.stints.length}개의 유니폼을 거쳐 완성한 발자취
                    </h2>
                    <p className="text-[13px] text-[var(--t-g500)]">
                      고교 첫 무대부터 은퇴 시즌까지 소속팀별 활약 기록입니다
                    </p>
                  </div>

                  <TeamStintsTimeline stints={retro.stints} />
                </div>
              )}

              {/* Chapter 03: 성장 궤적과 인생 최고 시즌 */}
              {currentChapter.key === 'TRAJECTORY' && (
                <div className="space-y-6">
                  <div className="space-y-1">
                    <p className="text-[12px] font-bold text-[var(--t-accent-ink)]">
                      03 · 성장 궤적과 전성기
                    </p>
                    <h2 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.03em] text-[var(--t-g900)] text-balance">
                      정점을 향해 올라선 커리어 곡선
                    </h2>
                  </div>

                  <CareerTrajectoryChart
                    seasons={retro.seasons}
                    peakSeasonNumber={retro.peakSeason?.seasonNumber}
                  />

                  {retro.peakSeason && (
                    <div
                      data-testid="peak-season-spotlight"
                      className="pt-5 border-t border-[var(--t-g100)] space-y-3"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[13px] font-bold text-[var(--t-gold)]">
                          인생 최고의 시즌 스포트라이트
                        </span>
                        <span className="text-[12px] font-semibold text-[var(--t-g500)] tabular-nums">
                          {retro.peakSeason.year} · 만 {retro.peakSeason.age}세
                        </span>
                      </div>
                      <p className="text-[17px] font-bold text-[var(--t-g900)]">
                        {retro.peakSeason.teamName} ({retro.peakSeason.leagueShortName}) · OVR{' '}
                        {retro.peakSeason.ovr}
                      </p>
                      <p className="text-[13px] text-[var(--t-g600)] tabular-nums">
                        {retro.peakSeason.ppg.toFixed(1)} PPG ·{' '}
                        {retro.peakSeason.rpg.toFixed(1)} RPG ·{' '}
                        {retro.peakSeason.apg.toFixed(1)} APG · 야투{' '}
                        {retro.peakSeason.fgPct.toFixed(1)}% · 3점{' '}
                        {retro.peakSeason.tpPct.toFixed(1)}%
                      </p>
                      <p className="text-[12px] text-[var(--t-g500)]">
                        {retro.peakSeason.wins}승 {retro.peakSeason.losses}패 ·{' '}
                        {retro.peakSeason.playoffResult}
                        {retro.peakSeason.headline
                          ? ` — ${retro.peakSeason.headline}`
                          : ''}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Chapter 04: 우승 연대기와 트로피 진열장 */}
              {currentChapter.key === 'TROPHIES' && (
                <div className="space-y-5">
                  <div className="space-y-1">
                    <p className="text-[12px] font-bold text-[var(--t-gold)]">
                      04 · 우승 연대기와 트로피 진열장
                    </p>
                    <h2 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.03em] text-[var(--t-g900)] text-balance">
                      코트 위에서 들어 올린 영광의 증거
                    </h2>
                  </div>

                  <TrophyCabinetSection
                    championships={retro.championships}
                    bestPlayoffNote={retro.bestPlayoffNote}
                    trophies={retro.trophies}
                  />
                </div>
              )}

              {/* Chapter 05 (조건부): 영구결번 게양식 */}
              {currentChapter.key === 'JERSEY' && (
                <div className="space-y-5">
                  <div className="space-y-1">
                    <p className="text-[12px] font-bold text-[var(--t-gold)]">
                      05 · 영구결번 공식 게양식
                    </p>
                    <h2 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.03em] text-[var(--t-g900)] text-balance">
                      {retro.jerseyCeremony.honoredTeam.name}의 영구결번으로 남는 #{retro.jerseyNumber}
                    </h2>
                  </div>

                  <JerseyRetirementStage
                    playerName={retro.playerName}
                    jerseyNumber={retro.jerseyNumber}
                    startYear={retro.startYear}
                    endYear={retro.endYear}
                    ceremony={retro.jerseyCeremony}
                  />
                </div>
              )}

              {/* Final Chapter: 레거시 판정과 마침표 */}
              {currentChapter.key === 'VERDICT' && (
                <div className="space-y-6">
                  <div className="space-y-2 text-center">
                    <p className="text-[12px] font-bold text-[var(--t-gold)] tabular-nums">
                      {String(chapters.length).padStart(2, '0')} · 최종 레거시 판정
                    </p>
                    <h2 className="text-[26px] sm:text-[30px] font-bold tracking-[-0.03em] text-[var(--t-g900)] text-balance">
                      {retro.legacyTitle}
                    </h2>
                    <p className="text-[14px] text-[var(--t-g600)] leading-[1.7] max-w-[48ch] mx-auto">
                      {retro.epitaph}
                    </p>
                  </div>

                  {/* 통산 평균은 리바운드·어시스트가 두 자리면 길어지므로 가운데 칸을 넓히고, 좁은 화면에서는 숫자를 함께 줄입니다. */}
                  <div className="grid grid-cols-[1fr_1.7fr_1fr] gap-2 py-4 border-y border-[var(--t-g100)] text-center tabular-nums">
                    <div>
                      <span className="block whitespace-nowrap text-[clamp(15px,5vw,22px)] font-bold text-[var(--t-accent)]">
                        {retro.legacyScore.toLocaleString()}
                      </span>
                      <span className="block whitespace-nowrap text-[11px] text-[var(--t-g500)]">
                        레거시 점수
                      </span>
                    </div>
                    <div>
                      <span className="block whitespace-nowrap text-[clamp(15px,5vw,22px)] font-bold text-[var(--t-g900)]">
                        {retro.averages.ppg}/{retro.averages.rpg}/{retro.averages.apg}
                      </span>
                      <span className="block whitespace-nowrap text-[11px] text-[var(--t-g500)]">
                        통산 평균
                      </span>
                    </div>
                    <div>
                      <span className="block whitespace-nowrap text-[clamp(15px,5vw,22px)] font-bold text-[var(--t-gold)]">
                        {retro.totals.championships}/{retro.totals.mvps}
                      </span>
                      <span className="block whitespace-nowrap text-[11px] text-[var(--t-g500)]">
                        우승 / MVP
                      </span>
                    </div>
                  </div>

                  <div className="divide-y divide-[var(--t-g100)] text-[14px]">
                    <div className="py-2.5 flex items-center justify-between gap-3">
                      <span className="text-[var(--t-g500)]">대표 구단</span>
                      <span className="font-bold text-[var(--t-g900)]">
                        {retro.jerseyCeremony.honoredTeam.name}
                        {retro.jerseyCeremony.jerseyRetired
                          ? ` · 영구결번 #${retro.jerseyNumber}`
                          : ''}
                      </span>
                    </div>
                    <div className="py-2.5 flex items-center justify-between gap-3">
                      <span className="text-[var(--t-g500)]">통산 프로 연봉</span>
                      <span className="font-bold text-[var(--t-g900)] tabular-nums">
                        {formatCurrencyDetailed(retro.careerEarnings)}
                      </span>
                    </div>
                    {retro.traits.length > 0 && (
                      <div className="py-2.5 flex items-center justify-between gap-3">
                        <span className="text-[var(--t-g500)] shrink-0">
                          커리어 특성
                        </span>
                        <span className="font-semibold text-[var(--t-g800)] text-right">
                          {retro.traits.map((t) => getTraitInfo(t).name).join(' · ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.section>
          </AnimatePresence>

          {/* 하단 엄지 내비게이션 */}
          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="button"
              data-testid="retro-prev-btn"
              disabled={safeChapterIdx === 0}
              onClick={handlePrevChapter}
              className="min-h-[50px] px-4 rounded-2xl bg-[var(--t-card)] border border-[var(--t-g200)] text-[14px] font-semibold text-[var(--t-g700)] hover:bg-[var(--t-g50)] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1 cursor-pointer t-tap shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>이전</span>
            </button>
            <button
              type="button"
              data-testid="retro-next-btn"
              onClick={handleNextChapter}
              className="t-cta flex-1 gap-1.5"
            >
              <span>
                {safeChapterIdx === chapters.length - 1
                  ? '종합 커리어 아카이브 보기'
                  : `다음 · ${chapters[safeChapterIdx + 1]?.title}`}
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* 종합 커리어 아카이브 (4탭 리포트) */
        <div data-testid="retro-archive-view" className="space-y-3">
          {/* 아카이브 상단 아이덴티티 카드 */}
          <section className="t-card space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <TeamEmblem team={retro.jerseyCeremony.honoredTeam} size="md" />
                <div className="min-w-0">
                  <h1 className="text-[22px] sm:text-[24px] font-bold tracking-[-0.03em] text-[var(--t-g900)] truncate">
                    #{retro.jerseyNumber} {retro.playerName}
                  </h1>
                  <p className="text-[13px] font-semibold text-[var(--t-accent-ink)] truncate">
                    {retro.legacyTitle} · 레거시 {retro.legacyScore.toLocaleString()}
                  </p>
                  <p className="text-[12px] text-[var(--t-g500)] tabular-nums mt-0.5">
                    {careerSpanText} · {retro.retirementReasonLabel}
                  </p>
                </div>
              </div>
              <button
                type="button"
                data-testid="replay-documentary-btn"
                onClick={() => {
                  setChapterIdx(0);
                  setSlideDirection(1);
                  setViewMode('SLIDES');
                }}
                className="min-h-[40px] px-3 rounded-xl bg-[var(--t-g100)] hover:bg-[var(--t-g200)] text-[12px] font-bold text-[var(--t-g800)] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer t-tap"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>회고 재생</span>
              </button>
            </div>

            {/* 4탭 세그먼트 내비게이션 */}
            <div
              role="tablist"
              aria-label="커리어 아카이브 탭"
              className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-[var(--t-g100)] text-[12px] sm:text-[13px] font-bold"
            >
              {(
                [
                  { id: 'SUMMARY', label: '종합 요약' },
                  { id: 'JOURNEY', label: '팀 · 그래프' },
                  { id: 'TROPHIES', label: '우승 · 트로피' },
                  { id: 'SEASONS', label: '시즌별 스탯' },
                ] as const
              ).map((tab) => {
                const active = archiveTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    data-testid={`archive-tab-${tab.id}`}
                    onClick={() => setArchiveTab(tab.id)}
                    className={`min-h-[40px] px-1.5 rounded-xl whitespace-nowrap transition-colors cursor-pointer ${
                      active
                        ? 'bg-[var(--t-card)] text-[var(--t-g900)] shadow-xs'
                        : 'text-[var(--t-g500)] hover:text-[var(--t-g800)]'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* 탭 1: 종합 요약 */}
          {archiveTab === 'SUMMARY' && (
            <div className="space-y-3">
              <section className="t-card space-y-5">
                <p className="text-[14px] text-[var(--t-g700)] leading-[1.7]">
                  {retro.epitaph}
                </p>

                <div className="grid grid-cols-4 gap-2 py-4 border-y border-[var(--t-g100)] text-center tabular-nums">
                  <div>
                    <span className="block text-[20px] font-bold text-[var(--t-g900)]">
                      {retro.averages.ppg}
                    </span>
                    <span className="text-[11px] text-[var(--t-g500)]">PPG</span>
                  </div>
                  <div>
                    <span className="block text-[20px] font-bold text-[var(--t-g900)]">
                      {retro.averages.rpg}
                    </span>
                    <span className="text-[11px] text-[var(--t-g500)]">RPG</span>
                  </div>
                  <div>
                    <span className="block text-[20px] font-bold text-[var(--t-g900)]">
                      {retro.averages.apg}
                    </span>
                    <span className="text-[11px] text-[var(--t-g500)]">APG</span>
                  </div>
                  <div>
                    <span className="block text-[20px] font-bold text-[var(--t-accent)]">
                      {retro.peakOvr}
                    </span>
                    <span className="text-[11px] text-[var(--t-g500)]">최고 OVR</span>
                  </div>
                </div>

                <div className="divide-y divide-[var(--t-g100)] text-[14px]">
                  <div className="py-2.5 flex items-center justify-between gap-3">
                    <span className="text-[var(--t-g500)]">통산 누적 기록</span>
                    <span className="font-bold text-[var(--t-g900)] tabular-nums text-right">
                      {retro.totals.points.toLocaleString()}득점 ·{' '}
                      {retro.totals.rebounds.toLocaleString()}리바 ·{' '}
                      {retro.totals.assists.toLocaleString()}어시 ({retro.totals.gp}G)
                    </span>
                  </div>
                  {retro.totals.nbaGp > 0 && (
                    <div className="py-2.5 flex items-center justify-between gap-3">
                      <span className="text-[var(--t-g500)]">NBA 통산 기록</span>
                      <span className="font-bold text-[var(--t-g900)] tabular-nums text-right">
                        {retro.totals.nbaPoints.toLocaleString()}득점 ({retro.totals.nbaGp}G) · 우승{' '}
                        {retro.totals.nbaChampionships} · MVP {retro.totals.nbaMvps}
                      </span>
                    </div>
                  )}
                  <div className="py-2.5 flex items-center justify-between gap-3">
                    <span className="text-[var(--t-g500)]">단일 경기 커리어 하이</span>
                    <span className="font-bold text-[var(--t-accent-ink)] tabular-nums text-right">
                      {retro.careerHighs.points}득점
                      {retro.careerHighs.rebounds > 0
                        ? ` · ${retro.careerHighs.rebounds}리바`
                        : ''}
                      {retro.careerHighs.assists > 0
                        ? ` · ${retro.careerHighs.assists}어시`
                        : ''}
                    </span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between gap-3">
                    <span className="text-[var(--t-g500)]">통산 프로 연봉</span>
                    <span className="font-bold text-[var(--t-g900)] tabular-nums">
                      {formatCurrencyDetailed(retro.careerEarnings)}
                    </span>
                  </div>
                  {retro.traits.length > 0 && (
                    <div className="py-2.5 flex items-center justify-between gap-3">
                      <span className="text-[var(--t-g500)] shrink-0">보유 특성</span>
                      <span className="font-semibold text-[var(--t-g800)] text-right">
                        {retro.traits.map((t) => getTraitInfo(t).name).join(' · ')}
                      </span>
                    </div>
                  )}
                </div>
              </section>

              {/* 대표 구단 및 영구결번 섹션 */}
              <section className="t-card space-y-4">
                <span className="text-[13px] font-bold text-[var(--t-g500)]">
                  대표 구단 · 영구결번
                </span>
                {retro.jerseyCeremony.jerseyRetired ? (
                  <JerseyRetirementStage
                    playerName={retro.playerName}
                    jerseyNumber={retro.jerseyNumber}
                    startYear={retro.startYear}
                    endYear={retro.endYear}
                    ceremony={retro.jerseyCeremony}
                    initialRaised
                  />
                ) : (
                  <div className="flex items-center gap-4">
                    <TeamEmblem team={retro.jerseyCeremony.honoredTeam} size="lg" />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <h3 className="text-[17px] font-bold text-[var(--t-g900)] truncate">
                        {retro.jerseyCeremony.honoredTeam.name}
                      </h3>
                      <p className="text-[12px] text-[var(--t-g600)] tabular-nums">
                        {retro.jerseyCeremony.honoredTeamSeasons}시즌 ·{' '}
                        {retro.jerseyCeremony.honoredTeamPoints.toLocaleString()}득점 · 우승{' '}
                        {retro.jerseyCeremony.honoredTeamChamps} · MVP{' '}
                        {retro.jerseyCeremony.honoredTeamMvps}
                      </p>
                      <p className="text-[12px] text-[var(--t-g500)] pt-1">
                        영구결번 기준 미달
                      </p>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* 탭 2: 팀 여정 · 그래프 */}
          {archiveTab === 'JOURNEY' && (
            <div className="space-y-3">
              <section className="t-card">
                <CareerTrajectoryChart
                  seasons={retro.seasons}
                  peakSeasonNumber={retro.peakSeason?.seasonNumber}
                />
              </section>
              <section className="t-card space-y-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-[15px] font-bold text-[var(--t-g900)]">
                    소속팀 이적 여정
                  </h3>
                  <span className="text-[12px] font-semibold text-[var(--t-g500)] tabular-nums">
                    {retro.stints.length}개 구간
                  </span>
                </div>
                <TeamStintsTimeline stints={retro.stints} />
              </section>
            </div>
          )}

          {/* 탭 3: 우승 · 트로피 */}
          {archiveTab === 'TROPHIES' && (
            <section className="t-card space-y-6">
              <TrophyCabinetSection
                championships={retro.championships}
                bestPlayoffNote={retro.bestPlayoffNote}
                trophies={retro.trophies}
              />

              {retro.brokenRecords.length > 0 && (
                <div className="pt-5 border-t border-[var(--t-g100)] space-y-3">
                  <h3 className="text-[15px] font-bold text-[var(--t-g900)]">
                    경신한 역대 리그 신기록
                  </h3>
                  <div className="divide-y divide-[var(--t-g100)]">
                    {retro.brokenRecords.map((rec, idx) => (
                      <div
                        key={`${rec.league}_${rec.label}_${idx}`}
                        className="py-2.5 flex items-center justify-between gap-3 text-[13px]"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-[var(--t-g900)]">
                            {rec.leagueShortName} {rec.label}
                          </span>
                          <span className="block text-[12px] text-[var(--t-g500)]">
                            {rec.teamName} ({rec.year})
                          </span>
                        </div>
                        <span className="font-bold text-[var(--t-accent)] tabular-nums shrink-0">
                          {rec.formattedValue}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* 탭 4: 시즌별 스탯 */}
          {archiveTab === 'SEASONS' && (
            <section className="t-card">
              <SeasonStatsTable retro={retro} />
            </section>
          )}

          {/* 하단 액션 */}
          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              data-testid="open-career-card"
              onClick={() => setShareCardOpen(true)}
              className="t-cta-sub t-cta-sub--accent"
            >
              커리어 카드
            </button>
            {isReplayMode && onCloseReplay ? (
              <button
                type="button"
                onClick={onCloseReplay}
                className="t-cta"
              >
                명예의 전당으로 돌아가기
              </button>
            ) : (
              <>
                <button
                  type="button"
                  data-testid="complete-retirement-home-btn"
                  onClick={completeRetirementAndReturnHome}
                  className="t-cta"
                >
                  명예의 전당 헌액 후 홈으로
                </button>
                <button
                  type="button"
                  onClick={() => {
                    completeRetirementAndReturnHome();
                    resetActiveCareer();
                  }}
                  className="t-cta-sub t-cta-sub--card"
                >
                  새 유망주 바로 시작
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
