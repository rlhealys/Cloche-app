"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import EmptyState from "@/components/EmptyState";
import LoadingIndicator from "@/components/LoadingIndicator";
import { searchMenuItems } from "@/lib/queries";
import type { ConfirmedMenuItem } from "@/types";

// search-3: how long to wait after the user stops typing before firing a
// query — short enough to feel live, long enough not to fire on every
// keystroke.
const SEARCH_DEBOUNCE_MS = 300;

// search-6: navigates to the restaurant's existing menu screen.
function RestaurantResultRow({ item }: { item: ConfirmedMenuItem }) {
  return (
    <Link
      href={`/restaurant/${item.restaurant_id}?from=search`}
      className="flex w-full items-center gap-4 py-4 text-left transition-colors hover:text-accent"
    >
      {item.hero_image_url && (
        <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-sm border border-ink/10">
          <Image
            src={item.hero_image_url}
            alt=""
            fill
            sizes="56px"
            className="object-cover"
          />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="font-display block truncate text-lg font-semibold tracking-tight">
          {item.restaurant_name}
        </span>
        <span className="font-body block truncate text-sm text-ink/70">{item.address}</span>
      </span>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 shrink-0 text-ink/30"
        aria-hidden="true"
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  );
}

// search-7: navigates to the Menu Item Detail Screen.
function MenuItemResultRow({ item }: { item: ConfirmedMenuItem }) {
  return (
    <Link
      href={`/item/${item.id}`}
      className="flex w-full flex-col gap-1 py-4 text-left transition-colors hover:text-accent"
    >
      <span className="font-utility text-xs font-medium tracking-widest text-ink/50 uppercase">
        {item.restaurant_name}
        {item.category ? ` · ${item.category}` : ""}
      </span>
      <span className="flex items-baseline gap-2">
        <span className="font-display text-lg font-medium tracking-tight">{item.name}</span>
        {item.price !== null && (
          <>
            <span className="flex-1 border-b border-dotted border-ink/30" />
            <span className="font-utility text-sm font-medium tracking-wide text-accent">
              ≈${item.price.toFixed(2)}
            </span>
          </>
        )}
      </span>
    </Link>
  );
}

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // The URL is the source of truth for the initial query — read once on
  // mount so a query already encoded in the URL (e.g. arriving here via
  // browser back-navigation to /search?q=...) is restored immediately
  // instead of starting blank.
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [restaurants, setRestaurants] = useState<ConfirmedMenuItem[]>([]);
  const [menuItems, setMenuItems] = useState<ConfirmedMenuItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  // True once a search has actually resolved (vs. still debouncing/in
  // flight) — gates the "no results" message so it can't flash before the
  // first fetch for a query has had a chance to come back.
  const [hasSearched, setHasSearched] = useState(false);
  // search-4: chain dedup needs the user's real position to pick the nearest
  // location, same as Feed's own geolocation fix — null until resolved, no
  // dummy/placeholder coordinate used in the meantime.
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Bumped on every query/coords change so a slow, now-stale request can
  // recognize it's no longer current and skip applying its results —
  // otherwise a fast edit followed by a slower-resolving earlier request
  // could overwrite fresher results with stale ones.
  const requestIdRef = useRef(0);
  // True only for the query restored from the URL on mount — makes that one
  // search fire immediately instead of waiting out the debounce, since it's
  // already a settled term, not something still being typed. Never true for
  // the user's own typing, not even their first keystroke.
  const skipNextDebounceRef = useRef(query.trim() !== "");

  // Keeps the URL's `q` param in sync with the current query — via
  // replace(), not push(), so typing doesn't spam the browser history with
  // one entry per keystroke. This is what lets browser back-navigation land
  // on a /search URL that already encodes the query being returned to.
  const updateUrlQuery = useCallback(
    (trimmed: string) => {
      const params = new URLSearchParams();
      if (trimmed) params.set("q", trimmed);
      const queryString = params.toString();
      router.replace(queryString ? `/search?${queryString}` : "/search", { scroll: false });
    },
    [router]
  );

  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => {
        // Denied or unavailable — search simply stays unable to run until a
        // fix arrives, same as Feed's handling.
      }
    );
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    // An empty query is cleared synchronously by handleQueryChange below, so
    // there's nothing left for this debounced fetch to do. Without real
    // coordinates yet, chain dedup has no distance to rank by, so search
    // waits rather than running undeduped.
    if (!trimmed || !coords) return;

    const requestId = ++requestIdRef.current;
    const { lat, lng } = coords;
    const delay = skipNextDebounceRef.current ? 0 : SEARCH_DEBOUNCE_MS;
    skipNextDebounceRef.current = false;

    const timeoutId = window.setTimeout(async () => {
      updateUrlQuery(trimmed);
      setIsSearching(true);
      try {
        const results = await searchMenuItems(trimmed, lat, lng);
        if (requestIdRef.current !== requestId) return;
        setRestaurants(results.restaurants);
        setMenuItems(results.menuItems);
        setHasSearched(true);
      } catch (error) {
        console.error(error);
        if (requestIdRef.current === requestId) {
          setRestaurants([]);
          setMenuItems([]);
          setHasSearched(true);
        }
      } finally {
        if (requestIdRef.current === requestId) setIsSearching(false);
      }
    }, delay);

    return () => window.clearTimeout(timeoutId);
  }, [query, coords, updateUrlQuery]);

  // Clearing the input clears results (and the URL's `q` param) immediately
  // rather than waiting out the debounce — a direct state update from the
  // event that caused it, not something that belongs in the effect above.
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    if (!value.trim()) {
      requestIdRef.current += 1;
      setRestaurants([]);
      setMenuItems([]);
      setIsSearching(false);
      setHasSearched(false);
      updateUrlQuery("");
    }
  };

  const trimmedQuery = query.trim();
  const showNoResults =
    trimmedQuery !== "" &&
    hasSearched &&
    !isSearching &&
    restaurants.length === 0 &&
    menuItems.length === 0;

  return (
    <main className="min-h-dvh bg-parchment text-ink">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-ink/10 bg-parchment/95 px-6 py-4 backdrop-blur-sm">
        <Link
          href="/"
          aria-label="Back to feed"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink/70 transition-colors hover:text-accent"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>

        <input
          type="text"
          name="q"
          value={query}
          onChange={handleQueryChange}
          placeholder="Search dishes, restaurants, categories"
          autoFocus
          autoComplete="off"
          className="font-body w-full rounded-full border border-ink/15 bg-white/60 px-5 py-2.5 text-base text-ink placeholder:text-ink/40 focus:border-accent focus:outline-none"
        />
      </div>

      {trimmedQuery !== "" && (
        <div className="mx-auto max-w-2xl px-6 py-6">
          {isSearching && (
            <div className="flex justify-center py-6">
              <LoadingIndicator />
            </div>
          )}

          {restaurants.length > 0 && (
            <section>
              <h2 className="font-utility text-xs font-medium tracking-widest text-ink/70 uppercase">
                Restaurants
              </h2>
              <div className="mt-2 divide-y divide-ink/10">
                {restaurants.map((item) => (
                  <RestaurantResultRow key={item.restaurant_id} item={item} />
                ))}
              </div>
            </section>
          )}

          {menuItems.length > 0 && (
            <section className="mt-8 first:mt-0">
              <h2 className="font-utility text-xs font-medium tracking-widest text-ink/70 uppercase">
                Menu Items
              </h2>
              <div className="mt-2 divide-y divide-ink/10">
                {menuItems.map((item) => (
                  <MenuItemResultRow key={item.id} item={item} />
                ))}
              </div>
            </section>
          )}

          {showNoResults && (
            <div className="flex justify-center py-6">
              <EmptyState message={`No matches for "${trimmedQuery}".`} />
            </div>
          )}
        </div>
      )}
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh w-full items-center justify-center bg-parchment">
          <LoadingIndicator />
        </main>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
