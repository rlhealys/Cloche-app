"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FeedCard from "./FeedCard";
import LoadingIndicator from "./LoadingIndicator";
import { getFeedItems } from "@/lib/queries";
import type { ConfirmedMenuItem, SortMode } from "@/types";

// Matches Section 5.1's infinite-scroll batch size.
const BATCH_SIZE = 20;
// Start loading the next batch this many cards before the end, so the
// fetch has time to land before the user actually reaches it.
const PREFETCH_THRESHOLD = 3;

export default function Feed({
  initialItems,
  sort,
  userLat,
  userLng,
  seed,
}: {
  initialItems: ConfirmedMenuItem[];
  sort: SortMode;
  userLat: number;
  userLng: number;
  seed: number;
}) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialItems.length === BATCH_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  // Tracks the effective location (placeholder until real geolocation
  // resolves) as state, not just the ref below, so DistanceBadge re-renders
  // with real distances once it's available.
  const [userLocation, setUserLocation] = useState({ lat: userLat, lng: userLng });

  // Refs, not state, so loadMore always reads live values instead of a
  // snapshot captured in a stale closure — a concurrent/duplicate observer
  // firing (e.g. React Strict Mode's dev double-invoke, or a fast re-scroll)
  // must not be able to re-request an offset that's already in flight or done.
  const offsetRef = useRef(initialItems.length);
  const hasMoreRef = useRef(hasMore);
  const loadingRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  // Starts at the server-provided placeholder; updated once real geolocation
  // resolves. A ref (not state) so pagination fetches always read the live
  // value without needing loadMore to be recreated when location changes.
  const coordsRef = useRef({ lat: userLat, lng: userLng });

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    setIsLoadingMore(true);
    setLoadMoreFailed(false);

    const offset = offsetRef.current;
    const { lat, lng } = coordsRef.current;

    try {
      const next = await getFeedItems(sort, lat, lng, offset, BATCH_SIZE, seed);

      offsetRef.current = offset + next.length;
      hasMoreRef.current = next.length === BATCH_SIZE;

      setItems((prev) => [...prev, ...next]);
      setHasMore(hasMoreRef.current);
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

  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        coordsRef.current = { lat, lng };
        setUserLocation({ lat, lng });

        // Location just changed from the placeholder — re-fetch from the
        // top so distance tiering reflects where the device actually is.
        loadingRef.current = true;
        try {
          const fresh = await getFeedItems(sort, lat, lng, 0, BATCH_SIZE, seed);
          offsetRef.current = fresh.length;
          hasMoreRef.current = fresh.length === BATCH_SIZE;
          setItems(fresh);
          setHasMore(hasMoreRef.current);
        } catch (error) {
          // Keep whatever's already on screen (the placeholder-based batch)
          // rather than clearing it out over a background refresh failure.
          console.error(error);
        } finally {
          loadingRef.current = false;
        }
      },
      () => {
        // Denied or unavailable — coordsRef/userLocation are simply never
        // updated, so the feed keeps using the last known/placeholder
        // location, per spec. Nothing else to do here.
      }
    );
  }, [sort, seed]);

  return (
    <main className="h-dvh w-full snap-y snap-mandatory overflow-y-scroll overscroll-y-contain bg-parchment">
      {items.map((item, index) => (
        <section key={item.id} className="relative h-dvh w-full snap-start snap-always">
          <FeedCard item={item} userLat={userLocation.lat} userLng={userLocation.lng} />
          {index === items.length - PREFETCH_THRESHOLD && (
            <div ref={sentinelRef} className="pointer-events-none absolute bottom-0 h-px w-px" />
          )}
        </section>
      ))}
      <div className="fixed top-4 right-4 z-50 flex flex-col items-end gap-2">
        <div className="font-utility rounded-full border border-ink/15 bg-parchment/95 px-3 py-1.5 text-xs tracking-widest text-ink/70 uppercase shadow-sm">
          {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
        </div>
        <div className="font-utility rounded-full border border-ink/15 bg-parchment/95 px-3 py-1.5 text-xs tracking-widest text-ink/70 uppercase shadow-sm">
          {items.length} loaded
        </div>
      </div>

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
