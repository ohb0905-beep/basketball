'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Code2,
  Inbox,
  Loader2,
  LogOut,
  RefreshCw,
  Save,
  X,
} from 'lucide-react';
import { GAME_NAME, GAME_VERSION } from '../../config/appMeta';
import {
  ADMIN_NOTE_MAX,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_STATUS_OPTIONS,
  FEEDBACK_TYPE_LABELS,
  FEEDBACK_TYPE_OPTIONS,
  FeedbackRecord,
  FeedbackStatus,
  FeedbackStatusCounts,
  FeedbackType,
  formatFeedbackDateKst,
  formatStoredGameContextRows,
} from '../../lib/feedback';
import { Modal } from '../common/Modal';
import { AdminConsoleNav } from './AdminConsoleNav';

const PAGE_SIZE = 25;

const EMPTY_COUNTS: FeedbackStatusCounts = {
  total: 0,
  received: 0,
  reviewing: 0,
  resolved: 0,
  rejected: 0,
};

const STATUS_STYLE_MAP: Record<
  FeedbackStatus,
  { text: string; bg: string }
> = {
  received: {
    text: 'text-[var(--t-down)]',
    bg: 'bg-[var(--t-down-soft)]',
  },
  reviewing: {
    text: 'text-[var(--t-gold)]',
    bg: 'bg-[var(--t-gold-soft)]',
  },
  resolved: {
    text: 'text-[var(--t-ok)]',
    bg: 'bg-[var(--t-ok-soft)]',
  },
  rejected: {
    text: 'text-[var(--t-up)]',
    bg: 'bg-[var(--t-up-soft)]',
  },
};

const TYPE_SHORT_MAP: Record<FeedbackType, string> = {
  bug: '버그 제보',
  balance: '밸런스',
  content: '콘텐츠',
  ui: 'UI/사용성',
  other: '기타',
};

interface AdminToast {
  id: number;
  tone: 'ok' | 'error';
  message: string;
}

interface DetailEditorProps {
  item: FeedbackRecord;
  saving: boolean;
  onSave: (draftStatus: FeedbackStatus, draftNote: string) => void;
}

