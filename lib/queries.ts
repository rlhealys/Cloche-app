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

// Soft upvote weighting (upvotes-4): a dish with more upvotes gets a higher
// statistical chance of landing earlier within its own distance tier, but
// this is not a hard sort by upvote_count — a 0-upvote item can still land
// ahead of a heavily-upvoted one. log(1 + n) keeps the effect soft and
// diminishing rather than letting a runaway-popular dish dominate its tier.
// Coerces a missing/undefined count to 0 rather than propagating NaN — a
// stale confirmed_menu_items view missing the upvote_count column entirely
// (Postgres view columns freeze at creation time; adding a column to
// menu_items doesn't retroactively appear in a view defined with mi.* until
// the view is re-created — see Section 5.6 of cloche-overview.md) made every
// item's weight NaN, which silently collapsed the whole shuffle to the
// unshuffled input order regardless of seed. This keeps the shuffle correct
// even if that ever recurs, though the real fix is re-issuing the view.
function upvoteWeight(upvoteCount: number | null | undefined): number {
  return 1 + Math.log(1 + (upvoteCount ?? 0));
}

// Weighted shuffle without replacement (Efraimidis-Spirakis): each item
// draws a key = random()^(1/weight), then items are ordered by key
// descending. A higher weight pushes the key closer to 1 on average, so
// higher-weight items are more likely (not guaranteed) to sort earlier —
// exactly the "soft weighting" this step calls for, and it stays
// deterministic/reproducible from the same seeded `random`.
function weightedShuffleWithRandom<T>(
  items: T[],
  weightOf: (item: T) => number,
  random: () => number
): T[] {
  return items
    .map((item) => ({ item, key: Math.pow(random(), 1 / weightOf(item)) }))
    .sort((a, b) => b.key - a.key)
    .map(({ item }) => item);
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
    const ordered = tiers.flatMap((tier) =>
      weightedShuffleWithRandom(tier, (item) => upvoteWeight(item.upvote_count), random)
    );

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

// Double-tap upvoting (upvotes-3): fires on every double-tap, but only ever
// results in one row per (menu_item_id, user_id) — enforced server-side by
// the unique constraint from upvotes-1, not just by not-tapping-twice on the
// client. A repeat tap on an already-upvoted dish hits that constraint
// (Postgres code 23505) and is swallowed here rather than surfaced as an
// error, since a double-tap is passive/zero-friction and never needs to
// report "you already did this" back to the user.
export async function upvoteMenuItem(menuItemId: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return;

  const { error } = await supabase
    .from("votes")
    .insert({ menu_item_id: menuItemId, user_id: userId });

  if (error && error.code !== "23505") {
    throw error;
  }
}

// The only path that can undo an upvote (upvote-arrow-2) — a real deletion
// of the vote row, not a soft flag. The AFTER DELETE trigger from
// upvote-arrow-1 (decrement_upvote_count) is what actually decrements
// menu_items.upvote_count; this just removes the row that trigger watches.
export async function removeUpvote(menuItemId: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return;

  const { error } = await supabase
    .from("votes")
    .delete()
    .eq("menu_item_id", menuItemId)
    .eq("user_id", userId);

  if (error) throw error;
}

// Shared per-item upvoted-state tracking (upvote-arrow-3): given a page of
// item ids, returns the subset the current anonymous user has already
// voted on. Meant to be called once per loaded page so callers can seed
// their upvoted/unvoted state without a separate round trip per item.
export async function getUserVotedItemIds(menuItemIds: string[]): Promise<Set<string>> {
  if (menuItemIds.length === 0) return new Set();

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return new Set();

  const { data, error } = await supabase
    .from("votes")
    .select("menu_item_id")
    .eq("user_id", userId)
    .in("menu_item_id", menuItemIds);

  if (error) {
    console.error(error);
    return new Set();
  }

  return new Set((data ?? []).map((row) => row.menu_item_id as string));
}

// Looks up a dish's name for the post-directions review banner (upvotes-8).
// Returns null (rather than throwing) if the item's gone or no longer
// confirmed — a stale pendingReviews entry pointing at it should just not
// surface a banner, not break the feed.
export async function getMenuItemName(menuItemId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("confirmed_menu_items")
    .select("name")
    .eq("id", menuItemId)
    .maybeSingle();

  if (error) {
    console.error(error);
    return null;
  }
  return data?.name ?? null;
}

export async function getRestaurantMenu(
  restaurantId: string
): Promise<ConfirmedMenuItem[]> {
  const { data, error } = await supabase
    .from("confirmed_menu_items")
    .select("*")
    .eq("restaurant_id", restaurantId);

  // Returns the same empty-array "not found" shape a genuinely missing
  // restaurant already produces (rather than throwing), same convention as
  // getMenuItem/getMenuItemName — e.g. a malformed (non-UUID) id trips a
  // Postgres error here, which app/restaurant/[id]/page.tsx's existing
  // `items.length === 0` check should handle the same way it handles a
  // real not-found, not crash the page.
  if (error) {
    console.error(error);
    return [];
  }
  return data ?? [];
}

// search-7: fetches a single confirmed menu item for the Menu Item Detail
// Screen. Returns null (rather than throwing) if it's gone or no longer
// confirmed, same convention as getMenuItemName above.
export async function getMenuItem(menuItemId: string): Promise<ConfirmedMenuItem | null> {
  const { data, error } = await supabase
    .from("confirmed_menu_items")
    .select("*")
    .eq("id", menuItemId)
    .maybeSingle();

  if (error) {
    console.error(error);
    return null;
  }
  return data;
}

// search-3/4: the two grouped result sets the Search Screen renders —
// matching restaurants and matching menu items, each already chain-deduped
// down to the nearest location (search-4).
export type SearchResults = {
  restaurants: ConfirmedMenuItem[];
  menuItems: ConfirmedMenuItem[];
};

const SEARCH_RESULT_LIMIT = 50;

// PostgREST's `.or()` filter list is comma/parenthesis-delimited, so a
// literal comma or parenthesis in the search term would otherwise be parsed
// as filter-list syntax instead of part of the value — stripped outright,
// since a dish/restaurant/category search has no real need to match on them.
// `%`/`_` are ILIKE wildcards, so a literal one typed by the user is
// backslash-escaped rather than left to act as one.
function toIlikePattern(term: string): string {
  const sanitized = term.replace(/[,()]/g, "");
  const escaped = sanitized.replace(/[\\%_]/g, (char) => `\\${char}`);
  return `%${escaped}%`;
}

// search-4: collapses rows that share a `keyOf` chain key down to the single
// nearest one, by distance from the user's current position — used both for
// restaurants (keyed by restaurant_name, so a chain's several locations
// surface once) and for menu items (keyed by restaurant_name + dish name, so
// the same dish repeated across chain locations also surfaces once).
function nearestPerGroup<T extends ConfirmedMenuItem>(
  items: T[],
  keyOf: (item: T) => string,
  userLat: number,
  userLng: number
): T[] {
  const nearestByKey = new Map<string, { item: T; distanceMiles: number }>();

  for (const item of items) {
    const key = keyOf(item);
    const distanceMiles = haversineDistanceMiles(userLat, userLng, item.lat, item.lng);
    const existing = nearestByKey.get(key);
    if (!existing || distanceMiles < existing.distanceMiles) {
      nearestByKey.set(key, { item, distanceMiles });
    }
  }

  return [...nearestByKey.values()].map(({ item }) => item);
}

// Live search (search-3): a single confirmed_menu_items query matching the
// term against dish name, restaurant name, and category (case-insensitive,
// partial match via ILIKE), split into the two result groups by which
// field(s) actually matched — a row can contribute to both (e.g. a dish
// whose own name matches at a restaurant whose name also matches) — then
// each group is chain-deduped to its nearest location (search-4).
export async function searchMenuItems(
  query: string,
  userLat: number,
  userLng: number
): Promise<SearchResults> {
  const term = query.trim();
  const pattern = toIlikePattern(term);
  // Guards against a term that sanitizes down to nothing (e.g. "(),,,"),
  // which would otherwise become the match-everything pattern "%%".
  if (!term || pattern === "%%") return { restaurants: [], menuItems: [] };

  const { data, error } = await supabase
    .from("confirmed_menu_items")
    .select("*")
    .or(`name.ilike.${pattern},restaurant_name.ilike.${pattern},category.ilike.${pattern}`)
    .limit(SEARCH_RESULT_LIMIT);

  if (error) throw error;

  const lowerTerm = term.toLowerCase();
  const rows = data ?? [];

  const restaurantMatches = rows.filter((item) =>
    item.restaurant_name.toLowerCase().includes(lowerTerm)
  );
  const menuItemMatches = rows.filter(
    (item) =>
      item.name.toLowerCase().includes(lowerTerm) ||
      (item.category?.toLowerCase().includes(lowerTerm) ?? false)
  );

  return {
    restaurants: nearestPerGroup(
      restaurantMatches,
      (item) => item.restaurant_name,
      userLat,
      userLng
    ),
    // "::" joined so a restaurant_name/name pair can't collide with a
    // different pair that happens to concatenate to the same string.
    menuItems: nearestPerGroup(
      menuItemMatches,
      (item) => `${item.restaurant_name}::${item.name}`,
      userLat,
      userLng
    ),
  };
}
