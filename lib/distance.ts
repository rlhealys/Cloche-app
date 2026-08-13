export function haversineDistanceMiles(
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

// Section 4.4 MVP approach: straight-line distance converted to an estimated
// drive time via an assumed average city speed — an approximation, not a
// real routing engine. Swapping in a real directions/ETA API is post-MVP.
const ASSUMED_AVERAGE_SPEED_MPH = 30;

export function estimateMinutesAway(distanceMiles: number): number {
  return Math.round((distanceMiles / ASSUMED_AVERAGE_SPEED_MPH) * 60);
}
