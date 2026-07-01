// Best-effort geocoding of a visitor's city / postal code → lat/lng, so the
// Clinical Trials Finder can rank by real distance and tell the truth about
// whether anything sits within the requested radius. Free, no API key:
//   - postal codes → Zippopotam (api.zippopotam.us)
//   - place names  → Nominatim / OpenStreetMap
// Any failure returns null and the finder degrades to country-level ranking.

export type GeoPoint = { lat: number; lng: number };

// Country display name (as used in intakeOptions.COUNTRIES) → ISO-3166 alpha-2.
const ISO2: Record<string, string> = {
  "United States": "US",
  Canada: "CA",
  "United Kingdom": "GB",
  Ireland: "IE",
  Australia: "AU",
  "New Zealand": "NZ",
  Germany: "DE",
  France: "FR",
  Spain: "ES",
  Italy: "IT",
  Netherlands: "NL",
  Belgium: "BE",
  Switzerland: "CH",
  Austria: "AT",
  Portugal: "PT",
  Sweden: "SE",
  Norway: "NO",
  Denmark: "DK",
  Finland: "FI",
  Poland: "PL",
  Czechia: "CZ",
  Hungary: "HU",
  Greece: "GR",
  Turkey: "TR",
  Israel: "IL",
  "Saudi Arabia": "SA",
  "United Arab Emirates": "AE",
  Egypt: "EG",
  "South Africa": "ZA",
  India: "IN",
  Pakistan: "PK",
  China: "CN",
  Japan: "JP",
  "South Korea": "KR",
  Taiwan: "TW",
  "Hong Kong": "HK",
  Singapore: "SG",
  Malaysia: "MY",
  Thailand: "TH",
  Indonesia: "ID",
  Philippines: "PH",
  Vietnam: "VN",
  Brazil: "BR",
  Argentina: "AR",
  Chile: "CL",
  Colombia: "CO",
  Mexico: "MX",
  "Russian Federation": "RU",
  Ukraine: "UA",
  Romania: "RO",
};

async function fetchJson(url: string, headers?: Record<string, string>): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json", ...headers },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function geocodeLocation(
  country: string,
  query: string,
): Promise<GeoPoint | null> {
  const q = (query || "").trim();
  if (!q) return null;
  const cc = ISO2[country];
  const looksPostal = /\d/.test(q);

  // 1. Postal code via Zippopotam (needs a known country code).
  if (looksPostal && cc) {
    const r: any = await fetchJson(
      `https://api.zippopotam.us/${cc.toLowerCase()}/${encodeURIComponent(q.replace(/\s+/g, ""))}`,
    );
    const p = r?.places?.[0];
    const lat = p ? parseFloat(p.latitude) : NaN;
    const lng = p ? parseFloat(p.longitude) : NaN;
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  // 2. Place name (or postal fallback) via Nominatim.
  const term = country ? `${q}, ${country}` : q;
  const r: any = await fetchJson(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(term)}`,
    { "User-Agent": "RPHope-ClinicalTrialsFinder/1.0 (nonprofit; contact via rphope.org)" },
  );
  if (Array.isArray(r) && r[0]) {
    const lat = parseFloat(r[0].lat);
    const lng = parseFloat(r[0].lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// Haversine distance in kilometers.
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
