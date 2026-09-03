import type { Coordinates } from "../../core/types.js";

const EARTH_RADIUS_METERS = 6371000;

/** Distância em linha reta entre dois pontos. Usada só pelos adapters offline. */
export function haversineDistanceMeters(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

/** Fatores usados para aproximar distância/tempo rodados a partir da linha reta. */
export const OFFLINE_ROAD_FACTOR = 1.3;
export const OFFLINE_AVG_SPEED_KMH = 25;
