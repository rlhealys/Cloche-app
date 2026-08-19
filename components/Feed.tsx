"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FeedCard from "./FeedCard";
import LoadingIndicator from "./LoadingIndicator";
import EmptyState from "./EmptyState";
import TopNavBar from "./TopNavBar";
import Sidebar from "./Sidebar";
import PendingReviewBanner from "./PendingReviewBanner";
import { generateFeedSeed, getFeedItems, getUserVotedItemIds } from "@/lib/queries";
import { prunePendingReviews } from "@/lib/pendingReviews";
import type { ConfirmedMenuItem, SortMode } from "@/types";

// Matches Section 5.1's infinite-scroll batch size.
const BATCH_SIZE = 20;
// Start loading the next batch this many cards before the end, so the
// fetch has time to land before the user actually reaches it.
const PREFETCH_THRESHOLD = 3;
// Standard reel-app (Instagram/TikTok-style) pull-to-refresh distance — how
// far the finger must travel downward, while already pinned to the top of
// the feed, before the gesture counts as a refresh request rather than an
// incidental drag.
const PULL_TRIGGER_THRESHOLD_PX = 80;
// ui-refresh-5: minimum net scroll movement (in either direction) since the
// last recorded position before the nav bar toggles — filters out the
// sub-pixel jitter a snap-scroll settle can produce, so the bar doesn't
// flicker when the feed is effectively stationary.
const NAV_TOGGLE_SCROLL_THRESHOLD_PX = 12;

