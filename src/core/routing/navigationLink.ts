import type { Coordinates } from "../types.js";

/**
 * Link de navegação usando o esquema público de URLs do Google Maps
 * (https://developers.google.com/maps/documentation/urls/get-started#directions-action) —
 * não é uma API autenticada, é só um formato de URL documentado publicamente.
 */
export function buildNavigationLink(origin: Coordinates, orderedStops: Coordinates[]): string {
  if (orderedStops.length === 0) {
    throw new Error("Cannot build navigation link with zero stops");
  }

  const lastStop = orderedStops[orderedStops.length - 1]!;
  const waypoints = orderedStops.slice(0, -1);

  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.lat},${origin.lon}`,
    destination: `${lastStop.lat},${lastStop.lon}`,
    travelmode: "driving",
  });

  if (waypoints.length > 0) {
    params.set("waypoints", waypoints.map((w) => `${w.lat},${w.lon}`).join("|"));
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
