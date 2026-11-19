'use client';

import React, { useMemo, useState } from 'react';
import { Heart } from 'lucide-react';
import { buildSeasonReactionFeed, ReactionTone } from '../../engine/fanReactionEngine';
import { CareerState, SeasonBoxScore } from '../../types/game';

function getToneStyle(tone: ReactionTone): string {
  switch (tone) {
    case 'HYPE':
      return 'bg-[var(--t-accent-soft)] text-[var(--t-accent-ink)]';
    case 'SHOCK':
      return 'bg-[var(--t-gold-soft)] text-[var(--t-gold)]';
    case 'CRITIC':
      return 'bg-[var(--t-down-soft)] text-[var(--t-down)]';
    case 'EXPECT':
    default:
      return 'bg-[var(--t-g100)] text-[var(--t-g600)]';
  }
}

export function FanReactionFeed({
  career,
  season,
}: {
  career: CareerState;
  season: SeasonBoxScore;
}) {
  const bundle = useMemo(
    () => buildSeasonReactionFeed(career, season),
    [career, season]
  );
  const [likedIds, setLikedIds] = useState<Record<string, boolean>>({});

  const toggleLike = (id: string) => {
    setLikedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div data-testid="fan-reaction-feed" className="space-y-4">
      {/* 언론 1면 헤드라인 */}
      <div className="p-4 rounded-2xl bg-[var(--t-g100)] space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-[12px]">
          <span className="font-bold text-[var(--t-accent-ink)]">
            {bundle.outlet}
          </span>
          <span className="font-medium text-[var(--t-g500)] tabular-nums">
            {season.year}시즌 · {season.playoffResult || `정규 ${season.teamRank}위`}
          </span>
        </div>
        <h3 className="text-[16px] font-bold tracking-[-0.02em] text-[var(--t-g900)] leading-snug">
          {bundle.headline}
        </h3>
      </div>

      {/* 팬 커뮤니티 댓글 피드 */}
      <div className="space-y-1">
        <div className="flex items-center justify-between pb-1">
          <span className="text-[13px] font-bold text-[var(--t-g600)]">
            팬 반응
          </span>
          <span className="text-[12px] text-[var(--t-g400)] tabular-nums">
            댓글 {bundle.comments.length}
          </span>
        </div>

        <div className="divide-y divide-[var(--t-g100)]">
          {bundle.comments.map((comment) => {
            const isLiked = Boolean(likedIds[comment.id]);
            const likesCount = comment.baseLikes + (isLiked ? 1 : 0);

            return (
              <div
                key={comment.id}
                className="py-3 flex items-start gap-3"
              >
                <div className="w-9 h-9 rounded-full bg-[var(--t-g100)] text-[var(--t-g700)] font-bold text-[13px] flex items-center justify-center shrink-0">
                  {comment.initial}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[13px] font-bold text-[var(--t-g900)] truncate">
                        {comment.nickname}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${getToneStyle(
                          comment.tone
                        )}`}
                      >
                        {comment.toneLabel}
                      </span>
                    </div>
                    <span className="text-[11px] text-[var(--t-g400)] shrink-0">
                      {comment.timeAgo}
                    </span>
                  </div>

                  <p className="text-[13px] text-[var(--t-g700)] leading-relaxed">
                    {comment.text}
                  </p>

                  <div className="pt-0.5">
                    <button
                      type="button"
                      onClick={() => toggleLike(comment.id)}
                      aria-pressed={isLiked}
                      className={`inline-flex items-center gap-1 text-[12px] font-semibold tabular-nums cursor-pointer t-tap ${
                        isLiked
                          ? 'text-[var(--t-up)]'
                          : 'text-[var(--t-g400)] hover:text-[var(--t-g700)]'
                      }`}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`}
                      />
                      <span>{likesCount}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
