import EmptyState from "@/components/EmptyState";
import Feed from "@/components/Feed";
import { generateFeedSeed, getFeedItems } from "@/lib/queries";

// Query results change as the pipeline confirms new items — fetch per request.
export const dynamic = "force-dynamic";

// Placeholder until real geolocation is wired in (Step 12).
const DUMMY_USER_LAT = 29.7604;
const DUMMY_USER_LNG = -95.3698;

// Matches Section 5.1's infinite-scroll batch size.
const FEED_BATCH_SIZE = 20;

export default async function Home() {
  // Captured once here and passed to the client so subsequent paginated
  // fetches reuse it, keeping the tiered shuffle stable for this page load.
  const seed = generateFeedSeed();

  const items = await getFeedItems(
    "distance",
    DUMMY_USER_LAT,
    DUMMY_USER_LNG,
    0,
    FEED_BATCH_SIZE,
    seed
  );

  if (items.length === 0) {
    return (
      <main className="flex h-dvh w-full items-center justify-center bg-parchment px-8">
        <EmptyState message="No dishes to show yet — check back soon." />
      </main>
    );
  }

  return (
    <Feed
      initialItems={items}
      sort="distance"
      userLat={DUMMY_USER_LAT}
      userLng={DUMMY_USER_LNG}
      seed={seed}
    />
  );
}
