import { supabase } from "./supabase";
import type { ConfirmedMenuItem, SortMode } from "@/types";

// Distance can't be ordered at the DB level (it depends on the caller's
// live position, not a stored column), so candidates are pulled in bulk
// and sorted here. Replaced by lib/distance.ts once that lands (Step 13).
function haversineDistanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function getFeedItems(
  sort: SortMode,
  userLat: number,
  userLng: number,
  offset: number,
  limit: number
): Promise<ConfirmedMenuItem[]> {
  if (sort === "distance") {
    const { data, error } = await supabase
      .from("confirmed_menu_items")
      .select("*")
      .limit(500);

    if (error) throw error;

    const sorted = (data ?? []).sort(
      (a, b) =>
        haversineDistanceMiles(userLat, userLng, a.lat, a.lng) -
        haversineDistanceMiles(userLat, userLng, b.lat, b.lng)
    );

    return sorted.slice(offset, offset + limit);
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
