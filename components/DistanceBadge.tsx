import { estimateMinutesAway, haversineDistanceMiles } from "@/lib/distance";

export default function DistanceBadge({
  userLat,
  userLng,
  lat,
  lng,
}: {
  userLat: number;
  userLng: number;
  lat: number;
  lng: number;
}) {
  const distanceMiles = haversineDistanceMiles(userLat, userLng, lat, lng);
  const minutes = estimateMinutesAway(distanceMiles);

  return (
    <div className="font-utility absolute bottom-10 left-1/2 inline-flex w-fit -translate-x-1/2 items-center gap-2.5 rounded-full border border-ink/15 bg-parchment px-5 py-2.5 text-sm tracking-wide text-ink/70 uppercase shadow-sm">
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
      <span>{minutes} min</span>
    </div>
  );
}
