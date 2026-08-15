import Feed from "@/components/Feed";
import { generateFeedSeed } from "@/lib/queries";

// Seed must be generated per request, not baked in at build time, so a
// fresh page load gets a fresh shuffle.
export const dynamic = "force-dynamic";

export default function Home() {
  // Captured once here and passed to the client so subsequent paginated
  // fetches reuse it, keeping the tiered shuffle stable for this page load.
  const seed = generateFeedSeed();

  return <Feed sort="distance" seed={seed} />;
}
