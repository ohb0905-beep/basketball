'use client';

import React, { useEffect } from 'react';
import { X, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useCareerStore } from '../../store/useCareerStore';
import { CareerEvent, CareerEventChoice } from '../../types/game';

interface CustomModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose?: () => void;
}

export function Modal({ open, title, subtitle, children, onClose }: CustomModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            {subtitle && (
              <p className="text-xs font-semibold text-orange-600 mb-1">{subtitle}</p>
            )}
            <h3 id="modal-title" className="text-lg font-bold text-slate-900">
              {title}
            </h3>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="모달 닫기"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="p-6">{children}</div>
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
    <Modal open={true} title={event.title} subtitle={event.subtitle}>
      <p className="text-sm text-slate-600 leading-relaxed mb-6">{event.description}</p>
      <div className="space-y-3">
        {event.choices.map((choice, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelectChoice(choice)}
            className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-orange-500 hover:bg-orange-50/40 transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-sm font-bold text-slate-900 group-hover:text-orange-600">
                {choice.label}
              </span>
              <Sparkles className="w-4 h-4 text-orange-500 shrink-0" />
            </div>
            <p className="text-xs text-slate-600 mb-2">{choice.description}</p>
            <p className="text-xs font-semibold text-orange-700">{choice.effectSummary}</p>
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function ToastBanner() {
  const toast = useCareerStore((s) => s.toast);
  const clearToast = useCareerStore((s) => s.clearToast);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      clearToast();
    }, 3800);
    return () => clearTimeout(timer);
  }, [toast, clearToast]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-md w-full px-4 sm:px-0">
      <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-900 text-white shadow-lg border border-slate-800">
        {toast.tone === 'amber' ? (
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        ) : (
          <CheckCircle2 className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">{toast.title}</p>
          {toast.description && (
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
              {toast.description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={clearToast}
          aria-label="알림 닫기"
          className="text-slate-400 hover:text-white p-1 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
