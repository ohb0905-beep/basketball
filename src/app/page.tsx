'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '../components/common/Header';
import { CareerEventModal, ToastBanner } from '../components/common/Modal';
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

export default function BenchToMvpApp() {
  const view = useCareerStore((s) => s.view);
  const career = useCareerStore((s) => s.career);
  const setView = useCareerStore((s) => s.setView);
  const resolveEventChoice = useCareerStore((s) => s.resolveEventChoice);
  const startNewCareer = useCareerStore((s) => s.startNewCareer);

  const [activeTab, setActiveTab] = useState<'SEASON' | 'TRAINING' | 'HISTORY'>('SEASON');

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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <Header />

      <main className="flex-1 w-full">
        {view === 'HOME' && <HeroSection />}

        {view === 'CREATE' && <PlayerCreator />}

        {view === 'DASHBOARD' && career && (
          <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
            <PlayerHeader career={career} />

            {/* 3탭 네비게이션 (화이트톤 세그먼트 컨트롤) */}
            <div
              role="tablist"
              aria-label="인게임 대시보드 탭"
              className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-white border border-slate-200 shadow-2xs"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'SEASON'}
                onClick={() => setActiveTab('SEASON')}
                className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer ${
                  activeTab === 'SEASON'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                🏀 이번 시즌 &amp; 오프시즌
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'TRAINING'}
                onClick={() => setActiveTab('TRAINING')}
                className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer ${
                  activeTab === 'TRAINING'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                ⚡ 내 선수 &amp; 생체역학 훈련
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'HISTORY'}
                onClick={() => setActiveTab('HISTORY')}
                className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer ${
                  activeTab === 'HISTORY'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                📜 커리어 기록실
              </button>
            </div>

            <div>
              {activeTab === 'SEASON' && <SeasonTab />}
              {activeTab === 'TRAINING' && <TrainingTab />}
              {activeTab === 'HISTORY' && <HistoryTab />}
            </div>
          </div>
        )}

        {view === 'DRAFT_COMBINE' && <DraftCombine />}

        {view === 'DRAFT_LIVE' && (
          <div className="px-4 py-8">
            <DraftLiveStage />
          </div>
        )}

        {view === 'RETIREMENT' && <RetirementCeremony />}
      </main>

      {/* 시즌 분기점 / 아시안게임 차출 / 부상 이벤트 모달 */}
      <CareerEventModal
        event={career?.pendingEvent || null}
        onSelectChoice={resolveEventChoice}
      />

      <ToastBanner />
    </div>
  );
}
