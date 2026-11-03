import { safePublicUrl } from "@/lib/public-url";

function isSafePublicUrl(rawUrl) {
  return Boolean(safePublicUrl(rawUrl));
}

function sanitizePublicEmail(rawEmail) {
  if (!rawEmail || typeof rawEmail !== "string") return "";
  const cleaned = rawEmail.replace(/^mailto:/i, "").split("?")[0].trim().toLowerCase();
  if (!cleaned || cleaned.length > 160 || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,12}$/i.test(cleaned)) {
    return "";
  }
  if (/^(noreply|no-reply|donotreply)/i.test(cleaned) || /@(example|test|domain|email)\./i.test(cleaned)) {
    return "";
  }
  return cleaned;
}

function sanitizePublicPhone(rawPhone) {
  if (!rawPhone || typeof rawPhone !== "string") return "";
  const cleaned = rawPhone.replace(/^tel:/i, "").replace(/\s+/g, " ").trim();
  const digits = cleaned.replace(/\D/g, "");
  if (cleaned.length > 40 || digits.length < 7 || digits.length > 15 || !/^[+\d()\s.\-xextEXT]+$/.test(cleaned)) {
    return "";
  }
  return cleaned;
}

function normalizeBizTokens(text = "") {
  const stop = new Set([
    "the", "and", "for", "with", "llc", "inc", "ltd", "corp", "co",
    "de", "del", "la", "el", "los", "las", "en", "y", "s.a", "sa",
  ]);
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !stop.has(t));
}

function isSameLocalBusiness(nameA = "", nameB = "") {
  const cleanA = normalizeBizTokens(nameA).join(" ");
  const cleanB = normalizeBizTokens(nameB).join(" ");
  if (!cleanA || !cleanB) return false;
  if (cleanA === cleanB || cleanA.includes(cleanB) || cleanB.includes(cleanA)) {
    return true;
  }
  const tokensA = normalizeBizTokens(nameA).filter((t) => t.length >= 3);
  const tokensB = new Set(normalizeBizTokens(nameB).filter((t) => t.length >= 3));
  if (!tokensA.length || !tokensB.size) return false;
  const shared = tokensA.filter((t) => tokensB.has(t));
  return shared.length >= Math.min(2, tokensA.length, tokensB.size);
}

// Live display & bounded search helper for Google Maps Places API
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

async function lookupPublicContactsViaWeb(base44, businesses = [], locationQuery = "") {
  const invokeLlm = base44?.asServiceRole?.integrations?.Core?.InvokeLLM;
  if (typeof invokeLlm !== "function" || businesses.length === 0) return new Map();

  const targets = businesses.slice(0, 12).map((b) => ({
    name: String(b.name || "").slice(0, 140),
    address: String(b.address || locationQuery || "").slice(0, 180),
  }));

  try {
    const res = await Promise.race([
      invokeLlm({
        model: "gemini_3_flash",
        add_context_from_internet: true,
        prompt: `Find the official public website URL, public business contact email, and public business phone number for each local business listed below in ${locationQuery}.
Return ONLY publicly published business contact details. Never invent or guess emails, phone numbers, or websites; use "" when not publicly available.
BEGIN_BUSINESSES
${JSON.stringify(targets)}
END_BUSINESSES`,
        response_json_schema: {
          type: "object",
          properties: {
            contacts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  website_url: { type: "string" },
                  public_email: { type: "string" },
                  public_phone: { type: "string" },
                },
                required: ["name"],
              },
            },
          },
          required: ["contacts"],
        },
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Contact lookup timeout")), 10000)),
    ]);

    const map = new Map();
    for (const item of res?.contacts || []) {
      if (!item?.name) continue;
      map.set(item.name.trim().toLowerCase(), {
        website_url: isSafePublicUrl(item.website_url) ? item.website_url.trim() : "",
        public_email: sanitizePublicEmail(item.public_email),
        public_phone: sanitizePublicPhone(item.public_phone),
      });
    }
    return map;
  } catch {
    return new Map();
  }
}

/**
 * Links AI-discovered opportunities with their matching Google Places venue info
 * (finding the venue on Google Places if not already in localPlaces), and enriches
 * both AI opportunities and Google Places listings with publicly available contact info.
 */
