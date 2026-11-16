'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '../components/common/Header';
import { CareerEventModal, Modal, ToastBanner } from '../components/common/Modal';
import { PlayerCreator } from '../components/create/PlayerCreator';
import { HistoryTab } from '../components/dashboard/HistoryTab';
import { PlayerHeader } from '../components/dashboard/PlayerHeader';
import { SeasonTab } from '../components/dashboard/SeasonTab';
import { TrainingTab } from '../components/dashboard/TrainingTab';
import { DraftCombine } from '../components/draft/DraftCombine';
import { DraftLiveStage } from '../components/draft/DraftLiveStage';
import { BestFiveCourt } from '../components/home/BestFiveCourt';
import { HeroSection } from '../components/home/HeroSection';
import { RetirementCeremony } from '../components/retirement/RetirementCeremony';
import { useCareerStore } from '../store/useCareerStore';

type DashboardTabId = 'SEASON' | 'TRAINING' | 'HISTORY';

export default function BenchToMvpApp() {
  const view = useCareerStore((s) => s.view);
  const career = useCareerStore((s) => s.career);
  const setView = useCareerStore((s) => s.setView);
  const resolveEventChoice = useCareerStore((s) => s.resolveEventChoice);
  const resetActiveCareer = useCareerStore((s) => s.resetActiveCareer);
  const startNewCareer = useCareerStore((s) => s.startNewCareer);

  const [activeTab, setActiveTab] = useState<DashboardTabId>('SEASON');
  const [resetModalOpen, setResetModalOpen] = useState(false);

  // body data-state 동기화 ('title' | 'playing' | 'gameover')
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

  // ?autostart=1 파라미터 지원 및 타이틀 화면 Enter/Space 키 핸드셰이크
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

  useEffect(() => {
    if (view !== 'HOME') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (resetModalOpen) return;
      if (
        document.activeElement &&
        ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(
          document.activeElement.tagName
        )
      ) {
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (career) {
          setView('DASHBOARD');
        } else {
          setView('CREATE');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, career, resetModalOpen, setView]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col">
      <Header onRequestResetModal={() => setResetModalOpen(true)} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {view === 'HOME' && (
          <div className="space-y-8">
            <HeroSection onRequestResetModal={() => setResetModalOpen(true)} />
            <BestFiveCourt />
          </div>
        )}

        {view === 'CREATE' && <PlayerCreator />}

        {view === 'DASHBOARD' && career && (
          <div className="space-y-6">
            {/* 상단 고정 선수 프로필 카드 */}
            <PlayerHeader career={career} />

            {/* 클린 3탭 네비게이션 */}
            <div
              role="tablist"
              aria-label="인게임 대시보드 탭"
              className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-slate-200/75 border border-slate-200"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'SEASON'}
                onClick={() => setActiveTab('SEASON')}
                className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'SEASON'
                    ? 'bg-white text-orange-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🏀 이번 시즌
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'TRAINING'}
                onClick={() => setActiveTab('TRAINING')}
                className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'TRAINING'
                    ? 'bg-white text-orange-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ⚡ 내 선수 & 훈련
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'HISTORY'}
                onClick={() => setActiveTab('HISTORY')}
                className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'HISTORY'
                    ? 'bg-white text-orange-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📜 커리어 기록실
              </button>
            </div>

            {/* 3탭 본문 */}
            <div>
              {activeTab === 'SEASON' && <SeasonTab />}
              {activeTab === 'TRAINING' && <TrainingTab />}
              {activeTab === 'HISTORY' && <HistoryTab />}
            </div>
          </div>
        )}

        {view === 'DRAFT_COMBINE' && <DraftCombine />}

        {view === 'DRAFT_LIVE' && <DraftLiveStage />}

        {view === 'RETIREMENT' && <RetirementCeremony />}
      </main>

      <footer className="border-t border-slate-200 bg-white py-5 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <span>벤치에서 MVP까지 (From Bench to MVP) · 농구 선수 커리어 육성 시뮬레이션</span>
          <span>고교 · U-리그 · KBL · 해외 · G리그 · NCAA · NBA 7대 리그 지원</span>
        </div>
      </footer>

      {/* 시즌 분기점 / 병역특례 / 노장 부상 이벤트 모달 */}
      <CareerEventModal
        event={career?.pendingEvent || null}
        onSelectChoice={resolveEventChoice}
      />

      {/* 새 선수 생성 확인 모달 (브라우저 confirm 대체) */}
      <Modal
        open={resetModalOpen}
        title="새 선수를 처음부터 육성할까요?"
        subtitle="진행 중인 커리어 초기화 확인"
        onClose={() => setResetModalOpen(false)}
      >
        <div className="space-y-5">
          <p className="text-sm text-slate-600 leading-relaxed">
            현재 진행 중인{' '}
            <strong className="text-slate-900">
              #{career?.jerseyNumber} {career?.name}
            </strong>{' '}
            선수의 은퇴 전 커리어 데이터가 초기화되고 새 선수 생성 화면으로 이동해요. (단, 이미
            은퇴하여 명예의 전당 및 올타임 베스트 5에 헌액된 선수 기록은 영구히 보존돼요!)
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setResetModalOpen(false)}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
            >
              취소하고 계속 플레이
            </button>
            <button
              type="button"
              onClick={() => {
                setResetModalOpen(false);
                resetActiveCareer();
              }}
              className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs cursor-pointer"
            >
              새 선수 만들기
            </button>
          </div>
        </div>
      </Modal>

      <ToastBanner />
    </div>
  );
}
