"use client";

import { useEffect, useState } from "react";
import BackToSearchButton from "./BackToSearchButton";
import FeedCard from "./FeedCard";
import LoadingIndicator from "./LoadingIndicator";
import { getUserVotedItemIds } from "@/lib/queries";
import type { ConfirmedMenuItem } from "@/types";

// search-7: reuses FeedCard as-is for the single-dish detail view — same
// visual design, same upvote arrow/double-tap gesture, same Get Directions
// badge. The only difference from the Feed Screen is the container: no
// scroll/snap wrapper and no pagination, since there's exactly one card and
// nothing to swipe to.
export default function MenuItemDetail({ item }: { item: ConfirmedMenuItem }) {
  // Real device coordinates only, same as Feed/Search — null until resolved,
  // no dummy/placeholder coordinate used in the meantime.
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [upvoted, setUpvoted] = useState(false);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => {
        // Denied or unavailable — stays on the loading state, same as
        // Feed/Search's handling.
      }
    );
  }, []);

  useEffect(() => {
    getUserVotedItemIds([item.id]).then((votedIds) => setUpvoted(votedIds.has(item.id)));
  }, [item.id]);

  if (!coords) {
    return (
      <main className="flex h-dvh w-full items-center justify-center bg-parchment">
        <BackToSearchButton />
        <LoadingIndicator />
      </main>
    );
  }

  return (
    <main className="h-dvh w-full overflow-hidden bg-parchment">
      <BackToSearchButton />
      <FeedCard
        item={item}
        userLat={coords.lat}
        userLng={coords.lng}
        upvoted={upvoted}
        onUpvotedChange={(_itemId, nextUpvoted) => setUpvoted(nextUpvoted)}
      />
    </main>
  );
}
