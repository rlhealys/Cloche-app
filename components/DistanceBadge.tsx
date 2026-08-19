import { estimateMinutesAway, haversineDistanceMiles } from "@/lib/distance";
import { appendPendingReview } from "@/lib/pendingReviews";

// No origin param — Google Maps uses the device's own current location as
// the starting point.
function buildDirectionsUrl(lat: number, lng: number, placeId: string | null): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${lat},${lng}`,
  });
  if (placeId) params.set("destination_place_id", placeId);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export default function DistanceBadge({
  userLat,
  userLng,
  lat,
  lng,
  placeId = null,
  itemId,
  restaurantId,
  restaurantName,
}: {
  userLat: number;
  userLng: number;
  lat: number;
  lng: number;
  placeId?: string | null;
  itemId: string;
  restaurantId?: string;
  restaurantName?: string;
}) {
  const distanceMiles = haversineDistanceMiles(userLat, userLng, lat, lng);
  const minutes = estimateMinutesAway(distanceMiles);
  const directionsUrl = buildDirectionsUrl(lat, lng, placeId);

  // TEMP DEBUG — remove after distance bug investigation
  console.log("[DEBUG DISTANCE][DistanceBadge]", {
    restaurantId,
    restaurantName,
    userLat,
    userLng,
    restaurantLat: lat,
    restaurantLng: lng,
    rawDistanceMiles: distanceMiles,
    finalMinutes: minutes,
  });

  return (
    <a
      href={directionsUrl}
      onClick={(e) => {
        e.stopPropagation();
        appendPendingReview(itemId).catch((error) => console.error(error));
      }}
      className="glass-chip-accent font-utility absolute bottom-10 left-1/2 inline-flex w-fit -translate-x-1/2 items-center gap-2.5 rounded-full px-5 py-2.5 text-sm font-semibold tracking-wide text-accent uppercase transition-shadow hover:shadow-lg"
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
        <path d="M5 17h14M5 17a2 2 0 1 0 4 0M5 17a2 2 0 1 1 4 0M15 17a2 2 0 1 0 4 0M15 17a2 2 0 1 1 4 0M5 17V9l2-4h10l2 4v8" />
      </svg>
      <span>Get Directions</span>
      <span className="text-ink/40">·</span>
      <span className="whitespace-nowrap">≈ {minutes} min</span>
    </a>
  );
}
