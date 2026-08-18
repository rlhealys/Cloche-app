"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  prunePendingReviews,
  removePendingReview,
  type PendingReviewEntry,
} from "@/lib/pendingReviews";
import { getMenuItemName, upvoteMenuItem } from "@/lib/queries";
import { UPVOTE_ARROW_PATH } from "./FeedCard";

// Surfaces the oldest still-pending "how was it" entry (upvotes-8) — never
// more than one at a time — and wires its two actions (upvotes-9).
export default function PendingReviewBanner({
  onUpvotedChange,
}: {
  // upvote-arrow-3's shared upvotedItemIds updater (see Feed.tsx's
  // setItemUpvoted) — called only after the vote is confirmed recorded, so
  // the on-card arrow fills in sync with reality (upvote-arrow-6).
  onUpvotedChange: (itemId: string, upvoted: boolean) => void;
}) {
  const [banner, setBanner] = useState<{ entry: PendingReviewEntry; dishName: string } | null>(
    null
  );
  // Mirrors `banner` synchronously (state updates aren't visible until the
  // next render) so a trigger firing while a banner is already showing, or
  // while a name lookup is still in flight, doesn't surface a second one on
  // top of it — only one banner shows at a time.
  const bannerActiveRef = useRef(false);
  const isMountedRef = useRef(true);

  const trySurfaceOldestPending = useCallback(async () => {
    if (bannerActiveRef.current) return;

    const queue = prunePendingReviews();

    // Walk oldest-first. A dish removed/unconfirmed since its "Get
    // Directions" tap resolves to a null name — that entry is discarded
    // entirely (same removal a normal dismiss would do, just with no
    // banner ever shown for it) so it can't sit stuck at the head of the
    // queue blocking every valid entry behind it; the next entry is tried
    // in its place.
    for (const entry of queue) {
      const dishName = await getMenuItemName(entry.itemId);
      if (!isMountedRef.current || bannerActiveRef.current) return;

      if (!dishName) {
        removePendingReview(entry);
        continue;
      }

      bannerActiveRef.current = true;
      setBanner({ entry, dishName });
      return;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    trySurfaceOldestPending();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") trySurfaceOldestPending();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      isMountedRef.current = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [trySurfaceOldestPending]);

  // Arrow (formerly 👍): writes a vote (subject to the same
  // (menu_item_id, user_id) unique constraint as the double-tap/arrow paths
  // from upvotes-1/3/upvote-arrow-5 — a dish already upvoted some other way
  // just hits that constraint here too and is swallowed the same way) and
  // removes the entry from the queue. The banner itself dismisses right
  // away; the shared upvotedItemIds Set only updates once the vote is
  // actually confirmed recorded, same pattern as the double-tap burst.
  const handleGood = useCallback(() => {
    if (!banner) return;
    const { itemId } = banner.entry;
    upvoteMenuItem(itemId)
      .then(() => onUpvotedChange(itemId, true))
      .catch((error) => console.error(error));
    removePendingReview(banner.entry);
    bannerActiveRef.current = false;
    setBanner(null);
  }, [banner, onUpvotedChange]);

  // ✕: removes the entry from the queue only — never writes to votes, never
  // touches upvote_count. A dismiss means "no data", not "disliked it", so
  // it must carry no signal at all, positive or negative.
  const handleDismiss = useCallback(() => {
    if (!banner) return;
    removePendingReview(banner.entry);
    bannerActiveRef.current = false;
    setBanner(null);
  }, [banner]);

  if (!banner) return null;

  return (
    <div
      role="status"
      className="glass-chip font-body fixed top-24 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-xs -translate-x-1/2 items-center justify-between gap-3 rounded-full py-2.5 pr-3 pl-4 text-sm text-ink shadow-sm"
    >
      <span className="truncate">How was {banner.dishName}?</span>
      <span className="flex shrink-0 items-center gap-2 text-lg leading-none">
        <button type="button" aria-label="Upvote" onClick={handleGood} className="p-1">
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="text-upvote h-5 w-5"
            aria-hidden="true"
          >
            <path d={UPVOTE_ARROW_PATH} />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={handleDismiss}
          className="p-1 text-ink/50 transition-colors hover:text-ink"
        >
          ✕
        </button>
      </span>
    </div>
  );
}