export default function Feed({ sort, seed }: { sort: SortMode; seed: number }) {
  // Real device coordinates only — null until navigator.geolocation resolves.
  // There is no placeholder/dummy value here: nothing is fetched or rendered
  // until a real fix is available (see render logic below).
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  // null = no batch fetched yet; [] = fetched, but genuinely no results.
  const [items, setItems] = useState<ConfirmedMenuItem[] | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  // Starts as the seed passed down from the page load, but a pull-to-refresh
  // (below) regenerates it — held in state rather than re-read from the
  // `seed` prop so paginated loadMore calls after a refresh keep using the
  // new shuffle instead of drifting back to the original one.
  const [activeSeed, setActiveSeed] = useState(seed);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // ui-refresh-5: whether the top nav bar is shown. Only ever flipped by
  // handleFeedScroll below — TopNavBar renders its own transform/opacity
  // transition off this, so nothing about card sizing/scroll-snap changes.
  const [isNavVisible, setIsNavVisible] = useState(true);
  // upvote-arrow-3: the single source of truth for which items the current
  // user has upvoted, seeded from the server on every page load below. The
  // on-card arrow, the double-tap gesture, and the pending-review banner
  // will all read from and update this in later steps (upvote-arrow-4/5/6),
  // so an upvote registered through any one of them stays in sync everywhere.
  const [upvotedItemIds, setUpvotedItemIds] = useState<Set<string>>(new Set());

  // Refs, not state, so loadMore always reads live values instead of a
  // snapshot captured in a stale closure — a concurrent/duplicate observer
  // firing (e.g. React Strict Mode's dev double-invoke, or a fast re-scroll)
  // must not be able to re-request an offset that's already in flight or done.
  const offsetRef = useRef(0);
  // Optimistic until the first fetch reports otherwise — this also covers
  // the very first (offset 0) fetch, since it's just loadMore called once
  // real coordinates are known.
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  // Mirrors `coords` state; only ever set from a real geolocation fix.
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  // ui-refresh-5: last scrollTop seen by handleFeedScroll, and the
  // requestAnimationFrame id used to throttle it to at most once per frame.
  const lastNavScrollTopRef = useRef(0);
  const navScrollRafRef = useRef<number | null>(null);

  // upvote-arrow-3: folds a newly-loaded page's voted item ids into the
  // shared set rather than replacing it, since loadMore's pages accumulate
  // (unlike `items`, which refreshFeed replaces outright, this only ever
  // grows — a stale id for an item no longer in `items` is harmless).
  const recordVotedItemIds = useCallback((votedIds: Set<string>) => {
    if (votedIds.size === 0) return;
    setUpvotedItemIds((prev) => new Set([...prev, ...votedIds]));
  }, []);

  // upvote-arrow-5: single point where any consumer of the shared state
  // (currently just the on-card arrow) reports a change, so the Set stays
  // the one source of truth every reader sees updated the same way.
  const setItemUpvoted = useCallback((itemId: string, nextUpvoted: boolean) => {
    setUpvotedItemIds((prev) => {
      if (prev.has(itemId) === nextUpvoted) return prev;
      const next = new Set(prev);
      if (nextUpvoted) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current || !coordsRef.current) return;
    loadingRef.current = true;
    setIsLoadingMore(true);
    setLoadMoreFailed(false);

    const offset = offsetRef.current;
    const { lat, lng } = coordsRef.current;

    try {
      const next = await getFeedItems(sort, lat, lng, offset, BATCH_SIZE, activeSeed);

      offsetRef.current = offset + next.length;
      hasMoreRef.current = next.length === BATCH_SIZE;

      setItems((prev) => [...(prev ?? []), ...next]);
      recordVotedItemIds(await getUserVotedItemIds(next.map((item) => item.id)));
    } catch (error) {
      // Leave offsetRef/hasMoreRef untouched so the same batch can be retried.
      console.error(error);
      setLoadMoreFailed(true);
    } finally {
      loadingRef.current = false;
      setIsLoadingMore(false);
    }
  }, [sort, activeSeed, recordVotedItemIds]);

  // Pull-to-refresh (see the touch handlers below): re-shuffles by drawing a
  // fresh seed and re-fetching page 1 from offset 0, replacing `items`
  // outright rather than appending. Shares `loadingRef` with loadMore so an
  // in-flight pagination fetch and a refresh can't race each other.
  const refreshFeed = useCallback(async () => {
    if (loadingRef.current || !coordsRef.current) return;
    loadingRef.current = true;
    setIsRefreshing(true);
    setLoadMoreFailed(false);

    const newSeed = generateFeedSeed();
    const { lat, lng } = coordsRef.current;

    try {
      const next = await getFeedItems(sort, lat, lng, 0, BATCH_SIZE, newSeed);

      offsetRef.current = next.length;
      hasMoreRef.current = next.length === BATCH_SIZE;
      setActiveSeed(newSeed);
      setItems(next);
      recordVotedItemIds(await getUserVotedItemIds(next.map((item) => item.id)));
    } catch (error) {
      console.error(error);
      setLoadMoreFailed(true);
    } finally {
      loadingRef.current = false;
      setIsRefreshing(false);
    }
  }, [sort, recordVotedItemIds]);

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      observerRef.current?.disconnect();
      if (!node) return;

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) loadMore();
      });
      observerRef.current.observe(node);
    },
    [loadMore]
  );

  // Detects the pull-to-refresh gesture: a downward drag while already at
  // the very top of the feed (scrollTop 0 — with every card sized h-dvh and
  // snap-start/snap-mandatory on the container, scrollTop 0 is exactly the
  // first card, so no separate "which card is visible" check is needed).
  // overscroll-y-contain on the scroll container (see className below)
  // blocks the native rubber-band bounce, so scrollTop stays pinned at 0 for
  // the whole gesture — a touch listener, not a scroll listener, is what
  // actually detects the pull.
  const touchStartYRef = useRef<number | null>(null);
  const pullTriggeredRef = useRef(false);

  const handleFeedTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    const atTop = e.currentTarget.scrollTop <= 0;
    touchStartYRef.current = atTop ? e.touches[0].clientY : null;
    pullTriggeredRef.current = false;
  };

  const handleFeedTouchMove = (e: React.TouchEvent<HTMLElement>) => {
    if (touchStartYRef.current === null || pullTriggeredRef.current) return;
    const deltaY = e.touches[0].clientY - touchStartYRef.current;
    if (deltaY > PULL_TRIGGER_THRESHOLD_PX) {
      pullTriggeredRef.current = true;
      refreshFeed();
    }
  };

  const handleFeedTouchEnd = () => {
    touchStartYRef.current = null;
    pullTriggeredRef.current = false;
  };

  // ui-refresh-5: shows/hides TopNavBar based on scroll direction within the
  // feed's own scroll container — an upward finger swipe (scrollTop
  // increasing) hides it, a downward swipe (scrollTop decreasing) restores
  // it. rAF-throttled to at most one direction check per animation frame
  // (native `scroll` events can fire far more often than that during a snap
  // animation), and gated behind NAV_TOGGLE_SCROLL_THRESHOLD_PX so small
  // jitter around a settled snap position doesn't flicker the bar. Reads
  // scrollTop off the event's own target only — no window/document scroll
  // and no visualViewport involvement, so this can't interact with the
  // native mobile browser toolbar.
  const handleFeedScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (navScrollRafRef.current !== null) return;

    navScrollRafRef.current = requestAnimationFrame(() => {
      navScrollRafRef.current = null;

      if (scrollTop <= 0) {
        setIsNavVisible(true);
      } else {
        const delta = scrollTop - lastNavScrollTopRef.current;
        if (delta > NAV_TOGGLE_SCROLL_THRESHOLD_PX) setIsNavVisible(false);
        else if (delta < -NAV_TOGGLE_SCROLL_THRESHOLD_PX) setIsNavVisible(true);
      }
      lastNavScrollTopRef.current = scrollTop;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (navScrollRafRef.current !== null) cancelAnimationFrame(navScrollRafRef.current);
    };
  }, []);

  // Request a real geolocation fix, then fetch the first batch against it.
  // On denial/timeout/unavailability, coordsRef/coords are simply never
  // set, so the render below stays on the loading state indefinitely —
  // there is no dummy coordinate to silently fall back to. (An explicit
  // denied/timeout message is a separate follow-up, not handled here.)
  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        coordsRef.current = { lat, lng };
        setCoords({ lat, lng });
        loadMore();
      },
      () => {
        // Denied or unavailable — intentionally left unhandled here.
      }
    );
  }, [loadMore]);

  // upvotes-7: prune the pendingReviews queue (age + soft cap) on every feed
  // mount — a fresh reload counts, since Feed remounts then — and again on
  // every return from backgrounding via visibilitychange, since a
  // backgrounded tab doesn't unmount/remount. Purely silent: no state here,
  // no banner for the discard (surfacing the queue is upvotes-8).
  useEffect(() => {
    prunePendingReviews();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") prunePendingReviews();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  if (!coords || items === null) {
    return (
      <main className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-parchment px-8">
        <TopNavBar
          navVisible={isNavVisible}
          menuOpen={isSidebarOpen}
          onMenuClick={() => setIsSidebarOpen((v) => !v)}
        />
        <Sidebar
          open={isSidebarOpen}
          coords={coords}
          itemCount={items?.length ?? null}
          onClose={() => setIsSidebarOpen(false)}
        />
        <LoadingIndicator />
        {loadMoreFailed && (
          <button
            onClick={loadMore}
            className="font-utility rounded-full border border-ink/15 bg-parchment/95 px-3 py-1.5 text-xs font-medium tracking-widest text-ink/70 uppercase shadow-sm transition-colors hover:text-accent"
          >
            Couldn&apos;t load the feed — tap to retry
          </button>
        )}
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="flex h-dvh w-full items-center justify-center bg-parchment px-8">
        <TopNavBar
          navVisible={isNavVisible}
          menuOpen={isSidebarOpen}
          onMenuClick={() => setIsSidebarOpen((v) => !v)}
        />
        <Sidebar
          open={isSidebarOpen}
          coords={coords}
          itemCount={items?.length ?? null}
          onClose={() => setIsSidebarOpen(false)}
        />
        <EmptyState message="No dishes to show yet — check back soon." />
      </main>
    );
  }

  return (
    <main
      className="h-dvh w-full snap-y snap-mandatory overflow-y-scroll overscroll-y-contain bg-parchment"
      onTouchStart={handleFeedTouchStart}
      onTouchMove={handleFeedTouchMove}
      onTouchEnd={handleFeedTouchEnd}
      onScroll={handleFeedScroll}
    >
      <TopNavBar
        navVisible={isNavVisible}
        menuOpen={isSidebarOpen}
        onMenuClick={() => setIsSidebarOpen((v) => !v)}
      />
      <Sidebar
        open={isSidebarOpen}
        coords={coords}
        itemCount={items.length}
        onClose={() => setIsSidebarOpen(false)}
      />
      <PendingReviewBanner onUpvotedChange={setItemUpvoted} />
      {isRefreshing && (
        <div className="fixed top-20 left-1/2 z-50 -translate-x-1/2 rounded-full border border-ink/15 bg-parchment/95 px-3 py-1.5 shadow-sm">
          <LoadingIndicator />
        </div>
      )}
      {items.map((item, index) => (
        <section key={item.id} className="relative h-dvh w-full snap-start snap-always">
          <FeedCard
            item={item}
            userLat={coords.lat}
            userLng={coords.lng}
            upvoted={upvotedItemIds.has(item.id)}
            onUpvotedChange={setItemUpvoted}
          />
          {index === items.length - PREFETCH_THRESHOLD && (
            <div ref={sentinelRef} className="pointer-events-none absolute bottom-0 h-px w-px" />
          )}
        </section>
      ))}

      {isLoadingMore && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-ink/15 bg-parchment/95 px-3 py-1.5 shadow-sm">
          <LoadingIndicator />
        </div>
      )}
      {loadMoreFailed && (
        <button
          onClick={loadMore}
          className="font-utility fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-ink/15 bg-parchment/95 px-3 py-1.5 text-xs font-medium tracking-widest text-ink/70 uppercase shadow-sm transition-colors hover:text-accent"
        >
          Couldn&apos;t load more — tap to retry
        </button>
      )}
    </main>
  );
}
