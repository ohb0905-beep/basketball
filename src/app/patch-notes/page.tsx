import type { Metadata } from 'next';
import { LegalDocumentLayout } from '../../components/legal/LegalDocumentLayout';
import { MarkPatchNotesSeen } from '../../components/legal/MarkPatchNotesSeen';
import { GAME_NAME } from '../../config/appMeta';
import {
  BALANCE_DIRECTION_LABELS,
  LATEST_PATCH_NOTE,
  PATCH_NOTES,
} from '../../data/patchNotes';

export const metadata: Metadata = {
  title: `패치노트 · ${GAME_NAME}`,
  description: `${GAME_NAME}(Road to MVP) 버전별 업데이트 안내`,
};

function formatDate(date: string): string {
  return date.replaceAll('-', '.');
}

export default function PatchNotesPage() {
  return (
    <LegalDocumentLayout
      title="패치노트"
      updatedAt={formatDate(LATEST_PATCH_NOTE.date)}
      updatedAtLabel="최근 업데이트"
      currentPath="/patch-notes"
    >
      <MarkPatchNotesSeen />
      {PATCH_NOTES.map((note) => (
        <section
          key={note.version}
          id={`v${note.version}`}
          data-testid={`patch-note-${note.version}`}
          className="space-y-3 border-b border-[var(--t-g100)] pb-6 last:border-b-0 last:pb-0"
        >
          <div className="space-y-1">
            <p className="text-[12px] font-medium text-[var(--t-g500)] tabular-nums">
              v{note.version} · {formatDate(note.date)}
            </p>
            <h2 className="text-[16px] font-bold text-[var(--t-g900)]">
              {note.title}
            </h2>
            <p>{note.summary}</p>
          </div>

          {note.highlights.length > 0 && (
            <ul className="list-disc pl-5 space-y-1">
              {note.highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          {note.balance && note.balance.length > 0 && (
            <div className="space-y-1.5">
              <h3 className="text-[14px] font-bold text-[var(--t-g900)]">밸런스</h3>
              <ul className="space-y-1">
                {note.balance.map((change) => (
                  <li key={`${change.target}-${change.detail}`}>
                    <strong className="text-[var(--t-g900)]">{change.target}</strong>{' '}
                    <span className="text-[12px] font-bold text-[var(--t-accent-ink)]">
                      {BALANCE_DIRECTION_LABELS[change.direction]}
                    </span>
                    <span className="block">{change.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {note.fixes && note.fixes.length > 0 && (
            <div className="space-y-1.5">
              <h3 className="text-[14px] font-bold text-[var(--t-g900)]">버그 수정</h3>
              <ul className="list-disc pl-5 space-y-1">
                {note.fixes.map((fix) => (
                  <li key={fix}>{fix}</li>
                ))}
              </ul>
            </div>
          )}

          {note.saveImpact && (
            <p className="rounded-[12px] bg-[var(--t-accent-soft)] px-3 py-2 text-[13px] text-[var(--t-accent-ink)]">
              <strong>기존 세이브 안내</strong> {note.saveImpact}
            </p>
          )}
        </section>
      ))}
    </LegalDocumentLayout>
  );
}
