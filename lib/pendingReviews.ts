import { supabase } from "./supabase";

const PENDING_REVIEWS_KEY = "pendingReviews";

// upvotes-7: entries older than this are silently dropped on every prune —
// no banner or notification for the discard itself.
const PENDING_REVIEW_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// upvotes-7: soft cap on queue length — beyond this, the oldest unanswered
// entries are silently dropped rather than letting the queue grow
// unbounded. ~5-10 per spec; revisit if that range feels wrong in practice.
const PENDING_REVIEW_MAX_QUEUE_SIZE = 8;

export type PendingReviewEntry = {
  itemId: string;
  timestamp: number;
  userId: string;
};

function readPendingReviews(): PendingReviewEntry[] {
  try {
    const raw = window.localStorage.getItem(PENDING_REVIEWS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error(error);
    return [];
  }
}

function writePendingReviews(queue: PendingReviewEntry[]): void {
  window.localStorage.setItem(PENDING_REVIEWS_KEY, JSON.stringify(queue));
}

// Post-directions review queue (upvotes-6): a real array in localStorage,
// not a single overwritable flag, so every "Get Directions" tap across a
// session gets queued rather than the latest overwriting the rest.
export async function appendPendingReview(itemId: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return;

  const queue = readPendingReviews();
  queue.push({ itemId, timestamp: Date.now(), userId });
  writePendingReviews(queue);
}

// Removes one specific entry (matched by identity, not just itemId, since
// the same dish could in principle be queued twice in one session) — used
// both for a stale/unresolvable entry (PendingReviewBanner) and, later, for
// an answered/dismissed one (upvotes-9).
export function removePendingReview(entry: PendingReviewEntry): void {
  const queue = readPendingReviews();
  const next = queue.filter(
    (e) => e.itemId !== entry.itemId || e.timestamp !== entry.timestamp || e.userId !== entry.userId
  );
  if (next.length !== queue.length) writePendingReviews(next);
}

// Prunes entries older than 24h, then enforces the soft cap by keeping only
// the newest PENDING_REVIEW_MAX_QUEUE_SIZE of what's left (entries are
// appended oldest-first, so this drops the oldest first) — silently, no
// banner/notification for the discard. Meant to be called on every feed
// mount and every return-from-background (see Feed.tsx), not just once per
// session, so a queue built up over a long absence gets trimmed promptly.
export function prunePendingReviews(): PendingReviewEntry[] {
  const queue = readPendingReviews();
  const cutoff = Date.now() - PENDING_REVIEW_MAX_AGE_MS;
  const fresh = queue.filter((entry) => entry.timestamp >= cutoff);
  const capped = fresh.slice(-PENDING_REVIEW_MAX_QUEUE_SIZE);

  if (capped.length !== queue.length) {
    writePendingReviews(capped);
  }

  return capped;
}
