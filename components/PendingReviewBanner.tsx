"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  prunePendingReviews,
  removePendingReview,
  type PendingReviewEntry,
} from "@/lib/pendingReviews";
import { getMenuItemName, upvoteMenuItem } from "@/lib/queries";

// Surfaces the oldest still-pending "how was it" entry (upvotes-8) — never
// more than one at a time — and wires its two actions (upvotes-9).
export default function PendingReviewBanner() {
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

  // 👍: writes a vote (subject to the same (menu_item_id, user_id) unique
  // constraint as the double-tap path from upvotes-1/3 — a dish already
  // upvoted via double-tap just hits that constraint here too and is
  // swallowed the same way) and removes the entry from the queue.
  const handleGood = useCallback(() => {
    if (!banner) return;
    upvoteMenuItem(banner.entry.itemId).catch((error) => console.error(error));
    removePendingReview(banner.entry);
    bannerActiveRef.current = false;
    setBanner(null);
  }, [banner]);

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
        <button type="button" aria-label="Good" onClick={handleGood} className="p-1">
          👍
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
