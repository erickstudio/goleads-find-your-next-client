// Live display only: never save Places content into lead entities, CSVs, or browser storage.
export async function searchGoogleLocalBusinesses(base44, { businessCategory, locationQuery, maxResults = 5 }) {
  const connector = base44?.asServiceRole?.connectors;
  if (!connector?.callApi) return { status: "unavailable", places: [] };
  let timeout;
  try {
    const response = await Promise.race([
      connector.callApi("google_maps", {
        method: "POST", host: "places", path: "/v1/places:searchText",
        query: { fields: "places.id,places.displayName,places.formattedAddress,places.businessStatus,places.googleMapsUri,places.attributions" },
        body: { textQuery: `${businessCategory} in ${locationQuery}`, pageSize: Math.min(20, Math.max(1, maxResults)) },
      }),
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error("Places timeout")), 12000); }),
    ]);
    const payload = response?.data || response;
    if (!payload || payload.error || (response?.status >= 400)) return { status: "unavailable", places: [] };
    const seen = new Set();
    const places = (payload.places || []).filter((p) => p.id && p.displayName?.text && !seen.has(p.id) && seen.add(p.id))
      .slice(0, Math.min(20, Math.max(1, maxResults))).map((p) => ({
        placeId: p.id, name: String(p.displayName.text), address: String(p.formattedAddress || ""), businessStatus: p.businessStatus || "",
        url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.displayName.text)}&query_place_id=${encodeURIComponent(p.id)}`,
        attributions: (p.attributions || []).map((a) => ({ provider: String(a.provider || ""), uri: /^https:\/\//.test(a.providerUri || "") ? a.providerUri : "" })),
      }));
    return { status: "ok", places };
  } catch { return { status: "unavailable", places: [] }; }
  finally { clearTimeout(timeout); }
}

