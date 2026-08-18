"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import DistanceBadge from "./DistanceBadge";
import { upvoteMenuItem } from "@/lib/queries";
import type { ConfirmedMenuItem } from "@/types";

// Two taps closer together than this count as one double-tap gesture,
// matching the standard reel-app (Instagram/TikTok-style) feel.
const DOUBLE_TAP_MAX_INTERVAL_MS = 300;

// upvotes-5: below this, upvote_count stays entirely invisible — no count,
// ratio, or any other rendering of the raw number, ever. At/above it, a
// single subtle "Crowd Favorite" badge appears instead (never the number
// itself). Deliberately low so it's achievable/testable at current traffic
// levels — revisit once real usage data exists.
const CROWD_FAVORITE_UPVOTE_THRESHOLD = 10;

export default function FeedCard({
  item,
  userLat,
  userLng,
}: {
  item: ConfirmedMenuItem;
  userLat: number;
  userLng: number;
}) {
  // burstId is bumped on every double-tap so the burst element remounts (via
  // `key`) and replays its animation even on rapid repeat double-taps;
  // burstActive controls whether it's mounted at all, cleared once the
  // animation finishes so the node doesn't linger in the DOM indefinitely.
  const [burstId, setBurstId] = useState(0);
  const [burstActive, setBurstActive] = useState(false);
  const lastTapRef = useRef(0);

  const isCrowdFavorite = item.upvote_count >= CROWD_FAVORITE_UPVOTE_THRESHOLD;

  const handleCardClick = useCallback(() => {
    const now = Date.now();
    const isDoubleTap = now - lastTapRef.current < DOUBLE_TAP_MAX_INTERVAL_MS;
    // Reset rather than update to `now` so a fast triple-tap can't chain
    // into a second upvote off the second+third taps.
    lastTapRef.current = isDoubleTap ? 0 : now;
    if (!isDoubleTap) return;

    // Optimistic and immediate — the burst plays regardless of the network
    // request's outcome, since this is meant to be a zero-friction, passive
    // gesture, not something the user waits on. Server-side enforcement (the
    // unique constraint from upvotes-1) is what actually decides whether the
    // vote counts; a repeat double-tap on an already-upvoted dish still
    // bursts, it just doesn't add a second row.
    setBurstId((id) => id + 1);
    setBurstActive(true);
    upvoteMenuItem(item.id).catch((error) => console.error(error));
  }, [item.id]);

  return (
    <article
      className="relative mx-auto flex h-full w-full max-w-md flex-col justify-center bg-parchment px-8 py-12 text-ink"
      onClick={handleCardClick}
    >
      <Link
        href={`/restaurant/${item.restaurant_id}`}
        onClick={(e) => e.stopPropagation()}
        className="mb-6 ml-auto flex w-fit items-center gap-3 text-ink/70 transition-colors hover:text-accent"
      >
        {item.hero_image_url && (
          <span className="relative h-24 w-24 shrink-0 -rotate-2 overflow-hidden rounded-sm border-4 border-ink/10 shadow-sm">
            <Image
              src={item.hero_image_url}
              alt=""
              fill
              sizes="96px"
              className="object-cover"
            />
          </span>
        )}
        <span className="font-utility inline-flex items-center gap-2 text-xs font-medium tracking-widest uppercase">
          {item.restaurant_name}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3 w-3 shrink-0"
            aria-hidden="true"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </span>
      </Link>

      <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight">
        {item.name}
      </h1>

      {(item.category || isCrowdFavorite) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {item.category && (
            <p className="glass-chip font-utility inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium tracking-widest text-ink/70 uppercase shadow-sm">
              {item.category}
            </p>
          )}
          {isCrowdFavorite && (
            <p className="glass-chip font-utility inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium tracking-widest text-accent uppercase shadow-sm">
              Crowd Favorite
            </p>
          )}
        </div>
      )}

      {item.description && (
        <p className="font-body mt-4 text-base leading-relaxed text-ink/70">
          {item.description}
        </p>
      )}

      {item.price !== null && (
        <div className="mt-6 flex items-baseline gap-2">
          <span className="flex-1 border-b border-dotted border-ink/40" />
          <span className="font-utility text-lg font-medium tracking-wide text-accent">
            ≈${item.price.toFixed(2)}
          </span>
        </div>
      )}

      <DistanceBadge
        userLat={userLat}
        userLng={userLng}
        lat={item.lat}
        lng={item.lng}
        placeId={item.place_id}
        itemId={item.id}
        restaurantId={item.restaurant_id}
        restaurantName={item.restaurant_name}
      />

      {burstActive && (
        <span
          key={burstId}
          onAnimationEnd={() => setBurstActive(false)}
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="text-accent animate-upvote-burst h-28 w-28 drop-shadow-sm"
            aria-hidden="true"
          >
            <path d="M12 21s-6.7-4.35-9.3-8.1C1 10.1 1.3 6.7 4 5.1c2.1-1.25 4.6-.6 6 1.15C11.4 4.5 13.9 3.85 16 5.1c2.7 1.6 3 5 1.3 7.8C18.7 16.65 12 21 12 21z" />
          </svg>
        </span>
      )}
    </article>
  );
}