export async function correlateAndEnrichWithGooglePlaces(
  base44,
  { opportunities = [], localPlaces = [], businessCategory = "", locationQuery = "" }
) {
  const enrichedOpps = opportunities.map((o) => ({ ...o }));
  const enrichedPlaces = localPlaces.map((p) => ({
    ...p,
    category: p.category || businessCategory || "",
    location: p.location || locationQuery || "",
    website_url: p.website_url || "",
    public_email: p.public_email || "",
    public_phone: p.public_phone || "",
  }));

  // 1. Match AI opportunities against already-retrieved localPlaces
  const unmatchedOpps = [];
  for (const opp of enrichedOpps) {
    const match = enrichedPlaces.find((p) => isSameLocalBusiness(opp.business_name, p.name));
    if (match) {
      opp.place_id = match.placeId || "";
      opp.place_name = match.name || "";
      opp.place_address = match.address || "";
      opp.place_url = match.url || "";
      opp.place_business_status = match.businessStatus || "OPERATIONAL";
      match.matched_opportunity_name = opp.business_name;
      match.signal_type = opp.signal_type || "";
      match.signal_summary = opp.signal_summary || "";
      if (opp.website_url && !match.website_url) match.website_url = opp.website_url;
      if (opp.public_email && !match.public_email) match.public_email = opp.public_email;
      if (opp.public_phone && !match.public_phone) match.public_phone = opp.public_phone;
    } else {
      unmatchedOpps.push(opp);
    }
  }

  // 2. For AI opportunities not yet matched, look up the exact local venue on Google Places
  if (unmatchedOpps.length > 0 && base44?.asServiceRole?.connectors?.callApi) {
    await Promise.allSettled(
      unmatchedOpps.slice(0, 8).map(async (opp) => {
        const res = await searchGoogleLocalBusinesses(base44, {
          businessCategory: opp.business_name,
          locationQuery: opp.location || locationQuery,
          maxResults: 1,
        });
        const candidatePlace = res?.places?.[0];
        if (candidatePlace && isSameLocalBusiness(opp.business_name, candidatePlace.name)) {
          opp.place_id = candidatePlace.placeId || "";
          opp.place_name = candidatePlace.name || "";
          opp.place_address = candidatePlace.address || "";
          opp.place_url = candidatePlace.url || "";
          opp.place_business_status = candidatePlace.businessStatus || "OPERATIONAL";
        }
      })
    );
  }

  // 3. Enrich missing public contact details (website, email, phone) for Places & AI opportunities
  const needsContactLookup = [];
  for (const opp of enrichedOpps) {
    if (!opp.public_email || !opp.public_phone || !opp.website_url) {
      needsContactLookup.push({ name: opp.business_name, address: opp.place_address || opp.location });
    }
  }
  for (const pl of enrichedPlaces) {
    if (!pl.public_email || !pl.public_phone || !pl.website_url) {
      needsContactLookup.push({ name: pl.name, address: pl.address || locationQuery });
    }
  }

  if (needsContactLookup.length > 0) {
    const contactMap = await lookupPublicContactsViaWeb(base44, needsContactLookup, locationQuery);
    if (contactMap.size > 0) {
      for (const opp of enrichedOpps) {
        const found =
          contactMap.get(String(opp.business_name || "").trim().toLowerCase()) ||
          Array.from(contactMap.entries()).find(([k]) => isSameLocalBusiness(opp.business_name, k))?.[1];
        if (found) {
          if (!opp.website_url && found.website_url) opp.website_url = found.website_url;
          if (!opp.public_email && found.public_email) opp.public_email = found.public_email;
          if (!opp.public_phone && found.public_phone) opp.public_phone = found.public_phone;
        }
      }
      for (const pl of enrichedPlaces) {
        const found =
          contactMap.get(String(pl.name || "").trim().toLowerCase()) ||
          Array.from(contactMap.entries()).find(([k]) => isSameLocalBusiness(pl.name, k))?.[1];
        if (found) {
          if (!pl.website_url && found.website_url) pl.website_url = found.website_url;
          if (!pl.public_email && found.public_email) pl.public_email = found.public_email;
          if (!pl.public_phone && found.public_phone) pl.public_phone = found.public_phone;
        }
      }
    }
  }

  // Sync any newly discovered contact details between matched AI opportunities and localPlaces
  for (const opp of enrichedOpps) {
    const match = enrichedPlaces.find(
      (p) => (opp.place_id && p.placeId === opp.place_id) || isSameLocalBusiness(opp.business_name, p.name)
    );
    if (match) {
      if (opp.website_url && !match.website_url) match.website_url = opp.website_url;
      if (opp.public_email && !match.public_email) match.public_email = opp.public_email;
      if (opp.public_phone && !match.public_phone) match.public_phone = opp.public_phone;
      if (match.website_url && !opp.website_url) opp.website_url = match.website_url;
      if (match.public_email && !opp.public_email) opp.public_email = match.public_email;
      if (match.public_phone && !opp.public_phone) opp.public_phone = match.public_phone;
    }
  }

  return {
    opportunities: enrichedOpps,
    localPlaces: enrichedPlaces,
  };
}