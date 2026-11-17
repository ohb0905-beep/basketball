'use client';

import React from 'react';
import { CheckCircle2, Sparkles, X } from 'lucide-react';
import { useCareerStore } from '../../store/useCareerStore';
import { CareerEvent, CareerEventChoice } from '../../types/game';

export interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose?: () => void;
  children: React.ReactNode;
}

export function Modal({ open, title, subtitle, onClose, children }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-white text-slate-900 border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl font-black text-slate-900">{title}</h2>
            {subtitle && (
              <p className="text-xs font-semibold text-orange-600 mt-1">{subtitle}</p>
            )}
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
              aria-label="닫기"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

export function CareerEventModal({
  event,
  onSelectChoice,
}: {
  event: CareerEvent | null;
  onSelectChoice: (choice: CareerEventChoice) => void;
}) {
  if (!event) return null;

  return (
    <div
      data-testid="career-event-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-slate-900">
        <div className="space-y-2 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-1.5 text-orange-600 text-xs font-extrabold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{event.subtitle || '커리어 주요 분기점'}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">{event.title}</h2>
          <p className="text-sm text-slate-600 leading-relaxed">{event.description}</p>
        </div>

        <div className="space-y-3">
          {event.choices.map((choice, idx) => (
            <button
              key={`${event.id}-choice-${idx}`}
              type="button"
              onClick={() => onSelectChoice(choice)}
              className="w-full text-left p-4 rounded-2xl bg-slate-50 hover:bg-orange-50/60 border border-slate-200 hover:border-orange-500 transition cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm sm:text-base font-black text-slate-900 group-hover:text-orange-600 transition">
                  {choice.label}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {choice.description}
              </p>
              {choice.effectSummary && (
                <p className="text-[11px] font-bold text-orange-600 mt-2">
                  효과: {choice.effectSummary}
                </p>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ToastBanner() {
  const toast = useCareerStore((s) => s.toast);
  const clearToast = useCareerStore((s) => s.clearToast);

  if (!toast) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-md bg-white border-2 border-orange-500 text-slate-900 px-4 py-3.5 rounded-2xl shadow-xl flex items-start gap-3">
      <CheckCircle2 className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-xs sm:text-sm font-extrabold text-slate-900 leading-snug">
          {toast.title}
        </p>
        {toast.description && (
          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
            {toast.description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={clearToast}
        className="text-slate-400 hover:text-slate-700 transition cursor-pointer"
        aria-label="알림 닫기"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