function FeedbackDetailBody({
  item,
  saving,
  onSave,
}: DetailEditorProps) {
  const [draftStatus, setDraftStatus] = useState<FeedbackStatus>(item.status);
  const [draftNote, setDraftNote] = useState(item.admin_note ?? '');
  const [showRawJson, setShowRawJson] = useState(false);

  const contextRows = useMemo(
    () => formatStoredGameContextRows(item.game_context),
    [item.game_context]
  );

  const rawJsonText = useMemo(() => {
    try {
      return JSON.stringify(item.game_context ?? {}, null, 2);
    } catch {
      return '{}';
    }
  }, [item.game_context]);

  const hasChanges =
    draftStatus !== item.status || draftNote !== (item.admin_note ?? '');

  const statusStyle = STATUS_STYLE_MAP[item.status] || STATUS_STYLE_MAP.received;

  return (
    <div className="space-y-5">
      {/* 메타 정보 및 제목 */}
      <div className="space-y-2 pb-4 border-b border-[var(--t-g100)]">
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <span
            className={`px-2 py-0.5 rounded-md font-bold ${statusStyle.bg} ${statusStyle.text}`}
          >
            {FEEDBACK_STATUS_LABELS[item.status] || item.status}
          </span>
          <span className="px-2 py-0.5 rounded-md font-semibold bg-[var(--t-g100)] text-[var(--t-g700)]">
            {FEEDBACK_TYPE_LABELS[item.type] || item.type}
          </span>
          <span className="text-[var(--t-g500)] tabular-nums">
            {item.game_version ? `v${item.game_version}` : '버전 정보 없음'}
          </span>
          <span className="text-[var(--t-g400)]" aria-hidden="true">
            ·
          </span>
          <span className="text-[var(--t-g500)] tabular-nums">
            {formatFeedbackDateKst(item.created_at)}
          </span>
        </div>

        <h2 className="text-[18px] font-bold tracking-[-0.02em] text-[var(--t-g900)] leading-snug break-words">
          {item.title}
        </h2>
        <p className="text-[11px] font-mono text-[var(--t-g400)] break-all">
          ID: {item.id}
        </p>
      </div>

      {/* 제보 상세 내용 전문 */}
      <div className="space-y-1.5">
        <h3 className="text-[12px] font-bold text-[var(--t-g500)]">상세 내용</h3>
        <div className="p-4 rounded-2xl bg-[var(--t-g50)] border border-[var(--t-g100)] text-[14px] text-[var(--t-g800)] leading-relaxed whitespace-pre-wrap break-words max-h-[280px] overflow-y-auto">
          {item.content}
        </div>
      </div>

      {/* 자동 첨부 game_context 구조화 요약 + 원본 JSON 토글 */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[12px] font-bold text-[var(--t-g500)]">
            자동 첨부 게임 정보
          </h3>
          <button
            type="button"
            data-testid="toggle-raw-json-btn"
            onClick={() => setShowRawJson((prev) => !prev)}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--t-g600)] hover:text-[var(--t-g900)] cursor-pointer whitespace-nowrap"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{showRawJson ? '원본 JSON 숨기기' : '원본 JSON 보기'}</span>
            {showRawJson ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {contextRows.length > 0 ? (
          <div className="rounded-2xl bg-[var(--t-g50)] border border-[var(--t-g100)] px-3.5 py-2 divide-y divide-[var(--t-g100)] text-[12px]">
            {contextRows.map((row) => (
              <div
                key={row.label}
                className="py-2 flex items-baseline justify-between gap-3"
              >
                <span className="text-[var(--t-g500)] shrink-0">{row.label}</span>
                <span className="font-medium text-[var(--t-g800)] text-right tabular-nums break-words">
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-[var(--t-g500)] py-2">
            첨부된 게임 요약 정보가 없습니다.
          </p>
        )}

        {showRawJson && (
          <pre
            data-testid="raw-game-context-json"
            className="p-3.5 rounded-2xl bg-[var(--t-g100)] text-[11px] font-mono text-[var(--t-g800)] overflow-x-auto max-h-[240px] leading-relaxed"
          >
            {rawJsonText}
          </pre>
        )}
      </div>

      {/* 처리 상태 변경 및 관리자 메모 저장 */}
      <div className="pt-4 border-t border-[var(--t-g100)] space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="admin-status-select"
            className="block text-[13px] font-bold text-[var(--t-g800)]"
          >
            처리 상태
          </label>
          <select
            id="admin-status-select"
            data-testid="admin-status-select"
            value={draftStatus}
            disabled={saving}
            onChange={(e) => setDraftStatus(e.target.value as FeedbackStatus)}
            className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--t-g100)] text-[14px] font-semibold text-[var(--t-g900)] focus:outline-none focus:ring-2 focus:ring-[var(--t-accent)] cursor-pointer disabled:opacity-60"
          >
            {FEEDBACK_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} ({opt.value})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <label
              htmlFor="admin-note-textarea"
              className="text-[13px] font-bold text-[var(--t-g800)]"
            >
              관리자 메모
            </label>
            <span className="text-[12px] text-[var(--t-g500)] tabular-nums">
              {draftNote.length.toLocaleString()} / {ADMIN_NOTE_MAX.toLocaleString()}
            </span>
          </div>
          <textarea
            id="admin-note-textarea"
            data-testid="admin-note-textarea"
            rows={4}
            maxLength={ADMIN_NOTE_MAX}
            disabled={saving}
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
            placeholder="원인 분석, 패치 예정 버전, 대응 이력 등을 기록해 두세요."
            className="w-full px-3.5 py-3 rounded-xl bg-[var(--t-g100)] text-[14px] text-[var(--t-g900)] placeholder:text-[var(--t-g400)] leading-relaxed resize-y min-h-[104px] focus:outline-none focus:ring-2 focus:ring-[var(--t-accent)] disabled:opacity-60"
          />
        </div>

        <button
          type="button"
          data-testid="admin-save-btn"
          disabled={saving || !hasChanges}
          onClick={() => onSave(draftStatus, draftNote)}
          className="t-cta min-h-[48px] gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>저장 중...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>{hasChanges ? '변경 사항 저장' : '저장됨'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export function AdminFeedbackDashboard() {
  const router = useRouter();

  const [typeFilter, setTypeFilter] = useState<FeedbackType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | 'all'>('all');
  const [offset, setOffset] = useState(0);
  const [reloadTick, setReloadTick] = useState(0);

  const [items, setItems] = useState<FeedbackRecord[]>([]);
  const [totalFiltered, setTotalFiltered] = useState(0);
  const [counts, setCounts] = useState<FeedbackStatusCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [toast, setToast] = useState<AdminToast | null>(null);

  const pushToast = useCallback((tone: 'ok' | 'error', message: string) => {
    const id = Date.now();
    setToast({ id, tone, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast((prev) => (prev?.id === toast.id ? null : prev));
    }, 3400);
    return () => clearTimeout(timer);
  }, [toast]);

  const triggerReload = useCallback(() => {
    setLoading(true);
    setErrorMessage(null);
    setReloadTick((prev) => prev + 1);
  }, []);

  const handleChangeTypeFilter = (next: FeedbackType | 'all') => {
    setLoading(true);
    setErrorMessage(null);
    setTypeFilter(next);
    setOffset(0);
  };

  const handleChangeStatusFilter = (next: FeedbackStatus | 'all') => {
    setLoading(true);
    setErrorMessage(null);
    setStatusFilter(next);
    setOffset(0);
  };

  const handleChangeOffset = (next: number) => {
    setLoading(true);
    setErrorMessage(null);
    setOffset(next);
  };

  useEffect(() => {
    let cancelled = false;

    const qs = new URLSearchParams({
      type: typeFilter,
      status: statusFilter,
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });

    fetch(`/api/admin/feedback?${qs.toString()}`, {
      method: 'GET',
      cache: 'no-store',
    })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          router.refresh();
          return;
        }

        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          items?: FeedbackRecord[];
          totalFiltered?: number;
          counts?: FeedbackStatusCounts;
        };

        if (cancelled) return;

        if (!res.ok || !data?.ok) {
          setErrorMessage(
            data?.error ||
              '피드백 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
          );
          return;
        }

        const nextItems = Array.isArray(data.items) ? data.items : [];
        setItems(nextItems);
        setTotalFiltered(
          typeof data.totalFiltered === 'number'
            ? data.totalFiltered
            : nextItems.length
        );
        if (data.counts) {
          setCounts(data.counts);
        }

        setSelectedId((prev) => {
          if (prev && nextItems.some((item) => item.id === prev)) {
            return prev;
          }
          return nextItems[0]?.id ?? null;
        });
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMessage('네트워크 오류로 피드백 목록을 불러오지 못했습니다.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [typeFilter, statusFilter, offset, reloadTick, router]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  const handleSelectItem = (item: FeedbackRecord) => {
    setSelectedId(item.id);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setMobileDetailOpen(true);
    }
  };

  const handleSaveDetail = async (
    nextStatus: FeedbackStatus,
    nextNote: string
  ) => {
    if (!selectedItem || saving) return;
    setSaving(true);

    const previousStatus = selectedItem.status;

    try {
      const res = await fetch(`/api/admin/feedback/${selectedItem.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: nextStatus,
          admin_note: nextNote,
        }),
      });

      if (res.status === 401) {
        router.refresh();
        return;
      }

      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        item?: FeedbackRecord;
      };

      if (!res.ok || !data?.ok || !data.item) {
        pushToast('error', data?.error || '저장에 실패했습니다. 다시 시도해 주세요.');
        return;
      }

      const updated = data.item;

      // 목록 상태 즉시 반영
      setItems((prev) => {
        const mapped = prev.map((row) => (row.id === updated.id ? updated : row));
        if (statusFilter !== 'all' && updated.status !== statusFilter) {
          return mapped.filter((row) => row.id !== updated.id);
        }
        return mapped;
      });

      if (previousStatus !== updated.status) {
        setCounts((prev) => ({
          ...prev,
          [previousStatus]: Math.max(0, prev[previousStatus] - 1),
          [updated.status]: prev[updated.status] + 1,
        }));
        if (statusFilter !== 'all' && updated.status !== statusFilter) {
          setTotalFiltered((prev) => Math.max(0, prev - 1));
          setMobileDetailOpen(false);
        }
      }

      pushToast('ok', '상태와 관리자 메모가 저장되었습니다.');
    } catch {
      pushToast('error', '네트워크 오류로 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' });
    } finally {
      router.refresh();
      setLoggingOut(false);
    }
  };

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));

  const summaryItems: {
    key: FeedbackStatus | 'all';
    label: string;
    value: number;
    toneClass: string;
  }[] = [
    { key: 'all', label: '전체', value: counts.total, toneClass: 'text-[var(--t-g900)]' },
    { key: 'received', label: '접수', value: counts.received, toneClass: 'text-[var(--t-down)]' },
    { key: 'reviewing', label: '확인 중', value: counts.reviewing, toneClass: 'text-[var(--t-gold)]' },
    { key: 'resolved', label: '해결 완료', value: counts.resolved, toneClass: 'text-[var(--t-ok)]' },
    { key: 'rejected', label: '반영 불가', value: counts.rejected, toneClass: 'text-[var(--t-up)]' },
  ];

  return (
    <div className="min-h-screen bg-[var(--t-bg)] text-[var(--t-g900)]">
      {/* 로컬 토스트 알림 */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          data-testid="admin-toast"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-32px)] max-w-[440px] bg-[var(--t-g900)] text-[var(--t-card)] pl-3.5 pr-2 py-2.5 rounded-2xl shadow-lg flex items-center gap-3"
        >
          <span
            className={`w-1 h-6 rounded-full shrink-0 ${
              toast.tone === 'ok' ? 'bg-[var(--t-ok)]' : 'bg-[var(--t-up)]'
            }`}
          />
          <p className="flex-1 text-[13px] font-semibold leading-snug">
            {toast.message}
          </p>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center opacity-75 hover:opacity-100 cursor-pointer rounded-xl"
            aria-label="알림 닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 상단 관리자 헤더 */}
      <header className="sticky top-0 z-30 bg-[var(--t-bg)]/92 backdrop-blur-md border-b border-[var(--t-g200)]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-baseline gap-2 min-w-0">
              <h1 className="text-[17px] sm:text-[18px] font-bold tracking-[-0.03em] text-[var(--t-g900)] whitespace-nowrap truncate">
                {GAME_NAME} 관리자
              </h1>
              <span className="hidden md:inline text-[12px] font-medium text-[var(--t-g500)] whitespace-nowrap tabular-nums">
                v{GAME_VERSION}
              </span>
            </div>
            <div className="hidden sm:block">
              <AdminConsoleNav active="feedback" />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              data-testid="admin-refresh-btn"
              disabled={loading}
              onClick={triggerReload}
              className="min-h-[40px] px-3 rounded-xl bg-[var(--t-card)] border border-[var(--t-g200)] text-[13px] font-semibold text-[var(--t-g700)] hover:bg-[var(--t-g100)] inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer t-tap disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">새로고침</span>
            </button>
            <button
              type="button"
              data-testid="admin-logout-btn"
              disabled={loggingOut}
              onClick={() => void handleLogout()}
              className="min-h-[40px] px-3 rounded-xl bg-[var(--t-card)] border border-[var(--t-g200)] text-[13px] font-semibold text-[var(--t-g700)] hover:text-[var(--t-up)] hover:border-[var(--t-up)]/40 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer t-tap disabled:opacity-50"
            >
              {loggingOut ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              <span>로그아웃</span>
            </button>
          </div>

          <div className="w-full sm:hidden pt-1">
            <AdminConsoleNav active="feedback" />
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-5 sm:py-6 space-y-5">
        {/* 상태별 요약 카운트 스트립 */}
        <section
          aria-label="상태별 요약"
          className="grid grid-cols-2 sm:grid-cols-5 gap-2.5"
        >
          {summaryItems.map((card) => {
            const active = statusFilter === card.key;
            return (
              <button
                key={card.key}
                type="button"
                data-testid={`summary-count-${card.key}`}
                onClick={() => handleChangeStatusFilter(card.key)}
                className={`p-4 rounded-[18px] text-left border transition cursor-pointer t-tap ${
                  active
                    ? 'bg-[var(--t-card)] border-[var(--t-accent)] ring-1 ring-[var(--t-accent)]/30'
                    : 'bg-[var(--t-card)] border-[var(--t-g200)] hover:border-[var(--t-g400)]'
                }`}
              >
                <p className="text-[12px] font-semibold text-[var(--t-g500)]">
                  {card.label}
                </p>
                <p
                  className={`mt-1 text-[24px] font-bold tracking-[-0.03em] tabular-nums ${card.toneClass}`}
                >
                  {card.value.toLocaleString()}
                </p>
              </button>
            );
          })}
        </section>

        {/* 필터 바 (제보 유형 + 제보 상태) */}
        <section
          aria-label="피드백 필터"
          className="bg-[var(--t-card)] border border-[var(--t-g200)] rounded-[20px] p-4 space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <span className="text-[12px] font-bold text-[var(--t-g500)] sm:w-16 shrink-0">
              제보 유형
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                data-testid="filter-type-all"
                onClick={() => handleChangeTypeFilter('all')}
                className={`min-h-[36px] px-3 rounded-xl text-[13px] font-semibold whitespace-nowrap transition cursor-pointer ${
                  typeFilter === 'all'
                    ? 'bg-[var(--t-g900)] text-[var(--t-card)]'
                    : 'bg-[var(--t-g100)] text-[var(--t-g700)] hover:bg-[var(--t-g200)]'
                }`}
              >
                전체
              </button>
              {FEEDBACK_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  data-testid={`filter-type-${opt.value}`}
                  onClick={() => handleChangeTypeFilter(opt.value)}
                  className={`min-h-[36px] px-3 rounded-xl text-[13px] font-semibold whitespace-nowrap transition cursor-pointer ${
                    typeFilter === opt.value
                      ? 'bg-[var(--t-g900)] text-[var(--t-card)]'
                      : 'bg-[var(--t-g100)] text-[var(--t-g700)] hover:bg-[var(--t-g200)]'
                  }`}
                >
                  {TYPE_SHORT_MAP[opt.value]}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--t-g100)] flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <span className="text-[12px] font-bold text-[var(--t-g500)] sm:w-16 shrink-0">
              처리 상태
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                data-testid="filter-status-all"
                onClick={() => handleChangeStatusFilter('all')}
                className={`min-h-[36px] px-3 rounded-xl text-[13px] font-semibold whitespace-nowrap transition cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-[var(--t-accent)] text-white'
                    : 'bg-[var(--t-g100)] text-[var(--t-g700)] hover:bg-[var(--t-g200)]'
                }`}
              >
                전체
              </button>
              {FEEDBACK_STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  data-testid={`filter-status-${opt.value}`}
                  onClick={() => handleChangeStatusFilter(opt.value)}
                  className={`min-h-[36px] px-3 rounded-xl text-[13px] font-semibold whitespace-nowrap transition cursor-pointer ${
                    statusFilter === opt.value
                      ? 'bg-[var(--t-accent)] text-white'
                      : 'bg-[var(--t-g100)] text-[var(--t-g700)] hover:bg-[var(--t-g200)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 메인 2단 마스터-디테일 영역 */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* 왼쪽: 피드백 목록 */}
          <div className="lg:col-span-7 bg-[var(--t-card)] border border-[var(--t-g200)] rounded-[20px] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[var(--t-g100)] flex items-center justify-between gap-2">
              <span className="text-[13px] font-bold text-[var(--t-g800)]">
                피드백 목록
              </span>
              <span className="text-[12px] font-medium text-[var(--t-g500)] tabular-nums">
                조회 {totalFiltered.toLocaleString()}건
              </span>
            </div>

            {errorMessage && (
              <div
                role="alert"
                data-testid="admin-list-error"
                className="m-4 p-4 rounded-2xl bg-[var(--t-up-soft)] text-[var(--t-up)] space-y-2"
              >
                <p className="text-[13px] font-semibold">{errorMessage}</p>
                <button
                  type="button"
                  onClick={triggerReload}
                  className="text-[12px] font-bold underline cursor-pointer"
                >
                  다시 불러오기
                </button>
              </div>
            )}

            {loading ? (
              <div className="divide-y divide-[var(--t-g100)]" aria-busy="true">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-4 sm:px-5 space-y-2.5 animate-pulse">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-14 rounded-md bg-[var(--t-g100)]" />
                      <div className="h-5 w-16 rounded-md bg-[var(--t-g100)]" />
                      <div className="h-4 w-24 rounded bg-[var(--t-g100)] ml-auto" />
                    </div>
                    <div className="h-5 w-3/4 rounded bg-[var(--t-g100)]" />
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div
                data-testid="admin-empty-state"
                className="py-16 px-6 text-center space-y-2"
              >
                <div className="w-11 h-11 mx-auto rounded-2xl bg-[var(--t-g100)] text-[var(--t-g400)] flex items-center justify-center">
                  <Inbox className="w-5 h-5" />
                </div>
                <p className="text-[15px] font-bold text-[var(--t-g800)]">
                  조건에 맞는 피드백이 없습니다
                </p>
                <p className="text-[13px] text-[var(--t-g500)]">
                  필터를 초기화하거나 새로고침해 최신 제보를 확인해 보세요.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--t-g100)]" data-testid="admin-feedback-list">
                {items.map((item) => {
                  const isSelected = selectedId === item.id;
                  const statusStyle =
                    STATUS_STYLE_MAP[item.status] || STATUS_STYLE_MAP.received;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        data-testid={`feedback-row-${item.id}`}
                        onClick={() => handleSelectItem(item)}
                        className={`w-full text-left px-4 sm:px-5 py-4 transition cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--t-accent-soft)]/70'
                            : 'hover:bg-[var(--t-g50)]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap ${statusStyle.bg} ${statusStyle.text}`}
                            >
                              {FEEDBACK_STATUS_LABELS[item.status] || item.status}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[var(--t-g100)] text-[var(--t-g700)] whitespace-nowrap">
                              {TYPE_SHORT_MAP[item.type] || item.type}
                            </span>
                            {item.game_version && (
                              <span className="text-[11px] font-medium text-[var(--t-g500)] tabular-nums whitespace-nowrap">
                                v{item.game_version}
                              </span>
                            )}
                          </div>
                          <span className="text-[12px] text-[var(--t-g500)] tabular-nums shrink-0">
                            {formatFeedbackDateKst(item.created_at)}
                          </span>
                        </div>

                        <p className="text-[14px] font-bold text-[var(--t-g900)] leading-snug line-clamp-1">
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-[12px] text-[var(--t-g600)] line-clamp-1">
                          {item.content}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* 페이지네이션 */}
            {totalFiltered > PAGE_SIZE && (
              <div className="px-5 py-3 border-t border-[var(--t-g100)] flex items-center justify-between gap-2">
                <span className="text-[12px] text-[var(--t-g500)] tabular-nums">
                  {currentPage} / {totalPages} 페이지
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={offset === 0 || loading}
                    onClick={() => handleChangeOffset(Math.max(0, offset - PAGE_SIZE))}
                    className="min-h-[36px] px-2.5 rounded-lg bg-[var(--t-g100)] text-[12px] font-semibold text-[var(--t-g700)] inline-flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    이전
                  </button>
                  <button
                    type="button"
                    disabled={offset + PAGE_SIZE >= totalFiltered || loading}
                    onClick={() => handleChangeOffset(offset + PAGE_SIZE)}
                    className="min-h-[36px] px-2.5 rounded-lg bg-[var(--t-g100)] text-[12px] font-semibold text-[var(--t-g700)] inline-flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  >
                    다음
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 오른쪽: 데스크톱 고정 상세 패널 */}
          <aside className="hidden lg:block lg:col-span-5 lg:sticky lg:top-[84px]">
            <div
              data-testid="admin-detail-panel"
              className="bg-[var(--t-card)] border border-[var(--t-g200)] rounded-[20px] p-5"
            >
              {selectedItem ? (
                <FeedbackDetailBody
                  key={`${selectedItem.id}-${selectedItem.status}-${selectedItem.admin_note ?? ''}`}
                  item={selectedItem}
                  saving={saving}
                  onSave={(nextStatus, nextNote) =>
                    void handleSaveDetail(nextStatus, nextNote)
                  }
                />
              ) : (
                <div className="py-16 text-center space-y-1.5">
                  <p className="text-[14px] font-bold text-[var(--t-g700)]">
                    피드백을 선택해 주세요
                  </p>
                  <p className="text-[12px] text-[var(--t-g500)]">
                    목록에서 항목을 클릭하면 상세 내용과 게임 환경을 확인하고 상태를 변경할 수 있습니다.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </section>
      </main>

      {/* 모바일/태블릿 상세 모달 */}
      <Modal
        open={mobileDetailOpen && Boolean(selectedItem)}
        title="피드백 상세"
        onClose={saving ? undefined : () => setMobileDetailOpen(false)}
        testId="admin-detail-modal"
      >
        {selectedItem && (
          <FeedbackDetailBody
            key={`mobile-${selectedItem.id}-${selectedItem.status}-${selectedItem.admin_note ?? ''}`}
            item={selectedItem}
            saving={saving}
            onSave={(nextStatus, nextNote) =>
              void handleSaveDetail(nextStatus, nextNote)
            }
          />
        )}
      </Modal>
    </div>
  );
}
