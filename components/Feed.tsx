"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FeedCard from "./FeedCard";
import LoadingIndicator from "./LoadingIndicator";
import EmptyState from "./EmptyState";
import TopNavBar from "./TopNavBar";
import Sidebar from "./Sidebar";
import { getFeedItems } from "@/lib/queries";
import type { ConfirmedMenuItem, SortMode } from "@/types";

// Matches Section 5.1's infinite-scroll batch size.
const BATCH_SIZE = 20;
// Start loading the next batch this many cards before the end, so the
// fetch has time to land before the user actually reaches it.
const PREFETCH_THRESHOLD = 3;

export default function Feed({ sort, seed }: { sort: SortMode; seed: number }) {
  // Real device coordinates only — null until navigator.geolocation resolves.
  // There is no placeholder/dummy value here: nothing is fetched or rendered
  // until a real fix is available (see render logic below).
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  // null = no batch fetched yet; [] = fetched, but genuinely no results.
  const [items, setItems] = useState<ConfirmedMenuItem[] | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

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

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current || !coordsRef.current) return;
    loadingRef.current = true;
    setIsLoadingMore(true);
    setLoadMoreFailed(false);

    const offset = offsetRef.current;
    const { lat, lng } = coordsRef.current;

    try {
      const next = await getFeedItems(sort, lat, lng, offset, BATCH_SIZE, seed);

      offsetRef.current = offset + next.length;
      hasMoreRef.current = next.length === BATCH_SIZE;

      setItems((prev) => [...(prev ?? []), ...next]);
    } catch (error) {
      // Leave offsetRef/hasMoreRef untouched so the same batch can be retried.
      console.error(error);
      setLoadMoreFailed(true);
    } finally {
      loadingRef.current = false;
      setIsLoadingMore(false);
    }
  }, [sort, seed]);

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

  // Scroll-snap must live on the actual scrolling element for Safari to tie
  // its native toolbar auto-hide to it. Previously that was an inner h-dvh
  // div with its own overflow-y-scroll, which kept the document itself from
  // ever overflowing/scrolling — invisible to that heuristic. Scoped to this
  // component's lifecycle (not globals.css/layout.tsx) since /restaurant/[id]
  // shares the same html/body and must stay a plain, non-snapping scroll.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("snap-y", "snap-mandatory", "overscroll-y-contain");
    return () => {
      root.classList.remove("snap-y", "snap-mandatory", "overscroll-y-contain");
    };
  }, []);

  // Even with 100dvh (already in use on the snap sections below), Safari can
  // still show a brief offset/glitch while its toolbar animates in/out — the
  // dvh recalculation lags a frame or two behind the live visual viewport,
  // only catching up once the scroll-snap settles. Tracking
  // window.visualViewport directly and driving a CSS var from it lets the
  // section height follow the real-time viewport through that transition
  // instead of waiting on a reflow. Falls back to 100dvh (see className
  // below) wherever visualViewport isn't available.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const updateHeight = () => {
      document.documentElement.style.setProperty("--app-vh", `${viewport.height}px`);
    };

    updateHeight();
    viewport.addEventListener("resize", updateHeight);
    return () => viewport.removeEventListener("resize", updateHeight);
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

  if (!coords || items === null) {
    return (
      <main className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-parchment px-8">
        <TopNavBar
          menuOpen={isSidebarOpen}
          onMenuClick={() => setIsSidebarOpen((v) => !v)}
          filterOpen={isFilterOpen}
          onFilterClick={() => setIsFilterOpen((v) => !v)}
          searchOpen={isSearchOpen}
          onSearchClick={() => setIsSearchOpen((v) => !v)}
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
          menuOpen={isSidebarOpen}
          onMenuClick={() => setIsSidebarOpen((v) => !v)}
          filterOpen={isFilterOpen}
          onFilterClick={() => setIsFilterOpen((v) => !v)}
          searchOpen={isSearchOpen}
          onSearchClick={() => setIsSearchOpen((v) => !v)}
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
    <main className="w-full bg-parchment">
      <TopNavBar
        menuOpen={isSidebarOpen}
        onMenuClick={() => setIsSidebarOpen((v) => !v)}
        filterOpen={isFilterOpen}
        onFilterClick={() => setIsFilterOpen((v) => !v)}
        searchOpen={isSearchOpen}
        onSearchClick={() => setIsSearchOpen((v) => !v)}
      />
      <Sidebar
        open={isSidebarOpen}
        coords={coords}
        itemCount={items.length}
        onClose={() => setIsSidebarOpen(false)}
      />
      {items.map((item, index) => (
        <section
          key={item.id}
          className="relative h-[var(--app-vh,100dvh)] w-full snap-start snap-always"
        >
          <FeedCard item={item} userLat={coords.lat} userLng={coords.lng} />
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
