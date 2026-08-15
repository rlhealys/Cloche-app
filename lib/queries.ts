import { supabase } from "./supabase";
import { haversineDistanceMiles } from "./distance";
import type { ConfirmedMenuItem, SortMode } from "@/types";

// Upper bound (miles) of each tier except the last, which is open-ended (50+).
const DISTANCE_TIER_BOUNDARIES_MILES = [5, 15, 30, 50];

function distanceTierIndex(distanceMiles: number): number {
  for (let i = 0; i < DISTANCE_TIER_BOUNDARIES_MILES.length; i++) {
    if (distanceMiles < DISTANCE_TIER_BOUNDARIES_MILES[i]) return i;
  }
  return DISTANCE_TIER_BOUNDARIES_MILES.length;
}

// Deterministic PRNG (mulberry32) so a shuffle can be reproduced from a seed —
// lets a later paginated call reuse the same seed to keep ordering stable
// across a session instead of re-shuffling on every request.
function mulberry32(seed: number): () => number {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithRandom<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// A caller that wants to reuse a shuffle across paginated calls (see the
// `seed` param below) should generate one with this and hold onto it,
// rather than let each call default to its own random seed.
export function generateFeedSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

export async function getFeedItems(
  sort: SortMode,
  userLat: number,
  userLng: number,
  offset: number,
  limit: number,
  // Pass the same seed across paginated calls within one page load to keep
  // the shuffle stable; omit it to get a fresh shuffle (e.g. on page load).
  seed: number = generateFeedSeed()
): Promise<ConfirmedMenuItem[]> {
  if (sort === "distance") {
    const { data, error } = await supabase
      .from("confirmed_menu_items")
      .select("*")
      .limit(500);

    if (error) throw error;

    const tiers: ConfirmedMenuItem[][] = Array.from(
      { length: DISTANCE_TIER_BOUNDARIES_MILES.length + 1 },
      () => []
    );
    for (const item of data ?? []) {
      const distance = haversineDistanceMiles(userLat, userLng, item.lat, item.lng);
      const tierIndex = distanceTierIndex(distance);

      // TEMP DEBUG — remove after distance bug investigation
      console.log("[DEBUG DISTANCE][getFeedItems tiering]", {
        restaurantId: item.restaurant_id,
        restaurantName: item.restaurant_name,
        userLat,
        userLng,
        restaurantLat: item.lat,
        restaurantLng: item.lng,
        rawDistanceMiles: distance,
        tierIndex,
      });

      tiers[tierIndex].push(item);
    }

    const random = mulberry32(seed);
    const ordered = tiers.flatMap((tier) => shuffleWithRandom(tier, random));

    return ordered.slice(offset, offset + limit);
  }

  const { data, error } = await supabase
    .from("confirmed_menu_items")
    .select("*")
    .order("price", { ascending: sort === "price_low", nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data ?? [];
}

export async function getRestaurantMenu(
  restaurantId: string
): Promise<ConfirmedMenuItem[]> {
  const { data, error } = await supabase
    .from("confirmed_menu_items")
    .select("*")
    .eq("restaurant_id", restaurantId);

  if (error) throw error;
  return data ?? [];
}
