'use client';

import React, { useEffect, useState } from 'react';
import { BookMarked, Calendar, SlidersHorizontal } from 'lucide-react';
import { Header } from '../components/common/Header';
import {
  CareerEventModal,
  ResetConfirmModal,
  SaveAndGuideModal,
  ToastBanner,
} from '../components/common/Modal';
import { PlayerCreator } from '../components/create/PlayerCreator';
import { HistoryTab } from '../components/dashboard/HistoryTab';
import { PlayerHeader } from '../components/dashboard/PlayerHeader';
import { SeasonTab } from '../components/dashboard/SeasonTab';
import { TrainingTab } from '../components/dashboard/TrainingTab';
import { DraftCombine } from '../components/draft/DraftCombine';
import { DraftLiveStage } from '../components/draft/DraftLiveStage';
import { HeroSection } from '../components/home/HeroSection';
import { RetirementCeremony } from '../components/retirement/RetirementCeremony';
import { useCareerStore } from '../store/useCareerStore';
import { hasSeasonBottomDock } from '../utils/formatters';

const DASHBOARD_TABS = [
  { id: 'SEASON' as const, label: '시즌', icon: Calendar },
  { id: 'TRAINING' as const, label: '선수', icon: SlidersHorizontal },
  { id: 'HISTORY' as const, label: '기록', icon: BookMarked },
];

export default function BenchToMvpApp() {
  const view = useCareerStore((s) => s.view);
  const career = useCareerStore((s) => s.career);
  const lastEncounterOutcome = useCareerStore((s) => s.lastEncounterOutcome);
  const setView = useCareerStore((s) => s.setView);
  const resolveEventChoice = useCareerStore((s) => s.resolveEventChoice);
  const dismissEncounterOutcome = useCareerStore((s) => s.dismissEncounterOutcome);
  const startNewCareer = useCareerStore((s) => s.startNewCareer);
  const resetActiveCareer = useCareerStore((s) => s.resetActiveCareer);

  const [activeTab, setActiveTab] = useState<'SEASON' | 'TRAINING' | 'HISTORY'>('SEASON');
  const [showResetModal, setShowResetModal] = useState(false);
  const [showSaveGuideModal, setShowSaveGuideModal] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (view === 'HOME') {
      document.body.dataset.state = 'title';
    } else if (view === 'RETIREMENT') {
      document.body.dataset.state = 'gameover';
    } else {
      document.body.dataset.state = 'playing';
    }
  }, [view]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1' && view === 'HOME') {
      if (career) {
        setView('DASHBOARD');
      } else {
        startNewCareer({
          name: '신입생',
          jerseyNumber: '',
          heightCm: 198,
          primaryPos: 'SF',
          highSchoolTeamId: 'HS_SAMIL',
        });
      }
    }
  }, [view, career, setView, startNewCareer]);

  const isLiveBroadcast =
    view === 'DASHBOARD' &&
    career?.seasonPhase === 'LIVE_FINAL_BROADCAST' &&
    Boolean(career?.liveGame);

  const isWideDashboard =
    view === 'DASHBOARD' &&
    activeTab === 'SEASON' &&
    (career?.seasonPhase === 'POSTSEASON_BRACKET' || isLiveBroadcast);

  const showBottomTabBar =
    view === 'DASHBOARD' && Boolean(career) && !isLiveBroadcast;

  const hasSeasonDock =
    showBottomTabBar &&
    activeTab === 'SEASON' &&
    hasSeasonBottomDock(career);

  return (
    <div className="min-h-screen bg-[var(--t-bg)] text-[var(--t-g900)] flex flex-col">
      <Header
        wide={isWideDashboard}
        onRequestResetModal={() => setShowResetModal(true)}
        onRequestSaveGuideModal={() => setShowSaveGuideModal(true)}
      />

      <main className="flex-1 w-full">
        {view === 'HOME' && (
          <HeroSection onRequestResetModal={() => setShowResetModal(true)} />
        )}

        {view === 'CREATE' && <PlayerCreator />}

        {view === 'DASHBOARD' && career && (
          <div
            className={`mx-auto px-4 pt-2 space-y-3 transition-[max-width] duration-200 ${
              isWideDashboard ? 'max-w-[760px]' : 'max-w-[560px]'
            } ${
              hasSeasonDock
                ? 'pb-[156px]'
                : showBottomTabBar
                ? 'pb-[88px]'
                : 'pb-10'
            }`}
          >
            {!isLiveBroadcast && <PlayerHeader career={career} />}

            <div>
              {activeTab === 'SEASON' && <SeasonTab />}
              {activeTab === 'TRAINING' && <TrainingTab />}
              {activeTab === 'HISTORY' && <HistoryTab />}
            </div>
          </div>
        )}

        {view === 'DRAFT_COMBINE' && <DraftCombine />}

        {view === 'DRAFT_LIVE' && (
          <div className="px-4 pt-3 pb-10">
            <DraftLiveStage />
          </div>
        )}

        {view === 'RETIREMENT' && <RetirementCeremony />}
      </main>

      {/* 고정 하단 탭바 (토스형 모바일 앱 내비게이션) */}
      {showBottomTabBar && (
        <nav
          role="tablist"
          aria-label="대시보드 탭"
          className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--t-card)]/95 backdrop-blur-md border-t border-[var(--t-g200)] rounded-t-[20px] pb-safe"
        >
          <div className="max-w-[560px] mx-auto grid grid-cols-3 h-[58px]">
            {DASHBOARD_TABS.map((tab) => {
              const Icon = tab.icon;
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col items-center justify-center gap-0.5 cursor-pointer t-tap ${
                    selected
                      ? 'text-[var(--t-accent)]'
                      : 'text-[var(--t-g400)] hover:text-[var(--t-g700)]'
                  }`}
                >
                  <Icon
                    className={`w-[22px] h-[22px] ${
                      selected ? 'stroke-[2.4]' : 'stroke-[1.9]'
                    }`}
                  />
                  <span
                    className={`text-[11px] leading-none ${
                      selected ? 'font-bold' : 'font-medium'
                    }`}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* 분기점 인카운터 바텀시트 (대시보드 진입 시에만 표시) */}
      <CareerEventModal
        event={view === 'DASHBOARD' ? career?.pendingEvent || null : null}
        career={career}
        lastOutcome={view === 'DASHBOARD' ? lastEncounterOutcome : null}
        onSelectChoice={resolveEventChoice}
        onDismissOutcome={dismissEncounterOutcome}
      />

      {/* 초기화 확인 바텀시트 */}
      <ResetConfirmModal
        open={showResetModal}
        career={career}
        onCancel={() => setShowResetModal(false)}
        onConfirmReset={() => {
          setShowResetModal(false);
          resetActiveCareer();
        }}
      />

      {/* 세이브 · 가이드 바텀시트 */}
      <SaveAndGuideModal
        open={showSaveGuideModal}
        onClose={() => setShowSaveGuideModal(false)}
      />

      <ToastBanner />
    </div>
  );
}
